var passport = require("passport");
var FacebookStrategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken')
var Config = require('../../config');
var emailer = require("./emailer");
var util = require("./util");
var User = require("../db/user");


//==========================passport strategy============================
async function CreateUser(provider, profile){
	var newUser = {};
	newUser.provider = provider;
	if(profile.id) newUser.oauthID = profile.id;
	if(profile.emails){
		var email = profile.emails[0].value;
		newUser.signupEmail = email;
		newUser.contactEmail = email;
	}
	if(profile.password) newUser.password = profile.password;
	if(profile.name){
		var name = profile.name.givenName + ' ' + profile.name.familyName;
		newUser.signupName = name;
		newUser.name = name;
	}
	if(profile.signupName){
		newUser.signupName = profile.signupName;
		newUser.name = profile.signupName;
	}
	if(Config.defaultAdmin){
		if(Config.defaultAdmin.provider == provider && 
			Config.defaultAdmin.email == newUser.signupEmail){
			newUser.authType = "admin";
		}
	}
	newUser.photo = "/static/image/user-default.png";
	newUser.icon = "/static/image/user-default-icon.png";
	var user = await User.create(newUser);
	emailer.SendSignupConfirmEmail(user);
	return user;
}

passport.serializeUser(function(user, done) {
	done(null,user._id);
});

passport.deserializeUser(function(id, done) {
	User.findOne({_id:id}, {"__v":0,"password":0,"oauthID":0})
	.then(function(user){ done(null,user); })
	.catch(function(err){ done(err); });
});

function OAuthVerify(provider){
	return function(token, refreshToken, profile, done) {
		User.findOne({"provider": provider, "oauthID": profile.id})
		.then(function(user){
			return user || CreateUser(provider, profile);
		})
		.then(function(user){ done(null, user); })
		.catch(function(err){ done(err); });
	};
}

if(Config.facebookAuth.enable){
	passport.use(new FacebookStrategy({
		clientID        : Config.facebookAuth.clientID,
		clientSecret    : Config.facebookAuth.clientSecret,
		callbackURL     : Config.facebookAuth.callbackURL,
		profileFields: ['id', 'email', 'name']},
		OAuthVerify("facebook")
	));
}

if(Config.googleAuth.enable){
	passport.use(new GoogleStrategy({
		clientID        : Config.googleAuth.clientID,
		clientSecret    : Config.googleAuth.clientSecret,
		callbackURL     : Config.googleAuth.callbackURL},
		OAuthVerify("google")
	));
}

passport.use(new LocalStrategy({
    usernameField: "email",
    passwordField: "password"},
	function(email, password, done) {
		User.findOne({"provider": "local", "signupEmail": email})
		.then(async function(user){
			if(!user || !user.password) return done(null, false);
			var match = await bcrypt.compare(password, user.password);
			done(null, match ? user : false);
		})
		.catch(function(err){ done(err); });
	}
));


//==========================auth function============================
const saltRounds = 10;

var auth = {};

auth.Signup = function(req, res, next){
	var email = req.body.email;
	var password = req.body.password;
	var name = req.body.name;

	(async function(){
		var exist = await User.findOne({"provider": "local", "signupEmail": email});
		if(exist) return res.redirect('/login?message='+encodeURIComponent('帳號已存在'));
		var user = await CreateUser("local", {
			emails: [{value: email}],
			password: await bcrypt.hash(password, saltRounds),
			signupName: name
		});
		//直接login
		req.login(user, function(err) {
			if(err) return next(err);
			return res.redirect(util.RetrieveIntentUrl(req));
		});
	})().catch(next);
}

auth.ForgetPassword = function(req, res, next){
	var email = req.body.email;
	(async function(){
		var user = await User.findOne({"provider": "local", "signupEmail": email});
		if(!Config.elasticEmail.enable){
			return res.json({status: "fail", message: 'send email not enabled'});
		}
		if(user){
			var token = jwt.sign({id: user.id, email: user.signupEmail}, Config.jwt.secret, {
				expiresIn: "1h"
			});
			emailer.SendResetPasswordEmail(user,token);
		}
		// Same answer whether or not the account exists, so this endpoint cannot be
		// used to find out which emails are registered. It used to never respond
		// when the account did not exist.
		res.json({status: "ok", message: 'reset password email sent'});
	})().catch(next);
}

auth.ResetPassword = function(req, res, next){
	var password = req.body.password;
	var token = req.body.token;
	jwt.verify(token, Config.jwt.secret, function (err, decoded) {
		if(err){
			return res.json({status: "fail", message: 'invalid token'});
		}
		(async function(){
			var user = await User.findOne({_id: decoded.id});
			if(!user) return res.json({status: "fail", message: 'reset password fail'});
			var hash = await bcrypt.hash(password, saltRounds);
			await User.updateOne({_id: decoded.id}, {password: hash});
			res.json({status: "ok", message: 'reset password ok'});
		})().catch(next);
	});
}

auth.ChangePassword = function(req, res, next){
	if(!req.user) return res.json({status: "fail", message: 'not login'});
	var data = req.body.data || {};
	(async function(){
		var user = await User.findOne({_id: req.user._id});
		if(!user) return res.json({status: "fail", message: 'user not found'});
		if(user.provider != "local") return res.json({status: "fail", message: 'not local user'});
		var match = await bcrypt.compare(data.oldPassword || "", user.password);
		if(!match) return res.json({status: "fail", message: 'password not match'});
		var hash = await bcrypt.hash(data.newPassword, saltRounds);
		await User.updateOne({_id: user._id}, {password: hash});
		res.json({status: "ok", message: 'change password ok'});
	})().catch(next);
}

module.exports = auth;

var util = require("./util");
var User = require('../db/user');
var mongoose = require('mongoose');

var userController = {};

function Run(param, fn, failMessage){
	fn().then(function(result){
		param.succFunc(result);
	}).catch(function(err){
		console.log(err);
		param.failFunc({err: failMessage});
	});
}

userController.EditUserInfo = function(param){
	var modify = {};
	modify.name = param.body.name;
	modify.contactEmail = param.body.contactEmail;
	Run(param, async function(){
		await User.updateOne({"_id": param.userID}, modify);
		return modify;
	}, "edit user info fail");
};

userController.ChangeUserPhoto = function(param){
	var randomStr = "?rand="+Math.floor(Math.random()*100);
	var modify = {};
	modify.photo = param.photo+randomStr;
	modify.icon = param.icon+randomStr;
	Run(param, async function(){
		await User.updateOne({"_id": param.userID}, modify);
		return modify;
	}, "change user photo fail");
};

userController.ListUser = function(param){
	// Any logged-in user can search users (dataset masters pick members this way),
	// but only admins may see emails or list every account. Others search by name,
	// an exact email, or a user id, and get public fields back.
	var query = {};
	var or = [];
	if(param.keyword){
		var keyword = util.EscapeRegex(param.keyword);
		or.push({"name":{$regex: keyword}});
		if(param.isAdmin){
			or.push({"contactEmail":{$regex: keyword}});
		}
		else{
			or.push({"contactEmail":String(param.keyword)});
			or.push({"signupEmail":String(param.keyword)});
		}
		if(mongoose.Types.ObjectId.isValid(param.keyword)){
			or.push({"_id":new mongoose.Types.ObjectId(param.keyword)});
		}
		query["$or"] = or;
	}
	else if(!param.isAdmin){
		return param.succFunc({hasMore: false, user: []});
	}
	if(param.isAdmin && param.authType){
		query.authType = param.authType;
	}
	if(param.isAdmin && param.status){
		query.status = param.status;
	}
	var projection = param.isAdmin ? {"__v":0,"password":0,"oauthID":0} : {"name":1,"icon":1,"photo":1};
	var limit = 8;
	var skip = (param.page||0)*limit;
	Run(param, async function(){
		var user = await User.find(query,projection,{limit:limit+1, skip:skip});
		if(user.length > limit){
			return {hasMore: true, user: user.slice(0,-1)};
		}
		return {hasMore: false, user: user};
	}, "list user fail");
};

userController.ListName = function(param){
	if(!param.id) return param.failFunc({err:"no id"});
	var attr = {"name":1};
	if(param.user){	//登入才能看到別的使用者的照片和email
		attr.photo = 1;
		attr.contactEmail = 1;
	}
	Run(param, function(){
		return User.find({_id: {$in: param.id.split(",")}},attr);
	}, "list name fail");
};

userController.UpdateAuth = function(param){
	var update = {};
	if(param.authType){
		update.authType = param.authType;
	}
	if(param.status){
		update.status = param.status;
	}
	Run(param, async function(){
		await User.updateOne({_id: param.id},update);
		return {id: param.id};
	}, "update auth fail");
};

userController.DeleteUser = function(param){
	if(!param.user) return param.failFunc({err:"no user"});
	// Delete by _id. The old query used oauthID, which deserializeUser strips from
	// req.user, so for Google/Facebook users it became {provider} alone and could
	// delete a different account.
	Run(param, async function(){
		await User.deleteOne({_id: param.user._id});
	}, "delete user fail");
};

module.exports = userController;

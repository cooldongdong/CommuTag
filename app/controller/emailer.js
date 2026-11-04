// Sends the sign-up and password-reset emails over SMTP, so any provider works
// (Gmail / Google Workspace, Resend, Mailgun, SES...). It used to call the
// ElasticEmail HTTP API directly through the deprecated `request` package.
var nodemailer = require("nodemailer");
var ejs = require("ejs");
var Config = require("../../config");

var conf = Config.email || {};
var transport = conf.enable ? nodemailer.createTransport({
	host: conf.smtp.host,
	port: conf.smtp.port,
	secure: !!conf.smtp.secure,
	auth: {user: conf.smtp.user, pass: conf.smtp.pass}
}) : null;

var emailer = {};

async function Send(to, subject, template, data){
	if(!transport) return;
	try{
		var html = await ejs.renderFile(template, data);
		await transport.sendMail({
			from: {name: Config.siteName, address: conf.sender},
			to: to,
			subject: subject,
			html: html
		});
	}
	catch(err){
		console.log(err);
	}
}

emailer.SendSignupConfirmEmail = function(user){
	if(!user.signupEmail) return;
	Send(user.signupEmail, Config.siteName+" 註冊確認信", "view/email/signupConfirm.ejs", {
		user: user,
		hostname: Config.hostname,
		siteName: Config.siteName
	});
};

emailer.SendResetPasswordEmail = function(user, token){
	Send(user.signupEmail, Config.siteName+" 密碼重設", "view/email/resetPassword.ejs", {
		user: user,
		resetUrl: Config.hostname+"/login?reset=1&token="+token,
		siteName: Config.siteName
	});
};

module.exports = emailer;

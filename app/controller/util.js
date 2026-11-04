var Config = require('../../config');
var URL = require('url');
var csrfSync = require('csrf-sync').csrfSync;
var Dataset = require('../db/dataset');
var ImageModel = require("../db/imageSchema").ImageModel;

var util = {};

function FailDenied(message, message_query_param){
	return function(req, res) {
		var isAjax = req.xhr;
		if (isAjax) res.send({"status": "fail", "message": message});
		else res.redirect("/?message=" + encodeURIComponent(message_query_param));
	}
}

var PermissionDenied = FailDenied("permission denied", "權限不足");
var BlackListDenied = FailDenied("blacklist", "黑名單使用者無此權限");

util.StoreIntentUrl = function(req, res, next){
	if(req.query.intentUrl){
		req.session.intentUrl = decodeURIComponent(req.query.intentUrl);
	}
	next();
}

util.RetrieveIntentUrl = function(req){
	if(req.session.intentUrl){
		var url = req.session.intentUrl;
		var urlParse = URL.parse(url);
		delete req.session.intentUrl;
		//avoid explicit specify hostname
		if(!urlParse.hostname) return url;
		else return "/";
	}
	else return "/";
};

util.RandomInt = function(max) {
	return Math.floor(Math.random() * Math.floor(max));
};

// User input goes into $regex in several queries; escape it so it matches literally
// and cannot be used to send a catastrophic-backtracking pattern to the database.
util.EscapeRegex = function(str){
	return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

function IsMaster(dataset, user){
	return (dataset.master || []).some(function(master){
		return user._id.toString() == master._id.toString();
	});
}

async function FindDataset(id){
	try{
		return await Dataset.findOne({"_id": id});
	}
	catch(err){
		console.log(err);
		return null;
	}
}

util.CheckLogin = function (req, res, next) {
	if (req.isAuthenticated()) return next();
	PermissionDenied(req, res);
};

util.CheckAdmin = function (req, res, next) {
	if(req.user && req.user.authType == "admin"){
		return next();
	}
	PermissionDenied(req, res);
};

util.CheckMaster = function (req, res, next) {
	if (!req.user) return PermissionDenied(req, res);
	if (req.user.authType == "admin") return next();

	var id = req.query.dataset || req.body.dataset;
	if(!id) return PermissionDenied(req, res);

	FindDataset(id).then(function(dataset){
		if(!dataset) return PermissionDenied(req, res);
		if(IsMaster(dataset, req.user)) return next();
		return PermissionDenied(req, res);
	});
};

util.CheckImageEdit = function (req, res, next) {
	if(!req.user) return PermissionDenied(req, res);
	if (req.user.authType == "admin") return next();
	var id = req.query.dataset || req.body.dataset;
	if(!id) return PermissionDenied(req, res);

	(async function(){
		var dataset = await FindDataset(id);
		if(!dataset) return false;
		if(IsMaster(dataset, req.user)) return true;
		//確認是否為使用者自己上傳的影像
		var image = await ImageModel(id).findOne({_id:req.body.image});
		if(!image || !image.uploader) return false;
		return req.user._id.toString() == image.uploader.toString();
	})().then(function(allowed){
		if(allowed) return next();
		PermissionDenied(req, res);
	}).catch(function(err){
		console.log(err);
		PermissionDenied(req, res);
	});
};

util.CheckBlacklist = function (req, res, next) {
	if(req.user){
		if (req.user.status != "blacklist") return next();
	}
	BlackListDenied(req, res);
};

util.FailRedirect = function(req, res, redirect, message){
	var isAjax = req.xhr;
	if(isAjax) return res.send({"status":"fail","message":message});
	else return res.redirect(redirect+"?message="+encodeURIComponent(message));
};

util.UpdateDatasetStatistic = async function(param){
	var result = await ImageModel(param.dataset).aggregate([
		{$group: {
			_id:null,
			picNum: {$sum:1},
			annotationNum: {
				$sum: {
					$cond: [{$ne: ["$annotation", null]}, 1, 0]
				}
			},
		}},
		{$project:{ _id:0}}
	]);
	if(result.length == 0){
		result.push({picNum:0,annotationNum:0});
	}
	await Dataset.updateOne({_id:param.dataset},result[0]);
};


// Synchronizer-token CSRF protection (csurf is deprecated). The token lives in the
// session; pages put it in <meta name="csrf-token">, and the frontend sends it back
// as the csrf-token header or the _csrf form field. GET/HEAD/OPTIONS are not checked.
var csrf = csrfSync({
	getTokenFromRequest: function(req){
		return req.headers["csrf-token"] || req.headers["x-csrf-token"] || (req.body && req.body._csrf);
	}
});
util.CSRF = csrf.csrfSynchronisedProtection;

module.exports = util;

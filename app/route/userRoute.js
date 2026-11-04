var express = require("express");
var router = express.Router();
var userController = require("../controller/userController");
var util = require("../controller/util");
var Config = require("../../config.json");
var upload = require("../controller/upload");

module.exports = router;

var meta = {};
meta.version = Config.version;
meta.hostname = Config.hostname;

router.get('/info', util.CheckLogin, function(req, res) {
	res.status(200).json({"status":"ok","data": req.user});
});

router.get('/list-user', util.CheckLogin, function(req, res) {
	var param = {};
	param.keyword = req.query.keyword;
	param.authType = req.query.authType;
	param.status = req.query.status;
	param.page = req.query.page;
	param.isAdmin = req.user.authType == "admin";
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	userController.ListUser(param);
});

router.get('/list-name', function(req, res) {
	var param = {};
	param.user = req.user;
	param.id = req.query.id;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	userController.ListName(param);
});

router.post('/edit', util.CheckLogin, util.CSRF, function(req, res) {
	var param = {};
	param.userID = req.user.id;
	param.body = req.body.data;
	param.succFunc = function(result){
		res.status(200).json({"status": "ok", "data": result});
	};
	param.failFunc = function(result){
		console.log(result);
		res.status(200).json({status: "fail", message: result.err});
	};
	userController.EditUserInfo(param);
});

router.post('/upload-image', util.CheckLogin, util.CSRF, upload.UploadImageToMem, function(req, res){
	(async function(){
		var image = await upload.ReadImage(req);
		var saved = await upload.SaveUserPhoto(req.user.id, image.buffer);
		userController.ChangeUserPhoto({
			userID: req.user._id,
			photo: saved.photo,
			icon: saved.icon,
			succFunc: function(result){
				res.status(200).json({status: "ok", "data": result});
			},
			failFunc: function(result){
				res.status(200).json({status: "fail", message: result.err});
			}
		});
	})().catch(function(err){
		if(!err.err) console.log(err);
		res.status(200).json({status: "fail", message: err.err || "upload user photo fail"});
	});
});

router.post('/update-auth', util.CheckAdmin,util.CSRF, function(req, res){
	var param = {};
	param.id = req.body.id;
	param.authType = req.body.authType;
	param.status = req.body.status;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	userController.UpdateAuth(param);
});

router.post('/delete', util.CheckLogin, util.CSRF, function(req, res) {
	var param = {};
	param.user = req.user;
	param.succFunc = function(result){
		res.status(200).json({"status": "ok", "data": result});
	};
	param.failFunc = function(result){
		console.log(result);
		res.status(200).json({status: "fail", message: result.err});
	};
	var userID = req.user.id;
	req.logout(function(err){
		if(err) return param.failFunc({err: "logout fail"});
		upload.DeleteUser(userID).catch(function(err){ console.log(err); });
		userController.DeleteUser(param);
	});
});

var express = require("express");
var router = express.Router();
var apiController = require("../controller/apiController");
var util = require("../controller/util");
var Config = require("../../config.json");
var upload = require("../controller/upload");
var datasetController = require("../controller/datasetController");

module.exports = router;

router.post('/add-key', util.CheckAdmin,util.CSRF, function(req, res){
	var param = {};
	param.key = req.body.key;
	param.desc = req.body.desc;
	param.scope = req.body.scope||"all";
	param.dataset = req.body.dataset||[];
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	apiController.AddKey(param);
});

router.post('/delete-key', util.CheckAdmin,util.CSRF, function(req, res){
	var param = {};
	param.id = req.body.id;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	apiController.DeleteKey(param);
});

router.get('/list-key', util.CheckAdmin, function(req, res){
	var param = {};
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	apiController.ListKey(param);
});

router.post('/upload-image', upload.UploadImageToMem, function(req, res){
	function Fail(err){
		if(!err.err) console.log(err);
		res.status(200).json({status: "fail", message: err.err || "upload image fail"});
	}
	// Check the image before creating a record, so a bad upload leaves nothing behind.
	upload.ReadImage(req).then(function(image){
		var param = {};
		param.dataset = req.body.dataset;
		param.lat = req.body.lat;
		param.lng = req.body.lng;
		param.remark = req.body.remark;
		param.dataTime = req.body.dataTime;
		if(req.body.formReply){
			try{
				param.formReply = JSON.parse(req.body.formReply);
			}
			catch(err){
				return Fail({err: "invalid formReply"});
			}
		}
		param.apiKey = req.body.apiKey;
		param.succFunc = function(result){
			upload.SaveDatasetImage(req.body.dataset, result._id, image.buffer).then(function(){
				res.status(200).json({status: "ok", "data": result});
			}).catch(function(err){
				datasetController.RemoveImageRecord(req.body.dataset, result._id);
				Fail(err);
			});
		};
		param.failFunc = Fail;
		apiController.UploadImage(param);
	}).catch(Fail);
});

router.post('/set-annotation', function(req, res){
	var param = {};
	param.dataset = req.body.dataset;
	param.image = req.body.image;
	param.annotation = req.body.annotation;
	param.apiKey = req.body.apiKey;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	apiController.SetAnnotation(param);
});
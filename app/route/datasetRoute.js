var express = require("express");
var router = express.Router();
var datasetController = require("../controller/datasetController");
var util = require("../controller/util");
var Config = require("../../config.json");
var upload = require("../controller/upload");

module.exports = router;

var meta = {};
meta.version = Config.version;
meta.hostname = Config.hostname;

router.post('/create-dataset', util.CheckAdmin,util.CSRF, function(req, res){
	var param = {};
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.CreateDataset(param);
});

router.post('/update-dataset', util.CheckMaster,util.CSRF, function(req, res){
	var param = {};
	// CheckMaster authorized req.body.dataset, so that is the only dataset this request
	// may change. info._id used to decide the target, letting a master of one dataset
	// edit another. Counters are maintained by the server, not the client.
	var info = Object.assign({}, req.body.info || {});
	["_id","picNum","annotationNum","createdAt","updatedAt"].forEach(function(k){ delete info[k]; });
	info._id = req.body.dataset;
	if(!info._id) return res.status(200).json({"status": "fail","message": "no dataset"});
	param.info = info;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.UpdateDataset(param);
});

router.post('/delete-dataset', util.CheckAdmin,util.CSRF, function(req, res){
	var param = {};
	param.id = req.body.id;
	param.succFunc = function(result){
		upload.DeleteDataset(param.id).catch(function(err){ console.log(err); });
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.DeleteDataset(param);
});

router.get('/list-dataset', function(req, res) {
	var param = {};
	param.user = req.user;
	param.page = req.query.page;
	param.sort = req.query.sort;
	param.orderType = req.query.orderType;
	param.enableUpload = req.query.enableUpload;
	param.enableAnnotation = req.query.enableAnnotation;
	param.favorite = req.query.favorite;
	param.keyword = req.query.keyword;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.ListDataset(param);
});

router.get('/list-dataset-by-id', util.CheckAdmin, function(req, res) {
	var param = {};
	param.id = req.query.id;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.ListDatasetByID(param);
});

router.get('/view-dataset', function(req, res) {
	var param = {};
	param.user = req.user;
	param.id = req.query.id;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.ViewDataset(param);
});

router.get('/view-image', function(req, res) {
	var param = {};
	param.user = req.user;
	param.dataset = req.query.dataset;
	param.image = req.query.image;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.ViewImage(param);
});

router.post('/change-cover',util.CSRF, upload.UploadImageToMem,util.CheckMaster, function(req, res){	
	(async function(){
		var image = await upload.ReadImage(req);
		var picCover = await upload.SaveDatasetCover(req.body.dataset, image.buffer);
		datasetController.ChangeCover({
			id: req.body.dataset,
			picCover: picCover,
			succFunc: function(result){
				res.status(200).json({status: "ok", "data": result});
			},
			failFunc: function(result){
				res.status(200).json({status: "fail", message: result.err});
			}
		});
	})().catch(function(err){
		if(!err.err) console.log(err);
		res.status(200).json({status: "fail", message: err.err || "change cover fail"});
	});
});

router.post('/upload-image',util.CheckLogin,util.CheckBlacklist,util.CSRF, upload.UploadImageToMem, function(req, res){
	function Fail(err){
		if(!err.err) console.log(err);
		res.status(200).json({status: "fail", message: err.err || "upload image fail"});
	}
	upload.ReadImage(req).then(function(image){
		var param = {};
		param.user = req.user;
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
		param.succFunc = function(result){
			upload.SaveDatasetImage(req.body.dataset, result._id, image.buffer).then(function(){
				res.status(200).json({status: "ok", "data": result});
			}).catch(function(err){
				// Do not leave a record that points at a missing photo.
				datasetController.RemoveImageRecord(req.body.dataset, result._id);
				Fail(err);
			});
		};
		param.failFunc = Fail;
		datasetController.UploadImage(param);
	}).catch(Fail);
});

router.get('/list-image', function(req, res) {
	var param = {};
	param.user = req.user;
	param.dataset = req.query.dataset;
	param.page = req.query.page;
	param.all = req.query.all;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.ListImage(param);
});

router.post('/update-image-info', util.CheckImageEdit, util.CSRF, function(req, res) {
	var param = {};
	param.user = req.user;
	param.dataset = req.body.dataset;
	param.image = req.body.image;
	param.dataTime = req.body.dataTime;
	param.remark = req.body.remark;
	param.lat = req.body.lat;
	param.lng = req.body.lng;
	param.formReply = req.body.formReply;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.UpdateImageInfo(param);
});

router.post('/delete-image', util.CheckImageEdit, util.CSRF, function(req, res) {
	var param = {};
	param.user = req.user;
	param.dataset = req.body.dataset;
	param.image = req.body.image;
	param.succFunc = function(result){
		upload.DeleteDatasetImage(param.dataset, param.image).catch(function(err){ console.log(err); });
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.DeleteImage(param);
});

router.get('/list-image-for-annotation', function(req, res) {
	var param = {};
	param.user = req.user;
	param.dataset = req.query.dataset;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.ListImageForAnnotation(param);
});

router.post('/set-annotation',util.CheckLogin,util.CheckBlacklist,util.CSRF, function(req, res){
	var param = {};
	param.user = req.user;
	param.dataset = req.body.dataset;
	param.image = req.body.image;
	param.annotation = req.body.annotation;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.SetAnnotation(param);
});

router.post('/add-verification',util.CheckLogin,util.CheckBlacklist,util.CSRF, function(req, res){
	var param = {};
	param.user = req.user;
	param.dataset = req.body.dataset;
	param.image = req.body.image;
	param.agree = req.body.agree;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.AddVerification(param);
});

router.get('/verify-condition', function(req, res) {
	res.status(200).json({"status":"ok","data": Config.verify});
});

router.post('/batch-download',util.CheckLogin,util.CheckBlacklist,util.CSRF, function(req, res){
	var param = {};
	param.user = req.user;
	param.dataset = req.body.dataset;
	param.filter = req.body.filter;
	param.format = req.body.format;
	param.succFunc = function(result){
		res.status(200).json({"status":"ok","data": result});
	};
	param.failFunc = function(result){
		res.status(200).json({"status": "fail","message": result.err});
	};
	datasetController.BatchDownload(param);
});

router.get('/download-zip',util.CheckLogin,util.CheckBlacklist, function(req, res){
	datasetController.StreamZip({
		user: req.user,
		dataset: req.query.dataset,
		filter: req.query.filter,
		format: req.query.format,
		res: res
	});
});

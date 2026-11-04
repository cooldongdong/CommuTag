var Config = require('../../config');
var util = require("./util");
var ApiKey = require("../db/apiKey");
var Dataset = require("../db/dataset");
var ImageModel = require("../db/imageSchema").ImageModel;

var apiController = {};

function Run(param, fn){
	fn().then(function(result){
		param.succFunc(result);
	}).catch(function(err){
		if(!err || !err.err){
			console.log(err);
			err = {err:"internal error"};
		}
		param.failFunc(err);
	});
}

function RefreshStatistic(dataset){
	util.UpdateDatasetStatistic({dataset: dataset}).catch(function(err){
		console.log(err);
	});
}

apiController.AddKey = function(param){
	var data = {
		key: param.key,
		desc: param.desc,
		scope: param.scope,
		dataset: param.dataset
	};
	Run(param, async function(){
		try{
			return await ApiKey.updateOne({key: param.key},data,{upsert:true});
		}
		catch(err){
			console.log(err);
			throw {err:"create api key fail"};
		}
	});
};

apiController.DeleteKey = function(param){
	Run(param, async function(){
		try{
			await ApiKey.deleteOne({_id:param.id});
		}
		catch(err){
			console.log(err);
			throw {err:"delete api key fail"};
		}
		return {id:param.id};
	});
};

apiController.ListKey = function(param){
	Run(param, async function(){
		try{
			return await ApiKey.find({});
		}
		catch(err){
			console.log(err);
			throw {err:"list api key fail"};
		}
	});
};

async function CheckApiAuth(param){
	var key;
	try{
		key = await ApiKey.findOne({key:param.apiKey});
	}
	catch(err){
		console.log(err);
		throw {err:"find key fail"};
	}
	if(!key) throw {err:"key not found"};
	if(key.scope == "target"){
		var found = key.dataset.some(function(d){
			return d == param.dataset;
		});
		if(!found) throw {err:"dataset not in target"};
	}

	var result;
	try{
		result = await Dataset.findOne({_id:param.dataset},{"__v":0});
	}
	catch(err){
		console.log(err);
		throw {err:"find dataset fail"};
	}
	if(!result) throw {err:"dataset not found"};
	if(param.checkUpload && !result.enableUpload) throw {err:"upload not enabled"};
	if(param.checkAnnotation && !result.enableAnnotation) throw {err:"annotation not enabled"};
	return result;
}

apiController.UploadImage = function(param){
	Run(param, async function(){
		await CheckApiAuth({
			dataset: param.dataset,
			apiKey: param.apiKey,
			checkUpload: true
		});
		var newImage = {};
		newImage.lat = param.lat;
		newImage.lng = param.lng;
		newImage.remark = param.remark;
		newImage.dataTime = param.dataTime;
		newImage.formReply = param.formReply;
		newImage.uploadFrom = "api";
		newImage.uploader = param.apiKey;
		var result;
		try{
			result = await ImageModel(param.dataset).create(newImage);
		}
		catch(err){
			console.log(err);
			throw {err:"create image fail"};
		}
		RefreshStatistic(param.dataset);
		return result;
	});
};

apiController.SetAnnotation = function(param){
	Run(param, async function(){
		await CheckApiAuth({
			dataset: param.dataset,
			apiKey: param.apiKey,
			checkAnnotation: true
		});
		if(!param.annotation) throw {err:"no annotation"};
		var update = {
			annotation: {user: "api", annotation: param.annotation},
			verification: [],
			verifyNum:0,
			agreeNum:0
		};
		var result;
		try{
			result = await ImageModel(param.dataset).updateOne({_id:param.image},update);
		}
		catch(err){
			console.log(err);
			throw {err:"update annotation fail"};
		}
		RefreshStatistic(param.dataset);
		return result;
	});
};

module.exports = apiController;

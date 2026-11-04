var Config = require('../../config');
var util = require("./util");
var Dataset = require('../db/dataset');
var Favorite = require('../db/favorite');
var mongoose = require('mongoose');
var ImageModel = require("../db/imageSchema").ImageModel;

var datasetController = {};

function IsInList(list, user){
	return (list || []).some(function(m){
		return m._id.toString() == user._id.toString();
	});
}

async function CheckDatasetAuth(param){
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
	if(param.checkDownload && !result.enableDownload) throw {err:"download not enabled"};
	if(param.checkView && !result.isPublic){
		//不公開的資料集，管理員、版主跟私密成員才能看
		if(!param.user) throw {err:"view not allowed"};
		if(param.user.authType != "admin"){
			if(!IsInList(result.member, param.user) && !IsInList(result.master, param.user)){
				throw {err:"view not allowed"};
			}
		}
	}
	return result;
}
datasetController.CheckDatasetAuth = CheckDatasetAuth;

// Runs an async handler and routes its outcome to the param callbacks the routes expect.
function Run(param, fn){
	fn().then(function(result){
		if(result !== undefined) param.succFunc(result);
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

datasetController.CreateDataset = function(param){
	Run(param, async function(){
		try{
			return await Dataset.create({});
		}
		catch(err){
			console.log(err);
			throw {err:"create dataset fail"};
		}
	});
};

datasetController.UpdateDataset = function(param){
	//若無member資料傳輸時會自動省略，這邊補上空陣列讓資料庫更新member
	if(!param.info.member){
		param.info.member = [];
	}
	if(!param.info.master){
		param.info.master = [];
	}
	Run(param, async function(){
		try{
			return await Dataset.updateOne({_id:param.info._id},param.info);
		}
		catch(err){
			console.log(err);
			throw {err:"update dataset fail"};
		}
	});
};

datasetController.DeleteDataset = function(param){
	Run(param, async function(){
		try{
			await Dataset.deleteOne({_id:param.id});
		}
		catch(err){
			console.log(err);
			throw {err:"delete dataset fail"};
		}
		await ImageModel(param.id).deleteMany({});
		return {_id:param.id};
	});
};

datasetController.ListDataset = function(param){
	var condition = [];
	if(param.keyword){
		var regex = {"$regex": util.EscapeRegex(param.keyword),"$options": "i"};
		condition.push({"$or":[
			{name: regex},
			{desc: regex}
		]});
	}
	if(!param.user){
		condition.push({isPublic:true});
	}
	else if(param.user.authType != "admin"){
		condition.push({"$or":[
			{isPublic: true},
			{isPublic: false, "member._id": param.user._id.toString()},
			{isPublic: false, "master._id": param.user._id.toString()}
		]});
	}
	if(param.enableUpload){
		condition.push({enableUpload:param.enableUpload=="1"?true:false});
	}
	if(param.enableAnnotation){
		condition.push({enableAnnotation:param.enableAnnotation=="1"?true:false});
	}
	var queryOption = condition.length==0?{}:{"$and":condition};

	var sortOption = {};
	if(param.sort){
		sortOption[param.sort] = param.orderType=="desc"?-1:1;
	}

	Run(param, async function(){
		if(param.favorite == "1"){
			if(!param.user) return {hasMore:false,dataset:[]};
			var favorite;
			try{
				favorite = await Favorite.find({userID: param.user._id.toString()});
			}
			catch(err){
				console.log(err);
				throw {err:"list favorite fail"};
			}
			if(favorite.length == 0) return {hasMore:false,dataset:[]};
			queryOption._id = favorite.map(function(d){
				return d.datasetID;
			});
		}

		var limit = 8;
		var skip = (param.page||0)*limit;
		var dataset;
		try{
			dataset = await Dataset.find(queryOption,{"__v":0},{limit:limit+1, skip:skip}).sort(sortOption);
		}
		catch(err){
			console.log(err);
			throw {err:"list dataset fail"};
		}
		if(dataset.length > limit){
			return {hasMore: true, dataset: dataset.slice(0,-1)};
		}
		return {hasMore: false, dataset: dataset};
	});
};

datasetController.ListDatasetByID = function(param){
	Run(param, async function(){
		try{
			return await Dataset.find({_id: {$in: param.id.split(",")}},{"name":1,"picCover":1});
		}
		catch(err){
			console.log(err);
			throw {err:"list dataset fail"};
		}
	});
};

datasetController.ViewDataset = function(param){
	Run(param, function(){
		return CheckDatasetAuth({
			dataset: param.id,
			user: param.user,
			checkView: true
		});
	});
};

datasetController.ViewImage = function(param){
	Run(param, async function(){
		await CheckDatasetAuth({
			dataset: param.dataset,
			user: param.user,
			checkView: true
		});
		try{
			return await ImageModel(param.dataset).findOne({_id:param.image},{"__v":0});
		}
		catch(err){
			console.log(err);
			throw {err:"find image fail"};
		}
	});
};

datasetController.ChangeCover = function(param){
	var randomStr = "?rand="+Math.floor(Math.random()*100);
	var modify = {};
	modify.picCover = param.picCover+randomStr;
	Run(param, async function(){
		try{
			await Dataset.updateOne({"_id": param.id}, modify);
		}
		catch(err){
			console.log(err);
			throw {"err": "change cover fail"};
		}
		return modify;
	});
};

datasetController.UploadImage = function(param){
	Run(param, async function(){
		await CheckDatasetAuth({
			dataset: param.dataset,
			user: param.user,
			checkView: true,
			checkUpload: true
		});
		var newImage = {};
		newImage.lat = param.lat;
		newImage.lng = param.lng;
		newImage.remark = param.remark;
		newImage.dataTime = param.dataTime;
		newImage.formReply = param.formReply;
		newImage.uploadFrom = "user";
		newImage.uploader = param.user._id.toString();
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

datasetController.ListImage = function(param){
	Run(param, async function(){
		await CheckDatasetAuth({
			dataset: param.dataset,
			user: param.user,
			checkView: true
		});
		var limit = 8;
		var skip = (param.page||0)*limit;
		var option = {};
		if(param.all != "1"){
			option.limit = limit+1;
			option.skip = skip;
		}
		var images;
		try{
			images = await ImageModel(param.dataset).find({},{"__v":0},option).sort({"createdAt":-1});
		}
		catch(err){
			console.log(err);
			throw {err:"list image fail"};
		}
		if(param.all == "1") return images;
		if(images.length > limit){
			return {hasMore: true, images: images.slice(0,-1)};
		}
		return {hasMore: false, images: images};
	});
};

datasetController.ListImageForAnnotation = function(param){
	Run(param, async function(){
		await CheckDatasetAuth({
			dataset: param.dataset,
			user: param.user,
			checkView: true
		});
		// Not yet verified: fewer votes than the sample size, or agreement below the accept ratio.
		// Same condition as the old server-side JavaScript $where, without running JS in MongoDB.
		var query = {$or: [
			{verifyNum: {$lt: Config.verify.sample}},
			{$expr: {$lt: ["$agreeNum", {$multiply: ["$verifyNum", Config.verify.accept]}]}}
		]};
		try{
			return await ImageModel(param.dataset).find(query,{"__v":0});
		}
		catch(err){
			console.log(err);
			throw {err:"list image for annotation fail"};
		}
	});
};

datasetController.UpdateImageInfo = function(param){
	Run(param, async function(){
		await CheckDatasetAuth({
			dataset: param.dataset,
			user: param.user,
			checkView: true,
		});
		var update = {
			dataTime: param.dataTime,
			remark: param.remark,
			lat: param.lat,
			lng: param.lng,
			formReply: param.formReply
		};
		var result;
		try{
			result = await ImageModel(param.dataset).updateOne({_id:param.image},update);
		}
		catch(err){
			console.log(err);
			throw {err:"update image fail"};
		}
		RefreshStatistic(param.dataset);
		return result;
	});
};

datasetController.DeleteImage = function(param){
	Run(param, async function(){
		await CheckDatasetAuth({
			dataset: param.dataset,
			user: param.user,
			checkView: true,
		});
		try{
			await ImageModel(param.dataset).deleteOne({_id:param.image});
		}
		catch(err){
			console.log(err);
			throw {err:"delete image fail"};
		}
		RefreshStatistic(param.dataset);
		return {_id:param.image};
	});
};

datasetController.SetAnnotation = function(param){
	Run(param, async function(){
		var dataset = await CheckDatasetAuth({
			dataset: param.dataset,
			user: param.user,
			checkView: true,
			checkAnnotation: true
		});
		var Image = ImageModel(param.dataset);
		var data = null;
		if(param.user && param.annotation){
			data = {};
			data.user = param.user._id;
			data.annotation = param.annotation;
		}
		var update = {
			annotation:data,
			verification: [],
			verifyNum:0,
			agreeNum:0
		};
		var image;
		try{
			image = await Image.findOne({_id:param.image});
		}
		catch(err){
			console.log(err);
			throw {err:"find image fail"};
		}
		if(!image) throw {err:"no image"};

		//check if user can modify annotation
		var editable = !image.annotation;
		if(image.annotation){
			if(param.user.authType == "admin") editable = true;
			else if(IsInList(dataset.master, param.user)) editable = true;
			else if(param.user._id.toString() == image.annotation.user){
				editable = true;
			}
		}
		if(!editable) throw {err:"auth fail"};

		var result;
		try{
			result = await Image.updateOne({_id:param.image},update);
		}
		catch(err){
			console.log(err);
			throw {err:"update annotation fail"};
		}
		RefreshStatistic(param.dataset);
		return result;
	});
};

datasetController.AddVerification = function(param){
	Run(param, async function(){
		await CheckDatasetAuth({
			dataset: param.dataset,
			user: param.user,
			checkView: true,
			checkAnnotation: true
		});
		var data = {};
		data.user = param.user._id.toString();
		data.agree = param.agree;
		var image;
		try{
			image = await ImageModel(param.dataset).findOne({_id:param.image});
		}
		catch(err){
			console.log(err);
			throw {err:"find image fail"};
		}
		if(!image) throw {err:"image not found"};

		var duplicate = image.verification.some(function(v){
			return v.user == data.user;
		});
		if(duplicate) throw {err:"verification duplicate"};

		image.verification.push(data);
		image.verifyNum++;
		image.agreeNum += data.agree=="1"?1:0;
		try{
			await image.save();
		}
		catch(err){
			console.log(err);
			throw {err:"update verification fail"};
		}
		RefreshStatistic(param.dataset);
		return image;
	});
};

// The old implementation shelled out to Python with request fields pasted into the
// command line (command injection). It is rebuilt in Node in a later change.
datasetController.BatchDownload = function(param){
	Run(param, async function(){
		await CheckDatasetAuth({
			dataset: param.dataset,
			user: param.user,
			checkDownload: true,
		});
		throw {err:"batch download temporarily unavailable"};
	});
};

module.exports = datasetController;

var Favorite = require("../db/favorite");

var favoriteController = {};

function Run(param, fn, failMessage){
	fn().then(function(result){
		param.succFunc(result);
	}).catch(function(err){
		console.log(err);
		param.failFunc({err: failMessage});
	});
}

favoriteController.AddFavorite = function(param){
	var data = {
		userID: param.user._id.toString(),
		datasetID: param.dataset
	};
	Run(param, function(){
		return Favorite.updateOne(data,data,{upsert:true});
	}, "create favorite fail");
};

favoriteController.RemoveFavorite = function(param){
	var data = {
		userID: param.user._id.toString(),
		datasetID: param.dataset
	};
	Run(param, async function(){
		await Favorite.deleteOne(data);
		return data;
	}, "remove favorite fail");
};

favoriteController.ListFavorite = function(param){
	var query = {};
	if(param.user){
		query.userID = param.user._id.toString();
	}
	if(param.dataset){
		query.datasetID = param.dataset;
	}
	Run(param, function(){
		return Favorite.find(query);
	}, "list favorite fail");
};

module.exports = favoriteController;

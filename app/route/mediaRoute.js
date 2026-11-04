// Serves stored photos. The bucket is private, so every request comes here first:
// dataset files need view permission on that dataset (private datasets used to be
// readable by anyone who knew the URL), user avatars are public. Then the browser
// is redirected to a short-lived signed URL.
var express = require("express");
var router = express.Router();
var storage = require("../controller/storage");
var datasetController = require("../controller/datasetController");

module.exports = router;

var ID = "[0-9a-fA-F]{24}";
var FILE = "[A-Za-z0-9_-]+\\.jpg";

function Redirect(res, key){
	return storage.SignedUrl(key, 600).then(function(url){
		// Let the browser reuse the redirect for a while instead of asking again per <img>.
		res.set("Cache-Control", "private, max-age=300");
		res.redirect(302, url);
	});
}

router.get(new RegExp("^/dataset/("+ID+")/((?:image/)?"+FILE+")$"), function(req, res){
	var dataset = req.params[0];
	var file = req.params[1];
	datasetController.CheckDatasetAuth({dataset: dataset, user: req.user, checkView: true})
	.then(function(){
		return Redirect(res, "dataset/"+dataset+"/"+file);
	})
	.catch(function(err){
		if(!err || !err.err) console.log(err);
		res.status(404).end();
	});
});

router.get(new RegExp("^/user/("+ID+")/("+FILE+")$"), function(req, res){
	Redirect(res, "user/"+req.params[0]+"/"+req.params[1]).catch(function(err){
		console.log(err);
		res.status(404).end();
	});
});

router.use(function(req, res){
	res.status(404).end();
});

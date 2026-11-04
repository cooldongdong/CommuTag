var multer = require("multer");
var sharp = require("sharp");
var storage = require("./storage");

var upload = {};

var fileFilter = function(req, file, cb){
	var allowArr = ["image/jpeg","image/png","image/gif"];
	cb(null, allowArr.includes(file.mimetype));
};

upload.UploadImageToMem = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 1024 * 1024 * 10
	},
	fileFilter: fileFilter
}).single("uploadImage");

var MAX_SIDE = 4096;

// Reads the uploaded image from a multipart file or the base64 data URL the web
// client sends, and checks that it really is an image before anything is stored.
// JPEGs within the size limit are kept byte for byte; anything else is converted
// to JPEG, because every stored photo is served as .jpg.
upload.ReadImage = async function(req){
	var buffer = null;
	if(req.file && req.file.buffer){
		buffer = req.file.buffer;
	}
	else if(typeof req.body.uploadImage == "string"){
		var data = req.body.uploadImage.replace(/^data:image\/[a-z]+;base64,/, "");
		buffer = Buffer.from(data, "base64");
	}
	if(!buffer || buffer.length == 0) throw {err: "no upload image"};

	var meta;
	try{
		meta = await sharp(buffer).metadata();
	}
	catch(err){
		throw {err: "invalid image"};
	}
	var tooBig = meta.width > MAX_SIDE || meta.height > MAX_SIDE;
	if(meta.format == "jpeg" && !tooBig){
		return {buffer: buffer, width: meta.width, height: meta.height};
	}
	var out = await sharp(buffer).rotate()
		.resize({width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true})
		.jpeg({quality: 90})
		.toBuffer({resolveWithObject: true});
	return {buffer: out.data, width: out.info.width, height: out.info.height};
};

upload.DatasetImageKey = function(dataset, image){
	return "dataset/"+dataset+"/image/"+image+".jpg";
};

upload.SaveDatasetImage = function(dataset, image, buffer){
	return storage.Put(upload.DatasetImageKey(dataset, image), buffer);
};

upload.SaveDatasetCover = async function(dataset, buffer){
	var key = "dataset/"+dataset+"/cover.jpg";
	await storage.Put(key, buffer);
	return storage.MediaPath(key);
};

// User photo is capped at 1024px; the icon is a 64px square crop.
upload.SaveUserPhoto = async function(user, buffer){
	var photoKey = "user/"+user+"/photo.jpg";
	var iconKey = "user/"+user+"/icon.jpg";
	var photo = await sharp(buffer).rotate()
		.resize({width: 1024, height: 1024, fit: "inside", withoutEnlargement: true})
		.jpeg({quality: 90}).toBuffer();
	var icon = await sharp(buffer).rotate()
		.resize({width: 64, height: 64, fit: sharp.fit.cover, position: sharp.strategy.entropy})
		.jpeg({quality: 90}).toBuffer();
	await storage.Put(photoKey, photo);
	await storage.Put(iconKey, icon);
	return {photo: storage.MediaPath(photoKey), icon: storage.MediaPath(iconKey)};
};

upload.DeleteDatasetImage = function(dataset, image){
	return storage.Delete(upload.DatasetImageKey(dataset, image));
};

upload.DeleteDataset = function(dataset){
	return storage.DeletePrefix("dataset/"+dataset+"/");
};

upload.DeleteUser = function(user){
	return storage.DeletePrefix("user/"+user+"/");
};

module.exports = upload;

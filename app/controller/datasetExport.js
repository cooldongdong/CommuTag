// Builds the batch-download zip. Ported from python/batchDownload (GenFolderClassify,
// GenVOC, GenInfo) so the server no longer needs Python or OpenCV.
//
// Layout, same as before:
//   folder (annotationType "image"): <tag>/<00001>.jpg, untagged photos under 未分類/
//   voc    (annotationType "bbox"):  image/<00001>.jpg + annotation/<00001>.xml
//   both:  info.csv, info.kml
var archiver = require("archiver");
var sharp = require("sharp");
var Config = require("../../config");
var storage = require("./storage");
var upload = require("./upload");
var User = require("../db/user");

var exporter = {};

exporter.FILTERS = ["all", "annotateFinish", "verifyFinish"];
exporter.FORMATS = {image: "folder", bbox: "voc"};

exporter.FilterImages = function(images, filter){
	var verify = Config.verify;
	return images.filter(function(image){
		if(filter == "all") return true;
		if(!image.annotation) return false;
		if(filter == "annotateFinish") return true;
		var verification = image.verification || [];
		var verifyNum = verification.length;
		if(verifyNum <= 0 || verifyNum < verify.sample) return false;
		var agreeNum = verification.filter(function(v){ return v.agree == "1"; }).length;
		return agreeNum/verifyNum >= verify.accept;
	});
};

function Pad(n){
	return String(n).padStart(5, "0");
}

function TaiwanTime(d){
	if(!d) return "";
	var t = new Date(new Date(d).getTime() + 8*3600*1000);
	return t.toISOString().replace("T", " ").substring(0, 19);
}

function CsvField(v){
	if(v === undefined || v === null) return "";
	if(v instanceof Date) return TaiwanTime(v);
	if(Array.isArray(v)) v = v.join("|");
	if(typeof v == "string") return '"'+v.replace(/"/g, '""')+'"';
	return String(v);
}

function XmlEscape(v){
	return String(v === undefined || v === null ? "" : v)
		.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function FormItems(dataset){
	var form = dataset.form;
	return form && Array.isArray(form.itemArr) ? form.itemArr : [];
}

function FormValue(image, item){
	var reply = image.formReply && image.formReply[item.id];
	if(!reply) return undefined;
	return reply.value;
}

function ImageUrl(dataset, image){
	return Config.hostname + storage.MediaPath(upload.DatasetImageKey(dataset._id, image._id));
}

function Tags(dataset, image){
	if(!image.annotation || !Array.isArray(image.annotation.annotation)) return [];
	if(dataset.annotationType == "image"){
		return image.annotation.annotation.filter(function(a){
			return a.value == "true";
		}).map(function(a){ return a.name; });
	}
	return image.annotation.annotation.map(function(a){ return a.tag; });
}

async function NameLookup(images){
	var ids = new Set();
	images.forEach(function(image){
		if(image.uploader) ids.add(String(image.uploader));
		if(image.annotation && image.annotation.user) ids.add(String(image.annotation.user));
		(image.verification || []).forEach(function(v){ ids.add(String(v.user)); });
	});
	var valid = Array.from(ids).filter(function(id){ return /^[0-9a-f]{24}$/.test(id); });
	var users = await User.find({_id: {$in: valid}}, {name: 1});
	var names = {};
	users.forEach(function(u){ names[u._id.toString()] = u.name || ""; });
	return function(id){
		id = String(id);
		return id + "_" + (names[id] || "");
	};
}

exporter.BuildCsv = function(dataset, rows, nameOf){
	var fields = ["imageName","lat","lng","dataTime","remark","上傳者","標註者","驗證者","標籤","createdAt","updatedAt"];
	var items = FormItems(dataset);
	var header = fields.concat(items.map(function(i){ return i.quest; })).concat(["imageUrl"]);
	var lines = [header.join(",")];
	rows.forEach(function(row){
		var image = row.image;
		var values = [
			row.name, image.lat, image.lng, image.dataTime, image.remark,
			image.uploader ? nameOf(image.uploader) : "",
			image.annotation && image.annotation.user ? nameOf(image.annotation.user) : "",
			(image.verification || []).map(function(v){ return nameOf(v.user); }),
			Tags(dataset, image),
			image.createdAt, image.updatedAt
		].map(CsvField);
		items.forEach(function(item){ values.push(CsvField(FormValue(image, item))); });
		values.push(ImageUrl(dataset, image));
		lines.push(values.join(","));
	});
	// BOM so Excel opens the Chinese headers correctly.
	return "﻿" + lines.join("\n") + "\n";
};

exporter.BuildKml = function(dataset, rows){
	var items = FormItems(dataset);
	var out = ['<?xml version="1.0" encoding="utf-8"?>',
		'<kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
		"<name>"+XmlEscape(dataset.name)+"</name>"];
	rows.forEach(function(row){
		var image = row.image;
		out.push("<Placemark><name>"+XmlEscape(row.name)+"</name>");
		if(image.lat !== undefined && image.lng !== undefined){
			out.push("<Point><coordinates>"+image.lng+","+image.lat+",0</coordinates></Point>");
		}
		out.push("<ExtendedData>");
		var data = [["imageName", row.name], ["dataTime", TaiwanTime(image.dataTime)], ["remark", image.remark],
			["createdAt", TaiwanTime(image.createdAt)], ["updatedAt", TaiwanTime(image.updatedAt)]];
		items.forEach(function(item){
			var v = FormValue(image, item);
			if(v !== undefined) data.push([item.quest, Array.isArray(v) ? v.join(" ") : v]);
		});
		data.push(["imageUrl", ImageUrl(dataset, image)]);
		data.forEach(function(d){
			if(d[1] === undefined || d[1] === null || d[1] === "") return;
			out.push('<Data name="'+XmlEscape(d[0])+'"><value>'+XmlEscape(d[1])+"</value></Data>");
		});
		out.push("</ExtendedData></Placemark>");
	});
	out.push("</Document></kml>");
	return out.join("\n");
};

exporter.BuildVoc = function(imageName, width, height, bboxArr){
	var objects = (bboxArr || []).map(function(b){
		var minX = parseFloat(b.x), minY = parseFloat(b.y);
		var maxX = minX + parseFloat(b.width), maxY = minY + parseFloat(b.height);
		return "\t<object>\n\t\t<name>"+XmlEscape(b.tag)+"</name>\n\t\t<pose>Unspecified</pose>\n"+
			"\t\t<truncated>0</truncated>\n\t\t<difficult>0</difficult>\n\t\t<bndbox>\n"+
			"\t\t\t<xmin>"+minX+"</xmin>\n\t\t\t<ymin>"+minY+"</ymin>\n"+
			"\t\t\t<xmax>"+maxX+"</xmax>\n\t\t\t<ymax>"+maxY+"</ymax>\n\t\t</bndbox>\n\t</object>";
	});
	var name = imageName.split("/").pop();
	return "<annotation>\n\t<folder>image</folder>\n\t<filename>"+XmlEscape(name)+"</filename>\n"+
		"\t<path>"+XmlEscape(imageName)+"</path>\n\t<source>\n\t\t<database>Unknown</database>\n\t</source>\n"+
		"\t<size>\n\t\t<width>"+width+"</width>\n\t\t<height>"+height+"</height>\n\t\t<depth>3</depth>\n\t</size>\n"+
		"\t<segmented>0</segmented>\n"+objects.join("\n")+(objects.length ? "\n" : "")+"</annotation>\n";
};

// Streams the zip straight to the response; photos are fetched from storage one by one.
exporter.StreamZip = async function(dataset, images, format, res){
	var archive = archiver("zip", {zlib: {level: 0}});	// JPEGs do not compress further
	archive.on("warning", function(err){ console.log(err); });
	archive.on("error", function(err){ console.log(err); res.destroy(err); });

	var filename = "batchDownload_"+format+".zip";
	res.setHeader("Content-Type", "application/zip");
	res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''"+encodeURIComponent((dataset.name || "dataset")+"_"+filename));
	archive.pipe(res);

	var nameOf = await NameLookup(images);
	var rows = [];
	var serial = 1;
	for(var i=0;i<images.length;i++){
		var image = images[i];
		var buffer;
		try{
			buffer = await storage.GetBuffer(upload.DatasetImageKey(dataset._id, image._id));
		}
		catch(err){
			continue;	// record without a stored photo: skip it, as the Python version did
		}
		var base = Pad(serial)+".jpg";
		if(format == "folder"){
			var tags = image.annotation ? Tags(dataset, image) : ["未分類"];
			tags.forEach(function(tag){
				archive.append(buffer, {name: String(tag).replace(/[\/\\]/g, "_")+"/"+base});
			});
			rows.push({image: image, name: base});
		}
		else{
			var imageName = "image/"+base;
			archive.append(buffer, {name: imageName});
			if(image.annotation){
				var meta = await sharp(buffer).metadata();
				archive.append(exporter.BuildVoc(imageName, meta.width, meta.height, image.annotation.annotation),
					{name: "annotation/"+Pad(serial)+".xml"});
			}
			rows.push({image: image, name: imageName});
		}
		serial++;
	}
	archive.append(exporter.BuildCsv(dataset, rows, nameOf), {name: "info.csv"});
	archive.append(exporter.BuildKml(dataset, rows), {name: "info.kml"});
	await archive.finalize();
};

module.exports = exporter;

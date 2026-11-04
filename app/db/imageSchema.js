var mongoose = require('mongoose');

var PointSchema = new mongoose.Schema({
	type: {type: String, enum: ["Point"], required: true},
	coordinates: {type: [Number], required: true}	// [lng, lat], GeoJSON order
},{_id: false});

var ImageSchema = new mongoose.Schema({
	dataset: {type: String, required: true},
	uploadFrom: String,		//user or api
	uploader: String,		//user id or api token	
	annotation:{			//annotation data
		type: mongoose.Schema.Types.Mixed,
		default: null
	},
	verification:{				//annotation verification data
		type: [mongoose.Schema.Types.Mixed],
		default: []
	},
	formReply:{			//reply for dataset form
		type: mongoose.Schema.Types.Mixed,
		default: null
	},
	verifyNum: {		//total number in verification
		type: Number,
		default: 0
	},
	agreeNum: {		//agree number in varification
		type: Number,
		default: 0
	},
	location: {type: PointSchema, default: undefined},
	remark: String,
	dataTime: Date
},{
	collection: "image",
	timestamps: {createdAt:"createdAt", updatedAt:"updatedAt"},
	toJSON: {virtuals: true, id: false},
	toObject: {virtuals: true, id: false}
});

ImageSchema.index({dataset: 1, createdAt: -1});
// 2dsphere indexes skip documents without the field, so photos without GPS are fine.
ImageSchema.index({location: "2dsphere"});

// The API and the frontend still speak lat/lng; they are read from the GeoJSON point.
ImageSchema.virtual("lat").get(function(){
	return this.location && this.location.coordinates ? this.location.coordinates[1] : undefined;
});
ImageSchema.virtual("lng").get(function(){
	return this.location && this.location.coordinates ? this.location.coordinates[0] : undefined;
});

var Image = mongoose.model("image", ImageSchema);

// Turns lat/lng in a create/update payload into the GeoJSON location field.
// Missing lat/lng leaves the location alone; empty or invalid values clear it.
function WithLocation(doc, forUpdate){
	if(!doc || !("lat" in doc || "lng" in doc)) return doc;
	var out = Object.assign({}, doc);
	var hasLat = "lat" in out, hasLng = "lng" in out;
	var lat = out.lat, lng = out.lng;
	delete out.lat;
	delete out.lng;
	if(hasLat && lat === undefined && hasLng && lng === undefined) return out;
	var latN = parseFloat(lat), lngN = parseFloat(lng);
	var valid = isFinite(latN) && isFinite(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;
	if(valid){
		out.location = {type: "Point", coordinates: [lngN, latN]};
	}
	else if(forUpdate){
		out.$unset = Object.assign({}, out.$unset, {location: 1});
	}
	return out;
}

// All photos live in one "image" collection. Every caller goes through this
// helper, which adds the dataset condition to each query, so code that only
// knows an image id can never reach a photo in another dataset.
function ImageModel(datasetID){
	var id = String(datasetID);
	function scope(q){ return Object.assign({}, q, {dataset: id}); }
	return {
		find: function(q, p, o){ return Image.find(scope(q), p, o); },
		findOne: function(q, p){ return Image.findOne(scope(q), p); },
		updateOne: function(q, u){ return Image.updateOne(scope(q), WithLocation(u, true)); },
		deleteOne: function(q){ return Image.deleteOne(scope(q)); },
		deleteMany: function(q){ return Image.deleteMany(scope(q)); },
		countDocuments: function(q){ return Image.countDocuments(scope(q)); },
		create: function(d){ return Image.create(Object.assign(WithLocation(d, false), {dataset: id})); },
		aggregate: function(pipeline){ return Image.aggregate([{$match: {dataset: id}}].concat(pipeline)); }
	};
}

module.exports = ImageSchema;
module.exports.Image = Image;
module.exports.ImageModel = ImageModel;

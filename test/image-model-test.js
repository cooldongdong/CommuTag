var Config = require("../config.json");
var chai = require('chai');
var mongoose = require('mongoose');
var ImageModel = require("../app/db/imageSchema").ImageModel;
var expect = chai.expect;

describe("Image model", function(){
	var a = new mongoose.Types.ObjectId().toString();
	var b = new mongoose.Types.ObjectId().toString();

	before(async function(){
		if(mongoose.connection.readyState == 0) await mongoose.connect(Config.mongodb.url);
	});

	after(async function(){
		await ImageModel(a).deleteMany({});
		await ImageModel(b).deleteMany({});
	});

	it("stores lat/lng as a GeoJSON point and reads them back", async function(){
		var img = await ImageModel(a).create({lat: "25.03", lng: "121.56", remark: "x"});
		var json = img.toJSON();
		expect(json.location).to.deep.equal({type: "Point", coordinates: [121.56, 25.03]});
		expect(json.lat).to.equal(25.03);
		expect(json.lng).to.equal(121.56);
		expect(json.dataset).to.equal(a);
	});

	it("leaves location empty when there is no GPS", async function(){
		var img = await ImageModel(a).create({remark: "no gps"});
		expect(img.toJSON().location).to.equal(undefined);
		expect(img.toJSON().lat).to.equal(undefined);
	});

	it("ignores out-of-range coordinates", async function(){
		var img = await ImageModel(a).create({lat: 200, lng: 10});
		expect(img.toJSON().location).to.equal(undefined);
	});

	it("updates and clears the location", async function(){
		var img = await ImageModel(a).create({lat: 1, lng: 2});
		await ImageModel(a).updateOne({_id: img._id}, {lat: 3, lng: 4});
		var updated = await ImageModel(a).findOne({_id: img._id});
		expect(updated.lat).to.equal(3);
		expect(updated.lng).to.equal(4);
		await ImageModel(a).updateOne({_id: img._id}, {lat: "", lng: ""});
		var cleared = await ImageModel(a).findOne({_id: img._id});
		expect(cleared.toJSON().location).to.equal(undefined);
	});

	it("never reaches a photo in another dataset", async function(){
		var img = await ImageModel(a).create({remark: "in a"});
		expect(await ImageModel(b).findOne({_id: img._id})).to.equal(null);
		await ImageModel(b).deleteOne({_id: img._id});
		expect(await ImageModel(a).findOne({_id: img._id})).to.not.equal(null);
	});

	it("finds photos near a point", async function(){
		await ImageModel(b).create({lat: 25.0330, lng: 121.5654, remark: "near"});
		await ImageModel(b).create({lat: 22.6273, lng: 120.3014, remark: "far"});
		var near = await ImageModel(b).find({location: {$near: {
			$geometry: {type: "Point", coordinates: [121.56, 25.03]},
			$maxDistance: 5000
		}}});
		expect(near.map(function(d){ return d.remark; })).to.deep.equal(["near"]);
	});
});

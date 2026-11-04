// End-to-end checks for photo storage: upload, permission-checked /media,
// and the batch-download zip. Needs MongoDB and the S3 server from config.json.
var Config = require("../config.json");
var chai = require('chai');
var chaiHttp = require('chai-http');
var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var cheerio = require('cheerio');
var sharp = require('sharp');
var AdmZip = require('adm-zip');
var app = require("../server.js");
var Dataset = require("../app/db/dataset");
var User = require("../app/db/user");
var ImageModel = require("../app/db/imageSchema").ImageModel;
var storage = require("../app/controller/storage");
var upload = require("../app/controller/upload");

chai.use(chaiHttp);
var expect = chai.expect;

async function Login(email, password){
	var agent = chai.request.agent(app);
	await agent.post("/auth/login-by-password").send({email: email, password: password});
	var page = await agent.get("/");
	return {agent: agent, csrf: cheerio.load(page.text)("meta[name='csrf-token']").attr("content")};
}

function Ajax(req, csrf){
	req = req.set("x-requested-with", "XMLHttpRequest");
	return csrf ? req.set("csrf-token", csrf) : req;
}

describe("照片儲存與打包下載", function(){
	this.timeout(30000);
	var users = {}, datasets = {}, owner, outsider, jpeg, imageID, privateImageID;

	before(async function(){
		if(mongoose.connection.readyState == 0) await mongoose.connect(Config.mongodb.url);
		await storage.EnsureBucket();
		var hash = await bcrypt.hash("secret", 10);
		users.owner = await User.create({provider: "local", signupEmail: "mediaOwner@test.com", password: hash, name: "Owner"});
		users.outsider = await User.create({provider: "local", signupEmail: "mediaOutsider@test.com", password: hash, name: "Outsider"});
		datasets.pub = await Dataset.create({name: "media public", annotationType: "bbox", tagArr: ["垃圾"],
			isPublic: true, enableUpload: true, enableDownload: true, enableGPS: true, enableAnnotation: true});
		datasets.priv = await Dataset.create({name: "media private", annotationType: "image",
			isPublic: false, enableUpload: true, enableDownload: true, enableAnnotation: true,
			member: [{_id: users.owner._id.toString()}]});
		jpeg = await sharp({create: {width: 320, height: 240, channels: 3, background: "#3a7"}}).jpeg().toBuffer();
		owner = await Login("mediaOwner@test.com", "secret");
		outsider = await Login("mediaOutsider@test.com", "secret");
	});

	after(async function(){
		for(var k in datasets){
			await ImageModel(datasets[k]._id).deleteMany({});
			await upload.DeleteDataset(datasets[k]._id.toString());
		}
		await Dataset.deleteMany({_id: {$in: Object.values(datasets).map(function(d){ return d._id; })}});
		await User.deleteMany({_id: {$in: Object.values(users).map(function(u){ return u._id; })}});
		owner.agent.close();
		outsider.agent.close();
	});

	it("uploads a photo with GPS", async function(){
		var res = await Ajax(owner.agent.post("/dataset/upload-image"), owner.csrf).send({
			dataset: datasets.pub._id.toString(), lat: 25.03, lng: 121.56, remark: "測試",
			uploadImage: "data:image/jpeg;base64,"+jpeg.toString("base64")
		});
		expect(res.body.status).to.equal("ok");
		imageID = res.body.data._id;
		expect(res.body.data.lat).to.equal(25.03);
		var stored = await storage.GetBuffer(upload.DatasetImageKey(datasets.pub._id, imageID));
		expect(stored.equals(jpeg)).to.equal(true);
	});

	it("rejects a file that is not an image, without leaving a record", async function(){
		var before = await ImageModel(datasets.pub._id).countDocuments({});
		var res = await Ajax(owner.agent.post("/dataset/upload-image"), owner.csrf).send({
			dataset: datasets.pub._id.toString(),
			uploadImage: "data:image/jpeg;base64,"+Buffer.from("<script>alert(1)</script>").toString("base64")
		});
		expect(res.body.status).to.equal("fail");
		expect(await ImageModel(datasets.pub._id).countDocuments({})).to.equal(before);
	});

	it("serves a public photo through a signed redirect", async function(){
		var res = await chai.request(app).get("/media/dataset/"+datasets.pub._id+"/image/"+imageID+".jpg").redirects(0);
		expect(res.status).to.equal(302);
		var signed = await fetch(res.headers.location);
		expect(signed.status).to.equal(200);
		expect(Buffer.from(await signed.arrayBuffer()).equals(jpeg)).to.equal(true);
	});

	it("does not serve a private photo to non-members", async function(){
		var res = await Ajax(owner.agent.post("/dataset/upload-image"), owner.csrf).send({
			dataset: datasets.priv._id.toString(),
			uploadImage: "data:image/jpeg;base64,"+jpeg.toString("base64")
		});
		expect(res.body.status).to.equal("ok");
		privateImageID = res.body.data._id;
		var path = "/media/dataset/"+datasets.priv._id+"/image/"+privateImageID+".jpg";
		expect((await owner.agent.get(path).redirects(0)).status).to.equal(302);
		expect((await outsider.agent.get(path).redirects(0)).status).to.equal(404);
		expect((await chai.request(app).get(path).redirects(0)).status).to.equal(404);
	});

	it("rejects paths outside the media layout", async function(){
		var res = await chai.request(app).get("/media/dataset/"+datasets.pub._id+"/../../user/x.jpg").redirects(0);
		expect(res.status).to.equal(404);
	});

	it("refuses unknown download filters and formats", async function(){
		var bad = await Ajax(owner.agent.post("/dataset/batch-download"), owner.csrf).send({
			dataset: datasets.pub._id.toString(), filter: "all; touch /tmp/pwned", format: "voc"});
		expect(bad.body.status).to.equal("fail");
		var wrongFormat = await Ajax(owner.agent.post("/dataset/batch-download"), owner.csrf).send({
			dataset: datasets.pub._id.toString(), filter: "all", format: "folder"});
		expect(wrongFormat.body.status).to.equal("fail");
	});

	it("does not let outsiders download a private dataset", async function(){
		var res = await outsider.agent.get("/dataset/download-zip").query({
			dataset: datasets.priv._id.toString(), filter: "all", format: "folder"});
		expect(res.status).to.equal(403);
	});

	it("builds a VOC zip with photo, annotation, CSV and KML", async function(){
		await Ajax(owner.agent.post("/dataset/set-annotation"), owner.csrf).send({
			dataset: datasets.pub._id.toString(), image: imageID,
			annotation: [{tag: "垃圾", x: 10, y: 20, width: 30, height: 40}]
		});
		var link = await Ajax(owner.agent.post("/dataset/batch-download"), owner.csrf).send({
			dataset: datasets.pub._id.toString(), filter: "all", format: "voc"});
		expect(link.body.status).to.equal("ok");
		var res = await owner.agent.get(link.body.data).buffer(true).parse(function(r, cb){
			var chunks = []; r.on("data", function(c){ chunks.push(c); }); r.on("end", function(){ cb(null, Buffer.concat(chunks)); });
		});
		expect(res.status).to.equal(200);
		var zip = new AdmZip(res.body);
		var names = zip.getEntries().map(function(e){ return e.entryName; }).sort();
		expect(names).to.deep.equal(["annotation/00001.xml", "image/00001.jpg", "info.csv", "info.kml"]);
		var xml = zip.readAsText("annotation/00001.xml");
		expect(xml).to.contain("<width>320</width>").and.contain("<height>240</height>");
		expect(xml).to.contain("<name>垃圾</name>").and.contain("<xmax>40</xmax>").and.contain("<ymax>60</ymax>");
		var csv = zip.readAsText("info.csv");
		expect(csv.charCodeAt(0)).to.equal(0xfeff);
		expect(csv).to.contain("25.03,121.56").and.contain("Owner").and.contain('"垃圾"');
		expect(zip.readAsText("info.kml")).to.contain("<coordinates>121.56,25.03,0</coordinates>");
	});

	it("deletes the stored photo with the record", async function(){
		var res = await Ajax(owner.agent.post("/dataset/delete-image"), owner.csrf).send({
			dataset: datasets.pub._id.toString(), image: imageID});
		expect(res.body.status).to.equal("ok");
		await new Promise(function(r){ setTimeout(r, 300); });
		var gone = false;
		try{ await storage.GetBuffer(upload.DatasetImageKey(datasets.pub._id, imageID)); }
		catch(err){ gone = true; }
		expect(gone).to.equal(true);
	});
});

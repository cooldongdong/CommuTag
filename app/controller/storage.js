// Object storage for photos, covers and avatars. Any S3-compatible service works:
// Cloudflare R2 in production, a local S3 server in development.
//
// The database stores app paths such as /media/dataset/<id>/image/<id>.jpg, never
// a bucket URL. The bucket stays private: /media checks permission and then
// redirects to a short-lived signed URL. Moving to another bucket or account only
// means changing config.json.
var Config = require("../../config");
var S3 = require("@aws-sdk/client-s3");
var presigner = require("@aws-sdk/s3-request-presigner");

var conf = Config.storage || {};
var client = new S3.S3Client({
	region: conf.region || "auto",
	endpoint: conf.endpoint,
	forcePathStyle: !!conf.forcePathStyle,
	credentials: {
		accessKeyId: conf.accessKeyId,
		secretAccessKey: conf.secretAccessKey
	}
});
var Bucket = conf.bucket;

var storage = {};

storage.MediaPath = function(key){
	return "/media/"+key;
};

storage.Put = function(key, body, contentType){
	return client.send(new S3.PutObjectCommand({
		Bucket: Bucket, Key: key, Body: body,
		ContentType: contentType || "image/jpeg"
	}));
};

storage.GetBuffer = async function(key){
	var res = await client.send(new S3.GetObjectCommand({Bucket: Bucket, Key: key}));
	return Buffer.from(await res.Body.transformToByteArray());
};

storage.Delete = function(key){
	return client.send(new S3.DeleteObjectCommand({Bucket: Bucket, Key: key}));
};

storage.List = async function(prefix){
	var keys = [];
	var token;
	do{
		var list = await client.send(new S3.ListObjectsV2Command({
			Bucket: Bucket, Prefix: prefix, ContinuationToken: token
		}));
		(list.Contents || []).forEach(function(o){ keys.push(o.Key); });
		token = list.IsTruncated ? list.NextContinuationToken : undefined;
	} while(token);
	return keys;
};

storage.DeletePrefix = async function(prefix){
	// One key at a time: some S3-compatible stores reject DeleteObjects without Content-MD5.
	var keys = await storage.List(prefix);
	for(var i=0;i<keys.length;i++){
		await storage.Delete(keys[i]);
	}
};

storage.SignedUrl = function(key, expiresIn){
	return presigner.getSignedUrl(client,
		new S3.GetObjectCommand({Bucket: Bucket, Key: key}),
		{expiresIn: expiresIn || 300});
};

storage.EnsureBucket = async function(){
	try{
		await client.send(new S3.HeadBucketCommand({Bucket: Bucket}));
	}
	catch(err){
		await client.send(new S3.CreateBucketCommand({Bucket: Bucket}));
	}
};

module.exports = storage;

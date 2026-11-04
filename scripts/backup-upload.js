// Reads a database dump from stdin, stores it in the bucket under backup/, and
// keeps the newest N (default 30). Used by scripts/backup-mongo.sh.
// The /media route only serves dataset/ and user/, so backups are never public.
var storage = require("../app/controller/storage");
var S3 = require("@aws-sdk/client-s3");

var KEEP = parseInt(process.env.BACKUP_KEEP || "30", 10);

async function ReadStdin(){
	var chunks = [];
	for await (var chunk of process.stdin) chunks.push(chunk);
	return Buffer.concat(chunks);
}

(async function(){
	var body = await ReadStdin();
	if(body.length == 0) throw new Error("empty dump on stdin, nothing uploaded");
	var stamp = new Date().toISOString().replace(/[:.]/g, "-");
	var key = "backup/mongo-"+stamp+".archive.gz";
	await storage.Put(key, body, "application/gzip");
	console.log("uploaded "+key+" ("+body.length+" bytes)");

	var keys = await storage.List("backup/mongo-");
	keys.sort();
	var old = keys.slice(0, Math.max(0, keys.length - KEEP));
	for(var i=0;i<old.length;i++){
		await storage.Delete(old[i]);
		console.log("removed "+old[i]);
	}
})().catch(function(err){
	console.error(err);
	process.exit(1);
});

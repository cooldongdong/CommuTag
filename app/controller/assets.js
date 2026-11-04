// Turns a page entry name into the <link>/<script> tags Vite built for it,
// using dist/.vite/manifest.json so file names carry a content hash and
// browsers never run a stale bundle after a deploy.
var fs = require("fs");
var path = require("path");

var manifestPath = path.join(__dirname, "../../dist/.vite/manifest.json");
var cached = null;

function loadManifest(useCache) {
	if (useCache && cached) return cached;
	cached = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	return cached;
}

function collect(manifest, key, out, seen) {
	if (seen[key]) return;
	seen[key] = true;
	var chunk = manifest[key];
	if (!chunk) throw new Error("asset entry not found in manifest: " + key);
	(chunk.imports || []).forEach(function (k) {
		collect(manifest, k, out, seen);
		out.preload.push(manifest[k].file);
	});
	(chunk.css || []).forEach(function (f) { out.css.push(f); });
}

module.exports = function (useCache) {
	return function assets(entry) {
		var manifest = loadManifest(useCache);
		var key = "src/js/" + entry + ".js";
		var out = { css: [], preload: [] };
		collect(manifest, key, out, {});
		var base = "/dist/";
		var tags = [];
		Array.from(new Set(out.css)).forEach(function (f) {
			tags.push('<link rel="stylesheet" href="' + base + f + '">');
		});
		Array.from(new Set(out.preload)).forEach(function (f) {
			tags.push('<link rel="modulepreload" href="' + base + f + '">');
		});
		tags.push('<script type="module" src="' + base + manifest[key].file + '"></script>');
		return tags.join("\n");
	};
};

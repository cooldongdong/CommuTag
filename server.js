var express = require("express");
var ejs = require("ejs");
var passport = require("passport");
var session = require("express-session");
var MongoDBStore = require('connect-mongodb-session')(session);
var mongoose = require("mongoose");
var fs = require("fs");
var path = require('path');
var morgan = require('morgan');

var Config = require("./config");

var ViewRoute = require("./app/route/viewRoute.js");
var AuthRoute = require("./app/route/authRoute.js");
var UserRoute = require("./app/route/userRoute.js");
var DatasetRoute = require("./app/route/datasetRoute.js");
var FavoriteRoute = require("./app/route/favoriteRoute.js");
var ApiRoute = require("./app/route/apiRoute.js");
var MediaRoute = require("./app/route/mediaRoute.js");

mongoose.connect(Config.mongodb.url);
mongoose.pluralize(null);

//setup view & static file
var rootDir = __dirname;
var app = express();
if(Config.mode == "production") app.set('trust proxy', 1);	// behind Cloudflare / reverse proxy, so secure cookies work
app.port = Config.serverPort || 8001;
app.set('view engine', 'ejs');
app.set("views", rootDir + "/view");
app.locals.assets = require("./app/controller/assets.js")(Config.mode == "production");
app.use('/static',express.static(rootDir + '/static'));
app.use('/dist',express.static(rootDir + '/dist'));
// Plotly must run as a classic script, so it is served from the locked npm package
// instead of being bundled by Vite.
var plotlyFile = require.resolve("plotly.js-basic-dist-min/plotly-basic.min.js");
app.locals.plotlyVersion = require("plotly.js-basic-dist-min/package.json").version;
app.get('/vendor/plotly-basic.min.js', function(req, res){
	res.sendFile(plotlyFile, {maxAge: "30d"});
});

//setup auth
var options = {
    uri: Config.mongodb.url,
    collection: 'user_session'
};
var sessionStore = new MongoDBStore(options);

var logPath = path.join(__dirname, 'log/')
if (!fs.existsSync(logPath)){
	fs.mkdirSync(logPath, {recursive: true});
}
var accessLogStream = fs.createWriteStream(logPath+"access.log", { flags: 'a' })
app.use(morgan("short",{ stream: accessLogStream }));

app.use(session({
    secret: Config.session.secret,
    store: sessionStore,
    resave: true,
    saveUninitialized: false,
    cookie: {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: Config.mode == "production",	// production runs behind HTTPS
        maxAge: 1000*60*60*24*30	//session保留30天
    }
}));

app.use(express.urlencoded({extended: true,limit: '5mb'}));
app.use(express.json({limit: '5mb'}));
app.use(passport.initialize());
app.use(passport.session());


//setup route
app.use("/", ViewRoute);
app.use("/auth", AuthRoute);
app.use("/user", UserRoute);
app.use("/dataset", DatasetRoute);
app.use("/favorite", FavoriteRoute);
app.use("/api", ApiRoute);
app.use("/media", MediaRoute);


app.listen(app.port);
console.log("CommuTag started in "+Config.mode+" mode");

module.exports = app;
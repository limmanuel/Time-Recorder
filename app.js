var express = require('express');
var path = require('path');
var bodyparser = require('body-parser');
var session = require('express-session');
var validator = require('express-validator');
var handle = require('express-handlebars');
var mongoose = require('mongoose');
var flash = require('connect-flash');
var passport = require('passport');
var Handlebars = require('handlebars');
var moment = require('moment');
var datepicker = require('js-datepicker');

var index = require('./routes/admin');

var app = express();

var port = process.env.PORT || 3000;

mongoose.connect('mongodb://admin:admin@ds133281.mlab.com:33281/lopez-database');
var db = mongoose.connection;
var ObjectID = require('mongodb').ObjectID;
var mongoClient = require('mongodb').MongoClient;
var url = 'mongodb://admin:admin@ds133281.mlab.com:33281/lopez-database';

mongoClient.connect(url, function(err, database){
  if(err){console.log(err);};
  db=database;
  Wuser = db.collection('wusers');
  Account = db.collection('accounts');
  Timelog = db.collection('timelogs');
  Request = db.collection('requests');

  app.listen(port, function(){
    console.log("Connected to port " + port);
  });
});

app.engine('handlebars', handle({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.locals.moment = require('moment');

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended: false}));

app.use(express.static(path.join(__dirname,'public')));

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.use(function (req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  next();
});

app.use(validator({
  errorFormatter: function(param, msg, value) {
      var namespace = param.split('.')
      , root    = namespace.shift()
      , formParam = root;

    while(namespace.length) {
      formParam += '[' + namespace.shift() + ']';
    }
    return {
      param : formParam,
      msg   : msg,
      value : value
    };
  }
}));

Handlebars.registerHelper('var',function(name, value, context){
  this[name] = value;
});

Handlebars.registerHelper('equal', function(lvalue, rvalue, options) {
    if (arguments.length < 3)
        throw new Error("Handlebars Helper equal needs 2 parameters");
    if( lvalue!==rvalue ) {
        return options.inverse(this);
    } else {
        return options.fn(this);
    }
});

Handlebars.registerHelper('greater', function(lvalue, rvalue, options) {
    if (arguments.length < 3)
        throw new Error("Handlebars Helper equal needs 2 parameters");
    if( lvalue>rvalue ) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});
Handlebars.registerHelper('less', function(lvalue, rvalue, options) {
    if (arguments.length < 3)
        throw new Error("Handlebars Helper equal needs 2 parameters");
    if( lvalue>rvalue ) {
        return options.inverse(this);
    } else {
        return options.fn(this);
    }
});
Handlebars.registerHelper('moment', function(date, format, options){
  return moment(date).format(format);
})
Handlebars.registerHelper('lastArr', function(array, context){
  return array[array.length -1];
})
Handlebars.registerHelper('addOne', function(num, options){
  return num+=1;
})
Handlebars.registerHelper('add', function(left, right, options){
  return left + ' ' + right;
})
Handlebars.registerHelper('duration', function (timeout, timein, options){
  var ms = moment(timeout,"HH:mm:ss").diff(moment(timein,"HH:mm:ss"));
  var d = moment.duration(ms).format("HH[h] mm[m] ss[s]");
  if(d!=='00s'){
    return d
  }
});
Handlebars.registerHelper('count', function (id, logs, status, options){
  logs.forEach(function(log){
    if(log.user_id == id){
      var c = 0;
      log.status.forEach(function(stat){
        if(stat.status == status){
          c++;
        }
      });
    }
    console.log(c);
    return c;
  });
});

app.use('/', index);
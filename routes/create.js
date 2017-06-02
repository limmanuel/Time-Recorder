var express = require('express');
var router = express.Router();
var moment = require('moment');
var passport = require('passport');
var localstr = require('passport-local').Strategy;
var datepicker = require('js-datepicker');
require("moment-duration-format");
var nodemailer = require('nodemailer');
var json2csv = require('json2csv');
var fs = require('fs');
var path = require('path');

//Mongoose Schema
let Account = require('../model/account.js');
let Wuser = require('../model/user.js');
let Time = require('../model/timelog.js');
let Request = require('../model/request.js');

//------------------------Create User----------------------------
//Create Page
router.get('/', ensureAuthenticated, function(req,res,next){
	if(req.user.position !== 'Manager' && req.user.department !== 'Head'){
		res.redirect('/create');
	} else {
		Account.getAccountByTeam(req.user.team, function(err,team){
			Wuser.getUserById(req.user.id, function(err, user){
				if(err){
					console.log(err);
				}
				res.render('create', {
					page: 'create',
					dates: moment().format('MM-DD-YYYY'),
					time: moment().format('HH:mm:ss'),
					wuser: req.user,
					user: user,
					user_id: req.user.id,
					team: team,
				});
			});
		});
	}
});

//Create Post
router.post('/', ensureAuthenticated, function(req,res,next){
	var first_name = req.body.fname;
	var last_name = req.body.lname;
	var username = req.body.username;
	var email = req.body.email;
	var team = req.body.team;
	var department = req.body.department;
	var password = req.body.password;
	var password2 = req.body.password2;

	req.checkBody('fname', 'First Name is required').notEmpty();
	req.checkBody('lname', 'Last Name is required').notEmpty();
	req.checkBody('username', 'Username is required').notEmpty();
	req.checkBody('team', 'Team is required').notEmpty();
	req.checkBody('email', 'Email is required').isEmail();
	req.checkBody('password', 'Password is required').notEmpty();
	req.checkBody('password2', 'Passwords do not match').equals(password);

	let errors = req.validationErrors();

	Wuser.getUsersByTeam(req.user.team, function(err, use){
		use.forEach(function(u){
			if(u.username == username){
				err = 'Username Already Exist';
			}
		});
		if(errors || err){
			if(req.user.position == 'User'){
				res.redirect('/create');
			} else {
				Account.getAccountByTeam(req.user.team, function(erro,team){
					Wuser.getUserById(req.user.id, function(erro, user){
						res.render('create', {
							page: 'create',
							dates: moment().format('MM-DD-YYYY'),
							time: moment().format('HH:mm:ss'),
							wuser: req.user,
							user: user,
							user_id: req.user.id,
							team: team,
							errors: errors,
							error: err
						});
					});
				});
			}
		} else {
			var newWuser = new Wuser({
				team: team,
				img: 'https://www.watsonmartin.com/wp-content/uploads/2016/03/default-profile-picture.jpg',
				first_name: first_name,
				last_name: last_name,
				username: username,
				email: email,
				password: password,
				department: department,
				position: "No Position"
			});
			Wuser.registerUser(newWuser, function(err, user){
				var newLog = new Time ({
					date: moment().format('MM-DD-YYYY'),
					team: team,
					user_id: user._id,
					name: first_name + ' ' + last_name,
					timein: [],
					timeout: [],
					breakin: [],
					breakout: [],
					status: []
				});
				newLog.save(function(err){
					if(err){
						console.log(err);
					}
					let query = {user_id: user._id, date: moment().format('MM-DD-YYYY')}
					var status = {
						status: "Absent"
					}
					Time.addStatus(query, status, function(err, data){});
				});
				if(err){
					console.log(err)
				}
				req.flash('success_msg', 'You created a new user')
				res.redirect('/create');
			});
		}
	});
});

//Authentication
function ensureAuthenticated(req,res,next){
	if(req.isAuthenticated()){
		return next();
	} else {
		req.flash('error_msg','Please Login First')
		res.redirect('/login');
	}
}

module.exports = router;
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

router.get('/', function(req,res,next){
	res.redirect('/login')
});

//Register Page
router.get('/register', function(req,res,next){
	res.render('register',{
		page: 'register',
	});
});

//Register Team and User
router.post('/register', function(req,res,next){
	var first_name = req.body.fname;
	var last_name = req.body.lname;
	var username = req.body.username;
	var email = req.body.email;
	var team = req.body.team;
	var department = "Head";
	var position = "CEO";
	var password = req.body.password;
	var password2 = req.body.password2;
	var sched_in = req.body.sched_in;
	var sched_out = req.body.sched_out;

	Account.getAccounts(function(err,acc){
		acc.forEach(function(a){
			if(a.team == team){
				err = 'Team already exist';
			}
		});

		req.checkBody('fname', 'First Name is required').notEmpty();
		req.checkBody('lname', 'Last Name is required').notEmpty();
		req.checkBody('username', 'Username is required').notEmpty();
		req.checkBody('team', 'Team is required').notEmpty();
		req.checkBody('email', 'Email is required').isEmail();
		req.checkBody('password', 'Password is required').notEmpty();
		req.checkBody('password2', 'Passwords do not match').equals(password);

		let errors = req.validationErrors();

		if(err || errors){
			res.render('register', {
				error: err,
				errors: errors,
			});
		} else {
			var newAccount = new Account({
				team: team,
				sched_in: sched_in,
				sched_out: sched_out,
				holiday: [],
				departments: [{
					department: department,
					positions: [{
						position: position
					}]
				}]
			});
			Account.registerAccount(newAccount, function(err, account){
				if(err){
					console.log(err);
				}
				var newWuser = new Wuser({
					team: team,
					img: 'https://www.watsonmartin.com/wp-content/uploads/2016/03/default-profile-picture.jpg',
					first_name: first_name,
					last_name: last_name,
					username: username,
					email: email,
					password: password,
					department: department,
					position: position,
					leave_count: 0
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
					req.flash('success_msg', 'You are registered and can login')
					res.redirect('/login');
				});
			});
		}
	}); 
});

//Login Page Add Current Date Time Log and Update Approved Leave Request
router.get('/login', function(req,res,next){
	Account.getAccounts(function(err, accounts){
		accounts.forEach(function(account){
			if(account !== null && account!== undefined){
				var team = account.team;
				Wuser.getUsersByTeam(team,function(err, users){
					users.forEach(function(user){
						if(user !== null && user!== undefined){
							var userid = user._id;
							var name = user.first_name+' '+user.last_name;
							Time.getTimeLogsByUser(userid, function(err, logs){
								var t = 0;
								var l = 0;
								var h = 0;
								var h_date = [];
								var date_now = moment().format('MM-DD-YYYY');
								var date_yes = moment().subtract(1,'d').format('MM-DD-YYYY');
								var year = moment().format('-YYYY');
								logs.forEach(function(log){
									if(log.date == date_now){
										l=1;
									}
									if(log.date == date_yes){
										if(log.timeout.length > 0){
											t=1;
										}
									}
									account.holiday.forEach(function(holidays){
										if(log.date == (holidays.date+year)){
											h=1;
										} else {
											h_date.push(holidays.date);
										}
									});
								});
								if(t == 0){
									let query = {user_id: userid, date: date_yes}
									var time = {
										timeout: account.sched_out+':00'
									}
									Time.addTimeOut(query, time, function(err, data){});
								}
								if(h == 0){
									h_date.forEach(function(date){
										var holiday_date = date;
										var newLog = new Time ({
											date: holiday_date+year,
											team: team,
											user_id: user._id,
											name: user.first_name + ' ' + user.last_name,
											status: {
												status: "Holiday"
											},
											timein: {
												timein: "N/A"
											},
											breakin: {
												breakin: "N/A"
											},
											breakout: {
												breakout: "N/A"
											},
											timeout: {
												timeout: "N/A"
											}
										});
										newLog.save(function(err){
											if(err){
												console.log(err);
											}
											h=0;
										});
									});
								}
								if(l == 0){
									var newLog = new Time ({
										date: date_now,
										team: team,
										user_id: userid,
										name: name,
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
										let query = {user_id: userid, date: moment().format('MM-DD-YYYY')}
										var status = {
											status: "Absent"
										}
										Time.addStatus(query, status, function(err, data){});
										l=1;
									});
								}
								var sched = account.sched_out+':00';
								var time = moment().format('HH:MM:ss');
								if(time >= sched){
									Time.getTimeLogsByUserAndDate(userid, moment().format('MM-DD-YYYY'), function(err, user){
										if(user.timein[0]){} else{
											let query = {user_id: userid, date: moment().format('MM-DD-YYYY'), 'status.status': 'Absent'};
											var timein = {
												timein: "N/A"
											}
											var breakin = {
												breakin: "N/A"
											}
											var breakout = {
												breakout: "N/A"
											}
											var timeout = {
												timeout: "N/A"
											}
											Time.addTimeIn(query, timein, function(err, tin){});
											Time.addBreakIn(query, breakin, function(err, bin){});
											Time.addBreakOut(query, breakout, function(err, bout){});
											Time.addTimeOut(query, timeout, function(err, tout){});
										}
									});
								}
							});
						}
					});
				});
			}
		});
		if(err){
			console.log(err);
		}
		res.render('login',{
			page: 'login',
			account: accounts
		});
	});
});

//Getting User username and Password
passport.use(new localstr({passReqToCallback: true}, function(req,username,password,done){
	var team = req.body.team;
	Wuser.getUserByUsername(team, username, function(err,user){
		if (err){
			console.log(err);
		}
		if(!user){
			return done(null,false,{message:'No user found'})
		}
		Wuser.comparePassword(password,user.password,function(err,isMatch){
			if (err){
				console.log(err);
			}
			if(isMatch){
				return done(null, user);
			} else {
				return done(null,false,{message:'Wrong Password'});
			}
		})
	})
}));

//Serializing and Deserializing User Account
passport.serializeUser(function(user, done) {
	done(null, user._id);
});

passport.deserializeUser(function(id, done) {
	Wuser.getUserById(id, function(err, user) {
		done(err, user);
	});
});

//User Logging In
router.post('/login', function(req,res,next){
	var username = req.body.username;
	var password = req.body.password;
	var team = req.body.team;

	req.checkBody('username', 'Invalid Username').notEmpty();
	req.checkBody('password', 'Password is required').notEmpty();

	let errors = req.validationErrors();

	if(errors){
		Account.getAccounts(function(err, accounts){
			res.render('login', {
				errors: errors,
				page: 'login',
				account: accounts
			});
		});
	} else {
		Wuser.getUserByUsername(team, username, function(err,user){
			if(user){
				passport.authenticate('local', {
					successRedirect:'/profile',
					failureRedirect:'/login',
					failureFlash: true
				})(req,res,next);
			}else{
				req.flash('error_msg', 'User not found')
				res.redirect('/login');
			}
		});
	}
});

//Logout
router.get('/logout', function(req,res,next){
	req.logout();
	req.flash('success_msg','You are logged out');
	res.redirect('/login');
});

//Logged In Page

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
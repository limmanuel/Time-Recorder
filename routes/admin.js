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
	var position = "Owner";
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

		console.log(err);

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
				holiday: []
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
					position: position
				});
				Wuser.registerUser(newWuser, function(err, user){
					var newLog = new Time ({
						date: moment().format('MM-DD-YYYY'),
						team: team,
						user_id: user._id,
						name: first_name + ' ' + last_name,
						timein: [],
						timeout: [],
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
								var l = 0;
								var h = 0;
								var h_date = [];
								var date_now = moment().format('MM-DD-YYYY');
								var year = moment().format('-YYYY');
								logs.forEach(function(log){
									if(log.date == date_now){
										l=1;
									}
									account.holiday.forEach(function(holidays){
										if(log.date == (holidays.date+year)){
											h=1;
										} else {
											h_date.push(holidays.date);
										}
									});
								});
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
										let query = {user_id: userid, date: moment().format('MM-DD-YYYY'), 'status.status': "Absent"};
										var timein = {
											timein: "N/A",
											date: moment().format('MM-DD-YYYY')
										}
										var timeout = {
											timeout: "N/A",
											date: moment().format('MM-DD-YYYY')
										}
										Time.addTimeIn(query, timein, function(err, tin){});
										Time.addTimeOut(query, timeout, function(err, tout){});
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
					successRedirect:'/'+team+'/'+user._id,
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

//----------------Profile Page-----------------
router.get('/:team/:id',ensureAuthenticated, function (req,res,next){
	if(req.query.month){
		var filterMonth = req.query.month.split(',');
		if(req.query.status){
			var filterStatus = req.query.status.split(',');
		} else {
			var filterStatus = ['Absent', 'Present', 'Late', 'Sick', 'Vacation', 'Holiday'];
		}
	} else {
		var filterMonth = ['01','02','03','04','05','06','07','08','09','10','11','12'];
		if(req.query.status){
			var filterStatus = req.query.status.split(',');
		} else {
			var filterStatus = ['Absent', 'Present', 'Late', 'Sick', 'Vacation', 'Holiday'];
		}
	}
	 if(req.query.tab) {
		var tab = req.query.tab;
	} else {
		var tab = 'home';
	}
	Account.getAccountByTeam(req.params.team, function(err,team){
		var team_log = team;
		Wuser.getUserById(req.params.id, function(err, user){
			var user_log = user;
			Time.getTimeLogsByUser(req.params.id, function(err, logs){
			var logs_log = logs;
				Request.getRequestByUser(req.params.id, function(err, forms){
					Time.getTimeLogsByUserAndDate(req.params.id, moment().format('MM-DD-YYYY'), function(err, log){
						if(err){
							console.log(err);
						}
						res.render('index', {
							page: 'profile',
							tab: tab,
							moment: moment,
							datepicker: datepicker,
							dates: moment().format('MM-DD-YYYY'),
							time: moment().format('HH:mm:ss'),
							wuser: user_log,
							user: user_log,
							user_id: req.params.id,
							log: log,
							logs: logs_log,
							team: team_log,
							filterStatus: filterStatus,
							filterMonth: filterMonth,
							forms: forms
						});
					});
				});
			});
		});
	});
});

//Home Tab
//Change Profile Picture
router.post('/:team/:id/image', ensureAuthenticated, function(req,res,next){
	let query = {_id: req.params.id};
	var img = {
		img: req.body.image
	};
	Wuser.setPicture(query, img, function(err, done){
		res.redirect('/'+req.params.team+'/'+req.params.id);
	});
});

//TimeIn
router.post('/:team/:id/timein/:dates/:tin', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.params.id, req.params.dates, function(err, user){
		let query = {user_id: req.params.id, date: req.params.dates};
		let status_query = {user_id: req.params.id, date: req.params.dates, 'status.status': 'Absent'};
		var timein = moment().format('HH:mm:ss');
		var sched = req.body.sched_in;
		var time = {
			timein: timein
		}
		if(timein > sched){
			var status = {
				status: "Late"
			}
			if(user.status.length == user.timein.length){
				Time.addStatus(query, status, function(err, data){});
			} else {
				Time.updateStatus(status_query, status, function(err, data){});
			}
		} else {
			var status = {
				status: "Present"
			}
			if(user.status.length == user.timein.length){
				Time.addStatus(query, status, function(err, data){});
			} else {
				Time.updateStatus(status_query, status, function(err, data){});
			}
		}
		Time.addTimeIn(query, time, function(err, tin){
			res.redirect('/'+req.params.team+'/'+req.params.id);
		});
	});
});

//TimeOut
router.post('/:team/:id/timeout/:dates/:tout', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.params.id, req.params.dates, function(err, user){
		let query = {user_id: req.params.id, date: req.params.dates};
		var timeout = moment().format('HH:mm:ss');
		var time = {
			timeout: timeout
		};
		Time.addTimeOut(query, time, function(err, tin){
			res.redirect('/'+req.params.team+'/'+req.params.id);
		});
	});
});

//Sick Leave
router.post('/:team/:id/status/:dates', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.params.id, req.params.dates, function(err, user){
		let query = {user_id: req.params.id, date: req.params.dates};
		let status_query = {user_id: req.params.id, date: req.params.dates};
		var status = {
			status: "Sick"
		}
		var timein = {
			timein: "N/A"
		}
		var timeout = {
			timeout: "N/A"
		}
		Time.addTimeIn(query, timein, function(err, tin){});
		Time.addTimeOut(query, timeout, function(err, tout){});
		Time.updateStatus(status_query, status, function(err, data){
			res.redirect('/'+req.params.team+'/'+req.params.id);
		});
	});
});

//Request Leave
router.post('/:team/:id/leave/form', ensureAuthenticated, function(req,res,next){
	var date = req.body.leave;
	if(moment(date).format('MM-DD-YYYY') == moment().format('MM-DD-YYYY')){
		res.render('index', {
			error: "Can't request on the same day",
		});
	} else {
		var newRequest = new Request ({
				date: moment().format('MM-DD-YYYY'),
				team: req.params.team,
				user_id: req.params.id,
				leave_date: moment(date).format('MM-DD-YYYY'),
				leave_status: "pending",
				message: req.body.message
			});
		newRequest.save(function(err){
			if(err){
				console.log(err);
			}
			res.redirect('/'+req.params.team+'/'+req.params.id);
		});
		Wuser.getUsersByTeam(req.params.team, function(err, users){
			users.forEach(function(user){
				if(user.position !== 'User'){
					var transporter = nodemailer.createTransport({
						service:'Gmail',
						auth: {
							user: 'rndmlpz@gmail.com',
							pass: "'      '"
						},tls: { rejectUnauthorized: false }
					});

					var mailOptions = {
						from: '"[Time-Recorder]" <rndmlpz@gmail.com>',
						to: user.email,
						subject: '[Time-Recorder]Leave Request: '+ req.body.team,
						text: 'Message from Time Recorder Name: '+ req.body.name + 'Email: ' + req.body.email + 'Leave Date: ' + req.body.leave + 'Message: ' + req.body.message ,
						html: '<p>Message from Time Recorder </p><ul><li>Name: '+ req.body.name + '</li><li>Email: ' + req.body.email + '</li><li>Leave Date: ' + req.body.leave + '</li><li>Message: ' + req.body.message + '</li></ul>'
					}
					transporter.sendMail(mailOptions,function(error,info){
						if(error){return console.log(error);}
						res.redirect('/'+req.params.team+'/'+req.params.id);
					});
				}
			});
		});
	}
});

//History Tab
//Filter
router.post('/:team/:id/filter', ensureAuthenticated, function(req,res,next){
	if(req.body.filterMonth){
		if (req.body.filterStatus){
			res.redirect('/'+req.params.team+'/'+req.params.id+'/?tab=history&month='+req.body.filterMonth+'&status='+req.body.filterStatus);
		} else {
			res.redirect('/'+req.params.team+'/'+req.params.id+'/?tab=history&month='+req.body.filterMonth);
		}
	} else if(req.body.filterStatus){
		res.redirect('/'+req.params.team+'/'+req.params.id+'/?tab=history&status='+req.body.filterStatus);
	} else {
		res.redirect('/'+req.params.team+'/'+req.params.id+'/?tab=history');
	}
});

//Form Tab
//Delete Request
router.post('/:team/:id/leave/form/delete/:leave_id', function(req,res,next){
	let query = {_id: req.params.leave_id};
	Request.delLeave(query, function(err, response){
		if(err){return console.log(err);}
			res.redirect('/'+req.params.team+'/'+req.params.id+'/?tab=form');
	});
});

//Settings Tab
//Update User
router.post('/:team/:id', ensureAuthenticated, function(req,res,next){
	var first_name = req.body.fname;
	var last_name = req.body.lname;
	var username = req.body.username;
	var email = req.body.email;
	var team = req.body.team;
	var position = req.body.position;
	var password = req.body.password;
	var password2 = req.body.password2;
	var image = req.body.image;

	req.checkBody('fname', 'First Name is required').notEmpty();
	req.checkBody('lname', 'Last Name is required').notEmpty();
	req.checkBody('username', 'Username is required').notEmpty();
	req.checkBody('team', 'Team is required').notEmpty();
	req.checkBody('email', 'Email is required').isEmail();
	req.checkBody('password2', 'Passwords do not match').equals(password);

	let errors = req.validationErrors();

	if(errors){
		if(req.query.month){
			var filterMonth = req.query.month;
			if(req.query.status){
				var filterStatus = req.query.status.split(',');
			} else {
				var filterStatus = ['Present', 'Late', 'Sick', 'Vacation', 'Holiday'];
			}
		} else {
			var filterMonth = moment().format('MM');
			if(req.query.status){
				var filterStatus = req.query.status.split(',');
			} else {
				var filterStatus = ['Present', 'Late', 'Sick', 'Vacation', 'Holiday'];
			}
		}
		 if(req.query.tab) {
			var tab = req.query.tab;
		} else {
			var tab = 'settings';
		}
		Account.getAccountByTeam(req.params.team, function(err,team){
			var team_log = team;
			Wuser.getUserById(req.params.id, function(err, user){
				var user_log = user;
				Time.getTimeLogsByUser(req.params.id, function(err, logs){
				var logs_log = logs;
					Request.getRequestByUser(req.params.id, function(err, forms){
						Time.getTimeLogsByUserAndDate(req.params.id, moment().format('MM-DD-YYYY'), function(err, log){
							if(err){
								console.log(err);
							}
							res.render('index', {
								page: 'profile',
								errors: errors,
								tab: tab,
								moment: moment,
								datepicker: datepicker,
								dates: moment().format('MM-DD-YYYY'),
								time: moment().format('HH:mm:ss'),
								wuser: user_log,
								user: user_log,
								user_id: req.params.id,
								log: log,
								logs: logs_log,
								team: team_log,
								filterStatus: filterStatus,
								filterMonth: filterMonth,
								forms: forms
							});
						});
					});
				});
			});
		});
	} else {
		var updateWuser = {
			team: team,
			img: image,
			first_name: first_name,
			last_name: last_name,
			username: username,
			email: email,
			password: password,
			position: position
		}
		let query = {_id: req.params.id}
		Wuser.getUserById(req.params.id, function(err, user){
			var last_password = user.password;
			Wuser.updateUser(last_password, query, updateWuser, function(err, val){
				if(err){
					console.log(err)
				}
				req.flash('success_msg', 'You updated your profile')
				res.redirect('/'+req.params.team+'/'+req.params.id);
			});
		});
	}
});

//-------------------Dashboard Page------------------------
router.get('/:team/:id/dashboard', ensureAuthenticated, function (req,res,next){
	if(req.query.month){
		var filterMonth = req.query.month.split(',');
		if(req.query.status){
			var filterStatus = req.query.status.split(',');
		} else {
			var filterStatus = ['Absent', 'Present', 'Late', 'Sick', 'Vacation', 'Holiday'];
		}
	} else {
		var filterMonth = ['01','02','03','04','05','06','07','08','09','10','11','12'];
		if(req.query.status){
			var filterStatus = req.query.status.split(',');
		} else {
			var filterStatus = ['Absent', 'Present', 'Late', 'Sick', 'Vacation', 'Holiday'];
		}
	}
	 if(req.query.tab) {
		var tab = req.query.tab;
	} else {
		var tab = 'home';
	}
	Account.getAccountByTeam(req.params.team, function(err,team){
		Wuser.getUserById(req.params.id, function(err, wuser){
			Wuser.getUsersByTeam(req.params.team, function(err, users){
				Time.getTimeLogsByTeam(req.params.team, function(err, logs){
					Time.getTimeLogsByDate(moment().format('MM-DD-YYYY'), req.params.team, function(err, log){
						Request.getRequestByTeam(req.params.team, function(err, forms){
							res.render('dashboard', {
								page: 'dashboard',
								tab: tab,
								moment: moment,
								datepicker: datepicker,
								dates: moment().format('MM-DD-YYYY'),
								time: moment().format('HH:mm:ss'),
								wuser: wuser,
								user: users,
								user_id: req.params.id,
								log: log,
								logs: logs,
								team: team,
								filterStatus: filterStatus,
								filterMonth: filterMonth,
								forms: forms
							});
						});
					});
				});
			});
		});
	});
});

//History Tab
//Filter
router.post('/:team/:id/dashboard/filter', ensureAuthenticated,  function(req,res,next){
	if(req.body.filterMonth){
		if (req.body.filterStatus){
			res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=history&month='+req.body.filterMonth+'&status='+req.body.filterStatus);
		} else {
			res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=history&month='+req.body.filterMonth);
		}
	} else if(req.body.filterStatus){
		res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=history&status='+req.body.filterStatus);
	} else {
		res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=history');
	}
});

//Form Tab
//Update Form
router.post('/:team/:id/dashboard/leave/form/:user_id/update/:leave_id', ensureAuthenticated, function(req,res,next){
	let query = {_id: req.params.leave_id};
	var leave_date = req.body.leave_date;
	var leave_status = req.body.leave_status;
	if(leave_status == 'deny'){
		Request.delLeave(query, function(err,data){
		if(err){return console.log(err);}
			res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=form');
		});
	} else {
		var newLog = new Time ({
			date: leave_date,
			team: req.params.team,
			user_id: req.params.user_id,
			timein: [{
				timein: 'N/A'
			}],
			timeout: [{
				timeout: 'N/A'
			}],
			status: [{
				status: "Vacation"
			}]
		});
		newLog.save(function(err){
			if(err){
				console.log(err);
			}
			Request.delLeave(query, function(err,val){
				res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=form');
			});
		});
	}
});

//--------------------Admin Page--------------------------
router.get('/:team/:id/admin', ensureAuthenticated, function (req,res,next){
	Wuser.getUserById(req.params.id, function(err, wuser){
		if(wuser.position == 'User'){
			res.redirect('/'+req.params.team+'/'+req.params.id);
		} else {
			if(req.query.tab) {
				var tab = req.query.tab;
			} else {
				var tab = 'User';
			}
			Account.getAccountByTeam(req.params.team, function(err,team){
				Wuser.getUserById(req.params.id, function(err, wuser){
					Wuser.getUsersByTeam(req.params.team, function(err, users){
						Time.getTimeLogsByTeam(req.params.team, function(err,logs){
							res.render('admin', {
								page: 'admin',
								tab: tab,
								dates: moment().format('MM-DD-YYYY'),
								time: moment().format('HH:mm:ss'),
								wuser: wuser,
								user: users,
								user_id: req.params.id,
								team: team,
								logs: logs
							});
						});
					});
				});
			});
		}
	});
});

//Manage User
//Update Position
router.post('/:team/:id/admin/settings/update/:user_id', ensureAuthenticated, function (req,res,next){
	var first_name = req.body.fname;
	var last_name = req.body.lname;
	var username = req.body.username;
	var email = req.body.email;
	var team = req.body.team;
	var position = req.body.position;
	var password = req.body.password;

	req.checkBody('fname', 'First Name is required').notEmpty();
	req.checkBody('lname', 'Last Name is required').notEmpty();
	req.checkBody('username', 'Username is required').notEmpty();
	req.checkBody('team', 'Team is required').notEmpty();
	req.checkBody('email', 'Email is required').isEmail();
	req.checkBody('password2', 'Passwords do not match').equals(password);

	let errors = req.validationErrors();

	if(errors){
		res.render('dashboard', {
			errors: errors,
		});
	} else {
		var updateWuser = {
			team: team,
			first_name: first_name,
			last_name: last_name,
			username: username,
			email: email,
			password: password,
			position: position
		}
		let query = {_id: req.params.user_id}
		Wuser.getUserById(req.params.user_id, function(err, user){
			var last_password = user.password;
			Wuser.updateUser(last_password, query, updateWuser, function(err, val){
				if(err){
					console.log(err)
				}
				req.flash('success_msg', 'You updated a User')
				res.redirect('/'+req.params.team+'/'+req.params.id+'/admin/?tab=User');
			});
		});
	}
});

//Delete User
router.post('/:team/:id/admin/settings/delete/:user_id', ensureAuthenticated, function(req,res,next){
	let log_query = {user_id: req.params.user_id};
	let user_query = {_id: req.params.user_id};
	Time.deleteUser(log_query, function(err, val){});
	Request.deleteUser(log_query, function(err, response){});
	Wuser.deleteUser(user_query, function(err, data){
		if(err){return console.log(err);}
			res.redirect('/'+req.params.team+'/'+req.params.id+'/admin/?tab=User');
	});
});

//Account Settings
//Update
router.post('/:team/:id/admin/settings/update/', ensureAuthenticated, function (req,res,next){
	var team = req.body.team;
	var sched_in = req.body.sched_in;
	var sched_out = req.body.sched_out;
	var last_team = req.params.team;

	Account.getAccounts(function(err,acc){
		acc.forEach(function(a){
			if(a.team == last_team){
			} else if(a.team == team){
				err = 'Team already exist';
			}
		});

		req.checkBody('team', 'Team is required').notEmpty();

		let errors = req.validationErrors();

		if(err || errors){
			res.render('admin', {
				error: err,
				errors: errors,
			});
		} else {
			var query = {team: last_team};
			var updateAccount = {
				team: team,
				sched_in: sched_in,
				sched_out: sched_out
			};
			Account.updateAccount(query, updateAccount, function(err, account){
				if(err){
					console.log(err);
				}
				if(req.params.team !== team){
					var updateTeam = {
						team: team
					};
					Wuser.updateTeam(query, updateTeam, function(err, user){
						Time.getTimeLogsByTeam(last_team, function(err, logs){
							logs.forEach(function(log){
								Time.updateTeam(query, updateTeam, function(err, data){
								});
							});
							Request.getRequestByTeam(last_team, function(err,forms){
								if(forms){
									forms.forEach(function(form){
										Request.updateTeam(query, updateteam, function(err,val){
											if(err){
												console.log(err);
											}
										});
									});
								}
							});
						});
					});
				}
				res.redirect('/'+team+'/'+req.params.id+'/admin/?tab=Account');
			});
		}
	}); 
});

//Add Holidays
router.post('/:team/:id/admin/settings/holiday/add', ensureAuthenticated,  function(req,res,next){
	var query = {team: req.params.team};
	var holiday_date = moment(req.body.holiday_date).format('MM-DD')
	var holiday = {
		name: req.body.holiday_name,
		date: holiday_date
	}
	var year = moment().format('-YYYY');
	Wuser.getUsersByTeam(req.params.team, function(err, users){
		users.forEach(function(user){
			var newLog = new Time ({
				date: holiday_date+year,
				team: req.params.team,
				user_id: user._id,
				name: user.first_name + ' ' + user.last_name,
				status: {
				status: "Holiday"
				},
				timein: {
					timein: "N/A"
				},
				timeout: {
					timeout: "N/A"
				}
			});
			newLog.save(function(err){
				if(err){
					console.log(err);
				}
			});
		});
		Account.addHoliday(query, holiday, function(err, holiday){
			res.redirect('/'+req.params.team+'/'+req.params.id+'/admin/?tab=Account');
		});
	});
});

//Delete Holiday
router.post('/:team/:id/admin/settings/delete/holiday/:holiday_id', function(req,res,next){
	let query = {team: req.params.team};
	Account.delHoliday(query, req.params.holiday_id, function(err, response){
		if(err){return console.log(err);}
			res.redirect('/'+req.params.team+'/'+req.params.id+'/admin/?tab=Account');
	});
});

//-------------------------Report Page-------------------------------
//get report
router.get('/:team/:id/report', ensureAuthenticated, function(req,res,next){
	Wuser.getUserById(req.params.id, function(err, wuser){
		if(wuser.position == 'User'){
			res.redirect('/'+req.params.team+'/'+req.params.id);
		} else {
			var month = moment().format('MM-')
			var year = moment().format('-YYYY')
			var from = moment(month+'01'+year).format('MM-DD-YYYY');
			var to = moment().format('MM-DD-YYYY');
			var count = [];
			Account.getAccountByTeam(req.params.team, function(err,team){
				Wuser.getUsersByTeam(req.params.team, function(err, users){
					Time.getTimeLogsByTeam(req.params.team, function(err,logs){
					users.forEach(function(user){
						var present_count = 0;
						var late_count = 0;
						var absent_count = 0;
						var sick_count = 0;
						var vacation_count = 0;
						var arr = {};
						logs.forEach(function(log){
							if(log.user_id == user.id){
								if(log.date >= from && log.date <= to){
									if(log.status[0].status == 'Present'){
										present_count++;
									}
									if(log.status[0].status == 'Late'){
										late_count++;
									}
									if(log.status[0].status == 'Absent'){
										absent_count++;
									}
									if(log.status[0].status == 'Sick'){
										sick_count++;
									}
									if(log.status[0].status == 'Vacation'){
										vacation_count++;
									}
								}
							}
						});
						var userid = user.id;
						arr = {user_id: userid, present: present_count, late: late_count, absent: absent_count, sick: sick_count, vacation: vacation_count};
						count.push(arr);
					});
						res.render('report', {
							page: 'report',
							dates: moment().format('MM-DD-YYYY'),
							time: moment().format('HH:mm:ss'),
							wuser: wuser,
							user: users,
							user_id: req.params.id,
							team: team,
							logs: logs,
							count: count,
							from: from,
							to: to
						});
					});
				});
			});
		}
	});
});

//get report
router.post('/:team/:id/report', ensureAuthenticated, function(req,res,next){
	Wuser.getUserById(req.params.id, function(err, wuser){
		if(wuser.position == 'User'){
			res.redirect('/'+req.params.team+'/'+req.params.id);
		} else {
			var month = moment().format('MM-')
			var year = moment().format('-YYYY')
			if(req.body.from_date){
				var from = moment(req.body.from_date).format('MM-DD-YYYY');
				if(req.body.to_date){
					var to = moment(req.body.to_date).format('MM-DD-YYYY');
				} else {
					var to = moment().format('MM-DD-YYYY');
				}
			} else {
				var from = moment(month+'01'+year).format('MM-DD-YYYY');
				if(req.body.to_date){
					var to = moment(req.body.to_date).format('MM-DD-YYYY');
				} else {
					var to = moment().format('MM-DD-YYYY');
				}
			}
			var count = [];
			Account.getAccountByTeam(req.params.team, function(err,team){
				Wuser.getUsersByTeam(req.params.team, function(err, users){
					Time.getTimeLogsByTeam(req.params.team, function(err,logs){
						users.forEach(function(user){
							var present_count = 0;
							var late_count = 0;
							var absent_count = 0;
							var sick_count = 0;
							var vacation_count = 0;
							var arr = {};
							logs.forEach(function(log){
								if(log.user_id == user.id){
									if(log.date >= from && log.date <= to){
										if(log.status[0].status == 'Present'){
											present_count++;
										}
										if(log.status[0].status == 'Late'){
											late_count++;
										}
										if(log.status[0].status == 'Absent'){
											absent_count++;
										}
										if(log.status[0].status == 'Sick'){
											sick_count++;
										}
										if(log.status[0].status == 'Vacation'){
											vacation_count++;
										}
									}
								}
							});
							var userid = user.id;
							var name = user.first_name + ' ' + user.last_name;
							arr = {user_id: userid,
								name: name,
								present: present_count, 
								late: late_count, 
								absent: absent_count, 
								sick: sick_count, 
								vacation: vacation_count};
							count.push(arr);
						});
						var fields = ['user_id', 'name', 'present', 'late', 'absent', 'sick', 'vacation'];
						var fieldNames = ['User Id', 'Name', 'Present', 'Late', 'Absent', 'Sick', 'Vacation'];
						var csv = json2csv({ data: count, fields: fields, fieldNames: fieldNames});
						fs.writeFile('report('+from+')to('+to+').csv', csv, function(err) {
						  if (err) throw err;
						});
						res.render('report', {
							page: 'report',
							dates: moment().format('MM-DD-YYYY'),
							time: moment().format('HH:mm:ss'),
							wuser: wuser,
							user: users,
							user_id: req.params.id,
							team: team,
							logs: logs,
							count: count,
							from: from,
							to: to
						});
					});
				});
			});
		}
	});
});

//download report
router.post('/:team/:id/report/download', ensureAuthenticated, function(req,res,next){
	var count = [];
	var from = moment(req.body.from).format('MM-DD-YYYY');
	var to = moment(req.body.to).format('MM-DD-YYYY');
	Account.getAccountByTeam(req.params.team, function(err,team){
		Wuser.getUsersByTeam(req.params.team, function(err, users){
			Time.getTimeLogsByTeam(req.params.team, function(err,logs){
				users.forEach(function(user){
					var present_count = 0;
					var late_count = 0;
					var absent_count = 0;
					var sick_count = 0;
					var vacation_count = 0;
					var arr = {};
					logs.forEach(function(log){
						if(log.user_id == user.id){
							if(log.date >= from && log.date <= to){
								if(log.status[0].status == 'Present'){
									present_count++;
								}
								if(log.status[0].status == 'Late'){
									late_count++;
								}
								if(log.status[0].status == 'Absent'){
									absent_count++;
								}
								if(log.status[0].status == 'Sick'){
									sick_count++;
								}
								if(log.status[0].status == 'Vacation'){
									vacation_count++;
								}
							}
						}
					});
					var userid = user.id;
					var name = user.first_name + ' ' + user.last_name;
					arr = {user_id: userid,
						name: name,
						present: present_count, 
						late: late_count, 
						absent: absent_count, 
						sick: sick_count, 
						vacation: vacation_count};
					count.push(arr);
				});
				var fields = ['user_id', 'name', 'present', 'late', 'absent', 'sick', 'vacation'];
				var fieldNames = ['User Id', 'Name', 'Present', 'Late', 'Absent', 'Sick', 'Vacation'];
				var csv = json2csv({ data: count, fields: fields, fieldNames: fieldNames});
				fs.writeFile('report('+from+')to('+to+').csv', csv, function(err) {
					if(err){
						console.log(err);
					}
				});
				res.setHeader('Content-disposition', 'attachment; filename=report('+from+')to('+to+').csv');
				res.set('Content-Type', 'text/csv');
				res.status(200).send(csv);
			});
		});
	});
});

//------------------------Create User----------------------------
//Create Page
router.get('/:team/:id/create', ensureAuthenticated, function(req,res,next){
	Wuser.getUserById(req.params.id, function(err, wuser){
		if(wuser.position == 'User'){
			res.redirect('/'+req.params.team+'/'+req.params.id);
		} else {
			Account.getAccountByTeam(req.params.team, function(err,team){
				Wuser.getUserById(req.params.id, function(err, user){
					if(err){
						console.log(err);
					}
					res.render('create', {
						page: 'create',
						dates: moment().format('MM-DD-YYYY'),
						time: moment().format('HH:mm:ss'),
						wuser: user,
						user: user,
						user_id: req.params.id,
						team: team,
					});
				});
			});
		}
	});
});

//Create Post
router.post('/:team/:id/create', ensureAuthenticated, function(req,res,next){
	var first_name = req.body.fname;
	var last_name = req.body.lname;
	var username = req.body.username;
	var email = req.body.email;
	var team = req.body.team;
	var position = req.body.position;
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

	if(errors){
		res.render('create', {
			errors: errors,
		});
	} else {
		var newWuser = new Wuser({
			team: team,
			img: 'https://www.watsonmartin.com/wp-content/uploads/2016/03/default-profile-picture.jpg',
			first_name: first_name,
			last_name: last_name,
			username: username,
			email: email,
			password: password,
			position: position
		});
		Wuser.registerUser(newWuser, function(err, user){
			var newLog = new Time ({
				date: moment().format('MM-DD-YYYY'),
				team: team,
				user_id: user._id,
				name: first_name + ' ' + last_name,
				timein: [],
				timeout: [],
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
			res.redirect('/'+req.params.team+'/'+req.params.id);
		});
	}
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
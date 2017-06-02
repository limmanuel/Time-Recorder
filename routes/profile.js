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

//----------------Profile Page-----------------
router.get('/',ensureAuthenticated, function (req,res,next){
	var error;
	if(req.query.error){
		error = req.query.error;
	}
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
	var hours_spent=[];
	var arr = {};
	Account.getAccountByTeam(req.user.team, function(err,team){
		var team_log = team;
		Wuser.getUserById(req.user.id, function(err, user){
			var user_log = user;
			Time.getTimeLogsByUser(req.user.id, function(err, logs){
			var logs_log = logs;
				Request.getRequestByUser(req.user.id, function(err, forms){
					Time.getTimeLogsByUserAndDate(req.user.id, moment().format('MM-DD-YYYY'), function(err, log){
						logs.forEach(function(val){
							var bms = 0;
							var tms = 0;
							var bdate=val.date;
							var d;
							val.timein.forEach(function(tin, index){
								if(tin.timein !== 'N/A' && val.timeout[index] && tin){						
									var timems = moment(val.timeout[index].timeout,"HH:mm:ss").diff(moment(tin.timein,"HH:mm:ss"));
									tms=tms+timems;
									val.breakin.forEach(function(bin, index){
										if(bin.breakin !== 'N/A' && val.breakout[index] && bin){						
											var breakms = moment(val.breakout[index].breakout,"HH:mm:ss").diff(moment(bin.breakin,"HH:mm:ss"));
											bms=bms+breakms;
										}
									});
								}
							});
							ms = tms - bms;
							d = moment.duration(ms).format("HH[h] mm[m] ss[s]");
							arr = {hours: d, date:bdate}
							hours_spent.push(arr); 
						});
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
							wuser: req.user,
							user: user_log,
							user_id: req.user.id,
							log: log,
							logs: logs_log,
							team: team_log,
							filterStatus: filterStatus,
							filterMonth: filterMonth,
							forms: forms,
							hours_spent: hours_spent,
							error: error
						});
					});
				});
			});
		});
	});
});

//Home Tab
//Change Profile Picture
router.post('/image', ensureAuthenticated, function(req,res,next){
	let query = {_id: req.user.id};
	var img = {
		img: req.body.image
	};
	Wuser.setPicture(query, img, function(err, done){
		res.redirect('/profile');
	});
});

//TimeIn
router.post('/timein/:dates/:tin', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.user.id, req.params.dates, function(err, user){
		let query = {user_id: req.user.id, date: req.params.dates};
		let status_query = {user_id: req.user.id, date: req.params.dates, 'status.status': 'Absent'};
		var timein = moment().format('HH:mm:ss');
		var sched = moment(req.params.dates + ' ' +req.body.sched_in).add(1,'m').format('HH:mm:ss');
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
			res.redirect('/profile');
		});
	});
});

//TimeOut
router.post('/timeout/:dates/:tout', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.user.id, req.params.dates, function(err, user){
		let query = {user_id: req.user.id, date: req.params.dates};
		var timeout = moment().format('HH:mm:ss');
		var time = {
			timeout: timeout
		};
		Time.addTimeOut(query, time, function(err, tin){
			res.redirect('/profile');
		});
	});
});

//Break In
router.post('/breakin/:dates/:tin', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.user.id, req.params.dates, function(err, user){
		let query = {user_id: req.user.id, date: req.params.dates};
		var breakin = moment().format('HH:mm:ss');
		var time = {
			breakin: breakin
		};
		Time.addBreakIn(query, time, function(err, tin){
			res.redirect('/profile');
		});
	});
});

//Break Out
router.post('/breakout/:dates/:tout', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.user.id, req.params.dates, function(err, user){
		let query = {user_id: req.user.id, date: req.params.dates};
		var breakout = moment().format('HH:mm:ss');
		var time = {
			breakout: breakout
		};
		Time.addBreakOut(query, time, function(err, tin){
			res.redirect('/profile');
		});
	});
});

//Sick Leave
router.post('/status/:dates', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.user.id, req.params.dates, function(err, user){
		let query = {user_id: req.user.id, date: req.params.dates};
		let status_query = {user_id: req.user.id, date: req.params.dates, 'status.status': 'Absent'};
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
		Time.addTimeOut(query, timeout, function(err, tout){
			res.redirect('/profile');
		});
	});
});

//History Tab
//Filter
router.post('/filter', ensureAuthenticated, function(req,res,next){
	if(req.body.filterMonth){
		if (req.body.filterStatus){
			res.redirect('/profile/?tab=history&month='+req.body.filterMonth+'&status='+req.body.filterStatus);
		} else {
			res.redirect('/profile/?tab=history&month='+req.body.filterMonth);
		}
	} else if(req.body.filterStatus){
		res.redirect('/profile/?tab=history&status='+req.body.filterStatus);
	} else {
		res.redirect('/profile/?tab=history');
	}
});

//Form Tab
//Delete Request
router.post('/leave/form/delete/:leave_id', function(req,res,next){
	let query = {_id: req.params.leave_id};
	Request.delLeave(query, function(err, response){
		if(err){return console.log(err);}
			res.redirect('/profile/?tab=form');
	});
});

//Request Leave
router.post('/leave/form', ensureAuthenticated, function(req,res,next){
	if(req.body.leave){
		var date = req.body.leave;
	} else {
		var error = "Date not specified";
		res.redirect('/profile/?tab=form&error='+error);
	}
	if(moment(date).format('MM-DD-YYYY') <= moment().add(14, 'd').format('MM-DD-YYYY')){
		var error = "Can't request on that day";
		res.redirect('/profile/?tab=form&error='+error);
	} else {
		var newRequest = new Request ({
				date: moment().format('MM-DD-YYYY'),
				team: req.user.team,
				user_id: req.user.id,
				leave_date: moment(date).format('MM-DD-YYYY'),
				leave_status: "pending",
				message: req.body.message
			});
		newRequest.save(function(err){
			if(err){
				console.log(err);
			}
			res.redirect('/profile');
		});
		Wuser.getUsersByTeam(req.user.team, function(err, users){
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
						res.redirect('/profile');
					});
				}
			});
		});
	}
});

//Settings Tab
//Update User
router.post('/', ensureAuthenticated, function(req,res,next){
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
		Account.getAccountByTeam(req.user.team, function(err,team){
			var team_log = team;
			Wuser.getUserById(req.user.id, function(err, user){
				var user_log = user;
				Time.getTimeLogsByUser(req.user.id, function(err, logs){
				var logs_log = logs;
					Request.getRequestByUser(req.user.id, function(err, forms){
						Time.getTimeLogsByUserAndDate(req.user.id, moment().format('MM-DD-YYYY'), function(err, log){
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
								wuser: req.user,
								user: user_log,
								user_id: req.user.id,
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
		let query = {_id: req.user.id}
		Wuser.getUserById(req.user.id, function(err, user){
			var last_password = user.password;
			Wuser.updateUser(last_password, query, updateWuser, function(err, val){
				if(err){
					console.log(err)
				}
				req.flash('success_msg', 'You updated your profile')
				res.redirect('/profile');
			});
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
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
	var breaks = "";
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
							var ms = 0;
							var bms = 0;
							var tms = 0;
							var bdate=val.date;
							var d;
							val.timeout.forEach(function(tout, index){
								if(val.breakout){
									val.breakout.forEach(function(bout, ind){
										if(bout.breakout !== 'N/A'){						
											var breakms = moment(bout.breakout,"HH:mm:ss").diff(moment(val.breakin[ind].breakin,"HH:mm:ss"));
											bms=bms+breakms;
										}
									});
								}
								if(tout.timeout !== 'N/A' && val.timein[index] && tout){						
									var timems = moment(tout.timeout,"HH:mm:ss").diff(moment(val.timein[index].timein,"HH:mm:ss"));
									tms=tms+timems;
								}
							});
							ms = tms - bms;
							bd = moment.duration(bms).format("HH:mm:ss");
							if(ms > 0){
								d = moment.duration(ms).format("HH[h] mm[m] ss[s]");
							}
							arr = {hours: d, date:bdate}
							hours_spent.push(arr);
							if(bdate == moment().format('MM-DD-YYYY') && bms >= 3600000){
								breaks = 'No breaks'
							}
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
							breaks: breaks,
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
	Account.getAccountByTeam(req.user.team, function(err,acc){
		var lati = req.body.lat;
		var long = req.body.lon;
		var l_name = "";
		acc.locations.forEach(function(location){
			var lon1 = location.lon + 0.005;
			var lon2 = location.lon - 0.005;
			var lat1 = location.lat + 0.005;
			var lat2 = location.lat - 0.005;
			if(lon1>=long<=lon2 && lat1>=lati<=lat2 && l_name==""){
				l_name = location.location_name;
			}
		});
			Time.getTimeLogsByUserAndDate(req.user.id, req.params.dates, function(err, user){
				if(user.timein.length == user.timeout.length){
					let query = {user_id: req.user.id, date: req.params.dates};
					let status_query = {user_id: req.user.id, date: req.params.dates, 'status.status': 'Absent'};
					var timein = moment().format('HH:mm:ss');
					var sched = moment(req.params.dates + ' ' +req.body.sched_in).add(1,'m').format('HH:mm:ss');
					var time = {
						timein: timein
					}
					if(l_name !== ""){
						var time = {
							timein: timein,
							location: l_name
						}
						Time.addTimeIn(query, time, function(err, tin){});
					} else {
						var time = {
							timein: timein,
							location: 'No Location'
						}
						Time.addTimeIn(query, time, function(err, tin){});
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
				}
			});
		if(l_name !== ""){
			req.flash('success_msg', 'You are currently at ' + l_name);
		} else {
			req.flash('error_msg', 'Location not registered');
		}
		res.redirect('/profile');
	});
});

//TimeOut
router.post('/timeout/:dates/:tout', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.user.id, req.params.dates, function(err, log){
		if(log.timein.length == log.timeout.length+1){
			let query = {user_id: req.user.id, date: req.params.dates};
			var timeout = moment().format('HH:mm:ss');
			var time = {
				timeout: timeout
			};
			if(log.breakin.length !== 0){
				Time.addTimeOut(query, time, function(err, tin){});
			} else {
				var breakin = {
					breakin: 'N/A'
				}
				var breakout = {
					breakout: 'N/A'
				}
				Time.addBreakIn(query, breakin, function(err, bin){});
				Time.addBreakOut(query, breakout, function(err, bout){});
				Time.addTimeOut(query, time, function(err, tout){});
			}
		}
		res.redirect('/profile');
	});
});

//Break In
router.post('/breakin/:dates/:tin', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.user.id, req.params.dates, function(err, log){
		if(log.breakin.length == log.breakout.length){
			let query = {user_id: req.user.id, date: req.params.dates};
			var breakin = moment().format('HH:mm:ss');
			var time = {
				breakin: breakin
			};
			Time.addBreakIn(query, time, function(err, tin){});
		}
		res.redirect('/profile');
	});
});

//Break Out
router.post('/breakout/:dates/:tout', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.user.id, req.params.dates, function(err, log){
		if(log.breakin.length == log.breakout.length+1){
			let query = {user_id: req.user.id, date: req.params.dates};
			var breakout = moment().format('HH:mm:ss');
			var time = {
				breakout: breakout
			};
			Time.addBreakOut(query, time, function(err, tin){});
		}
		res.redirect('/profile');
	});
});

//Sick Leave
router.post('/status/:dates', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUserAndDate(req.user.id, req.params.dates, function(err, log){
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
		var status = {
			status: "Sick"
		}
		Time.updateStatus(status_query, status, function(err, data){});
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
		if(err){return console.log(err);}
			res.redirect('/profile/?tab=form');
});

//Request Leave
router.post('/leave/form', ensureAuthenticated, function(req,res,next){
	if(req.body.leave){
		var date = req.body.leave;
	} else {
		req.flash('error_msg', "Date not specified");
		res.redirect('/profile/?tab=form');
	}
	if(moment(date).format('MM-DD-YYYY') <= moment().add(14, 'd').format('MM-DD-YYYY') || req.user.leave_count <= 0){
		req.flash('error_msg', 'Reached Leave Limit')
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
		});
		Wuser.getUsersByTeam(req.user.team, function(err, users){
			users.forEach(function(user){
				if((user.position == 'Manager' && user.department == req.user.department) || user.department == 'Head'){
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
					});
				}
			});
		});
	}
	res.redirect('/profile/?tab=form');
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
	var department = req.body.department;
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
			position: position,
			department: department,
			leave_count: req.user.leave_count
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
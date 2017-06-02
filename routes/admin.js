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

//--------------------Admin Page--------------------------
router.get('/', ensureAuthenticated, function (req,res,next){
	if(req.user.position !== 'Manager' && req.user.department !== 'Head'){
		res.redirect('/profile');
	} else {
		var error;
		var errors;
		if(req.query.error){
			error = req.query.error
		}
		if(req.query.errors){
			errors = req.query.errors
		}
		if(req.query.tab) {
			var tab = req.query.tab;
		} else {
			var tab = 'User';
		}
		Account.getAccountByTeam(req.user.team, function(err,team){
				Wuser.getUsersByTeam(req.user.team, function(err, users){
					Time.getTimeLogsByTeam(req.user.team, function(err,logs){
						res.render('admin', {
							page: 'admin',
							tab: tab,
							dates: moment().format('MM-DD-YYYY'),
							time: moment().format('HH:mm:ss'),
							wuser: req.user,
							user: users,
							user_id: req.user.id,
							team: team,
							logs: logs,
							error: error,
							errors: errors
						});
					});
				});
		});
	}
});

//Manage User
//Update Position
router.post('/user/update/:user_id', ensureAuthenticated, function (req,res,next){
	var first_name = req.body.fname;
	var last_name = req.body.lname;
	var username = req.body.username;
	var email = req.body.email;
	var team = req.body.team;
	var department = req.body.department;
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
		res.redirect('/admin/?tab=User&errors='+errors);
	} else {
		var updateWuser = {
			team: team,
			first_name: first_name,
			last_name: last_name,
			username: username,
			email: email,
			password: password,
			department: department,
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
				res.redirect('/admin/?tab=User');
			});
		});
	}
});

//Delete User
router.post('/user/delete/:user_id', ensureAuthenticated, function(req,res,next){
	let log_query = {user_id: req.params.user_id};
	let user_query = {_id: req.params.user_id};
	Time.deleteUser(log_query, function(err, val){});
	Request.deleteUser(log_query, function(err, response){});
	Wuser.deleteUser(user_query, function(err, data){
		if(err){return console.log(err);}
			res.redirect('/admin/?tab=User');
	});
});

//Departments/positions tab
//add department
router.post('/department/create', function(req,res,next){
	let query = {team: req.user.team};
	var dept_name = req.body.dept_name;
	let pquery = {team: req.user.team, departments: {$elemMatch: {department: dept_name}}}
	var department = {
		department: dept_name
	}
	var position = {
		position: "Manager"
	}
	Account.createDepartment(query,department,function(err,dept){
		Account.addPosition(pquery, position, function(err,pos){
			res.redirect('/admin?tab=Department')
		});
	});
});

//delete Department
router.post('/department/delete/:dept_id', function(req,res,next){
	let query = {team: req.user.team};
	var dept_id = req.params.dept_id;
	Account.delDepartment(query,dept_id,function(err,dept){
		res.redirect('/admin?tab=Department')
	});
});

//add position
router.post('/department/add/position', function(req,res,next){
	var dept_name = req.body.dept_name;
	var pos_name = req.body.pos_name;
	let query = {team: req.user.team, departments: {$elemMatch: {department: dept_name}}}
	var position = {
		position: pos_name
	}
	Account.addPosition(query, position, function(err,pos){
		res.redirect('/admin?tab=Department');
	});
});

//delete Position
router.post('/department/delete/position/:pos_id', function(req,res,next){
	let query = {team: req.user.team};
	var pos_id = req.params.pos_id;
	Account.delPosition(query,pos_id,function(err,pos){
		res.redirect('/admin?tab=Department')
	});
});

//Account Settings
//Update
router.post('/settings/update', ensureAuthenticated, function (req,res,next){
	var team = req.body.team;
	var sched_in = req.body.sched_in;
	var sched_out = req.body.sched_out;
	var last_team = req.user.team;

	Account.getAccounts(function(err,acc){
		acc.forEach(function(a){
			if(a.team == last_team){
			} else if(a.team == team){
				err = 'Team already exist';
			}
		});

		req.checkBody('team', 'Team is required').notEmpty();

		let errors = req.validationErrors();
		if(errors){
			var error;
			if(req.query.error){
				error = req.query.error
			}
			if(req.query.tab) {
				var tab = req.query.tab;
			} else {
				var tab = 'User';
			}
			Account.getAccountByTeam(req.user.team, function(err,team){
					Wuser.getUsersByTeam(req.user.team, function(err, users){
						Time.getTimeLogsByTeam(req.user.team, function(err,logs){
							res.render('admin', {
								page: 'admin',
								tab: tab,
								dates: moment().format('MM-DD-YYYY'),
								time: moment().format('HH:mm:ss'),
								wuser: req.user,
								user: users,
								user_id: req.user.id,
								team: team,
								logs: logs,
								error: error,
								errors: errors
							});
						});
					});
			});
		} else if(err){
			res.redirect('/admin/?tab=Account&error='+err);
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
				if(req.user.team !== team){
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
				res.redirect('/admin/?tab=Account');
			});
		}
	}); 
});

//Add Holidays
router.post('/settings/holiday/add', ensureAuthenticated,  function(req,res,next){
	if(req.body.holiday_date || req.body.holiday_name){
		var query = {team: req.user.team};
		var holiday_date = moment(req.body.holiday_date).format('MM-DD')
		var holiday = {
			name: req.body.holiday_name,
			date: holiday_date
		}
		var year = moment().format('-YYYY');
		Wuser.getUsersByTeam(req.user.team, function(err, users){
			users.forEach(function(user){
				var newLog = new Time ({
					date: holiday_date+year,
					team: req.user.team,
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
				});
			});
			Account.addHoliday(query, holiday, function(err, holiday){
				res.redirect('/admin/?tab=Account');
			});
		});
	} else {
		res.redirect('/admin/?tab=Account&error=Add Failed');
	}
});

//Delete Holiday
router.post('/settings/delete/holiday/:holiday_id', function(req,res,next){
	let query = {team: req.user.team};
	Account.delHoliday(query, req.params.holiday_id, function(err, response){
		if(err){return console.log(err);}
			res.redirect('/admin/?tab=Account');
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
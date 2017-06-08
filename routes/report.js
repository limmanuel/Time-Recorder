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

//-------------------------Report Page-------------------------------
//get report
router.get('/', ensureAuthenticated, function(req,res,next){
	if(req.user.position !== 'Manager' && req.user.department !== 'Head'){
		res.redirect('/report');
	} else {
		var from = moment().subtract(1,'M').format('MM-DD-YYYY');
		var to = moment().format('MM-DD-YYYY');
		var count = [];
		Account.getAccountByTeam(req.user.team, function(err,team){
			Wuser.getUsersByTeam(req.user.team, function(err, users){
				Time.getTimeLogsByTeam(req.user.team, function(err,logs){
				users.forEach(function(user){
					var present_count = 0;
					var late_count = 0;
					var absent_count = 0;
					var sick_count = 0;
					var vacation_count = 0;
					var hours_spent = "";
					var ms = 0;
					var arr = {};
					logs.forEach(function(log){
						if(log.user_id == user.id){
							if(log.date >= from && log.date <= to && log.timein[0] && log.timeout[0]){
								var bms = 0;
								var tms = 0;
								var name = log.name;
								var bdate=log.date;
								var d;
								log.timeout.forEach(function(tout, index){
									if(log.breakout){
										log.breakout.forEach(function(bout, ind){
											if(bout.breakout !== 'N/A'){						
												var breakms = moment(bout.breakout,"HH:mm:ss").diff(moment(log.breakin[ind].breakin,"HH:mm:ss"));
												bms=bms+breakms;
											}
										});
									}
									if(tout.timeout !== 'N/A' && log.timein[index] && tout){						
										var timems = moment(tout.timeout,"HH:mm:ss").diff(moment(log.timein[index].timein,"HH:mm:ss"));
										tms=tms+timems;
									}
								});
								var milli = tms - bms;
								ms = ms + milli;
								if(ms > 0){
									hours_spent = moment.duration(ms).format("HH[h] mm[m] ss[s]");
								}
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
					arr = {user_id: userid, 
						present: present_count, 
						late: late_count, absent: 
						absent_count, 
						sick: sick_count, 
						vacation: vacation_count, 
						hours: hours_spent
					};
					count.push(arr);
				});
					res.render('report', {
						page: 'report',
						dates: moment().format('MM-DD-YYYY'),
						time: moment().format('HH:mm:ss'),
						wuser: req.user,
						user: users,
						user_id: req.user.id,
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

//get report
router.post('/', ensureAuthenticated, function(req,res,next){
		if(req.user.position == 'User'){
			res.redirect('/report');
		} else {
			if(req.body.from_date){
				var from = moment(req.body.from_date).format('MM-DD-YYYY');
				if(req.body.to_date){
					var to = moment(req.body.to_date).format('MM-DD-YYYY');
				} else {
					var to = moment().format('MM-DD-YYYY');
				}
			} else {
				var from = moment().subtract(1,'M').format('MM-DD-YYYY');
				if(req.body.to_date){
					var to = moment(req.body.to_date).format('MM-DD-YYYY');
				} else {
					var to = moment().format('MM-DD-YYYY');
				}
			}
			var count = [];
			Account.getAccountByTeam(req.user.team, function(err,team){
				Wuser.getUsersByTeam(req.user.team, function(err, users){
					Time.getTimeLogsByTeam(req.user.team, function(err,logs){
						users.forEach(function(user){
							var present_count = 0;
							var late_count = 0;
							var absent_count = 0;
							var sick_count = 0;
							var vacation_count = 0;
							var hours_spent = "00s";
							var ms = 0;
							var arr = {};
							logs.forEach(function(log){
								if(log.user_id == user.id){
									if(log.date >= from && log.date <= to && log.timein[0] && log.timeout[0]){
										var bms = 0;
										var tms = 0;
										var name = log.name;
										var bdate=log.date;
										var d;
										log.timeout.forEach(function(tout, index){
											if(log.breakout){
												log.breakout.forEach(function(bout, ind){
													if(bout.breakout !== 'N/A'){						
														var breakms = moment(bout.breakout,"HH:mm:ss").diff(moment(log.breakin[ind].breakin,"HH:mm:ss"));
														bms=bms+breakms;
													}
												});
											}
											if(tout.timeout !== 'N/A' && log.timein[index] && tout){						
												var timems = moment(tout.timeout,"HH:mm:ss").diff(moment(log.timein[index].timein,"HH:mm:ss"));
												tms=tms+timems;
											}
										});
										var milli = tms - bms;
										ms = ms + milli;
										if(ms > 0){
											hours_spent = moment.duration(ms).format("HH[h] mm[m] ss[s]");
										}
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
								vacation: vacation_count,
								hours: hours_spent
							};
							count.push(arr);
						});
						res.render('report', {
							page: 'report',
							dates: moment().format('MM-DD-YYYY'),
							time: moment().format('HH:mm:ss'),
							wuser: req.user,
							user: users,
							user_id: req.user.id,
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

//download report
router.post('/download', ensureAuthenticated, function(req,res,next){
	var count = [];
	var from = moment(req.body.from).format('MM-DD-YYYY');
	var to = moment(req.body.to).format('MM-DD-YYYY');
	Account.getAccountByTeam(req.user.team, function(err,team){
		Wuser.getUsersByTeam(req.user.team, function(err, users){
			Time.getTimeLogsByTeam(req.user.team, function(err,logs){
				users.forEach(function(user){
					var present_count = 0;
					var late_count = 0;
					var absent_count = 0;
					var sick_count = 0;
					var vacation_count = 0;
					var hours_spent = "00s";
					var ms = 0;
					var arr = {};
					logs.forEach(function(log){
						if(log.user_id == user.id){
							if(log.date >= from && log.date <= to && log.timein[0] && log.timeout[0]){
								var bms = 0;
								var tms = 0;
								var name = log.name;
								var bdate=log.date;
								var d;
								log.timeout.forEach(function(tout, index){
									if(log.breakout){
										log.breakout.forEach(function(bout, ind){
											if(bout.breakout !== 'N/A'){						
												var breakms = moment(bout.breakout,"HH:mm:ss").diff(moment(log.breakin[ind].breakin,"HH:mm:ss"));
												bms=bms+breakms;
											}
										});
									}
									if(tout.timeout !== 'N/A' && log.timein[index] && tout){						
										var timems = moment(tout.timeout,"HH:mm:ss").diff(moment(log.timein[index].timein,"HH:mm:ss"));
										tms=tms+timems;
									}
								});
								var milli = tms - bms;
								ms = ms + milli;
								if(ms > 0){
									hours_spent = moment.duration(ms).format("HH[h] mm[m] ss[s]");
								}
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
						vacation: vacation_count,
						hours: hours_spent
					};
					count.push(arr);
				});
				var fields = ['null', 'user_id', 'name', 'present', 'late', 'absent', 'sick', 'vacation', 'hours'];
				var fieldNames = [req.user.team, 'User Id', 'Name', 'Present', 'Late', 'Absent', 'Sick', 'Vacation', 'Hours Spent'];
				var csv = json2csv({ data: count, fields: fields, fieldNames: fieldNames});
				res.setHeader('Content-disposition', 'attachment; filename=report('+from+')to('+to+').csv');
				res.set('Content-Type', 'text/csv');
				res.status(200).send(csv);
			});
		});
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
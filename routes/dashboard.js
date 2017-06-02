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

//-------------------Dashboard Page------------------------
router.get('/', ensureAuthenticated, function (req,res,next){
	if(req.query.month){
		var filterMonth = req.query.month.split(',');
		if(req.query.status){
			var filterStatus = req.query.status.split(',');
		} else {
			var filterStatus = ['Absent', 'Present', 'Late', 'Sick', 'Vacation'];
		}
	} else {
		var filterMonth = ['01','02','03','04','05','06','07','08','09','10','11','12'];
		if(req.query.status){
			var filterStatus = req.query.status.split(',');
		} else {
			var filterStatus = ['Absent', 'Present', 'Late', 'Sick', 'Vacation'];
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
			Wuser.getUsersByTeam(req.user.team, function(err, users){
				Time.getTimeLogsByTeam(req.user.team, function(err, logs){
					Time.getTimeLogsByDate(moment().format('MM-DD-YYYY'), req.user.team, function(err, log){
						Request.getRequestByTeam(req.user.team, function(err, forms){
							logs.forEach(function(val){
								var bms = 0;
								var tms = 0;
								var name = val.name;
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
								arr = {hours: d, date:bdate, name: name}
								hours_spent.push(arr); 
							});
							res.render('dashboard', {
								page: 'dashboard',
								tab: tab,
								moment: moment,
								datepicker: datepicker,
								dates: moment().format('MM-DD-YYYY'),
								time: moment().format('HH:mm:ss'),
								wuser: req.user,
								user: users,
								user_id: req.user.id,
								log: log,
								logs: logs,
								team: team,
								filterStatus: filterStatus,
								filterMonth: filterMonth,
								hours_spent: hours_spent,
								forms: forms
							});
						});
					});
				});
			});
	});
});

//History Tab
//Filter
router.post('/filter', ensureAuthenticated,  function(req,res,next){
	if(req.body.filterMonth){
		if (req.body.filterStatus){
			res.redirect('/dashboard/?tab=history&month='+req.body.filterMonth+'&status='+req.body.filterStatus);
		} else {
			res.redirect('/dashboard/?tab=history&month='+req.body.filterMonth);
		}
	} else if(req.body.filterStatus){
		res.redirect('/dashboard/?tab=history&status='+req.body.filterStatus);
	} else {
		res.redirect('/dashboard/?tab=history');
	}
});

//Form Tab
//Update Form
router.post('/leave/form/:user_id/update/:leave_id', ensureAuthenticated, function(req,res,next){
	let query = {_id: req.params.leave_id};
	var leave_date = req.body.leave_date;
	var leave_status = req.body.leave_status;
	if(leave_status == 'deny'){
		Request.updateLeave(query, leave_status, function(err,data){
			if(err){return console.log(err);}
			res.redirect('/dashboard/?tab=form');
		});
	} else {
		var newLog = new Time ({
			date: leave_date,
			team: req.user.team,
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
			Request.updateLeave(query, leave_status, function(err,val){
				res.redirect('/dashboard/?tab=form');
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
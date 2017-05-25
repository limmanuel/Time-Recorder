var express = require('express');
var router = express.Router();
var moment = require('moment');
var passport = require('passport');
var localstr = require('passport-local').Strategy;
var datepicker = require('js-datepicker');

let Account = require('../model/account.js');
let Wuser = require('../model/user.js');
let Time = require('../model/timelog.js');
let Request = require('../model/request.js');


router.get('/register', function(req,res,next){
	res.render('register',{
		page: 'register',
	});
});

router.get('/login', function(req,res,next){
	Account.getAccounts(function(err, accounts){
		accounts.forEach(function(account){
			if(account !== null && account!== undefined){
				Wuser.getUsersByTeam(account.team,function(err, users){
					users.forEach(function(user){
						if(user !== null && user!== undefined){
							var userid = user._id;
							Time.getTimeLogsByUser(user._id, function(err, logs){
								var leav = logs.leave;
								var l = 0;
								var leave_id = "";
								leav.forEach(function(data){
									if(data.leave_date == moment().format('MM-DD-YYYY')){
										l=1;
										leave_id = data._id;
									}
								});
								if(l==1 && leave_id !== ""){
									let status_query = {user_id: userid};
									var status_arr = {
										status: "Leave",
										date: moment().format('MM-DD-YYYY')
									}
									var timein_arr = {
										timein: "N/A",
										date: moment().format('MM-DD-YYYY')
									}
									var timeout_arr = {
										timeout: "N/A",
										date: moment().format('MM-DD-YYYY')
									}
									Time.addTimeIn(status_query, timein_arr, function(err, tin){});
									Time.addTimeOut(status_query, timeout_arr, function(err, tout){});
									Time.addStatus(status_query, status_arr, function(err, data){});
									Time.delLeave(status_query, leave_id, function(err,val){});
								} else {
									var query = {user_id: userid};
									var status = {
										status: "Absent",
										date: moment().format('MM-DD-YYYY')
									}
									var stat = logs.status;
									var s = 0;
									stat.forEach(function(val){
										if(val.date == moment().format('MM-DD-YYYY')){
											s = 1;
										}
									});
									if(s == 0){
										Time.addStatus(query, status, function(err, data){});
									}
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
			moment: moment,
			datepicker: datepicker,
			account: accounts
		});
	});
});

router.get('/logout', function(req,res,next){
	req.logout();
	req.flash('success_msg','You are logged out');
	res.redirect('/login');
});

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

	req.checkBody('fname', 'First Name is required').notEmpty();
	req.checkBody('lname', 'Last Name is required').notEmpty();
	req.checkBody('username', 'Username is required').notEmpty();
	req.checkBody('team', 'Team is required').notEmpty();
	req.checkBody('email', 'Email is required').isEmail();
	req.checkBody('password', 'Password is required').notEmpty();
	req.checkBody('password2', 'Passwords do not match').equals(password);

	let errors = req.validationErrors();

	Account.getAccounts(function(err,acc){
		if(err){
			console.log(err);
		}if(errors){
			res.render('register', {
				errors: errors,
			});
		} else {
			var newAccount = new Account({
				team: team,
				sched_in: sched_in,
				sched_out: sched_out
			});
			Account.registerAccount(newAccount, function(err, account){
				if(err){
					console.log(err);
				}
				var newWuser = new Wuser({
					team: team,
					team_id: account._id,
					first_name: first_name,
					last_name: last_name,
					username: username,
					email: email,
					password: password,
					position: position
				});
				Wuser.registerUser(newWuser, function(err, user){
					if(err){
						console.log(err)
					}
					var newTimelog = new Time({
						team: team,
						user_id: user._id,
						timein: [],
						timeout: [],
						status: [],
						leave: []
					});
					newTimelog.save(function(err){
						if(err){
							console.log(err)
						}
						req.flash('success_msg', 'You are registered and can login')
						res.redirect('/login');
					});
				});
			});
		}
	});
});

passport.use(new localstr({passReqToCallback: true}, function(req,username,password,done){
	var team = req.body.team;
	Wuser.getUserByUsername(team, username, function(err,user){
		if (err){
			console.log(err);
		}
		if(!user){
			return done(null,false,{message:'No user found'})
		}
		console.log('You are logged in to '+ team);
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

passport.serializeUser(function(user, done) {
	done(null, user._id);
});

passport.deserializeUser(function(id, done) {
	Wuser.getUserById(id, function(err, user) {
		done(err, user);
	});
});


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
				moment: moment,
				datepicker: datepicker,
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

router.get('/', function(req,res,next){
	res.redirect('/login')
})

router.get('/:team/:id',ensureAuthenticated, function (req,res,next){
	if(req.query.filter){
		var filter = req.query.filter;
	} else {
		var filter = moment().format('MM');
	} if(req.query.tab) {
		var tab = req.query.tab;
	} else {
		var tab = 'home';
	}
	Wuser.getUserById(req.params.id, function(err, user){
		var user_log = user;
		Time.getTimeLogsByUser(req.params.id, function(err, logs){
			var logs_log = logs;
			Account.getAccountByTeam(req.params.team, function(err,team){
				var team_log = team;
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
					logs: logs_log,
					team: team_log,
					filter: filter
				});
			});
		});
	});
});

router.post('/:team/:id/filter', ensureAuthenticated,  function(req,res,next){
	res.redirect('/'+req.params.team+'/'+req.params.id+'/?tab=history&filter='+req.body.filterMonth);
});

router.post('/:team/:id/timein/:dates/:tin', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUser(req.params.id, function(err, user){
		let query = {user_id: req.params.id};
		let status_query = {user_id: req.params.id, 'status.date': req.params.dates};
		var timein = moment().format('HH:mm:ss');
		var sched = req.body.sched_in;
		var time = {
			timein: timein,
			date: moment().format('MM-DD-YYYY')
		}
		if(timein > sched){
			var status = {
				status: "Late",
				date: moment().format('MM-DD-YYYY')
			}
			if(user.status.length == user.timein.length){
				Time.addStatus(query, status, function(err, data){});
			} else {
				Time.updateStatus(status_query, status, function(err, data){});
			}
		} else {
			var status = {
				status: "Present",
				date: moment().format('MM-DD-YYYY')
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

router.post('/:team/:id/timeout/:dates/:tout', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUser(req.params.id, function(err, user){
		let query = {user_id: req.params.id};
		var timeout = moment().format('HH:mm:ss');
		var sched = req.body.sched_out;
		var time = {
			timeout: timeout,
			date: moment().format('MM-DD-YYYY')
		}
		Time.addTimeOut(query, time, function(err, tout){
			res.redirect('/'+req.params.team+'/'+req.params.id);
		});
	});
});

router.post('/:team/:id/status/:dates', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUser(req.params.id, function(err, user){
		let query = {user_id: req.params.id};
		let status_query = {user_id: req.params.id, 'status.date': req.params.dates};
		var status = {
			status: "Sick",
			date: moment().format('MM-DD-YYYY')
		}
		var timein = {
			timein: "N/A",
			date: moment().format('MM-DD-YYYY')
		}
		var timeout = {
			timeout: "N/A",
			date: moment().format('MM-DD-YYYY')
		}
		Time.addTimeIn(query, timein, function(err, tin){
		});
		Time.addTimeOut(query, timeout, function(err, tout){
		});
		if(user.status.length == user.timein.length){
			Time.addStatus(query, status, function(err, data){
				res.redirect('/'+req.params.team+'/'+req.params.id);
			});
		} else {
			Time.updateStatus(status_query, status, function(err, data){
				res.redirect('/'+req.params.team+'/'+req.params.id);
			});
		}
	});
});

router.post('/:team/:id/leave/form/:dates', ensureAuthenticated,  function(req,res,next){
	Time.getTimeLogsByUser(req.params.id, function(err, user){
		let query = {user_id: req.params.id};
		var date = req.body.leave;
		var request = {
			date_requested: moment().format('MM-DD-YYYY'),
			leave_date: moment(date).format('MM-DD-YYYY'),
			status: "pending"
		}
		Time.reqLeave(query, request, function(err, data){
			res.redirect('/'+req.params.team+'/'+req.params.id);
		});
	});
});

router.post('/:team/:id/leave/form/delete/:leave_id',function(req,res,next){
	let query = {user_id: req.params.id};
	Time.delLeave(query, req.params.leave_id, function(err, response){
		if(err){return console.log(err);}
			res.redirect('/'+req.params.team+'/'+req.params.id+'/?tab=form');
	});
});

router.get('/:team/:id/create',ensureAuthenticated, function (req,res,next){
	Wuser.getUserById(req.params.id, function(err, user){
		Time.getTimeLogsByUser(req.params.id, function(err, logs){
			Account.getAccountByTeam(req.params.team, function(err,team){
				res.render('create', {
					page: 'create',
					moment: moment,
					datepicker: datepicker,
					dates: moment().format('MM-DD-YYYY'),
					time: moment().format('HH:mm:ss'),
					wuser: user,
					user: user,
					user_id: req.params.id,
					logs: logs,
					team: team
				});
			});
		});
	});
});

router.post('/:team/:id/create', ensureAuthenticated,  function(req,res,next){
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
			first_name: first_name,
			last_name: last_name,
			username: username,
			email: email,
			password: password,
			position: position
		});
		Wuser.registerUser(newWuser, function(err, user){
			if(err){
				console.log(err)
			}
			var newTimelog = new Time({
				team: team,
				user_id: user._id,
				timein: [],
				timeout: [],
				status: [],
				leave: []
			});
			newTimelog.save(function(err){
				if(err){
					console.log(err)
				}
				req.flash('success_msg', 'You created a new user')
				res.redirect('/'+req.params.team+'/'+req.params.id);
			});
		});
	}
});

router.post('/:team/:id/update', ensureAuthenticated,  function(req,res,next){
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
	req.checkBody('password2', 'Passwords do not match').equals(password);

	let errors = req.validationErrors();

	if(errors){
		res.render('update', {
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

router.get('/:team/:id/dashboard', ensureAuthenticated, function (req,res,next){
	if(req.query.filter){
		var filter = req.query.filter;
	} else {
		var filter = moment().format('MM');
	} if(req.query.tab) {
		var tab = req.query.tab;
	} else {
		var tab = 'home';
	}
	Wuser.getUserById(req.params.id, function(err, wuser){
		Wuser.getUsersByTeam(req.params.team, function(err, users){
			Time.getTimeLogsByTeam(req.params.team, function(err, logs){
				Account.getAccountByTeam(req.params.team, function(err,team){
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
						logs: logs,
						team: team,
						filter: filter
					});
				});
			});
		});
	});
});

router.post('/:team/:id/dashboard/filter', ensureAuthenticated,  function(req,res,next){
	res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=history&filter='+req.body.filterMonth);
});

router.post('/:team/:id/dashboard/leave/form/:user_id/update/:leave_id',function(req,res,next){
	let query = {user_id: req.params.user_id};
	let leave_query = {user_id: req.params.user_id, 'leave._id': req.params.leave_id};
	var date_requested = req.body.date_requested;
	var leave_date = req.body.leave_date;
	var leave_status = req.body.leave_status;
	var leave = {
		date_requested: date_requested,
		leave_date: leave_date,
		status: leave_status
	};
	if(leave_status == 'deny'){
		Time.delLeave(query, req.params.leave_id, function(err,data){
		if(err){return console.log(err);}
			res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=form');
		});
	} else {
		Time.updateLeave(leave_query, leave, function(err, response){
			if(err){return console.log(err);}
				res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=form');
		});
	}
});

router.post('/:team/:id/dashboard/settings/update/:user_id', ensureAuthenticated, function (req,res,next){
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
				res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=settings');
			});
		});
	}
});

router.post('/:team/:id/dashboard/settings/delete/:user_id',function(req,res,next){
	let log_query = {user_id: req.params.user_id};
	let user_query = {_id: req.params.user_id};
	Time.deleteUser(log_query, function(err, val){});
	Wuser.deleteUser(user_query, function(err, data){
		if(err){return console.log(err);}
			res.redirect('/'+req.params.team+'/'+req.params.id+'/dashboard/?tab=settings');
	});
});

function ensureAuthenticated(req,res,next){
	if(req.isAuthenticated()){
		return next();
	} else {
		req.flash('error_msg','Please Login First')
		res.redirect('/login');
	}
}

module.exports = router;
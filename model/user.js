var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var moment = require('moment');

var wuserSchema = mongoose.Schema({
	team: {
		type: String
	},
	img: {
		type: String
	},
	first_name: {
		type: String
	},
	last_name: {
		type: String
	},
	username: {
		type: String
	},
	email: {
		type: String
	},
	password: {
		type: String
	},
	department: {
		type:String
	},
	position: {
		type: String
	},
	leave_count: {
		type: Number
	}
});

var Wuser = module.exports = mongoose.model('Wuser', wuserSchema);

module.exports.registerUser = function(newUser, callback){
	bcrypt.genSalt(10, function(err,salt){
			bcrypt.hash(newUser.password,salt, function(err, hash){
				if(err){
					console.log(err);
				}
				newUser.password = hash;
				newUser.save(callback);
			});
	});
}

module.exports.comparePassword = function(pass, hash, callback){
	bcrypt.compare(pass,hash,function(err,isMatch){
		if(err){
			console.log(err);
		}
		callback(null,isMatch);
	});
}

module.exports.updateUser = function(pass, query, updateUser, callback){
	if(updateUser.password !== pass){
		bcrypt.genSalt(10, function(err,salt){
				bcrypt.hash(updateUser.password,salt, function(err, hash){
					if(err){
						console.log(err);
					}
					updateUser.password = hash;
					Wuser.updateOne(query, {$set: updateUser},callback)
				});
		});
	} else {
		updateUser.password = pass;
		Wuser.updateOne(query, {$set: updateUser},callback)
	}
}

module.exports.getUsersByTeam = function(team, callback){
	let query = {team: team};
	Wuser.find(query, callback).sort([['_id','ascending']]);
}

module.exports.getUserByUsername = function(team, username, callback){
	let query = {team: team, username: username};
	Wuser.findOne(query,callback);
}

module.exports.getUserById = function(id, callback){
	let query = {_id: id};
	Wuser.findOne(query,callback)
}

module.exports.deleteUser = function(query, callback){
	Wuser.deleteOne(query,callback);
}

module.exports.updateTeam = function(query, team, callback){
	Wuser.update(query, {$set: team}, callback);
}

module.exports.updateDepartment = function(query, department, callback){
	Wuser.updateOne(query, department, callback);
}

module.exports.updateLeaveCount = function(query, leave_count, callback){
	Wuser.update(query, leave_count, callback);
}

module.exports.setPicture = function(query, img, callback){
	Wuser.update(query, {$set: img}, callback);
}
var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
var moment = require('moment');

var accountSchema = mongoose.Schema({
	team: {
		type: String
	},
	sched_in: {
		type: String
	},
	sched_out: {
		type: String
	},
	locations: [{
		location_name: {
			type: String
		},
		lon: {
			type: Number
		},
		lat: {
			type: Number
		}
	}],
	departments: [{
		department: {
			type: String
		},
		positions: [{
			position: {
				type: String
			}
		}]
	}],
	holiday: [{
		name: {
			type: String
		},
		date: {
			type: String
		}
	}]
});

var Account = module.exports = mongoose.model('Account', accountSchema);

module.exports.registerAccount = function(newUser, callback){
	newUser.save(callback);
}

module.exports.getAccounts = function(callback){
	Account.find(callback);
}

module.exports.getAccountByTeam = function(team,callback){
	let query = {team: team};
	Account.findOne(query, callback);
}

module.exports.updateAccount = function(query, account, callback){
	Account.update(query,{$set: account},callback);
}

module.exports.addHoliday = function(query, holiday, callback){
	Account.update(query,
	{
		$push:{
			holiday: holiday
		}
	},
	callback);
}

module.exports.delHoliday = function(query, id, callback){
	Account.update(query,
		{
			$pull:{
				holiday:{ _id: id}
			}
		},
		callback);
}

module.exports.createDepartment = function(query, department, callback){
	Account.updateOne(query,
		{
			$push:{
				departments: department
			}	
		}, callback);
}

module.exports.addPosition = function(query, position, callback){
	Account.findOneAndUpdate(query, {
		$push: { 
			'departments.$.positions': position
		}
	}, callback)
}

module.exports.delDepartment = function(query, id, callback){
	Account.updateOne(query,
		{
			$pull:{
				departments: {_id: id}
			}	
		}, callback);
}

module.exports.delPosition = function(query, id, callback){
	Account.findOneAndUpdate(query, {
		$pull: { 
			'departments.$.positions': {_id: id}
		}
	}, callback)
}


module.exports.addLocation = function(query, location, callback){
	Account.findOneAndUpdate(query, {
		$push: { 
			locations: location
		}
	}, callback)
}

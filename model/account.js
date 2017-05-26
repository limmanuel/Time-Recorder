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

module.exports.getAccounts = function(callback){
	Account.find(callback);
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
	Account.update(query,{$pull:{holiday:{ _id: id}}},callback);
}
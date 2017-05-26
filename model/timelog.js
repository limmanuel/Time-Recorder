var mongoose = require('mongoose');
var moment = require('moment');

var timelogSchema = new mongoose.Schema({
	date: {
		type: String
	},
	team: {
		type: String
	},
	user_id: {
		type: String
	},
	name: {
		type: String
	},
	timein: [{
		timein: {
			type: String
		}
	}],
	timeout: [{
		timeout: {
			type: String
		}
	}],
	status: [{
		status: {
			type: String
		}
	}]
});

var TimeLog = module.exports = mongoose.model('Timelog', timelogSchema);

module.exports.getTimeLogsByUser = function(id,callback){
	let query = {user_id: id};
	TimeLog.find(query,callback);
}

module.exports.getTimeLogsByDate = function(date,team,callback){
	let query = {date: date, team:team};
	TimeLog.find(query,callback);
}

module.exports.getTimeLogsByUserAndDate = function(id,date,callback){
	let query = {date: date, user_id: id};
	TimeLog.findOne(query,callback);
}

module.exports.getTimeLogsByTeam = function(team,callback){
	let query = {team: team};
	TimeLog.find(query,callback).sort([['date','ascending']]);
}

module.exports.addTimeIn = function(query, time, callback){
		TimeLog.update(query,
	{
		$push:{
			timein: time
		}
	},
	 callback);
}

module.exports.addTimeOut = function(query, time, callback){
		TimeLog.update(query,
	{
		$push:{
			timeout: time
		}
	},
	 callback);
}

module.exports.addStatus = function(query, status, callback){
		TimeLog.update(query,
	{
		$push:{
			status: status
		}
	},
	 callback);
}

module.exports.updateStatus = function(query, status, callback){
		TimeLog.update(query,
	{
		$set:{
			'status.$': status
		}
	},
	 callback);
}

module.exports.deleteUser = function(query, callback){
	TimeLog.delete(query,callback);
}

module.exports.updateTeam = function(query, team, callback){
	TimeLog.update(query, {$set: team}, callback);
}
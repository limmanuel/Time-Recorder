var mongoose = require('mongoose');
var moment = require('moment');

var requestSchema = new mongoose.Schema({
	date: {
		type:String
	},
	team: {
		type: String
	},
	user_id: {
		type: String
	},
	leave_date: {
		type: String
	},
	leave_status: {
		type: String
	},
	message: {
		type: String
	}
});

var Request = module.exports = mongoose.model('Request', requestSchema);

module.exports.getRequestByUser = function(id,callback){
	let query = {user_id: id};
	Request.find(query,callback);
}

module.exports.getRequestByUserAndDate = function(id,date,callback){
	let query = {date: date, user_id: id};
	Request.findOne(query,callback);
}

module.exports.getrequestByDate = function(date,team,callback){
	let query = {date: date, team: team};
	Request.findOne(query,callback);
}

module.exports.getRequestByTeam = function(team,callback){
	let query = {team: team};
	Request.find(query,callback).sort([['user_id','ascending']]);
}

module.exports.delLeave = function(query, callback){
	Request.deleteOne(query, callback);
}

module.exports.deleteUser = function(query, callback){
	Request.delete(query,callback);
}

module.exports.updateTeam = function(query, team, callback){
	Request.update(query, {$set: team}, callback);
}

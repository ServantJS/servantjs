var mongoose = require('mongoose');

require('./models').load();

exports.SessionModel = mongoose.model('Session');
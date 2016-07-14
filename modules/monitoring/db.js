'use strict';

const mongoose = require('mongoose');

require('./models').load();

exports.NodeDetailModel = mongoose.model('NodeDetail');
exports.MetricDataModel = mongoose.model('MetricData');
exports.MetricHistoryModel = mongoose.model('MetricHistory');
'use strict';

const mongoose = require('mongoose');

require('./models').load();

exports.NodeDetailModel = mongoose.model('NodeDetail');
exports.MetricDataModel = mongoose.model('MetricData');
exports.MetricSettingModel = mongoose.model('MetricSetting');
exports.MetricHistoryModel = mongoose.model('MetricHistory');
'use strict';

const mongoose = require('mongoose');

require('./models').load();

exports.MonitoringModuleModel = mongoose.model('MonitoringModule');
exports.MetricModel = mongoose.model('Metric');
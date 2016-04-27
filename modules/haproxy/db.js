'use strict';

const mongoose = require('mongoose');

require('./models').load();

exports.HAProxyConfigModel = mongoose.model('HAProxyConfig');
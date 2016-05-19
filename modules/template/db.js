'use strict';

const mongoose = require('mongoose');

require('./models').load();

exports.TestModel = mongoose.model('Test');
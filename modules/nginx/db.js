'use strict';

const mongoose = require('mongoose');

require('./models').load();

exports.NGINXConfigModel = mongoose.model('NGINXConfig');
exports.NGINXTemplateModel = mongoose.model('NGINXTemplate');
exports.NGINXConfigsGroupModel = mongoose.model('NGINXConfigsGroup');
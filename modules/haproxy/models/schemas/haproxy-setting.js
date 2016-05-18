'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HAProxySettingSchema = exports.HAProxySettingSchema = new Schema({
    token_name: String,
    description: String,
    value: String
}, {collection: 'haproxy.settings'});

mongoose.model('HAProxySetting', HAProxySettingSchema);
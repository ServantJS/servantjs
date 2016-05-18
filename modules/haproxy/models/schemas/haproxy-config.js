'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = require('./haproxy-setting').HAProxySettingSchema;

const HAProxyConfigSchema = exports.HAProxyConfigSchema = new Schema({
    target_id: String,

    kind: {type: Number, index: true},
    name: {type: String, index: true},
    content: String,

    status: Number,
    order_num: {type: Number, index: true},

    meta: [schema]
}, {collection: 'haproxy.configs'});

mongoose.model('HAProxyConfig', HAProxyConfigSchema);
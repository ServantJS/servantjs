'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HAProxySettingItemSchema = new Schema({
    token_name: String,
    description: String,
    value: String
}, {_id: false});

const HAProxyConfigItemSchema = exports.HAProxyConfigItemSchema = new Schema({
    kind: {type: Number, index: true},
    name: {type: String, index: true},
    content: String,

    status: Number,

    meta: [HAProxySettingItemSchema]
}, {_id: false});

const HAProxyConfigSchema = exports.HAProxyConfigSchema = new Schema({
    target_id: String,
    container: [HAProxyConfigItemSchema]
}, {collection: 'haproxy.configs'});


mongoose.model('HAProxyConfig', HAProxyConfigSchema);
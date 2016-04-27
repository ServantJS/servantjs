'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HAProxyConfigSchema = exports.HAProxyConfigSchema = new Schema({
    target_id: String,

    kind: {type: Number, index: true},
    name: {type: String, unique: true},
    content: String,

    status: Number,
    order_num: {type: Number, index: true}
});

mongoose.model('HAProxyConfig', HAProxyConfigSchema);
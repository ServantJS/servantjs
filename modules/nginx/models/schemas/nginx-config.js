'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NGINXConfigSchema = exports.NGINXConfigSchema = new Schema({
    group_id: {type: Schema.Types.ObjectId, ref: 'NGINXConfigsGroup'},
    
    name: String,
    content: String,
    status: Number,
    kind: Number
}, {collection: 'nginx.configs'});

mongoose.model('NGINXConfig', NGINXConfigSchema);
'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NGINXConfigsGroupSchema = exports.NGINXConfigsGroupSchema = new Schema({
    name: String,
    target_id: String,
    
    source_dir: String
}, {collection: 'nginx.configs.groups'});

mongoose.model('NGINXConfigsGroup', NGINXConfigsGroupSchema);
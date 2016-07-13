'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NGINXTemplateVariableSchema = require('./nginx-template-variable').NGINXTemplateVariableSchema;

const NGINXTemplateSchema = exports.NGINXTemplateSchema = new Schema({
    name: String,
    content: String,
    vars: [NGINXTemplateVariableSchema]
}, {collection: 'nginx.templates'});

mongoose.model('NGINXTemplate', NGINXTemplateSchema);
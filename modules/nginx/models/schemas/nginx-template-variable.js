'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NGINXTemplateVariableSchema = exports.NGINXTemplateVariableSchema = new Schema({
    name: String,
    description: String,
    pattern: String,
    value: String
});
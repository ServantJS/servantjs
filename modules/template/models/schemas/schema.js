'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TestSchema = exports.TestSchema = new Schema({

});

mongoose.model('Test', TestSchema);
'use strict';

const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const CCServerSchema = exports.CCServerSchema = new Schema({
    dt: Date,
    server_name: String,
    ip: String,
    port: Number,
    status: Number
});

CCServerSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        this.dt = new Date();
    }

    next();
});

mongoose.model('CCServer', CCServerSchema);
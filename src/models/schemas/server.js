'use strict';

const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const ServerSchema = exports.ServerSchema = new Schema({
    dt: Date,
    server_name: String,
    ip: String,
    port: Number,
    status: Number
});

ServerSchema.pre('save', (next) => {
    if (this.isModified('status')) {
        this.dt = new Date();
    }

    next();
});

mongoose.model('Server', ServerSchema);
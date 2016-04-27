'use strict';

const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const ext = require('../../extensions');

const WorkerSchema = exports.WorkerSchema = new Schema({
    server_id: {type: Schema.Types.ObjectId, ref: 'CCServer'},
    sys_id: {type: String, index: true, unique: true},
    dt: Date,
    server_name: {type: String, unique: true},
    ip: String,
    status: Number,
    message: String,
    modules: [String]
});

WorkerSchema.pre('save', function (next) {
    this.dt = new Date();

    if (!this.sys_id) {
        this.sys_id = ext.generateId('w');
    }

    next();
});

mongoose.model('Worker', WorkerSchema);
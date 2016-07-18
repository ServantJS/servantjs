'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReportSchema = new Schema({
    worker_id: {type: Schema.Types.ObjectId, ref: 'Worker'},
    stack: String
}, {_id: false});

const TaskSchema = exports.TaskSchema = new Schema({
    dt: Date,
    username: String,

    server_id: {type: Schema.Types.ObjectId, ref: 'Server', index: true},
    //workers: [{type: Schema.Types.ObjectId, ref: 'Worker'}],

    target_id: {type: String},

    status: {type: Number, index: true},
    module: {type: String, index: true},
    cmd: {type: String, index: true},
    params: String,

    internal_error: String,

    error: [ReportSchema],
    report: [ReportSchema]
});

TaskSchema.pre('save', function (next) {
    if (!this.isModified('dt')) {
        this.dt = new Date();
    }

    next();
});

mongoose.model('Task', TaskSchema);
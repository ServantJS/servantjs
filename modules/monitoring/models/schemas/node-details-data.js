'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OSSchema = exports.EventSchema = new Schema({
    name: String,
    version: String,
    type: String,
    arch: String,
    kernel: String
}, {_id: false});

const IPSchema = exports.EventSchema = new Schema({
    address: String,
    netmask: String,
    family: String,
    mac: String
}, {_id: false});

const NetSchema = exports.EventSchema = new Schema({
    name: String,
    ip: [IPSchema]
}, {_id: false});

const EventSchema = exports.EventSchema = new Schema({
    metric_id: {type: Schema.Types.ObjectId, ref: 'Metric'},
    worker_id: {type: Schema.Types.ObjectId, ref: 'Worker', index: true},
    ts: {type: Date},

    values: {
        os: OSSchema,
        uptime: Number,
        status: Number,
        hostname: String,
        net: NetSchema
    }
}, {collection: 'monitoring.metrics.node.details'});

EventSchema.pre('save', function (next) {
    if (!this.isModified('ts')) {
        this.ts = new Date();
    }

    next();
});

mongoose.model('NodeDetails', EventSchema);

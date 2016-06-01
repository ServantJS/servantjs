'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CPUItemSchema = new Schema({
    name: String,
    user: Number,
    system: Number,
    total: Number
}, {_id: false});

const CPUHistoryItemSchema = new Schema({
    name: String,
    user: {
        v: Number,
        min: Number,
        max: Number
    },
    system: {
        v: Number,
        min: Number,
        max: Number
    },
    total: {
        v: Number,
        min: Number,
        max: Number
    }
}, {_id: false});

const CPUEventSchema = exports.CPUEventSchema = new Schema({
    metric_id: {type: Schema.Types.ObjectId, ref: 'Metric'},
    worker_id: {type: Schema.Types.ObjectId, ref: 'Worker', index: true},
    ts: {type: Date, index: {expires: '1d'}},

    values: [CPUItemSchema]
}, {collection: 'monitoring.metrics.cpu.event'});

const CPUHistorySchema = exports.CPUHistorySchema = new Schema({
    metric_id: {type: Schema.Types.ObjectId, ref: 'Metric'},
    worker_id: {type: Schema.Types.ObjectId, ref: 'Worker', index: true},
    ts: {type: Date, index: {expires: '30d'}},

    num_samples: Number,
    total_value: [CPUHistoryItemSchema],

    seq: Number,

    values: {type: Schema.Types.Mixed}
}, {collection: 'monitoring.metrics.cpu.history'});

CPUEventSchema.pre('save', function (next) {
    if (!this.isModified('ts')) {
        this.ts = new Date();
    }

    next();
});

mongoose.model('CPUHistory', CPUHistorySchema);
mongoose.model('CPUEvent', CPUEventSchema);

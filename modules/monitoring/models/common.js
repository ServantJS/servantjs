'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

exports.eventBase = {
    metric_id: {type: Schema.Types.ObjectId, ref: 'Metric'},
    worker_id: {type: Schema.Types.ObjectId, ref: 'Worker', index: true},
    ts: {type: Date, index: {expires: '1d'}},

    threshold_hits: {
        normal: {
            value: Number,
            hits: Number
        },
        warning: {
            value: Number,
            hits: Number
        },
        critical: {
            value: Number,
            hits: Number
        }
    }
};

exports.historyBase = {
    metric_id: {type: Schema.Types.ObjectId, ref: 'Metric'},
    worker_id: {type: Schema.Types.ObjectId, ref: 'Worker', index: true},
    ts: {type: Date, index: {expires: '30d'}},

    num_samples: Number,
    seq: Number,

    values: {type: Schema.Types.Mixed}
};

exports.historyTotalValue = new Schema({
    v: Number,
    min: Number,
    max: Number
}, {_id: false});
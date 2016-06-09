'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EventSchema = exports.EventSchema = new Schema({
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
    },
    
    values: {
        total: Number,
        free: Number
    }
}, {collection: 'monitoring.metrics.ram.event'});

const HistorySchema = exports.HistorySchema = new Schema({
    metric_id: {type: Schema.Types.ObjectId, ref: 'Metric'},
    worker_id: {type: Schema.Types.ObjectId, ref: 'Worker', index: true},
    ts: {type: Date, index: {expires: '30d'}},

    num_samples: Number,
    total_value: {
        total: {
            v: Number,
            min: Number,
            max: Number
        },
        free: {
            v: Number,
            min: Number,
            max: Number
        }
    },

    seq: Number,

    values: {type: Schema.Types.Mixed}
}, {collection: 'monitoring.metrics.ram.history'});

EventSchema.pre('save', function (next) {
    if (!this.isModified('ts')) {
        this.ts = new Date();
    }

    next();
});

mongoose.model('RAMHistory', HistorySchema);
mongoose.model('RAMEvent', EventSchema);

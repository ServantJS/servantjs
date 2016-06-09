'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NotifSchema = exports.NotifSchema = new Schema({
    ts: Date,
    message: String,
    provider: String,
    raw_value: {
        previous: Number,
        current: Number
    },
    threshold_kind: Number,
    prior: Number,
    status: Number // 0 - in queue, 1 - sent, 2 - error
}, {collection: 'monitoring.metrics.notifications'});

NotifSchema.pre('save', function (next) {
    if (!this.isModified('ts')) {
        this.ts = new Date();
    }

    if (!this.isModified('status')) {
        this.status = 0;
    }

    if (!this.isModified('prior')) {
        this.prior = 1;
    }

    next();    
});

mongoose.model('Notification', NotifSchema);
'use strict';

const common = require('../common');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DataSchema = new Schema({
    input: Number,
    output: Number
}, {_id: false});

const DataTotalSchema = new Schema({
    input: common.historyTotalValue,
    output: common.historyTotalValue
}, {_id: false});

const ItemSchema = new Schema({
    name: String,
    packets: DataSchema,
    bytes: DataSchema,
    per_sec: {
        packets: DataSchema,
        bytes: DataSchema
    }
}, {_id: false});

const ItemTotalSchema = new Schema({
    name: String,
    packets: DataTotalSchema,
    bytes: DataTotalSchema,
    per_sec: {
        packets: DataTotalSchema,
        bytes: DataTotalSchema
    }
}, {_id: false});

const Event = common.eventBase;
const History = common.historyBase;

Event.values = {type: Schema.Types.Mixed};
History.total_value = {type: Schema.Types.Mixed};

const EventSchema = exports.EventSchema = new Schema(Event, {collection: 'monitoring.metrics.net.activity.event'});
const HistorySchema = exports.HistorySchema = new Schema(History, {collection: 'monitoring.metrics.net.activity.history'});

EventSchema.pre('save', function (next) {
    if (!this.isModified('ts')) {
        this.ts = new Date();
    }

    next();
});

mongoose.model('NetActivityHistory', HistorySchema);
mongoose.model('NetActivityEvent', EventSchema);

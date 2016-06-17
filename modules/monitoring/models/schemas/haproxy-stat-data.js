'use strict';

const common = require('../common');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const eventCol = 'monitoring.metrics.haproxy.stat.event';
const historyCol = 'monitoring.metrics.haproxy.stat.history';

const Event = common.eventBase;
const History = common.historyBase;

const ServerSchema = new Schema({
    name: String,
    checkStatus : {
        name : String,
        desc: String
    },
    downTime : Number,
    status : String,
    bytes : {
        output : Number,
        input : Number
    }
}, {_id: false});

const ServerGroupSchema = new Schema({
    name: String,
    servers: [ServerSchema]
}, {_id: false});

Event.values = [ServerGroupSchema];//{type: Schema.Types.Mixed};
History.total_value = {type: Schema.Types.Mixed};

const EventSchema = exports.EventSchema = new Schema(Event, {collection: eventCol});
const HistorySchema = exports.HistorySchema = new Schema(History, {collection: historyCol});

EventSchema.pre('save', function (next) {
    if (!this.isModified('ts')) {
        this.ts = new Date();
    }

    next();
});

mongoose.model('HaProxyStatHistory', HistorySchema);
mongoose.model('HaProxyStatEvent', EventSchema);

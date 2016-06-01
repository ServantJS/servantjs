'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

var SettingItemSchema = new Schema({
    name: String,
    value: String
}, {_id: false});

const MetricSettingSchema = exports.MetricSettingSchema = new Schema({
    server_id: {type: Schema.Types.ObjectId, ref: 'Server'},
    
    isActive: Boolean,
    interval: Number,

    threshold: {
        repeat: Number,
        warning: {
            value: Number,
            measurement: String
        },
        critical: {
            value: Number,
            measurement: String
        }
    },

    settings: [SettingItemSchema],
    events: [SettingItemSchema]
}, {_id: false});

const MetricSchema = exports.MetricSchema = new Schema({
    sys_name: {type: String, unique: true},
    name: {
        ru: String,
        us: String
    },
    description: {
        ru: String,
        us: String
    },

    settings: [MetricSettingSchema]
    
}, {collection: 'monitoring.metrics'});

mongoose.model('Metric', MetricSchema);
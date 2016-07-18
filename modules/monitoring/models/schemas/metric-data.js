'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MetricSettingSchema = exports.MetricSettingSchema = new Schema({
    node_id: {type: Schema.Types.ObjectId, index: true, ref: 'NodeDetail'},

    sys_name: {type: String, index: true},
    component: String,
    disabled: Boolean,

    options: Schema.Types.Mixed
}, {collection: 'monitoring.metrics.settings'});

const MetricSchema = exports.MetricSchema = new Schema({
    node_id: {type: Schema.Types.ObjectId, index: true, ref: 'NodeDetail'},

    sys_name: {type: String, index: true},
    ts: {type: Date, index: {expires: '2m'}},
    measure: String,
    component: String,

    value: Number
}, {collection: 'monitoring.metrics.current'});

const MetricHistorySchema = exports.MetricHistorySchema = new Schema({
    node_id: {type: Schema.Types.ObjectId, index: true, ref: 'NodeDetail'},

    sys_name: {type: String, index: true},
    ts: {type: Date, index: {expires: '30d'}},
    measure: String,
    component: String,

    num_samples: Number,
    total_value: {
        v: Number,
        min: Number,
        max: Number
    },

    seq: Number,

    values: {type: Schema.Types.Mixed}
}, {collection: 'monitoring.metrics.history'});

mongoose.model('MetricData', MetricSchema);
mongoose.model('MetricSetting', MetricSettingSchema);
mongoose.model('MetricHistory', MetricHistorySchema);
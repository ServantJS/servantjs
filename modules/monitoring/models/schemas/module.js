'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MonitoringModuleSchema = exports.MonitoringModuleSchema = new Schema({
    sys_name: {type: String, unique: true},
    name: {
        ru: String,
        us: String
    },
    description: {
        ru: String,
        us: String
    },
    type: String,

    metrics: [{type: Schema.Types.ObjectId, ref: 'Metric'}]
}, {collection: 'monitoring.modules'});

mongoose.model('MonitoringModule', MonitoringModuleSchema);
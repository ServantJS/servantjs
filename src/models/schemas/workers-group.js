'use strict';

const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const ext = require('../../extensions');

const WorkersGroupSchema = exports.WorkersGroupSchema = new Schema({
    name: String,
    sys_id: {type: String, index: true, unique: true},
    server_id: {type: Schema.Types.ObjectId, ref: 'Server'},
    workers: [{type: Schema.Types.ObjectId, ref: 'Worker'}]
});

WorkersGroupSchema.pre('save', (next) => {
    this.dt = new Date();

    if (!this.sys_id) {
        this.sys_id = ext.generateId('g');
    }

    next();
});

mongoose.model('WorkersGroup', WorkersGroupSchema);
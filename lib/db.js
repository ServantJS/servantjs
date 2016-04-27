'use strict';

const fs       = require('fs');
const path     = require('path');
const mongoose = require('mongoose');

const logger   = require('./logger');
const config   = require('./config').get('db');

logger.verbose('Loading db models:');

require('../src/models').load();

exports.connection = mongoose.connection;
exports.CCServerModel = mongoose.model('CCServer');
exports.WorkerModel = mongoose.model('Worker');
exports.WorkersGroupModel = mongoose.model('WorkersGroup');
exports.TaskModel = mongoose.model('Task');

exports.connect = (callback) => {
    let options = {}, url = config.url;
    options.server = { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } };

    if (config.is_replica) {
        options.replset = { rs_name: config.replica.name, poolSize: 10, socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } };
    }

    mongoose.connect(config.url, options, (err) => {
        callback(err);
    });
};
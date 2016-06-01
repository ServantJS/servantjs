'use strict';

const db = require('./db');

const MonitoringModule = require('./module').MonitoringModule;
const logger = require('../core').logger;

module.exports = (serverDB, serverInstance, server, options) => {
    let module = new MonitoringModule(serverDB, db, serverInstance, server, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')(db)
    };
};
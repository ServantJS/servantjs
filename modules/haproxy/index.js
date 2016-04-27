'use strict';

const db = require('./db');

const HAProxyModule = require('./module').HAProxyModule;
const logger = require('../core').logger;

module.exports = (serverDB, serverInstance, server, options) => {
    let module = new HAProxyModule(serverDB, db, serverInstance, server, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')(db)
    };
};
'use strict';

const db = require('./db');

const TestModule = require('./module').TestModule;
const logger = require('../core').logger;

module.exports = (serverDB, serverInstance, server, options) => {
    let module = new TestModule(serverDB, db, serverInstance, server, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')(db)
    };
};
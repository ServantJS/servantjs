'use strict';

const db = require('./db');

const SecurityModule = require('./module').SecurityModule;
const logger = require('../core').logger;

module.exports = (serverDB, serverInstance, server, options) => {
    let module = new SecurityModule(serverDB, db, serverInstance, server, options);

    logger.info(`Init "${module.name.toUpperCase()}" module. Version - ${module.version}`);

    return {
        module: module,
        middlewares: require('./middlewares')(db)
    };
};
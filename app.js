'use strict';

require('./src/extensions');

const logger = require('./lib/logger');
const config = require('./lib/config');
const db = require('./lib/db');

const ServantServer = require('./src/server').ServantServer;

var server = new ServantServer({
    middlewares: config.get('middlewares'),
    modules: config.get('modules')
});

server.init()
    .then(() => {
        server.on('server.accept', (agent) => {
            logger.info('New connection. Address: ' + agent.ip);
        });

        server.on('server.error', (err) => {
            logger.error('Server error: ' + err.message, {stack: err.stack});
        });

        server.on('server.close', (code, message) => {
            logger.info('Server aborted connection. Code: {0}. Message: {1}'.f(code, message));
        });

        server.on('client.disconnect', (code, message, agent) => {
            logger.info('Client disconnected. Address: ' + agent.ip);
        });

        server.run();
    })
    .fail((e) => {
        logger.error('Server did not initialized. Name: {0}, reason: {1}'.f(e.name, e.message));
        logger.verbose(e.stack);

        process.exit(1);
    });
'use strict';

const winston = require('winston');
const path = require('path');

const conf = require(path.join(__dirname, 'config'));

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({colorize: true, level: 'debug'})
    ],
    exitOnError: true
});

module.exports = logger;
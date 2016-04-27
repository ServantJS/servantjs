'use strict';

const fs     = require('fs');
const path   = require('path');

const logger = require('../../lib/logger');

exports.load = () => {
    logger.verbose('Load schemas:');

    fs.readdirSync(path.join(__dirname, 'schemas')).forEach((name) => {
        logger.verbose('\t', name);
        require(path.join(__dirname, 'schemas', name));
    });
};
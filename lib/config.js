'use strict';

const nconf = require('nconf');
const path  = require('path');

nconf
    //.argv()
    //.env()
    .file(path.join(__dirname, '..', 'config.json'));

module.exports = nconf;
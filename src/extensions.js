'use strict';

const ws = require('ws');

const crypto = require('crypto');

exports.generateId = (pref) => {
    var currentDate = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    return (pref + crypto.createHash('md5').update(currentDate + random).digest('hex')).toUpperCase();
};

ws.prototype.sendJSON = function (message) {
    this.send(JSON.stringify(message));
};

ws.prototype.address = function () {
    return this.upgradeReq.headers['x-real-ip'] || this.upgradeReq.connection.remoteAddress;
};
'use strict';

const EventEmitter = require('events');
const ServantMessage = require('./message').ServantMessage;

const statuses = exports.statuses = {
    create: -1,
    success: 0,
    paused: 1,
    process: 2,
    error: 3,
    deleted: 4,
    warning: 5
};

class ModuleBase extends EventEmitter {
    constructor(serverDB, moduleDB, server) {
        super();
        this._serverDB = serverDB;
        this._moduleDB = moduleDB;
        this._server = server;
        this.statuses = statuses;
    }

    get serverDB() {
        return this._serverDB;
    }

    get moduleDB() {
        return this._moduleDB;
    }

    get server() {
        return this._server;
    }

    get name() {
        throw new Error('Not implemented');
    }

    get version() {
        throw new Error('Not implemented');
    }

    handle() {
        throw new Error('Method not implemented.');
    }

    createMessage(event, error, data) {
        return new ServantMessage({
            module: this.name,
            version: this.version,
            event: event,
            error: error,
            data: data
        });
    }

    checkStringParam(obj, paramName) {
        return !(obj.hasOwnProperty(paramName) && obj[paramName].length && obj[paramName].trim().length);
    }

    checkNumberParam(obj, paramName) {
        return !obj.hasOwnProperty(paramName) || isNaN(parseInt(obj[paramName]));
    }

    checkArrayParam(obj, paramName) {
        return !(obj.hasOwnProperty(paramName) && Array.isArray(obj[paramName]) && obj[paramName].length);
    }
}

exports.ModuleBase = ModuleBase;
exports.logger = require('../lib/logger');
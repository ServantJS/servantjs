'use strict';

const vow = require('vow');
const EventEmitter = require('events');
const ServantMessage = require('./message').ServantMessage;

const logger = require('../lib/logger');

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

    /**
     *
     * @param {String} text
     * @param {ServantClient} agent
     * @public
     */
    sendError(text, agent) {
        agent.sendMessage(this.createMessage('Error', text));
        agent.socket.close();

        logger.warn(`[${this.name}]: Close connection for: ${agent.ip}. Reason: ${text}`);
    }

    /**
     *
     * @param {String} targetId
     * @returns {Promise}
     */
    getTaskAgents(targetId) {
        const defer = vow.defer();

        if (!(targetId && targetId.length)) {
            defer.reject(new Error('Missing target id'));
            return defer.promise();
        }

        if (targetId[0] === 'G') {
            this.serverDB.WorkersGroupModel.findOne({sys_id: targetId}).populate('workers').exec(function (err, group) {
                if (err) {
                    defer.reject(err);
                } else if (!group) {
                    defer.reject(new Error(`Group "${targetId} not found`));
                } else {
                    defer.resolve(group.workers);
                }
            });
        } else if (targetId[0] === 'W') {
            this.serverDB.WorkerModel.findOne({sys_id: targetId}).exec(function (err, worker) {
                if (err) {
                    defer.reject(err);
                } else if (!worker) {
                    defer.reject(new Error(`Worker "${targetId} not found`));
                } else {
                    defer.resolve([worker]);
                }
            });
        } else {
            defer.reject(new Error('Incorrect target id'));
        }

        return defer.promise();
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
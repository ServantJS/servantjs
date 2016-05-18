'use strict';

const logger = require('../lib/logger');
const db = require('../lib/db');
const extensions = require('./extensions');
const coreMW = require('../middlewares/core');
const ServantMessage = require('../modules/message').ServantMessage;

const defer = typeof setImmediate === 'function'
    ? setImmediate
    : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) };

class ServantClient {
    constructor(server, socket, finalHandler) {
        this.socket = socket;
        this._server = server;
        this.ip = socket.address();

        this.socket.on('pong', ServantClient._onPong.bind(this));
        this.socket.on('close', ServantClient._onClose.bind(this));
        this.socket.on('error', ServantClient._onError.bind(this));
        this.socket.on('message', ServantClient._onMessage.bind(this));

        const out = function (err) { if (err) { logger.error('Next error: ' + err.message); logger.verbose(err.stack); } };

        this.out = finalHandler || out;

        if (this.server.heartbeat) {
            this.intervalId = setInterval(() => {
                this.socket.ping();
            }, this.server.heartbeat * 1000);
        }
    }

    get server() {
        return this._server;
    }

    static _onPong() {
        logger.debug('Pong received from: ' + this.ip);

        this.server.emit('client.pong');
    }

    static _onClose(code, message) {
        this.server.workers[this.ip] = null;
        delete this.server.workers[this.ip];

        logger.debug('Current agents: ' + this.currentAgentsCount);

        clearInterval(this.intervalId);

        this.server.emit('client.disconnect', code, message, this);
    }

    static _onError(error) {
        this.server.emit('client.error', error);
    }

    static _onMessage(raw) {
        let index = 0;

        //check all handlers in stage stack

        let stage = this.server.stacks[coreMW.MESSAGE_RECEIVED_STAGE];
        let modules = this.server.stacks[coreMW.MODULE_STAGE];

        logger.debug('Receive new message: ' + raw);

        let message = null;
        try {
            message = new ServantMessage(raw);
        } catch (e) {
            logger.error(e.message);
            logger.verbose(e.stack);
        }

        if (!message) {
            return;
        }

        const nextModule = (err) => {
            let layer = modules[index++];

            if (!layer) { //end reached
                defer(this.out, err);
                return;
            }

            if (layer.route !== 'dummy' && message.module.toLowerCase() !== layer.route) {
                return nextModule(err);
            }

            ServantClient.call(layer.handle, this, message, err, nextModule);
        };

        const nextStage = (err) => {
            let layer = stage[index++];

            if (!layer) { //end reached
                if (err) {
                    return defer(this.out, err);
                } else {
                    index = 0;
                    return defer(nextModule, err);
                }
            }

            if (layer.route !== 'dummy' && message.module.toLowerCase() !== layer.route) {
                return nextStage(err);
            }

            ServantClient.call(layer.handle, this, message, err, nextStage);
        };

        nextStage();
    }

    static call(handler, agent, message, err, next) {
        var error = err;
        var arity = handler.length;

        try {
            if (error && arity == 4) {
                return handler(err, message, agent, next);
            } else if (!error && arity < 4) {
                return handler(message, agent, next);
            }
        } catch (e) {
            error = e;
        }

        next(error);
    }

    sendMessage(message) {
        if (message instanceof ServantMessage) {
            let index = 0;
            let stage = this.server.stacks[coreMW.MESSAGE_SEND_STAGE];

            const nextStage = (err) => {
                let layer = stage[index++];

                if (!layer) { //end reached
                    if (err) {
                        return defer(this.out, err);
                    } else {
                        return this.socket.send(message.toJSON());
                    }
                }

                if (layer.route !== 'dummy' && message.module.toLowerCase() !== layer.route) {
                    return nextStage(err);
                }

                ServantClient.call(layer.handle, this, message, err, nextStage);
            };

            nextStage();
        } else {
            throw new Error('"message" is not instance of "ServantMessage"');
        }
    }
}

exports.ServantClient = ServantClient;
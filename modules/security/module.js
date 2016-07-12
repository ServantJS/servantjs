'use strict';

const fs = require('fs');

const ModuleBase = require('../core').ModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;
const db = require('../core').db;

const MODULE_NAME = 'security';
const MODULE_VERSION = '1.0';

class SecurityModule extends ModuleBase {
    /** @namespace agent.worker {WorkerModel} */
    /** @namespace agent.hostname {string }*/
    /** @namespace options.keyFilePath {string} */
    /**
     *
     * @param {Object} serverDB
     * @param {Object} moduleDB
     * @param {ServantServer} serverInstance
     * @param {Object} server
     * @param {Object} options
     */
    constructor(serverDB, moduleDB, serverInstance, server, options) {
        super(serverDB, moduleDB, server);

        if (!(options.keyFilePath || options.accessKey)) {
            throw new Error('Missing access key options.');
        }

        this._serverInstance = serverInstance;

        if (options.keyFilePath) {
            this._secureKey = fs.readFileSync(options.keyFilePath).toString();
        } else {
            this._secureKey = options.accessKey;
        }

        this._options = options;

        this.on('worker.send-key', this._onSendKey);
        this._serverInstance.on('client.disconnect', this._onClientDisconnected.bind(this));
    }

    /**
     * @return {string}
     */
    static get SendKeyEventName() {
        return 'SendKey';
    }

    /**
     * @return {string}
     */
    static get SaveTokenEventName() {
        return 'SaveToken';
    }

    /**
     * @return {string}
     */
    static get SendErrorEventName() {
        return 'Error';
    }

    get name() {
        return MODULE_NAME;
    }

    get version() {
        return MODULE_VERSION;
    }

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @param {Function} next
     * @public
     */
    handle(message, agent, next) {
        if (message.version != this.version) {
            logger.warn('Receive message with incorrect version number');
            return;
        }

        if (message.event === SecurityModule.SendKeyEventName) {
            this.emit('worker.send-key', message, agent);
        } else {
            logger.warn(`[${this.name}] Unsupported event "${message.event}". Worker: ${agent.ip}`);
        }
    }

    /**
     *
     * @param {String} text
     * @param {ServantClient} agent
     * @public
     */
    sendError(text, agent) {
        agent.sendMessage(this.createMessage(SecurityModule.SendErrorEventName, text));
        agent.socket.close();

        logger.warn(`[${this.name}]: Close connection for: ${agent.ip}. Reason: ${text}`);
    }

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
     _onSendKey(message, agent) {
        if (!message.data) {
            return this.sendError('Missing "data" property', agent);
        }

        try {
            ServantMessage.checkString(message.data.key, 'key');
            ServantMessage.checkString(message.data.hostname, 'hostname');
            ServantMessage.checkArray(message.data.modules, 'modules');
        } catch (e) {
            return this.sendError(e.message, agent);
        }

        if (message.data.key === this._secureKey) {
            const token = this.moduleDB.SessionModel.generateToken(agent.ip, agent.hostname);
            new this.moduleDB.SessionModel({
                token: token,
                worker_id: agent.worker ? agent.worker._id : null
            }).save((err) => {
                if (err) {
                    logger.error(err.message);
                    logger.verbose(err.stack);
                } else {

                    this.serverDB.WorkerModel.findOne({server_name: message.data.hostname}, (err, worker) => {
                        if (err) {
                            logger.error(err.message);
                            logger.verbose(err.stack);
                        } else if (!worker) {
                            worker = new this.serverDB.WorkerModel({
                                server_id: this.server._id,
                                server_name: message.data.hostname
                            });
                        }

                        worker.ip = agent.ip;
                        worker.status = this._options.states.running;
                        worker.message = 'OK';
                        worker.modules = message.data.modules;

                        worker.save((err) => {
                            if (err) {
                                logger.error(err.message);
                                logger.verbose(err.stack);
                            } else {
                                if (agent.hasOwnProperty('worker')) {
                                    delete agent.worker;
                                }

                                if (agent.hasOwnProperty('hostname')) {
                                    delete agent.hostname;
                                }

                                Object.defineProperty(agent, 'worker', {
                                    value: worker,
                                    enumerable: false,
                                    writable: false,
                                    configurable: true
                                });

                                Object.defineProperty(agent, 'hostname', {
                                    value: message.data.hostname,
                                    enumerable: false,
                                    writable: false,
                                    configurable: true
                                });

                                logger.info(`Worker "${worker.server_name}[${worker.ip}]" authorized on server`);
                                logger.debug(`Worker "${agent.hostname}": enabled modules - [${message.data.modules.join(' | ')}]`);

                                agent.sendMessage(this.createMessage(SecurityModule.SaveTokenEventName, null, {token: token}));
                                
                                this._serverInstance.emit('client.authorized', agent);
                            }
                        });
                    });
                }
            });
        } else {
            this.sendError('Wrong auth key', agent);
        }
    }

    _onClientDisconnected(code, message, agent) {
        if (agent.worker) {
            agent.worker.status = this._options.states.stopped;
            agent.worker.message = `Message: ${message}, code: ${code}`;
            //agent.worker.modules = [];

            agent.worker.save((err) => {
                if (err) {
                    logger.error(err.message);
                    logger.verbose(err.stack);
                } else {
                    logger.info(`Client disconnected. Address: ${agent.hostname || ''}[${agent.ip}], reason: ${message}, code: ${code}`);
                }
            });
        }
    }
}

exports.MODULE_NAME = MODULE_NAME;
exports.MODULE_VERSION = MODULE_VERSION;
exports.SecurityModule = SecurityModule;

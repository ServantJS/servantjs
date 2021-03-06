'use strict';

const fs = require('fs');
const vow = require('vow');
const async = require('async');
const mongoose = require('mongoose');

const ModuleBase = require('../core').ModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;
const db = require('../core').db;

const MODULE_NAME = 'haproxy';
const MODULE_VERSION = '1.0';

const GLOBAL_CONFIG_TYPE = 0;
const DEFAULT_CONFIG_TYPE = 1;
const LISTEN_CONFIG_TYPE = 2;
const FRONTEND_CONFIG_TYPE = 3;
const BACKEND_CONFIG_TYPE = 4;

const KIND_LIST = [
    GLOBAL_CONFIG_TYPE,
    DEFAULT_CONFIG_TYPE,
    LISTEN_CONFIG_TYPE,
    FRONTEND_CONFIG_TYPE,
    BACKEND_CONFIG_TYPE
];

class HAProxyModule extends ModuleBase {

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

        this._serverInstance = serverInstance;
        
        this._options = options;

        this.on('task.create-config', this._onCreateConfigTask.bind(this));
        this.on('task.update-config', this._onUpdateConfigTask.bind(this));
        this.on('task.remove-config', this._onRemoveConfigTask.bind(this));
    }

    /**
     * @return {string}
     */
    static get CreateEvent() {
        return 'Create';
    }

    /**
     * @return {string}
     */
    static get UpdateEvent() {
        return 'Update';
    }

    /**
     * @return {string}
     */
    static get RemoveEvent() {
        return 'Remove';
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

        if (message.event === HAProxyModule.CreateEvent) {
            this.onCommonEventComplete(message, agent);
        } else if (message.event === HAProxyModule.UpdateEvent) {
            this.onCommonEventComplete(message, agent);
        } else if (message.event === HAProxyModule.RemoveEvent) {
            this.onCommonEventComplete(message, agent);
        } else {
            logger.warn(`[${this.name}] Unsupported event "${message.event}". Worker: ${agent.ip}`);
        }
    }
    
    hasBind(block) {
        return block.kind === LISTEN_CONFIG_TYPE || block.kind === FRONTEND_CONFIG_TYPE;    
    }

    /**
     *
     * @param {Object} task
     * @param {Object} params
     * @param {TaskModel} originalTask
     * @private
     */
    _onCreateConfigTask(task, params, originalTask) {
        async.waterfall([
            (cb) => {
                if (this.checkArrayParam(params, 'container')) {
                    cb(new Error('Missing "container" parameter'));
                } else {
                    cb();
                }
            },
            (cb) => {
                this.moduleDB.HAProxyConfigModel.findOne({target_id: task.target_id}, (err, config) => {
                    if (err) {
                        cb(err);
                    } else if (config) {
                        cb(new Error(`HAProxy config for "${task.target_id}" already exist`));
                    } else {
                        cb();
                    }
                });
            },
            (cb) => {
                const model = new this.moduleDB.HAProxyConfigModel({
                    target_id: task.target_id,
                    container: []
                });

                try {
                    let index = 0;
                    let isContainsServer = false;

                    async.whilst(
                        () => index < params.container.length,
                        (next) => {
                            try {
                                const config = params.container[index];

                                if (this.checkStringParam(config, 'name')) {
                                    return next(new Error('Missing "name" parameter'));
                                } else if (this.checkStringParam(config, 'content')) {
                                    return next(new Error('Missing "content" parameter'));
                                } else if (this.checkNumberParam(config, 'kind')) {
                                    return next(new Error('Missing "kind" parameter'));
                                } else if (KIND_LIST.indexOf(config.kind) == -1) {
                                    return next(new Error(`Unsupported config kind for ${config.name}`));
                                }

                                if (this.hasBind(config)) {
                                    isContainsServer = true;
                                }

                                const containerItem = {
                                    kind: config.kind,
                                    name: config.name,
                                    content: config.content,
                                    status: 0,
                                    meta: config.meta || []
                                };

                                model.container.push(containerItem);

                                index++;
                                next();
                            } catch (e) {
                                next(e);
                            }
                        }
                        ,
                        (err) => {
                            if (err) {
                                cb(err);
                            } else {
                                if (isContainsServer) {
                                    this._cache.set(task._id.toString(), {model: model, agentsCount: task.agents.length, task: originalTask});

                                    const message = this.createMessage(HAProxyModule.CreateEvent, null, {
                                        taskKey: task._id.toString(),
                                        config: model.container
                                            .map((item) =>
                                                (item.kind !== GLOBAL_CONFIG_TYPE && item.kind !== DEFAULT_CONFIG_TYPE ? '#' + item.meta.map((item) => `${item.token_name}: ${item.value || ''}`).join(', ') + '\n' : '') + item.content)
                                            .join('\n\n')
                                    });

                                    cb(null, message);
                                } else {
                                    model.save((err) => {
                                        cb(err, null);
                                    });
                                }
                            }
                        }
                    )
                } catch (e) {
                    cb(e);
                }
            }
        ], (err, message) => {
            this.sendTask(err, message, originalTask, task.agents);
        });
    }

    /**
     *
     * @param {Object} task
     * @param {Object} params
     * @param {TaskModel} originalTask
     * @private
     */
    _onUpdateConfigTask(task, params, originalTask) {
        async.waterfall([
            (cb) => {
                if (this.checkStringParam(params, 'id')) {
                    cb(new Error('Missing "id" parameter'));
                } else if (this.checkArrayParam(params, 'container')) {
                    cb(new Error('Missing "container" parameter'));
                } else {
                    try {
                        params.id = mongoose.Types.ObjectId(params.id);

                        cb();
                    } catch (e) {
                        cb(e);
                    }
                }
            },
            (cb) => {
                this.moduleDB.HAProxyConfigModel.findOne({_id: params.id}, (err, config) => {
                    if (err) {
                        cb(err);
                    } else if (!config) {
                        cb(new Error(`HAProxy config "${params.id.toString()}" not found`));
                    } else {
                        cb(null, config);
                    }
                });
            },
            (config, cb) => {
                try {
                    let index = 0;
                    let isContainsServer = false;

                    config.container = [];

                    async.whilst(
                        () => index < params.container.length,
                        (next) => {
                            try {
                                const item = params.container[index];

                                if (this.checkStringParam(item, 'name')) {
                                    return next(new Error('Missing "name" parameter'));
                                } else if (this.checkStringParam(item, 'content')) {
                                    return next(new Error('Missing "content" parameter'));
                                } else if (this.checkNumberParam(item, 'kind')) {
                                    return next(new Error('Missing "kind" parameter'));
                                } else if (this.checkNumberParam(item, 'status')) {
                                    return next(new Error('Missing "status" parameter'));
                                } else if (KIND_LIST.indexOf(item.kind) == -1) {
                                    return next(new Error(`Unsupported config kind for ${item.name}`));
                                }

                                if (item.status == this.statuses.success && this.hasBind(item)) {
                                    isContainsServer = true;
                                }

                                const containerItem = {
                                    kind: item.kind,
                                    name: item.name,
                                    content: item.content,
                                    status: item.status,
                                    meta: item.meta || []
                                };

                                config.container.push(containerItem);

                                index++;
                                next();
                            } catch (e) {
                                next(e);
                            }
                        }
                        ,
                        (err) => {
                            if (err) {
                                cb(err);
                            } else {
                                this._cache.set(task._id.toString(), {model: config, agentsCount: task.agents.length, task: originalTask});

                                const msgData = {taskKey: task._id.toString()};

                                if (isContainsServer) {
                                    msgData.config = config.container
                                        .filter((item) => item.status == 0)
                                        .map(
                                            (item) => (item.kind !== GLOBAL_CONFIG_TYPE && item.kind !== DEFAULT_CONFIG_TYPE ? '#' + item.meta.map((item) => `${item.token_name}: ${item.value || ''}`).join(', ') + '\n' : '') + item.content)
                                        .join('\n\n')
                                } else {
                                    msgData.dispose = true;
                                }

                                const message = this.createMessage(HAProxyModule.UpdateEvent, null, msgData);

                                cb(null, message);
                            }
                        }
                    )
                } catch (e) {
                    cb(e);
                }
            }
        ], (err, message) => {
            this.sendTask(err, message, originalTask, task.agents);
        });
    }

    /**
     *
     * @param {Object} task
     * @param {Object} params
     * @param {TaskModel} originalTask
     * @private
     */
    _onRemoveConfigTask(task, params, originalTask) {
        async.waterfall([
            (cb) => {
                if (this.checkStringParam(params, 'id')) {
                    cb(new Error('Missing "id" parameter'));
                } else {
                    try {
                        params.id = mongoose.Types.ObjectId(params.id);

                        cb();
                    } catch (e) {
                        cb(e);
                    }
                }
            },
            (cb) => {
                this.moduleDB.HAProxyConfigModel.findOne({_id: params.id}, (err, config) => {
                    if (err) {
                        cb(err);
                    } else if (!config) {
                        cb(new Error(`HAProxy config "${params.id.toString()}" not found`));
                    } else {
                        cb(null, config);
                    }
                });
            },
            (config, cb) => {
                this._cache.set(task._id.toString(), {model: config, agentsCount: task.agents.length, task: originalTask});

                const message = this.createMessage(HAProxyModule.RemoveEvent, null, {
                    taskKey: task._id.toString(),
                    dispose: true
                });

                cb(null, message);
            }
        ], (err, message) => {
            this.sendTask(err, message, originalTask, task.agents);
        });
    }
}

exports.MODULE_NAME = MODULE_NAME;
exports.MODULE_VERSION = MODULE_VERSION;
exports.HAProxyModule = HAProxyModule;

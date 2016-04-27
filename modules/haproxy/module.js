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

const KIND_LIST = [
    GLOBAL_CONFIG_TYPE,
    DEFAULT_CONFIG_TYPE,
    LISTEN_CONFIG_TYPE,
    FRONTEND_CONFIG_TYPE
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
        this._cache = new Map();
        this._options = options;

        this.on('task.create-config', this._onCreateConfigTask.bind(this));
        this.on('task.pause-config', this._onPauseConfigTask.bind(this));
        this.on('task.resume-config', this._onResumeConfigTask.bind(this));
        this.on('task.update-config', this._onUpdateConfigTask.bind(this));
        this.on('task.remove-config', this._onRemoveConfigTask.bind(this));
    }

    /**
     * @return {string}
     */
    static get SendErrorEvent() {
        return 'Error';
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
    static get PauseEvent() {
        return 'Pause';
    }

    /**
     * @return {string}
     */
    static get ResumeEvent() {
        return 'Resume';
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
            this._onCommonEventComplete(message, agent);
        } else if (message.event === HAProxyModule.PauseEvent) {
            this._onCommonEventComplete(message, agent);
        } else if (message.event === HAProxyModule.ResumeEvent) {
            this._onCommonEventComplete(message, agent);
        } else if (message.event === HAProxyModule.UpdateEvent) {
            this._onCommonEventComplete(message, agent);
        } else if (message.event === HAProxyModule.RemoveEvent) {
            this._onCommonEventComplete(message, agent);
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
        agent.socket.sendJSON(this.createMessage(HAProxyModule.SendErrorEvent, text).toObject());
        agent.socket.close();

        logger.warn(`[${this.name}]: Close connection for: ${agent.ip}. Reason: ${text}`);
    }

    _getTaskAgents(targetId) {
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
                if (this.checkStringParam(params, 'name')) {
                    cb(new Error('Missing "name" parameter'));
                } else if (this.checkStringParam(params, 'content')) {
                    cb(new Error('Missing "content" parameter'));
                } else if (this.checkNumberParam(params, 'kind')) {
                    cb(new Error('Missing "kind" parameter'));
                } else if (params.kind != GLOBAL_CONFIG_TYPE && this.checkNumberParam(params, 'order_num')) {
                    cb(new Error('Missing "order_num" parameter'));
                } else {
                    if (KIND_LIST.indexOf(params.kind) < 0) {
                        cb(new Error(`Unsupported config kind "${params.kind}"`));
                    } else {

                        params.kind = parseInt(params.kind);
                        params.orderNumber = parseInt(params.order_num);

                        if (isNaN(params.orderNumber)) {
                            params.orderNumber = GLOBAL_CONFIG_TYPE;
                        }

                        cb();
                    }
                }
            },
            (cb) => {
                this.moduleDB.HAProxyConfigModel.findOne({name: params.name}, (err, config) => {
                    if (err) {
                        cb(err);
                    } else if (config) {
                        cb(new Error(`HAProxy config with name "${params.name}" already exist`));
                    } else {
                        cb();
                    }
                });
            }, (cb) => {
                if (params.kind === GLOBAL_CONFIG_TYPE) {
                    params.orderNumber = GLOBAL_CONFIG_TYPE;

                    this.moduleDB.HAProxyConfigModel.findOne({
                        target_id: task.target_id,
                        kind: GLOBAL_CONFIG_TYPE
                    }, (err, config) => {
                        if (err) {
                            cb(err);
                        } else if (config) {
                            cb(new Error(`HAProxy global config for target "${task.target_id}" already exist`));
                        } else {
                            cb();
                        }
                    });
                } else {
                    if (!params.orderNumber) {
                        params.orderNumber = 1;
                    }

                    cb();
                }
            },
            (cb) => {
                this.moduleDB.HAProxyConfigModel.find({target_id: task.target_id}).sort('kind order_num').lean().exec((err, configs) => {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null, configs);
                    }
                });
            },
            (configs, cb) => {
                this.moduleDB.HAProxyConfigModel.count({$and: [{kind: {$ne: GLOBAL_CONFIG_TYPE}}, {kind: {$ne: DEFAULT_CONFIG_TYPE}}]}).exec((err, count) => {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null, configs, count);
                    }
                });
            },
            (configs, amountOfServers, cb) => {
                try {
                    const model = new this.moduleDB.HAProxyConfigModel({
                        target_id: task.target_id,
                        kind: parseInt(params.kind),
                        name: params.name,
                        content: params.content,

                        status: 0,
                        order_num: params.orderNumber
                    });

                    if (!amountOfServers && model.kind !== LISTEN_CONFIG_TYPE && model.kind !== FRONTEND_CONFIG_TYPE) {
                        model.save((err) => {
                            cb(err, null);
                        });
                    } else {
                        configs.splice(params.orderNumber, 1, model);

                        this._cache.set(task._id.toString(), model);

                        const message = this.createMessage(HAProxyModule.CreateEvent, null, {
                            taskKey: task._id.toString(),
                            config: configs.map((item) => item.content).join('\n\n')
                        });

                        cb(null, message);
                    }
                } catch (e) {
                    cb(e);
                }
            }
        ], (err, message) => {
            if (err) {
                logger.error(err.message);
                logger.verbose(err.stack);

                originalTask.internal_error = err.message;
                originalTask.status = this.statuses.error;
                originalTask.save((err) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }
                });
            } else {
                if (message) {
                    try {
                        task.agents.forEach((agent) => {
                            agent.sendMessage(message);
                        });
                    } catch (e) {
                        logger.error(e.message);
                        logger.verbose(e.stack);
                    }
                }
            }
        });
    }

    /**
     *
     * @param {Object} task
     * @param {Object} params
     * @param {TaskModel} originalTask
     * @param {String} event
     * @param {Number} status
     * @private
     */
    _changeStatus(task, params, originalTask, event, status) {
        async.waterfall([
            (cb) => {
                if (this.checkStringParam(params, 'name') && this.checkStringParam(params, 'id')) {
                    cb(new Error('Missing "id" or "name" parameter'));
                } else {
                    try {
                        if (params.hasOwnProperty('id')) {
                            params.id = mongoose.Types.ObjectId(params.id);
                        }

                        cb();
                    } catch (e) {
                        cb(e);
                    }
                }
            },
            (cb) => {
                let query = null;
                if (params.hasOwnProperty('id')) {
                    query = {_id: params.id};
                } else if (params.hasOwnProperty('name')) {
                    query = {name: params.name};
                }

                this.moduleDB.HAProxyConfigModel.findOne(query, (err, config) => {
                    if (err) {
                        cb(err);
                    } else if (!config) {
                        cb(new Error(`HAProxy config with name "${params.name || params.id.toString()}" not found`));
                    } else {
                        if (config.kind == GLOBAL_CONFIG_TYPE && (status == this.statuses.success || status == this.statuses.paused)) {
                            return cb(new Error('It is impossible to change status for "global" config section'));
                        }

                        if (config.status == status) {
                            return cb(new Error('Nothing to change'));
                        }

                        cb(null, config);
                    }
                });
            },
            (config, cb) => {
                this.moduleDB.HAProxyConfigModel.find({
                    target_id: task.target_id,
                    status: this.statuses.success
                }).sort('kind order_num').lean().exec((err, configs) => {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null, config, configs);
                    }
                });
            },
            (config, configs, cb) => {
                try {
                    if (config.kind == GLOBAL_CONFIG_TYPE && status == this.statuses.deleted) {
                        this.moduleDB.HAProxyConfigModel.count({
                            target_id: task.target_id,
                            kind: {$ne: GLOBAL_CONFIG_TYPE}
                        }, (err, count) => {
                            if (err) {
                                cb(err);
                            } else {
                                if (!count) {
                                    const message = this.createMessage(event, null, {
                                        taskKey: task._id.toString(),
                                        config: '',
                                        dispose: true
                                    });

                                    cb(null, message);
                                } else {
                                    cb(new Error('Can not delete global config. Remove all other configs before'));
                                }
                            }
                        });
                    } else {
                        config.status = status;

                        if (status == this.statuses.success) {
                            configs.splice(config.order_num, 1, config);
                        } else if (status == this.statuses.paused || status == this.statuses.deleted) {
                            configs = configs.filter((item) => !item._id.equals(config._id));
                        }

                        this._cache.set(task._id.toString(), config);

                        const message = this.createMessage(event, null, {
                            taskKey: task._id.toString(),
                            config: configs.map((item) => item.content).join('\n\n')
                        });

                        cb(null, message);
                    }
                } catch (e) {
                    cb(e);
                }
            }
        ], (err, message) => {
            if (err) {
                logger.error(err.message);
                logger.verbose(err.stack);

                originalTask.internal_error = err.message;
                originalTask.status = this.statuses.error;
                originalTask.save((err) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }
                });
            } else {
                try {
                    task.agents.forEach((agent) => {
                        agent.sendMessage(message);
                    });
                } catch (e) {
                    logger.error(e.message);
                    logger.verbose(e.stack);
                }
            }
        });
    }

    /**
     *
     * @param {Object} task
     * @param {Object} params
     * @param {TaskModel} originalTask
     * @private
     */
    _onPauseConfigTask(task, params, originalTask) {
        this._changeStatus(task, params, originalTask, HAProxyModule.PauseEvent, this.statuses.paused);
    }

    /**
     *
     * @param {Object} task
     * @param {Object} params
     * @param {TaskModel} originalTask
     * @private
     */
    _onResumeConfigTask(task, params, originalTask) {
        this._changeStatus(task, params, originalTask, HAProxyModule.ResumeEvent, this.statuses.success);
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
                //} else if (this.checkStringParam(params, 'content')) {
                //    cb(new Error('Missing "content" parameter'));
                } else {
                    try {
                        //if (params.hasOwnProperty('id')) {
                            params.id = mongoose.Types.ObjectId(params.id);
                        //}

                        cb();
                    } catch (e) {
                        cb(e);
                    }
                }
            },
            (cb) => {
                /*
                let query = null;
                if (params.hasOwnProperty('id')) {
                    query = {_id: params.id};
                } else if (params.hasOwnProperty('name')) {
                    query = {name: params.name};
                }
                */

                this.moduleDB.HAProxyConfigModel.findOne({_id: params.id}, (err, config) => {
                    if (err) {
                        cb(err);
                    } else if (!config) {
                        cb(new Error(`HAProxy config with name "${params.name || params.id.toString()}" not found`));
                    } else {
                        cb(null, config);
                    }
                });
            },
            (config, cb) => {
                this.moduleDB.HAProxyConfigModel.find({
                    id: {$ne: config._id},
                    target_id: task.target_id,
                    status: this.statuses.success
                }).sort('kind order_num').lean().exec((err, configs) => {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null, config, configs);
                    }
                });
            },
            (config, configs, cb) => {
                this.moduleDB.HAProxyConfigModel.count({$and: [{kind: {$ne: GLOBAL_CONFIG_TYPE}}, {kind: {$ne: DEFAULT_CONFIG_TYPE}}]}).exec((err, count) => {
                    if (err) {
                        cb(err);
                    } else {
                        cb(null, config, configs, count);
                    }
                });
            },
            (config, configs, amountOfServers, cb) => {
                try {
                    //config.content = params.content;

                    if (!this.checkStringParam(params, 'name')) {
                        config.name = params.name;
                    }

                    if (!this.checkStringParam(params, 'content')) {
                        config.content = params.content;
                    }

                    if (!this.checkNumberParam(params, 'order_number')) {
                        if (config.kind === GLOBAL_CONFIG_TYPE && params.order_number === 0) {
                            params.order_number = 1;
                        }

                        config.order_num = params.order_number;
                    }

                    if (!amountOfServers && config.kind !== LISTEN_CONFIG_TYPE && config.kind !== FRONTEND_CONFIG_TYPE) {
                        config.save((err) => {
                            cb(err, null);
                        });
                    } else {
                        configs.splice(config.order_num, 1, config);

                        this._cache.set(task._id.toString(), config);

                        const message = this.createMessage(HAProxyModule.UpdateEvent, null, {
                            taskKey: task._id.toString(),
                            config: configs.map((item) => item.content).join('\n\n')
                        });

                        cb(null, message);
                    }
                } catch (e) {
                    cb(e);
                }
            }
        ], (err, message) => {
            if (err) {
                logger.error(err.message);
                logger.verbose(err.stack);

                originalTask.internal_error = err.message;
                originalTask.status = this.statuses.error;
                originalTask.save((err) => {
                    if (err) {
                        logger.error(err.message);
                        logger.verbose(err.stack);
                    }
                });
            } else {
                if (message) {
                    try {
                        task.agents.forEach((agent) => {
                            agent.sendMessage(message);
                        });
                    } catch (e) {
                        logger.error(e.message);
                        logger.verbose(e.stack);
                    }
                }
            }
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
        this._changeStatus(task, params, originalTask, HAProxyModule.RemoveEvent, this.statuses.deleted);
    }

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @param {Function} callback
     * @private
     */
    _onCommonTaskComplete(message, agent, callback) {
        async.waterfall([
            (cb) => {
                try {
                    const taskId = mongoose.Types.ObjectId(message.data.taskKey);

                    this.serverDB.TaskModel.findById(taskId, (err, task) => {
                        if (err) {
                            cb(err)
                        } else if (!task) {
                            cb(new Error(`Task "${message.data.taskKey}" not found`));
                        } else {
                            cb(null, task);
                        }
                    });
                } catch (e) {
                    cb(e);
                }
            },
            (task, cb) => {
                if (!task.report) {
                    task.report = [];
                }

                if (!task.error) {
                    task.error = [];

                }

                message.data.report.splice(0, 0, 'Worker: ' + agent.hostname);

                task.report.push({
                    worker_id: agent.worker._id,
                    stack: message.data.report.join('\n')
                });

                if (message.error) {
                    task.status = this.statuses.warning;
                    task.error.push({
                        worker_id: agent.worker._id,
                        stack: 'Worker: ' + agent.hostname + '\n' + message.error
                    });
                }

                task.save((err) => {
                    cb(err, task);
                });
            },
            (task, cb) => {
                try {
                    callback(task, cb);
                } catch (e) {
                    cb(e);
                }
            }
        ], (err) => {
            if (err) {
                logger.error(err.message);
                logger.verbose(err.stack);
            }
        });
    }

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
    _onCommonEventComplete(message, agent) {
        this._onCommonTaskComplete(message, agent, (task, cb) => {
            this._getTaskAgents(task.target_id)
                .then((workers) => {
                    if (workers.length != task.report.length) {
                        cb();
                    } else {
                        if (task.error && task.error.length) {
                            cb();
                        } else {
                            task.status = this.statuses.success;

                            if (this._cache.has(message.data.taskKey)) {

                                let action = 'save';

                                if (message.event == HAProxyModule.RemoveEvent) {
                                    action = 'remove';
                                }

                                this._cache.get(message.data.taskKey)[action]((err) => {
                                    if (err) {
                                        cb(err);
                                    } else {
                                        this._cache.delete(message.data.taskKey);

                                        task.save((err) => {
                                            cb(err);
                                        });
                                    }
                                });
                            } else {
                                cb(new Error(`Model for task "${message.data.taskKey}" not found in cache`));
                            }
                        }
                    }
                })
                .fail((e) => {
                    cb(e);
                });
        });
    }
}

exports.MODULE_NAME = MODULE_NAME;
exports.MODULE_VERSION = MODULE_VERSION;
exports.HAProxyModule = HAProxyModule;

'use strict';
const ModuleBase = require('../core').ModuleBase;

const ServantMessage = require('../message').ServantMessage;
const async = require('async');
const mongoose = require("mongoose");

const logger = require('../core').logger;

const MODULE_NAME = 'nginx';
const MODULE_VERSION = '1.0';

const configKind = {
    main: 0,
    linked: 1
};

class NGINXModule extends ModuleBase {

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
        this.on('task.remove-config', this._onRemoveConfigTask.bind(this));
        this.on('task.update-config', this._onUpdateConfigTask.bind(this));
        this.on('task.change-status-config', this._onChangeStatusConfigTask.bind(this));
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
    static get RemoveEvent() {
        return 'Remove';
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
    static get ChangeStatusEvent() {
        return 'ChangeStatus';
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

        if (message.event === NGINXModule.CreateEvent) {
            this.onCommonEventComplete(message, agent);
        } else if (message.event === NGINXModule.RemoveEvent) {
            this.onCommonEventComplete(message, agent);
        } else if (message.event === NGINXModule.UpdateEvent) {
            this.onCommonEventComplete(message, agent);
        } else if (message.event === NGINXModule.ChangeStatusEvent) {
            this.onCommonEventComplete(message, agent);
        } else {
            logger.warn(`[${this.name}] Unsupported event "${message.event}". Worker: ${agent.ip}`);
        }
    }

    createConfigName(name) {
        return name.replace(/\s/g, '-') + '.conf';
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
                } else if (this.checkStringParam(params, 'groupId')) {
                    cb(new Error('Missing "groupId" parameter'));
                } else if (this.checkNumberParam(params, 'kind')) {
                    cb(new Error('Missing "kind" parameter'));
                } else {
                    params.vars = params.vars || [];
                    
                    if (params.kind != 0 && params.kind != 1) {
                        cb(new Error('Unsupported value for "kind" parameter'));
                    } else {
                        cb();
                    }
                }
            },
            (cb) => {
                try {
                    this.moduleDB.NGINXConfigsGroupModel.findById(mongoose.Types.ObjectId(params.groupId), (err, group) => {
                        if (err) {
                            cb(err);
                        } else if (!group) {
                            cb(new Error(`Group "${params.groupId}" does not exist`));
                        } else {
                            cb(null, group);
                        }
                    });
                } catch (e) {
                    cb(e);
                }
            },
            (group, cb) => {
                try {
                    let content = params.content;

                    let i = params.vars.length;
                    while (i--) {
                        const v = params.vars[i];

                        v.pattern = v.pattern.replace('$', '\\$').replace('{', '\\{').replace('}', '\\}');
                        const r = new RegExp(v.pattern, 'g');
                        
                        content = content.replace(r, v.value);
                    }
                    
                    const model = new this.moduleDB.NGINXConfigModel({
                        group_id: group._id,

                        name: params.name,
                        content: content,
                        status: 0,
                        is_paused: false,
                        kind: params.kind
                    });

                    this._cache.set(task._id.toString(), {model: model, agentsCount: task.agents.length, task: originalTask});

                    const message = this.createMessage(NGINXModule.CreateEvent, null, {
                        taskKey: task._id.toString(),
                        content: content,
                        sourceDir: group.source_dir,
                        kind: params.kind,
                        name: this.createConfigName(params.name)
                    });

                    cb(null, message);
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
                this.moduleDB.NGINXConfigModel.findById(params.id).populate('group_id', 'source_dir').exec((err, config) => {
                    if (err) {
                        cb(err);
                    } else if (!config) {
                        cb(new Error(`NGINX config "${params.id.toString()}" not found`));
                    } else {
                        cb(null, config);
                    }
                });
            },
            (config, cb) => {
                try {
                    this._cache.set(task._id.toString(), {
                        model: config,
                        agentsCount: task.agents.length,
                        task: originalTask
                    });

                    const message = this.createMessage(NGINXModule.RemoveEvent, null, {
                        taskKey: task._id.toString(),
                        name: this.createConfigName(config.name),
                        content: config.content,
                        kind: config.kind,
                        isPaused: config.is_paused,
                        sourceDir: config.group_id.source_dir
                    });

                    cb(null, message);
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
                } else if (this.checkStringParam(params, 'name')) {
                    cb(new Error('Missing "name" parameter'));
                } else if (this.checkStringParam(params, 'content')) {
                    cb(new Error('Missing "content" parameter'));
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
                this.moduleDB.NGINXConfigModel.findById(params.id).populate('group_id', 'source_dir').exec((err, config) => {
                    if (err) {
                        cb(err);
                    } else if (!config) {
                        cb(new Error(`NGINX config "${params.id.toString()}" not found`));
                    } else {
                        cb(null, config);
                    }
                });
            },
            (config, cb) => {
                try {
                    const oldName = config.name;
                    const oldContent = config.content;
                    config.name = params.name;
                    config.content = params.content;

                    this._cache.set(task._id.toString(), {
                        model: config,
                        agentsCount: task.agents.length,
                        task: originalTask
                    });

                    const message = this.createMessage(NGINXModule.UpdateEvent, null, {
                        taskKey: task._id.toString(),
                        name: this.createConfigName(config.name),
                        oldName: this.createConfigName(oldName),
                        content: config.content,
                        kind: config.kind,
                        oldContent: oldContent,
                        sourceDir: config.group_id.source_dir
                    });

                    cb(null, message);
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
    _onChangeStatusConfigTask(task, params, originalTask) {
        async.waterfall([
            (cb) => {
                if (this.checkStringParam(params, 'id')) {
                    cb(new Error('Missing "id" parameter'));
                } else if (this.checkNumberParam(params, 'status')) {
                    cb(new Error('Missing "status" parameter'));
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
                this.moduleDB.NGINXConfigModel.findById(params.id).populate('group_id', 'source_dir').exec((err, config) => {
                    if (err) {
                        cb(err);
                    } else if (!config) {
                        cb(new Error(`NGINX config "${params.id.toString()}" not found`));
                    } else {
                        cb(null, config);
                    }
                });
            },
            (config, cb) => {
                try {
                    const old = config.status;
                    config.status = params.status;

                    if (config.kind === configKind.main) {
                        return cb(new Error(`Config "${config.name}" is unlinked and can not be paused or resumed`));
                    }
                    
                    if (old === config.status) {
                        return cb(new Error(`Config "${config.name}" already has the same status`));
                    }

                    if (config.status != 0 && config.status != 1) {
                        return cb(new Error(`Wrong status for "${config.name}". Accept only 0 or 1 value.`));
                    }
                    
                    config.is_paused = !!params.status;

                    this._cache.set(task._id.toString(), {
                        model: config,
                        agentsCount: task.agents.length,
                        task: originalTask
                    });

                    const message = this.createMessage(NGINXModule.ChangeStatusEvent, null, {
                        taskKey: task._id.toString(),
                        status: config.status,
                        sourceDir: config.group_id.source_dir,
                        name: this.createConfigName(config.name)
                    });

                    cb(null, message);
                } catch (e) {
                    cb(e);
                }
            }
        ], (err, message) => {
            this.sendTask(err, message, originalTask, task.agents);
        });
    }
}

exports.MODULE_NAME = MODULE_NAME;
exports.MODULE_VERSION = MODULE_VERSION;
exports.NGINXModule = NGINXModule;

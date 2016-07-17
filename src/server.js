'use strict';

const ws = require('ws');
const async = require('async');
const vow = require('vow');

const fs = require('fs');
const os = require('os');
const path = require('path');

const coreMW = require('../middlewares/core');
const statuses = require('../modules/core').statuses;

const logger = require('../lib/logger');
const db = require('../lib/db');

const ServantClient = require('./client').ServantClient;
const MiddlewareStack = require('./middleware-stack').MiddlewareStack;
const TaskLoop = require('./task-loop').TaskLoop;

const WebSocketServer = ws.Server;

const states = exports.states = {
    unInit: -1,
    init: 0,
    running: 1,
    stopped: 2,
    error: 3
};

class ServantServer extends MiddlewareStack {
    constructor(options) {
        options = options || {};

        super();

        this.ip = options.ip || '127.0.0.1';
        this.port = options.port || 8010;
        this.heartbeat = options.heartbeat || 0;
        this.loopInterval = options.loopInterval || 1;
        this.middlewaresOptions = options.middlewares || [];
        this.modulesOptions = options.modules || [];

        this.server = null;

        this._wss = null;
        this._workers = [];
        this._loop = null;
        this._state = states.unInit;
    }

    get modules() {
        return this._modules;
    }

    get stacks() {
        return this._stacks;
    }

    /**
     * 
     * @returns {{ServantClient}|*}
     */
    get workers() {
        return this._workers;
    }

    get currentAgentsCount() {
        return this._workers.length;
    }

    _wsOnConnect(socket) {
        var client = new ServantClient(this, socket);
        this._workers.push(client);

        logger.debug('Current agents: ' + this.currentAgentsCount);

        this.emit('server.accept', client);
    }

    _wsOnError(err) {
        this.emit('server.error', err);
    }

    _wsOnClose(code, message) {
        this.emit('server.close', code, message);
    }

    _onExit(err) {
        if (err) {
            logger.error(err.name + ': ' + err.message);
            logger.verbose(err.stack);
        }

        this.server.status = err ? states.error : states.stopped;
        this.server.save((err) => {
            if (err) {
                logger.error(err.name + ': ' + err.message);
                logger.verbose(err.stack);
            }

            process.exit(err ? 1 : process.exitCode ? process.exitCode : 0);
        });
    }

    _runTaskLoop() {
        logger.info('Task loop started');

        this._loop = new TaskLoop(this.server, this.loopInterval);

        this._loop.on('task.new', (task, params) => {
            const taskObj = task.toObject();
            this.handleStack(this._stacks[coreMW.TASK_RECEIVED_STAGE], null, [taskObj, this], (err) => {
                if (err) {
                    logger.error(err.message);
                    logger.verbose(err.stack);

                    task.internal_error = err.message;
                    task.status = statuses.error;
                    task.save((err) => {
                        if (err) {
                            logger.error(err.message);
                            logger.verbose(err.stack);
                        }
                    });
                } else {
                    this.emit('server.new-task', taskObj, task, params);
                }
            });
        });

        this._loop.run();
    }

    loadMiddlewares() {
        this.middlewaresOptions.forEach((item) => {
            const temp = require(path.join(path.dirname(module.parent.filename), 'middlewares', item))(db);
            this.loadMiddleware(temp);
        });
    }

    loadModules() {
        this.modulesOptions.forEach((item) => {
            item.states = states;

            const temp = require(path.join(path.dirname(module.parent.filename), 'modules', item.name))(db, this, this.server.toObject(), item);

            if (item.hasOwnProperty('depends')) {
                item.depends.middlewares.forEach((mw) => {
                    if (this.middlewaresOptions.indexOf(mw) < 0) {
                        throw new Error(`Module "${item.name} requires "${mw}" middleware.`);
                    }
                });
            }

            if (temp.hasOwnProperty('middlewares')) {
                if (!Array.isArray(temp.middlewares)) {
                    throw new Error('"middlewares" property must be an array');
                }

                for (let i = 0; i < temp.middlewares.length; i++) {
                    this.loadMiddleware(temp.middlewares[i]);
                }
            }

            this.loadModule(temp.module);
        });
    }

    init() {
        const defer = vow.defer();

        logger.verbose('Init. Options:', {
            ip: this.ip,
            port: this.port,
            heartbeat: this.heartbeat,
            loopInterval: this.loopInterval,
            middlewaresOptions: this.middlewaresOptions,
            modulesOptions: this.modulesOptions
        });

        async.waterfall([
            (callback) => {
                db.connect((err) => {
                    callback(err);
                });
            },
            (callback) => {
                logger.verbose('Connect to DB: success');
                db.ServerModel.findOne({server_name: os.hostname(), port: this.port}, (err, server) => {
                    if (err) {
                        return callback(err);
                    } else if (!err && !server) {
                        logger.verbose('New server saved in db');

                        server = new db.ServerModel({
                            server_name: os.hostname(),
                            port: this.port
                        });
                    }

                    server.status = this._state;
                    server.ip = this.ip;

                    this.server = server;

                    callback(err, server);
                });
            },
            (server, callback) => {
                server.save(callback);
            }
        ], (err) => {
            if (err) {
                defer.reject(err);
            } else {

                this._state = states.init;

                const h = this._onExit.bind(this);

                process.on('uncaughtException', h);
                process.on('SIGINT', h);

                this.loadMiddlewares();
                this.loadModules();

                defer.resolve();
            }
        });

        return defer.promise();
    }

    run() {
        if (this._state === states.init) {
            this._wss = new WebSocketServer({port: this.port, host: this.ip});
            this._wss.on('connection', this._wsOnConnect.bind(this));
            this._wss.on('error', this._wsOnError.bind(this));
            this._wss.on('close', this._wsOnClose.bind(this));
            this._state = states.running;

            logger.info(`Server "${this.server.server_name}" running at: ${this.server.ip}:${this.server.port}`);

            this.on('server.new-task', (task, originalTask, params) => {
                if (this.modules.hasOwnProperty(task.module)) {
                    this.modules[task.module].emit('task.' + task.cmd, task, params, originalTask);
                } else {
                    logger.warn(`Unsupported module "${task.module}"`);
                }
            });

            this._runTaskLoop();

            this.server.status = this._state;
            this.server.save((err) => {
                if (err) throw err;
            });
        } else {
            throw new Error('Server isn\'t initialized');
        }
    }
}

exports.ServantServer = ServantServer;
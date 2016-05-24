'use strict';

const EventEmitter = require('events');

const core = require('../modules/core');
const logger = require('../lib/logger');
const db = require('../lib/db');

class TaskLoop extends EventEmitter {
    /**
     *
     * @param {ServerModel} server
     * @param {Number} interval
     */
    constructor(server, interval) {
        super();

        if (!server) {
            throw new Error('Missing "server" parameter');
        }

        this.server = server;
        this.interval = interval || 1;
    }

    _iterate() {
        db.TaskModel.find({status: core.statuses.create, server_id: this.server._id}, '_id cmd module params server_id target_id status').sort('dt').limit(1).exec((err, tasks) => {
            if (err) {
                logger.error(err.message);
                logger.verbose(err.stack);
            } else if (!tasks.length) {
                // in case of empty result
            } else {
                const task = tasks[0];
                logger.debug(`Receive new task: module - ${task.module}; cmd - ${task.cmd}; params - ${task.params}`);

                try {
                    task.status = core.statuses.process;
                    task.save((err) => {
                        if (err) {
                            logger.error(err.message);
                            logger.error(err.stack);
                        } else {
                            this.emit('task.new', task, JSON.parse(task.params));
                        }
                    });
                }
                catch (e) {
                    logger.error(e.message);
                    logger.verbose(e.stack);
                }
            }

            setTimeout(() => {
                this._iterate();
            }, this.interval * 1000);
        });
    }

    run() {
        this._iterate();
    }
}

exports.TaskLoop = TaskLoop;
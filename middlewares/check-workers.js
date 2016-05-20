'use strict';

const core = require('./core');

const MiddlewareBase = core.MiddlewareBase;

class SecurityMiddleWare extends MiddlewareBase {
    constructor(db) {
        super();

        this.db = db;
    }

    get stage() {
        return core.TASK_RECEIVED_STAGE;
    }

    /**
     *
     * @param {TaskModel} task
     * @param {ServantServer} server
     * @param {Function} next
     */
    handle(task, server, next) {
        if (!(task.target_id && task.target_id.length)) {
            next(new Error('Missing target id'));
        }

        if (!Object.keys(server.workers).length) {
            return next(new Error('Server does not have any connected workers'));
        }

        if (task.target_id[0] === 'G') {
            this.db.WorkersGroupModel.findOne({sys_id: task.target_id}).populate('workers').exec(function (err, group) {
                if (err) {
                    next(err);
                } else if (!group) {
                    next(new Error(`Group "${task.target_id} not found`));
                } else {
                    let agents = [];
                    for (let i = 0; i < group.workers.length; i++) {
                        let res = false;
                        for (let key in server.workers) {
                            if (server.workers.hasOwnProperty(key)) {
                                let s = server.workers[key].worker._id;

                                if (group.workers[i].equals(s)) {
                                    res = true;
                                    agents.push(server.workers[key]);
                                    break;
                                }
                            }
                        }

                        if (!res) {
                            return next(new Error(`Worker "${group.workers[i].sys_id}" does not running`));
                        }
                    }
                    task.agents = agents;
                    next();
                }
            });
        } else if (task.target_id[0] === 'W') {
            this.db.WorkerModel.findOne({sys_id: task.target_id}).exec(function (err, worker) {
                if (err) {
                    next(err);
                } else if (!worker) {
                    next(new Error(`Worker "${task.target_id} not found`));
                } else {
                    let res = false;
                    for (let key in server.workers) {
                        if (server.workers.hasOwnProperty(key)) {
                            let s = server.workers[key].worker._id;

                            if (worker._id.equals(s)) {
                                task.agents = [server.workers[key]];
                                return next();
                            }
                        }
                    }

                    next(new Error(`Worker "${worker.sys_id}" does not running`));
                }
            });
        } else {
            next(new Error('Incorrect target id'));
        }
    }
}

module.exports = (serverDB) => {
    return new SecurityMiddleWare(serverDB);
};


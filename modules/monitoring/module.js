'use strict';

const async = require('async');
const mongoose = require('mongoose');
const extend = require('util')._extend;

const ModuleBase = require('../core').ModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;

const MODULE_NAME = 'monitoring';
const MODULE_VERSION = '1.0';

const DETAILS_INTERVAL = 5;

class MonitoringModule extends ModuleBase {

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

        this._intervals = {};
        this._settings = {};

        this.on('task.update-settings', this._onUpdateSettingsTask.bind(this));

        this._serverInstance.on('client.authorized', this._onClientAuthorized.bind(this));
        this._serverInstance.on('client.disconnect', this._onClientDisconnected.bind(this));
        
        this.init();
    }

    init() {

    }

    /**
     * @return {string}
     */
    static get CollectEvent() {
        return 'Collect';
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

        if (message.event === MonitoringModule.CollectEvent) {
            this._onCollectEvent(message, agent);
        } else {
            logger.warn(`[${this.name}] Unsupported event "${message.event}". Worker: ${agent.ip}`);
        }
    }

    _metricHandler(metric, settings) {
        logger.info(`Running metric "${metric.sys_name}"`);

        if (metric.is_detail) {
            settings.interval = DETAILS_INTERVAL;
        }

        const iterate = () => {
            for (let k in this._serverInstance.workers) {
                if (this._serverInstance.workers.hasOwnProperty(k) &&
                    this._serverInstance.workers[k].worker.modules.indexOf('monitoring') >= 0) {
                    const message = this.createMessage(MonitoringModule.CollectEvent, null, {
                        id: metric._id,
                        metric: metric.sys_name
                    });

                    this._serverInstance.workers[k].sendMessage(message);
                }
            }
        };

        this._intervals[metric.sys_name] = setInterval(() => {
            iterate();
        }, settings.interval * 60 * 1000);

        this._settings[metric._id.toString()] = settings;

        iterate();
    }

    _disposeMetric(metricName) {
        if (this._intervals.hasOwnProperty(metricName)) {
            clearInterval(this._intervals[metricName]);
            delete this._intervals[metricName];

            logger.info(`Metric "${metricName}" stopped`);
        }
    }

    /**
     *
     * @param {Object} task
     * @param {Object} params
     * @param {TaskModel} originalTask
     * @private
     */
    _onUpdateSettingsTask(task, params, originalTask) {
        async.waterfall([
            (cb) => {
                try {
                    if (this.checkStringParam(params, 'id')) {
                        cb(new Error('Missing "id" parameter'));
                    } else {
                        const id = mongoose.Types.ObjectId(params.id);

                        this.moduleDB.MetricModel.findOne({
                            _id: id,
                            'settings.server_id': this.server._id
                        }, 'sys_name is_detail settings.$', (err, metric) => {
                            if (err) {
                                cb(err);
                            } else if (!metric) {
                                cb(new Error(`Metric "${params.id}" does not exist for server`));
                            } else {
                                this._disposeMetric(metric.sys_name);

                                if (metric.settings[0].is_active) {
                                    this._metricHandler(metric, metric.settings[0]);
                                }

                                cb(null, metric);
                            }
                        });
                    }
                } catch (e) {
                    cb(e);
                }
            }
        ], (err, metric) => {
            if (err) {
                logger.error(err.message);
                logger.verbose(err.stack);

                originalTask.internal_error = err.message;
                originalTask.status = this.statuses.error;
            } else {
                originalTask.status = this.statuses.success;
                logger.verbose(`Metric ${metric.sys_name} successfully updated`);
            }

            originalTask.save((err) => {
                if (err) {
                    logger.error(err.message);
                    logger.verbose(err.stack);
                }
            });
        });
    }

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
    _onCollectEvent(message, agent) {
        if (message.data.hasOwnProperty('details')) {
            this._collectNodeDetailsData(message, agent);
        }

        if (message.data.hasOwnProperty('metrics')) {
            this._collectMetricsData(message, agent);
        }
    }

    /**
     *
     * @param {Date} ts
     * @returns {Array} {*[]}
     * @private
     */
    static _getTimeInterval(ts) {
        const ssd = new Date(ts);
        ssd.setMinutes(0);
        ssd.setSeconds(0);
        ssd.setMilliseconds(0);

        const sed = new Date(ts);
        sed.setHours(ssd.getHours() + 1);
        sed.setMinutes(0);
        sed.setSeconds(0);
        sed.setMilliseconds(0);

        return [ssd, sed];
    }

    static _setMinValue(history, current) {
        return history.min > current ? current : history.min;
    }

    static _setMaxValue(history, current) {
        return history.max < current ? current : history.max;
    }

    static _setHistoryData(history, value) {
        history.v += value;
        history.min = MonitoringModule._setMinValue(history, value);
        history.max = MonitoringModule._setMaxValue(history, value);
    }

    _runMetricsCollector(agent) {
        const iterate = () => {
            const message = this.createMessage(MonitoringModule.CollectEvent, null, null);
            agent.sendMessage(message);
        };

        this._intervals[agent.hostname] = setInterval(() => {
            iterate();
        }, 60 * 1000);

        iterate();
    }
    
    _onClientAuthorized(agent) {
        if (agent.worker.modules.indexOf('monitoring') >= 0) {
            this._runMetricsCollector(agent);
        }
    }

    _onClientDisconnected(code, message, agent) {
        if (this._intervals.hasOwnProperty(agent.hostname)) {
            clearInterval(this._intervals[agent.hostname]);
            delete this._intervals[agent.hostname];
        }
    }
    
    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
    _collectNodeDetailsData(message, agent) {
        const setData = function (data) {
            return {
                ts: data.ts,

                node_type: data.node_type,
                vendor: data.vendor,
                hostname: data.hostname,
                uptime: data.uptime,
                status: 1,

                system: data.system,
                gw: data.gw,
                inets: data.inets
            }
        };

        let i = 0;
        async.whilst(
            () => i < message.data.details.nodes.length,
            (next) => {
                const node = message.data.details.nodes[i++];
                let temp = node.status ? setData(node) : {$set: {status: 0}};
                
                this.moduleDB.NodeDetailModel.findOneAndUpdate({hostname: node.hostname},
                    temp, {upsert: true}, (err) => {
                        next(err);
                    });
            },
            (err) => {
                if (err) {
                    logger.error(err.message);
                    logger.verbose(err.stack);
                } else {
                    logger.verbose(`Successfully saved node details data from "${agent.hostname}"`);
                }
            }
        );
    }

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
    _collectMetricsData(message, agent) {
        const setData = function (nodeId, data) {
            return {
                node_id: nodeId,
                sys_name: data.name,
                ts: data.ts,
                measure: data.measure,
                component: data.component,
                value: data.value
            }
        };

        const saveMetric = (nodeId, metricName, current, cb) => {
            async.waterfall([
                (cb) => {
                    this.moduleDB.MetricDataModel.findOneAndUpdate({node_id: nodeId, sys_name: metricName},
                        setData(nodeId, current), {upsert: true}, (err) => {
                            cb(err);
                        });
                },
                (cb) => {
                    const [ssd, sed] = MonitoringModule._getTimeInterval(current.ts);

                    this.moduleDB.MetricHistoryModel.findOne({
                        node_id: nodeId, sys_name: metricName,
                        ts: {$gte: ssd, $lt: sed}
                    }, (err, model) => {
                        if (err) {
                            cb(err);
                        } else {
                            if (!model) {
                                model = new this.moduleDB.MetricHistoryModel({
                                    node_id: nodeId, sys_name: metricName, ts: current.ts,
                                    total_value: {v: 0, min: current.value, max: current.value},
                                    num_samples: 0,
                                    measure: current.measure,
                                    component: current.component,
                                    values: {}
                                });
                            }

                            MonitoringModule._setHistoryData(model.total_value, current.value);

                            model.seq = current.ts.getMinutes();
                            ++model.num_samples;

                            model.values[model.seq.toString()] = current.value;

                            model.markModified('values');
                            model.save((err) => {
                                cb(err);
                            });
                        }
                    });
                }
            ], cb);
        };

        if (message.data.metrics.nodes) {
            async.each(message.data.metrics.nodes, (node, next) => {
                this.moduleDB.NodeDetailModel.findOne({hostname: node.hostname}, '_id', {lean: true}, (err, model) => {
                    if (err) {
                        next(err);
                    } else if (!model) {
                        next(new Error(`Node ${node.hostname} not found`));
                    } else {
                        async.each(Object.keys(node.metrics), (k, next) => {
                            const current = node.metrics[k];

                            current.name = k;
                            current.ts = new Date(current.ts);

                            saveMetric(model._id, k, current, next);
                        }, (err) => {
                            next(err);
                        });
                    }
                });
            }, (err) => {
                if (err) {
                    logger.error(err.message);
                    logger.verbose(err.stack);
                } else {
                    logger.verbose(`Successfully saved metrics data from "${agent.hostname}"`);
                }
            });
        }
    }
}

exports.MODULE_NAME = MODULE_NAME;
exports.MODULE_VERSION = MODULE_VERSION;
exports.MonitoringModule = MonitoringModule;

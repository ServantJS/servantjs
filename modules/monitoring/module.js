'use strict';

const async = require('async');
const mongoose = require('mongoose');

const ModuleBase = require('../core').ModuleBase;
const ServantMessage = require('../message').ServantMessage;

const logger = require('../core').logger;
const db = require('../core').db;

const MODULE_NAME = 'monitoring';
const MODULE_VERSION = '1.0';

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

        this.init();
    }

    init() {
        this.moduleDB.MetricModel.find({
            'settings.server_id': this.server._id,
            'settings.isActive': true
        }, 'sys_name settings.$', (err, metrics) => {
            if (err) {
                logger.error(err.message);
                logger.verbose(err.stack);
            } else {
                let index = 0;
                async.whilst(
                    () => index < metrics.length,
                    (next) => {
                        const metric = metrics[index];
                        const settings = metric.settings[0];

                        this._metricHandler(metric, settings);

                        index++;
                        next();
                    },
                    (err) => {
                        if (err) {
                            logger.error(err.message);
                            logger.verbose(err.stack);
                        }
                    }
                )
            }
        });
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
        logger.verbose(`Run metric ${metric.sys_name}`);
        
        this._intervals[metric.sys_name] = setInterval(() => {
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
        }, settings.interval * 60 * 1000);
    }
    
    _disposeMetric(metricName) {
        if (this._intervals.hasOwnProperty(metricName)) {
            clearInterval(this._intervals[metricName]);
            delete this._intervals[metricName];
        }
    }

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
    _onCollectEvent(message, agent) {
        if (message.data.metric === 'os_cpu') {
            this._collectCPUData(message, agent)
        }
    }

    _collectCPUData(message, agent) {
        const ts = new Date();
        async.waterfall([
            (cb) => {
                try {
                    const metricId = mongoose.Types.ObjectId(message.data.id);

                    this.moduleDB.CPUEventModel.findOneAndUpdate({worker_id: agent.worker._id}, {
                        metric_id: metricId,
                        worker_id: agent.worker._id,
                        ts: ts,
                        values: message.data.value
                    }, {upsert: true}, (err) => {
                        cb(err, metricId);
                    });
                } catch (e) {
                    cb(e);
                }
            },
            (metricId, cb) => {
                var ssd = new Date(ts);
                ssd.setMinutes(0);
                ssd.setSeconds(0);
                ssd.setMilliseconds(0);

                var sed = new Date(ts);
                sed.setHours(ssd.getHours() + 1);
                sed.setMinutes(0);
                sed.setSeconds(0);
                sed.setMilliseconds(0);

                this.moduleDB.CPUHistoryModel.findOne({worker_id: agent.worker._id, ts: {$gte: ssd, $lt: sed}}, (err, model) => {
                    if (err) {
                        cb(err);
                    } else {
                        if (!model) {
                            model = new this.moduleDB.CPUHistoryModel({
                                metric_id: metricId,
                                worker_id: agent.worker._id,
                                ts: ts,
                                total_value: message.data.value.map((item) => {
                                    return {
                                        name: item.name, 
                                        user: {v: 0, min: item.user, max: item.user}, 
                                        system: {v: 0, min: item.system, max: item.system},
                                        total: {v: 0, min: item.total, max: item.total}}}),
                                num_samples: 0,
                                values: {}
                            });
                        }

                        let i = message.data.value.length;
                        while(i--) {
                            model.total_value[i].system.v += message.data.value[i].system;
                            model.total_value[i].system.min = model.total_value[i].system.min > message.data.value[i].system ? message.data.value[i].system : model.total_value[i].system.min;
                            model.total_value[i].system.max = model.total_value[i].system.max < message.data.value[i].system ? message.data.value[i].system : model.total_value[i].system.max;

                            model.total_value[i].user.v += message.data.value[i].user;
                            model.total_value[i].user.min = model.total_value[i].user.min > message.data.value[i].user ? message.data.value[i].user : model.total_value[i].user.min;
                            model.total_value[i].user.max = model.total_value[i].user.max < message.data.value[i].user ? message.data.value[i].user : model.total_value[i].user.max;

                            model.total_value[i].total.v += message.data.value[i].total;
                            model.total_value[i].total.min = model.total_value[i].total.min > message.data.value[i].total ? message.data.value[i].total : model.total_value[i].total.min;
                            model.total_value[i].total.max = model.total_value[i].total.max < message.data.value[i].total ? message.data.value[i].total : model.total_value[i].total.max;
                        }

                        model.seq = ts.getMinutes();
                        ++model.num_samples;

                        model.values[model.seq.toString()] = message.data.value;

                        model.markModified('values');
                        model.save((err) => {
                            cb(err);
                        });
                    }
                });
            }
        ], (err) => {
            if (err) {
                logger.error(err.message);
                logger.verbose(err.stack);
            } else {
                logger.verbose(`Successfully saved data from ${agent.hostname} of "${message.data.metric}" metric`);
            }
        });
    }
}

exports.MODULE_NAME = MODULE_NAME;
exports.MODULE_VERSION = MODULE_VERSION;
exports.MonitoringModule = MonitoringModule;

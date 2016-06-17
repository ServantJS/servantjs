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
        this.moduleDB.MetricModel.find({
            'settings.server_id': this.server._id,
            'settings.is_active': true
        }).select('sys_name is_detail settings.$').lean().exec((err, metrics) => {
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
                );
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
        switch (message.data.metric) {
            case 'os_cpu':
                this._collectCPUData(message, agent);
                break;
            case 'os_ram':
                this._collectRAMData(message, agent);
                break;
            case 'os_net_a':
                this._collectNetActivityData(message, agent);
                break;
            case 'node_details':
                this._collectNodeDetailsData(message, agent);
                break;
            case 'hp_stat':
                this._collectHaProxyStatData(message, agent);
                break;
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

    _createNotification(message, previous, current, threshold_kind, prior) {
        return this.moduleDB.NotificationModel({
            message: message,
            provider: this._options.provider,
            raw_value: {
                previous: previous,
                current: current
            },
            threshold_kind: threshold_kind,
            prior: prior || 1
        });
    }

    _checkThresholds(ts, event, message, current, agent, metricId, model, cb) {
        let notif;
        const settings = this._settings[metricId.toString()];

        if (event == null) {
            (new model({
                metric_id: metricId,
                worker_id: agent.worker._id,
                ts: ts,
                values: message.data.value,
                threshold_hits: {
                    normal: {value: -1, hits: 0},
                    warning: {value: 0, hits: 0},
                    critical: {value: 0, hits: 0}
                }
            })).save((err) => {
                cb(err);
            });

            return;
        }

        event.ts = ts;
        event.values = message.data.value;

        if (settings.threshold.is_enabled) {

            if (current < settings.threshold.warning.value && (event.threshold_hits.warning.value != 0 || event.threshold_hits.critical.value != 0)) {
                ++event.threshold_hits.normal.hits;

                if (event.threshold_hits.normal.value < 0) {
                    event.threshold_hits.normal.value = event.threshold_hits.critical.value || event.threshold_hits.warning.value;
                }
            } else {
                event.threshold_hits.normal.hits = 0;
            }

            if (current >= settings.threshold.warning.value && current < settings.threshold.critical.value) {
                ++event.threshold_hits.warning.hits;
                event.threshold_hits.warning.value = event.threshold_hits.warning.value > 0 && event.threshold_hits.warning.hits > 0 ? event.threshold_hits.warning.value : current;
            } else {
                event.threshold_hits.warning.hits = 0;
            }

            if (current >= settings.threshold.critical.value) {
                ++event.threshold_hits.critical.hits;
                event.threshold_hits.critical.value = event.threshold_hits.critical.value > 0 && event.threshold_hits.critical.hits > 0 ? event.threshold_hits.critical.value : current;
            } else {
                event.threshold_hits.critical.hits = 0;
            }

            if (event.threshold_hits.critical.hits >= settings.threshold.repeat) {
                notif = this._createNotification(`Value is above ${settings.threshold.critical.value}%`, event.threshold_hits.critical.value, current, 2, 3);
                event.threshold_hits.critical.hits = 0;
            } else if (event.threshold_hits.warning.hits >= settings.threshold.repeat) {
                notif = this._createNotification(`Value is above ${settings.threshold.warning.value}%`, event.threshold_hits.warning.value, current, 1, 1);
                event.threshold_hits.warning.hits = 0;
            } else if (event.threshold_hits.normal.hits >= settings.threshold.repeat) {
                notif = this._createNotification(`Value is below ${settings.threshold.warning.value}%`, event.threshold_hits.normal.value, current, 0, 1);
                event.threshold_hits.normal.hits = 0;
                event.threshold_hits.normal.value = -1;

                event.threshold_hits.warning.hits = 0;
                event.threshold_hits.warning.value = 0;

                event.threshold_hits.critical.hits = 0;
                event.threshold_hits.critical.value = 0;
            }

        }

        event.save((err) => {
            if (err) {
                cb(err);
            } else {
                if (notif) {
                    notif.save((err) => {
                        cb(err);
                    });
                } else {
                    cb(null);
                }
            }
        });
    }

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
    _collectCPUData(message, agent) {
        let metricId;
        const ts = new Date();
        async.waterfall([
            (cb) => {
                try {
                    metricId = mongoose.Types.ObjectId(message.data.id);

                    this.moduleDB.CPUEventModel.findOne({worker_id: agent.worker._id}, (err, event) => {
                        if (err) {
                            cb(err);
                        } else {
                            cb(null, event);
                        }
                    });

                } catch (e) {
                    cb(e);
                }
            },
            (event, cb) => {
                const totalLoad = message.data.value.map(function (item) {
                    return item.total;
                });

                const val = totalLoad.reduce((pv, cv) => pv + cv, 0);

                const current = Math.round(val / totalLoad.length);

                this._checkThresholds(ts, event, message, current, agent, metricId, this.moduleDB.CPUEventModel, cb);
            },
            (cb) => {
                let [ssd, sed] = MonitoringModule._getTimeInterval(ts);

                this.moduleDB.CPUHistoryModel.findOne({
                    worker_id: agent.worker._id,
                    ts: {$gte: ssd, $lt: sed}
                }, (err, model) => {
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
                                        total: {v: 0, min: item.total, max: item.total}
                                    }
                                }),
                                num_samples: 0,
                                values: {}
                            });
                        }

                        let i = message.data.value.length;
                        while (i--) {
                            MonitoringModule._setHistoryData(model.total_value[i].system, message.data.value[i].system);
                            MonitoringModule._setHistoryData(model.total_value[i].user, message.data.value[i].user);
                            MonitoringModule._setHistoryData(model.total_value[i].total, message.data.value[i].total);


                            /*model.total_value[i].system.v += message.data.value[i].system;

                            model.total_value[i].system.min = MonitoringModule._setMinValue(model.total_value[i].system, message.data.value[i].system);
                            model.total_value[i].system.max = MonitoringModule._setMaxValue(model.total_value[i].system, message.data.value[i].system);

                            model.total_value[i].user.v += message.data.value[i].user;
                            model.total_value[i].user.min = MonitoringModule._setMinValue(model.total_value[i].user, message.data.value[i].user);
                            model.total_value[i].user.max = MonitoringModule._setMaxValue(model.total_value[i].user, message.data.value[i].user);

                            model.total_value[i].total.v += message.data.value[i].total;
                            model.total_value[i].total.min = MonitoringModule._setMinValue(model.total_value[i].total, message.data.value[i].total);
                            model.total_value[i].total.max = MonitoringModule._setMaxValue(model.total_value[i].total, message.data.value[i].total);*/
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

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
    _collectRAMData(message, agent) {
        const ts = new Date();
        let metricId;
        async.waterfall([
            (cb) => {
                try {
                    metricId = mongoose.Types.ObjectId(message.data.id);

                    this.moduleDB.RAMEventModel.findOne({worker_id: agent.worker._id}, (err, event) => {
                        if (err) {
                            cb(err);
                        } else {
                            cb(null, event);
                        }
                    });

                } catch (e) {
                    cb(e);
                }
            },
            (event, cb) => {
                const current = Math.round((message.data.value.total - message.data.value.free) / message.data.value.total * 100);
                this._checkThresholds(ts, event, message, current, agent, metricId, this.moduleDB.RAMEventModel, cb);
            },
            (cb) => {
                const [ssd, sed] = MonitoringModule._getTimeInterval(ts);

                this.moduleDB.RAMHistoryModel.findOne({
                    worker_id: agent.worker._id,
                    ts: {$gte: ssd, $lt: sed}
                }, (err, model) => {
                    if (err) {
                        cb(err);
                    } else {
                        if (!model) {
                            model = new this.moduleDB.RAMHistoryModel({
                                metric_id: metricId,
                                worker_id: agent.worker._id,
                                ts: ts,
                                total_value: {
                                    total: {v: 0, min: message.data.value.total.user, max: message.data.value.total},
                                    free: {v: 0, min: message.data.value.free, max: message.data.value.free}
                                },
                                num_samples: 0,
                                values: {}
                            });
                        }

                        MonitoringModule._setHistoryData(model.total_value.total, message.data.value.total);
                        MonitoringModule._setHistoryData(model.total_value.free, message.data.value.free);

                        /*model.total_value.total.v += message.data.value.total;
                        model.total_value.total.min = MonitoringModule._setMinValue(model.total_value.total, message.data.value.total);
                        model.total_value.total.max = MonitoringModule._setMaxValue(model.total_value.total, message.data.value.total);

                        model.total_value.free.v += message.data.value.free;
                        model.total_value.free.min = MonitoringModule._setMinValue(model.total_value.free, message.data.value.free);
                        model.total_value.free.max = MonitoringModule._setMaxValue(model.total_value.free, message.data.value.free);*/

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

    _onClientAuthorized(agent) {
        if (this._intervals.hasOwnProperty('node_details')) {
            this.moduleDB.NodeDetailsModel.update({worker_id: agent.worker._id}, {$set: {'values.status': 1}}, (err) => {
                if (err) {
                    logger.error(err.message);
                    logger.verbose(err.stack);
                }
            });
        }
    }

    _onClientDisconnected(code, message, agent) {
        if (this._intervals.hasOwnProperty('node_details')) {
            this.moduleDB.NodeDetailsModel.update({worker_id: agent.worker._id}, {$set: {'values.status': 0}}, (err) => {
                if (err) {
                    logger.error(err.message);
                    logger.verbose(err.stack);
                }
            });
        }
    }
    
    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
    _collectNodeDetailsData(message, agent) {
        const ts = new Date();
        async.waterfall([
            (cb) => {
                try {
                    const metricId = mongoose.Types.ObjectId(message.data.id);

                    this.moduleDB.NodeDetailsModel.findOneAndUpdate({worker_id: agent.worker._id}, {
                        metric_id: metricId,
                        worker_id: agent.worker._id,
                        ts: ts,
                        values: {
                            os: message.data.value.os,
                            status: 1,
                            hostname: message.data.value.hostname,
                            uptime: message.data.value.uptime,
                            net: message.data.value.net
                        }
                    }, {upsert: true}, (err) => {
                        cb(err);
                    });
                } catch (e) {
                    cb(e);
                }
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

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
    _collectNetActivityData(message, agent) {
        let metricId;
        const ts = new Date();
        async.waterfall([
            (cb) => {
                try {
                    metricId = mongoose.Types.ObjectId(message.data.id);

                    this.moduleDB.NetActivityEventModel.findOne({worker_id: agent.worker._id}, (err, event) => {
                        if (err) {
                            cb(err);
                        } else {
                            cb(null, event);
                        }
                    });

                } catch (e) {
                    cb(e);
                }
            },
            (event, cb) => {

                const totalValue = message.data.value.total;
                if (!totalValue) {
                    return cb(new Error(`Incorrect data from agent "${agent.hostname}"`));
                }

                const current = totalValue.per_sec.bytes.input;

                this._checkThresholds(ts, event, message, current, agent, metricId, this.moduleDB.NetActivityEventModel, cb);
            },
            (cb) => {
                let [ssd, sed] = MonitoringModule._getTimeInterval(ts);

                this.moduleDB.NetActivityHistoryModel.findOne({
                    worker_id: agent.worker._id,
                    ts: {$gte: ssd, $lt: sed}
                }, (err, model) => {
                    if (err) {
                        cb(err);
                    } else {
                        if (!model) {
                            let obj = JSON.parse(JSON.stringify(message.data.value));
                            for (let k in obj) {
                                if (obj.hasOwnProperty(k)) {
                                    obj[k].packets = {
                                        input: {v: 0, min: obj[k].packets.input, max: obj[k].packets.input},
                                        output: {v: 0, min: obj[k].packets.output, max: obj[k].packets.output}
                                    };
                                    obj[k].bytes = {
                                        input: {v: 0, min: obj[k].bytes.input, max: obj[k].bytes.input},
                                        output: {v: 0, min: obj[k].bytes.output, max: obj[k].bytes.output}
                                    };
                                    obj[k].per_sec = {
                                        packets: {
                                            input: {
                                                v: 0,
                                                    min: obj[k].per_sec.packets.input,
                                                    max: obj[k].per_sec.packets.input
                                            },
                                            output: {
                                                v: 0,
                                                    min: obj[k].per_sec.packets.output,
                                                    max: obj[k].per_sec.packets.output
                                            }
                                        },
                                        bytes: {
                                            input: {
                                                v: 0,
                                                    min: obj[k].per_sec.bytes.input,
                                                    max: obj[k].per_sec.bytes.input
                                            },
                                            output: {
                                                v: 0,
                                                    min: obj[k].per_sec.bytes.output,
                                                    max: obj[k].per_sec.bytes.output
                                            }
                                        }
                                    }
                                }
                            }
                            
                            model = new this.moduleDB.NetActivityHistoryModel({
                                metric_id: metricId,
                                worker_id: agent.worker._id,
                                ts: ts,
                                total_value: obj,
                                num_samples: 0,
                                values: {}
                            });
                        }

                        for (let k in message.data.value) {
                            if (message.data.value.hasOwnProperty(k)) {
                                MonitoringModule._setHistoryData(model.total_value[k].packets.input, message.data.value[k].packets.input);
                                MonitoringModule._setHistoryData(model.total_value[k].packets.output, message.data.value[k].packets.output);

                                MonitoringModule._setHistoryData(model.total_value[k].bytes.input, message.data.value[k].bytes.input);
                                MonitoringModule._setHistoryData(model.total_value[k].bytes.output, message.data.value[k].bytes.output);

                                MonitoringModule._setHistoryData(model.total_value[k].per_sec.packets.input, message.data.value[k].per_sec.packets.input);
                                MonitoringModule._setHistoryData(model.total_value[k].per_sec.packets.output, message.data.value[k].per_sec.packets.output);

                                MonitoringModule._setHistoryData(model.total_value[k].per_sec.bytes.input, message.data.value[k].per_sec.bytes.input);
                                MonitoringModule._setHistoryData(model.total_value[k].per_sec.bytes.output, message.data.value[k].per_sec.bytes.output);
                            }
                        }

                        model.seq = ts.getMinutes();
                        ++model.num_samples;

                        model.values[model.seq.toString()] = message.data.value;

                        model.markModified('values');
                        model.markModified('total_value');
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

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @private
     */
    _collectHaProxyStatData(message, agent) {
        let metricId;
        const ts = new Date();
        async.waterfall([
            (cb) => {
                try {
                    metricId = mongoose.Types.ObjectId(message.data.id);

                    this.moduleDB.HaProxyStatEventEventModel.findOne({worker_id: agent.worker._id}, (err, event) => {
                        if (err) {
                            cb(err);
                        } else {
                            cb(null, event);
                        }
                    });

                } catch (e) {
                    cb(e);
                }
            },
            (event, cb) => {
                if (event == null) {
                    (new this.moduleDB.HaProxyStatEventEventModel({
                        metric_id: metricId,
                        worker_id: agent.worker._id,
                        ts: ts,
                        values: message.data.value,
                        threshold_hits: {
                            normal: {value: -1, hits: 0},
                            warning: {value: 0, hits: 0},
                            critical: {value: 0, hits: 0}
                        }
                    })).save((err) => {
                        cb(err, null);
                    });

                    return;
                }

                let previousData = event.values;

                event.ts = ts;
                event.values = message.data.value;
                event.markModified('values');
                event.save((err) => {
                    cb(err, previousData);
                });
            },
            (previousData, cb) => {
                let [ssd, sed] = MonitoringModule._getTimeInterval(ts);

                this.moduleDB.HaProxyStatHistoryModel.findOne({
                    worker_id: agent.worker._id,
                    ts: {$gte: ssd, $lt: sed}
                }, (err, model) => {
                    if (err) {
                        cb(err);
                    } else {
                        if (!model) {
                            /*let obj = JSON.parse(JSON.stringify(message.data.value));
                            for (let k in obj) {
                                if (obj.hasOwnProperty(k)) {
                                    obj[k].bytes = {
                                        input: {v: 0, min: obj[k].bytes.input, max: obj[k].bytes.input},
                                        output: {v: 0, min: obj[k].bytes.output, max: obj[k].bytes.output}
                                    };
                                }
                            }*/

                            model = new this.moduleDB.HaProxyStatHistoryModel({
                                metric_id: metricId,
                                worker_id: agent.worker._id,
                                ts: ts,
                                total_value: null,
                                num_samples: 0,
                                values: {}
                            });
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

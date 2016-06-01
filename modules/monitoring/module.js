'use strict';

const async = require('async');

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

        this._intervalTick = 1;
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
    }

    _metricHandler(metric, settings) {
        logger.verbose(`Run metric ${metric.sys_name}`);
        
        this._intervals[metric.sys_name] = setInterval(() => {
            for (let k in this._serverInstance.workers) {
                if (this._serverInstance.workers.hasOwnProperty(k) &&
                    this._serverInstance.workers[k].worker.modules.indexOf('monitoring') >= 0) {
                    const message = this.createMessage(MonitoringModule.CollectEvent, null, {
                        metric: metric.sys_name
                    });

                    this._serverInstance.workers[k].sendMessage(message);
                }
            }
        }, settings.interval * 1000);
    }
    
    _disposeMetric(metricName) {
        if (this._intervals.hasOwnProperty(metricName)) {
            clearInterval(this._intervals[metricName]);
            delete this._intervals[metricName];
        }
    }
}

exports.MODULE_NAME = MODULE_NAME;
exports.MODULE_VERSION = MODULE_VERSION;
exports.MonitoringModule = MonitoringModule;

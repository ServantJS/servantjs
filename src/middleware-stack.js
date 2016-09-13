'use strict';

const EventEmitter = require('events');
const async = require('async');

const logger = require('../lib/logger');
const coreMW = require('../middlewares/core');
const ModuleBase = require('../modules/core').ModuleBase;
const MiddlewareBase = require('../middlewares/core').MiddlewareBase;

const stages = [
    coreMW.MESSAGE_RECEIVED_STAGE,
    coreMW.MODULE_STAGE,
    coreMW.MESSAGE_SEND_STAGE,
    coreMW.TASK_RECEIVED_STAGE
];

class MiddlewareStack extends EventEmitter {
    constructor() {
        super();

        this._stacks = {};

        this._stacks[coreMW.MESSAGE_RECEIVED_STAGE] = [];
        this._stacks[coreMW.MODULE_STAGE] = [];
        this._stacks[coreMW.MESSAGE_SEND_STAGE] = [];
        this._stacks[coreMW.TASK_RECEIVED_STAGE] = [];

        this._modules = {};
    }

    loadMiddlewares() {
        throw new Error('Method not implemented');
    }

    loadModules() {
        throw new Error('Method not implemented');
    }

    loadModule(instance) {
        if (!(instance instanceof ModuleBase)) {
            throw new Error('Class must be instance of "ModuleBase"');
        }

        this._modules[instance.name] = instance;

        logger.debug(`Registered new module. Name: "${instance.name}", version: "${instance.version}"`);

        this.use(instance.name, instance.handle.bind(instance), coreMW.MODULE_STAGE);
    }

    loadMiddleware(instance) {
        if (!(instance instanceof MiddlewareBase)) {
            throw new Error('Class must be instance of "MiddlewareBase"');
        }

        logger.debug(`Registered new middle ware. Stage: "${instance.stage}"`);

        this.use(instance.handle.bind(instance), instance.stage);
    }

    use(name, handler, stage) {
        if (typeof name === 'function') {
            stage = handler;
            handler = name;
            name = 'dummy';
        }

        if (typeof handler !== 'function') {
            throw new Error('"handler" must be a function');
        }

        if (stages.indexOf(stage) === -1) {
            throw new Error(`Unsupported stage: "${stage}"`);
        }

        logger.debug(`Registered new middle ware function. Name: "${name}", stage: "${stage}"`);

        this._stacks[stage].push({route: name, handle: handler});
    }

    /**
     *
     * @param {Array} stack
     * @param {String} searchRoute
     * @param {Array} args
     * @param {Function} callback
     */
    handleStack(stack, searchRoute, args, callback) {
        let index = 0;
        let layer = null;

        async.whilst(
            () => {
                return index < stack.length;
            },
            (next) => {
                try {
                    layer = stack[index];

                    if (searchRoute && layer.route !== 'dummy' && searchRoute.toLowerCase() !== layer.route) {
                        index++;
                        return next();
                    }

                    const cb = (err) => {
                        index++;
                        next(err);
                    };

                    args.push(cb);

                    layer.handle.apply(layer.handle, args);
                } catch (e) {
                    next(e);
                }
            },
            (err) => {
                callback(err);
            }
        );
    }
}

exports.MiddlewareStack = MiddlewareStack;
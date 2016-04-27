'use strict';

const core = require('../../../middlewares/core');
const sm = require('../module');

const MiddlewareBase = core.MiddlewareBase;

class SecurityMiddleware extends MiddlewareBase {
    constructor(db) {
        super();

        this.db = db;
        this._name = sm.MODULE_NAME;
        this._version = sm.MODULE_VERSION;
    }

    get stage() {
        return core.MESSAGE_RECEIVED_STAGE;
    }

    /**
     *
     * @param {ServantMessage} message
     * @param {ServantClient} agent
     * @param {Function} next
     */
    handle(message, agent, next) {
        const event = {event: sm.SecurityModule.SendKeyEventName, module: this._name, version: this._version};

        if (message.module === this._name) {
            next();
        } else if (!message.data || !message.data.token) {
            agent.socket.sendJSON(event);
        } else {
            this.db.SessionModel.findOne({token: message.data.token}, (err, session) => {
                if (err) {
                    next(err);
                } else if (!session) {
                    agent.socket.sendJSON(event);
                } else {
                    next();
                }
            });
        }
    }
}

module.exports = (serverDB) => {
    return new SecurityMiddleware(serverDB);
};


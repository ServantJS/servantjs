'use strict';

const core = require('../../../middlewares/core');
const ServantMessage = require('../../../modules/message').ServantMessage;

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
        if (message.module === this._name) {
            next();
        } else if (!message.data || !message.data.token) {
            const temp = new ServantMessage({
                module: this._name,
                version: this._version,
                event: sm.SecurityModule.SendKeyEventName
            });

            agent.sendMessage(temp);
        } else {
            this.db.SessionModel.findOne({token: message.data.token}, (err, session) => {
                if (err) {
                    next(err);
                } else if (!session) {
                    const temp = new ServantMessage({
                        module: this._name,
                        version: this._version,
                        event: sm.SecurityModule.SendKeyEventName
                    });

                    agent.sendMessage(temp);
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


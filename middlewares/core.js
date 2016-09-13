'use strict';

class MiddlewareBase {
    get stage() {
        throw new Error('Property not implemented.');
    }

    handle() {
        throw new Error('Method not implemented.');
    }
}

exports.MESSAGE_RECEIVED_STAGE = 'message-received';
exports.MODULE_STAGE = 'message-handled';
exports.MESSAGE_SEND_STAGE = 'message-send';
exports.TASK_RECEIVED_STAGE = 'task-received';

exports.MiddlewareBase = MiddlewareBase;
exports.logger = require('../lib/logger');
exports.db = require('../lib/db');
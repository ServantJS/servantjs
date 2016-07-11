'use strict';

class ServantMessage {
    static checkString(str, name) {
        if (!(str && typeof str === 'string' && str.trim().length)) {
            throw new Error(`Missing or incorrect type of "${name}".`);
        } else {
            return str;
        }
    }

    static checkArray(array, name) {
        if (!(array && Array.isArray(array) && array.length)) {
            throw new Error(`Missing or incorrect type of "${name}".`);
        } else {
            return array;
        }
    }

    constructor(raw) {
        let temp = raw;

        if (typeof raw === 'string') {
            temp = JSON.parse(raw);
        }

        this._module = ServantMessage.checkString(temp.module, 'module');
        this._event = ServantMessage.checkString(temp.event, 'event');
        this._version = ServantMessage.checkString(temp.version, 'version');

        this._token = temp.token || null;
        this._data = temp.data || null;

        if (this._data && typeof this._data !== 'object') {
            throw new Error('Incorrect type for "data" property.');
        }

        this._error = temp.error || null;

        if (this._error && typeof this._error !== 'string') {
            throw new Error('Incorrect type for "error" property.');
        }
    }

    get token() {
        return this._token;
    }

    get module() {
        return this._module;
    }

    get event() {
        return this._event;
    }

    get version() {
        return this._version;
    }

    get data() {
        return this._data;
    }

    get error() {
        return this._error;
    }

    toObject() {
        return {
            module: this._module,
            event: this._event,
            version: this._version,
            data: this._data,
            error: this._error
        }
    }

    toJSON() {
        return JSON.stringify(this.toObject());
    }
}

exports.ServantMessage = ServantMessage;
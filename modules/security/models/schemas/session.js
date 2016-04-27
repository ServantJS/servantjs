'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto   = require('crypto');

function createToken(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

const SessionSchema = exports.SessionSchema = new Schema({
    token: String,
    worker_id: {type: Schema.Types.ObjectId, ref: 'Worker'}
});

SessionSchema.statics.generateToken = (ip, hostname) => {
    return createToken(ip + '|' + hostname + '|' + (new Date()).getTime().toString());
};

mongoose.model('Session', SessionSchema);
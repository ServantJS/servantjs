'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = exports.UserSchema = new Schema({
    email: {type: String, index: true, unique: true},
    pwd: {type: String, index: true},
    access_key: {type: String, unique: true},
    activated: Boolean
});

function generateAPIToken(pref, id, login) {
    var currentDate = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    return (pref + '-' + currentDate + '-' + crypto.createHash('sha256').update([id, currentDate, random, login].join('|')).digest('hex')).toUpperCase();
}

function searchIS(value) {
    return new RegExp('^' + value + '$', 'i');
}

function encryptPwd (pwd) {
    return crypto.createHash('sha256').update(pwd).digest('hex');
}

UserSchema.statics.authorize = function (login, pwd, callback) {
    this.findOne({email: {$regex: searchIS(login)}, pwd: encryptPwd(pwd), activated: true})
        .lean()
        .exec(callback);
};

UserSchema.pre('save', function (next) {
    if (!this.access_key) {
        this.access_key = generateAPIToken('uat', this._id, this.email);
    }

    if (this.isModified('pwd')) {
        this.pwd = encryptPwd(this.pwd);
    }

    next();
});

mongoose.model('User', UserSchema);
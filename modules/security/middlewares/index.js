'use strict';

module.exports = (serverDB) => {
    return [
        require('./check-token')(serverDB)
    ]
};
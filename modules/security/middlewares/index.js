'use strict';

module.exports = (moduleDB) => {
    return [
        require('./check-token')(moduleDB)
    ]
};
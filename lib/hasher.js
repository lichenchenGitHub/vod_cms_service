var crypto = require('crypto');

var Hasher = (function () {
    function _hasher() {
    }

    _hasher.prototype = {
        GetSHA1: function (msg) {
            var hash = crypto.createHash('sha1');
            hash.update(msg);
            return hash.digest('hex');
        },
        GetMD5: function (msg) {
            var hash = crypto.createHash('md5');
            hash.update(msg);
            return hash.digest('hex');
        }

    }

    return _hasher;
})();
module.exports = Hasher;
/**
 * Created by lichenchen on 2017/8/4.
 */
var conf = require('../conf/config');
var mongoose = require('mongoose');

var connectionString = 'mongodb://' + conf.mongodb.user + ':' + conf.mongodb.passwd + '@' + conf.mongodb.host + ':' + conf.mongodb.port + '/' + conf.mongodb.db;

if (conf.mongodb.authdb) {
    connectionString = connectionString + '?authSource=' + conf.mongodb.authdb;
}


mongoose.connect(connectionString, function (err) {
    if (err) {
        console.error('' + new Date() + ', failed to connect to: ' + connectionString + ', err: ' + err);
    }
});

mongoose.connection.on('open', function (ref) {
});

mongoose.connection.on('error', function (err) {
    console.error('' + new Date() + ', connection error: ' + err);
});

module.exports = mongoose;

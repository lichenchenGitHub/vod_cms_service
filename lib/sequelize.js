/**
 * Created by lichenchen on 2017/5/24.
 */
var Sequelize = require("sequelize");
var conf = require("../conf/config");
const sequelize = new Sequelize(conf.mysql.db, conf.mysql.user, conf.mysql.passwd, {
    host: conf.mysql.host,
    port: conf.mysql.port,
    dialect: conf.mysql.dbtype,
    pool: {
        max: conf.mysql.pool.max,
        min: conf.mysql.pool.min,
        idle: conf.mysql.pool.idle
    }
});
module.exports = sequelize;
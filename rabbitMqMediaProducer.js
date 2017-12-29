/**
 * Created by lichenchen on 2017/11/13.
 */
var Promise = require("bluebird");
var amqp = require("amqplib/callback_api");
var conf = require("./conf/config");
var Enums = require("./lib/enums");
var enums = new Enums();
var SearchDatabase = require("./lib/searchDatabase");
var searchDatabase = new SearchDatabase();
var JobEnterDatabase = require("./lib/jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
var Tools = require("./lib/tools");
var tools = new Tools();
amqp.connect("amqp://"+conf.rabbitMq.user+":"+conf.rabbitMq.password+"@"+conf.rabbitMq.host+":"+conf.rabbitMq.port, function (err, conn) {
    if (err) {
        console.error("connect server error at " + new Date())
        console.error(err);
    }
    conn.createChannel(function (err, ch) {
        if (err) {
            console.error("create channel error at " + new Date())
            console.error(err);
        }
        var ex = conf.rabbitMq.exchangeName;
        var smallInterval = conf.rabbitMq.interval;
        var bigInterval = smallInterval * 10;
        var interval = smallInterval;
        ch.assertExchange(ex, "topic", {durable: true});
        var routingKey = enums.RabbitMqMedia;
        var addTasks = function () {
            searchDatabase.getSPMAlertRecordByFilter({
                where: {status: 0},
                limit: conf.rabbitMq.selectLimit,
                raw: true
            }).then(function (result) {
                if (result.length == conf.rabbitMq.selectLimit) {
                    interval = smallInterval;
                } else {
                    interval = bigInterval;
                }
                Promise.mapSeries(result, function (item, index) {
                    for (var key in routingKey) {
                        if (routingKey[key].contentType == item.contentType && routingKey[key].actionType == item.actionType) {
                            tools.deleteEmptyProperty(item);
                            try {
                                ch.publish(ex, key, new Buffer(JSON.stringify(item)), {persistent: true});
                                console.log(" [x] sent %s:%s", key, JSON.stringify(item));
                                return jobEnterDatabase.updateSPMAlertRecords({where:{id: item.id}}, {
                                    status: 1,
                                    statusDesc:"推送成功",
                                    updateTime: new Date()
                                }).then(function (result) {
                                    return {message: "update SPMAlertRecords " + item.id + " success at " + new Date()}
                                }).catch(function (err) {
                                    return {
                                        Error: err,
                                        message: "update SPMAlertRecords " + item.id + " failed at " + new Date()
                                    }
                                })
                            } catch (e) {
                                console.error("catch error at " + new Date())
                                console.error(e);
                                return jobEnterDatabase.updateSPMAlertRecords({where:{id: item.id}}, {
                                    status: -1,
                                    statusDesc:"推送失败",
                                    updateTime: new Date()
                                }).then(function (result) {
                                    return {message: "update SPMAlertRecords " + item.id + " success at " + new Date()}
                                }).catch(function (err) {
                                    return {
                                        Error: err,
                                        message: "update SPMAlertRecords " + item.id + " failed at " + new Date()
                                    }
                                })
                            }
                        }
                    }
                }).then(function (data) {
                    console.log("execute job success at " + new Date())
                    console.log(data);
                    return;
                }).catch(function (err) {
                    console.error("execute job failed at " + new Date());
                    console.error(err);
                    return;
                })
            })
        }
        setInterval(addTasks, interval)
    })
})

/**
 * Created by lichenchen on 2017/8/24.
 */
var cluster = require("cluster");
var Promise = require("bluebird");
var Redis = require("ioredis");
var fs = require("fs");
var schedule = require("node-schedule");
var conf = require("./conf/config");
var Tools = require("./lib/tools");
var tools = new Tools();
var SearchDatabase = require("./lib/searchDatabase");
var searchDatabase = new SearchDatabase();
var JobEnterDatabase = require("./lib/jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
var TransformObject = require("./lib/transformObject");
var transformObject = new TransformObject();
var ExecuteJob = require("./lib/executeJob");
var executeJob = new ExecuteJob();
if (conf.redisConf.default === "cluster") {
    var keystore = new Redis.Cluster(conf.redisConf.cluster);
} else {
    var keystore = new Redis(conf.redisConf.normal);
}
var token = null;
if (cluster.isMaster) {
    var arr = [];
    var numWorkers = require('os').cpus().length;
    for (var i = 0; i < numWorkers; i++) {
        var worker = cluster.fork();
        worker.on("message", function (messsage ) {
            console.log(messsage);
            if (arr.length > 0) {
                worker.send({vid: arr.shift(), token: token});
            }
        })
    }
    function eachWorker(callback) {
        for (var id in cluster.workers) {
            callback(cluster.workers[id]);
        }
    }

    setInterval(function () {
        console.log("task start !");
        var nowDate = Math.floor(new Date().getTime() / 1000);
        //查询时间间隔设置
        keystore.get("cpsStartTime", function (err, result) {
            if (err) {
                console.error(err);
            } else {
                var startTime = null;
                var endTime = null;
                if (result) {
                    endTime = Number(result);
                    startTime = endTime - Number(conf.cpsInterval);
                    keystore.set("cpsStartTime", result + conf.cpsInterval);
                } else {
                    keystore.set("cpsStartTime", nowDate + conf.cpsInterval);
                    endTime = Number(nowDate);
                    startTime = endTime - Number(conf.cpsInterval);
                }
                console.log("endTime is :" + endTime);
                console.log("startTime is :" + startTime);
            }
            //获取token
            return tools.getCpsToken().then(function (tokenResult) {
                token = tokenResult.token;
                //获取节目集列表
                var params = tools.transJsonToParams({
                    token: token,
                    appId: conf.appId,
                    sortBy: "mtime",
                    order: "asc",
                    startTime: startTime,
                    endTime: endTime
                });
                //查询seriesList
                return searchDatabase.getCpsMediaList(params).then(function (mediaListResult) {
                    if (mediaListResult.list.length == 0) {
                        console.log(mediaListResult);
                    } else {
                        var seriesList = mediaListResult.list.map(function (item, index, input) {
                            return item.vid;
                        })
                        arr = arr.concat(seriesList);
                        eachWorker(function (worker) {
                            if (arr.length > 0) {
                                worker.send({vid: arr.shift(), token: token});
                            }
                        });
                    }
                }).catch(function (err) {
                    console.error(err);
                });
            })
        })
    }, 6000);

} else {
    process.on('message', function (message) {
        if (message.token) {
            token = message.token;
        }
        console.log(token);
        searchDatabase.getCpsMediaInfo(message.vid, 0, token).then(function (seriesInfo) {
            var series = transformObject.transCpsSeries(seriesInfo);
            if (series == null) {
                return null;
            } else {
                //节目集入库，同时获取节目集下节目列表
                return Promise.join(jobEnterDatabase.upsertCpsSeries(series), searchDatabase.getCpsMediaListSeries(message.vid, token), function (seriesResult, programList) {
                    return {series: seriesResult, programList: programList.list};
                }).then(function (result) {
                    //节目集入库成功结果入库待聚合表，节目列表遍历入库
                    return Promise.join(jobEnterDatabase.upsertWaitunified(executeJob.executeJobWaitunified(result.series)), executeJob.executeCpsProgramList(result.programList, message.vid, result.series, token), function (waitunifiedResult, programListResult) {
                        console.log("waitunifiedResult  code is :" + waitunifiedResult.code)
                        console.log('programListResult execute number is :' + programListResult);
                        return programListResult;
                    });
                })
            }
        }).then(function (result) {
            process.send(result);
        }).catch(function (err) {
            process.send(err);
        })
    })
}


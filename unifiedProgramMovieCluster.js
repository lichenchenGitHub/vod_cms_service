/**
 * Created by lichenchen on 2017/4/21.
 */
var cluster = require("cluster");
var kue = require("kue");
var Redis = require("ioredis");
var conf = require("./conf/config");
var unirest = require("unirest");
var Promise = require("bluebird");
var queue = kue.createQueue({
    prefix: conf.queuePrefix.unifiedProgramMovie,
    redis: {
        createClientFactory: function () {
            if (conf.redisConf.default === "cluster") {
                return new Redis.Cluster(conf.redisConf.cluster);
            } else {
                return new Redis(conf.redisConf.normal)
            }
        }
    }
});
if (conf.redisConf.default === "cluster") {
    var keystore = new Redis.Cluster(conf.redisConf.cluster);
} else {
    var keystore = new Redis(conf.redisConf.normal);
}
var ExecuteJob = require("./lib/executeJob");
var JobEnterDatabase = require("./lib/jobEnterDatabase");
var excuteJob = new ExecuteJob();
var jobEnterDatabase = new JobEnterDatabase();
var Enums = require("./lib/enums");
var enums = new Enums();


var Hasher = require('./lib/hasher');
var hasher = new Hasher();
var initJob = function () {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedseriesseries?filter[limit]=" + conf.jobOption.limit + "&filter[where][status]=1&filter[where][isunified]=0"));
        req.pool(conf.poolOption);
        req.end(function (res) {
            if (res.status != 200) {
                reject({Error: "initJob get apiInfo error " + res.statusCode + " at " + new Date()})
            } else {
                if (res.body instanceof Array) {
                    if (res.body.length > 0) {
                        var initList = res.body;
                        return Promise.map(initList, function (item, index) {
                            return new Promise(function (resolve, reject) {
                                var hash = conf.queuePrefix.unifiedProgramMovie + hasher.GetSHA1(item.cpcontentid.toString());
                                keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                    if (err) {
                                        reject({Error: "set " + conf.queuePrefix.unifiedProgramMovie + " key error"})
                                    } else if (msg == 'OK') {
                                        var job = queue.create(conf.keyPrefix.unifiedSeries, {
                                            unifiedseriescode: item.unifiedseriescode,
                                            cpcontentid: item.cpcontentid
                                        }).attempts(conf.jobOption.attempts).backoff({
                                            delay: conf.jobOption.delay,
                                            type: 'fixed'
                                        }).removeOnComplete(true).ttl(conf.jobOption.ttl).save(function (err) {
                                            if (err) {
                                                reject({Error: item.cpcontentid + " : create job err " + err + new Date()});
                                            } else {
                                                resolve({Info: item.cpcontentid + " : create job success as job " + job.id + " at " + new Date()});
                                            }
                                        })
                                    }
                                });
                            });
                        }).then(function (data) {
                            resolve(data);
                        }).catch(function (err) {
                            reject(err);
                        });
                    } else {
                        resolve({Warning: "apiInfo Array length is 0"});
                    }
                } else {
                    reject({Error: "init apiInfo is not an Array at" + new Date()})
                }
            }

        })
    });
}
var addJob = function () {
    queue.inactiveCount(conf.keyPrefix.unifiedSeries, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.mediaComplete, function (err, total) {
                console.log("delayedCount is :" + total);
                if (total <= conf.jobOption.total) {
                    initJob().then(function (data) {
                        console.log(data)
                        return;
                    }).catch(function (err) {
                        console.error(err);
                        return;
                    })
                }
            })
        }
    });
}
var removeJob = function () {
    try {
        console.log("remove job start at " + new Date());
        kue.Job.rangeByType(conf.keyPrefix.unifiedSeries, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
            if (err) {
                console.error(err);
            } else {
                if (jobs instanceof Array && jobs.length > 0) {
                    jobs.forEach(function (job) {
                        job.remove(function () {
                            console.log('removed ', job.id + " at " + new Date());
                        });
                    })
                } else {
                    console.log("don't have failed jobs");
                }
            }
        });
    } catch (e) {
        console.error("remove failed at " + new Date());
        console.error(e);
    }
}
if (cluster.isMaster) {
    kue.app.listen(7013);
    var worker = cluster.fork();
    initJob().then(function (data) {
        console.log(data);
        return;
    }).catch(function (err) {
        console.error(err);
        return;
    })
    queue.on('error', function (err) {
        console.error(JSON.stringify({role: 'scheduler', err: err}));
    });
    var addJobInterval = null;
    addJobInterval = setInterval(addJob, conf.jobOption.addInterval);
    var removeJobInterval = null;
    removeJobInterval = setInterval(removeJob, conf.jobOption.removeInterval);
    cluster.on('exit', function (worker, code, signal) {
        if (signal) {
            console.log('worker ' + worker.process.pid + ' was killed by signal: ' + signal);
        }
        else if (code !== 0) {
            console.log('worker ' + worker.process.pid + ' exited with error code: ' + code);
            worker = cluster.fork();
        }
        else {
            console.log('worker ' + worker.process.pid + ' exited success');
        }
    });
    var quitCallback = function () {
        if (addJobInterval) {
            clearInterval(addJobInterval);
            addJobInterval = null;
        }
        if (removeJobInterval) {
            clearInterval(removeJobInterval);
            removeJobInterval = null;
        }
        queue.shutdown(1000, function (err) {
            worker.kill('SIGTERM');
            setTimeout(function () {
                process.exit(0);
            }, 3000);
        });
    }
    process.once("SIGINT", quitCallback);
    process.once("SIGTERM", quitCallback);
} else {
    queue.process(conf.keyPrefix.unifiedSeries, function (job, done) {
        //聚合节目和介质
        try {
            return excuteJob.executeJobUnifiedprograms(job.data.unifiedseriescode, job.data.cpcontentid).then(function (data) {
                //更新聚合节目集聚合状态
                return jobEnterDatabase.upsertUnifiedseriesseries({
                    unifiedseriescode: job.data.unifiedseriescode,
                    cpcontentid: job.data.cpcontentid,
                    isunified: enums.UnifiedStatus.SUCCESS_UNIFIED.value,
                    unifieddesc: enums.UnifiedStatus.SUCCESS_UNIFIED.name
                }).then(function (unifiedseriesseriesResult) {
                    console.log(unifiedseriesseriesResult);
                    return done();
                })
            }).catch(function (err) {
                return jobEnterDatabase.upsertUnifiedseriesseries({
                    unifiedseriescode: job.data.unifiedseriescode,
                    cpcontentid: job.data.cpcontentid,
                    isunified: enums.UnifiedStatus.FAILED_UNIFIED.value,
                    unifieddesc: enums.UnifiedStatus.FAILED_UNIFIED.name
                }).then(function (unifiedseriesseriesResult) {
                    console.error(err);
                    return done(err);
                }).catch(function (error) {
                    console.log("Unifiedseriesseries set isunified -1 error at " + new Date());
                    return done(error)
                })
            })
        } catch (e) {
            console.error(e);
            return jobEnterDatabase.upsertUnifiedseriesseries({
                unifiedseriescode: job.data.unifiedseriescode,
                cpcontentid: job.data.cpcontentid,
                isunified: enums.UnifiedStatus.FAILED_UNIFIED.value,
                unifieddesc: enums.UnifiedStatus.FAILED_UNIFIED.name
            }).then(function (unifiedseriesseriesResult) {
                return done(e);
            }).catch(function (error) {
                console.log("Unifiedseriesseries set isunified -1 error at " + new Date());
                return done(error)
            })
        }

    })
}

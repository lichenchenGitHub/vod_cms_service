/**
 * Created by lichenchen on 2017/7/5.
 */
var cluster = require("cluster");
var kue = require("kue");
var Redis = require("ioredis");
var conf = require("./conf/config");
var unirest = require("unirest");
var Promise = require("bluebird");
var queue = kue.createQueue({
    prefix: conf.queuePrefix.importMediaResult,
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
var executeJob = new ExecuteJob();
var jobEnterDatabase = new JobEnterDatabase();
var Hasher = require('./lib/hasher');
var hasher = new Hasher();
var initJob = function () {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Importmedia?filter[limit]=" + conf.jobOption.limit + "&filter[where][status]=10&filter[where][statisticalstatus]=0&filter[order]=priority DESC"));
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
                                var hash = conf.queuePrefix.importMediaResult + hasher.GetSHA1(item.id.toString());
                                keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                    if (err) {
                                        reject({Error: "set " + conf.queuePrefix.importMediaResult + " key error"})
                                    } else if (msg == 'OK') {
                                        var job = queue.create(conf.keyPrefix.importMediaResult, {
                                            id: item.id,
                                            importsuccesscount: item.importsuccesscount
                                        }).attempts(conf.jobOption.attempts).backoff({
                                            delay: conf.jobOption.delay,
                                            type: 'fixed'
                                        }).removeOnComplete(true).ttl(conf.jobOption.ttl).save(function (err) {
                                            if (err) {
                                                reject({Error: item.id + " : create job err " + err + new Date()});
                                            } else {
                                                resolve({Info: item.id + " : create job success as job " + job.id + " at " + new Date()});
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
    queue.inactiveCount(conf.keyPrefix.importMediaResult, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.importMediaResult, function (err, total) {
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
        kue.Job.rangeByType(conf.keyPrefix.importMediaResult, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
            if (err) {
                console.error(err);
            } else {
                if (jobs instanceof Array && jobs.length > 0) {
                    jobs.forEach(function (job) {
                        job.remove(function () {
                            console.log('removed ', job.id + ":" + job.data.id + " at " + new Date());
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
    kue.app.listen(7016);
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
        queue.shutdown(1000, function (err) {
            if (addJobInterval) {
                clearInterval(addJobInterval);
                addJobInterval = null;
            }
            if (removeJobInterval) {
                clearInterval(removeJobInterval);
                removeJobInterval = null;
            }
            worker.kill('SIGTERM');
            setTimeout(function () {
                process.exit(0);
            }, 3000);
        });
    }
    process.once("SIGINT", quitCallback);
    process.once("SIGTERM", quitCallback);
} else {
    queue.process(conf.keyPrefix.importMediaResult, function (job, done) {
        if (job.data.importsuccesscount == 0) {
            var importMedia = {};
            importMedia.status = 21;
            importMedia.statusdesc = "解析失败,导入成功条数为0";
            importMedia.successcount = 0;
            importMedia.failedcount = 0;
            return jobEnterDatabase.updateImportMedia(job.data.id, importMedia).then(function (data) {
                return done();
            }).catch(function (err) {
                console.error(err);
                return done(err)
            })
        } else {
            return executeJob.executeImportMediaDetailResult(job.data.id).then(function (result) {
                console.log("result is:");
                console.log(result);
                if (result.code != 200) {
                    return done();
                } else {
                    var importMedia = {};
                    // var total = result.data.successCount + result.data.failedCount;
                    importMedia.statisticalstatus = 1;
                    if (result.data.failedCount <= 0) {
                        importMedia.status = 20;
                        importMedia.statusdesc = "解析成功";
                        importMedia.successcount = result.data.successCount;
                        importMedia.failedcount = result.data.failedCount;
                    } else {
                        importMedia.status = 21;
                        importMedia.statusdesc = "解析失败";
                        importMedia.successcount = result.data.successCount;
                        importMedia.failedcount = result.data.failedCount;
                    }
                    importMedia.updatetime = new Date();
                    return jobEnterDatabase.updateImportMedia(job.data.id, importMedia).then(function (data) {
                        console.log(data);
                        return done();
                    })
                }
            }).catch(function (err) {
                console.error("error is :");
                console.error(err);
                var importMedia = {};
                importMedia.statisticalstatus = -1;
                importMedia.status = 21;
                importMedia.statusdesc = "解析失败";
                importMedia.updatetime = new Date();
                return jobEnterDatabase.updateImportMedia(job.data.id, importMedia).then(function (data) {
                    console.error(data);
                    return done(err);
                }).catch(function (error) {
                    console.error(error);
                    return done(error);
                })
            })
        }
    })

}
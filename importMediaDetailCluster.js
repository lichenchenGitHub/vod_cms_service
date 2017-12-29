/**
 * Created by lichenchen on 2017/6/15.
 */
var cluster = require("cluster");
var kue = require("kue");
var Redis = require("ioredis");
var conf = require("./conf/config");
var unirest = require("unirest");
var Promise = require("bluebird");
var queue = kue.createQueue({
    prefix: conf.queuePrefix.importMediaDetail,
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
        var req = unirest.get(conf.strongLoopApi + "Importmediadetails?filter[order]=priority DESC&filter[limit]=" + conf.jobOption.limit + "&filter[where][status]=0");
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
                                var hash = conf.queuePrefix.importMediaDetail + hasher.GetSHA1(item.id.toString());
                                keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                    if (err) {
                                        reject({Error: "set " + conf.queuePrefix.importMediaDetail + " key error"})
                                    } else if (msg == 'OK') {
                                        var job = queue.create(conf.keyPrefix.importMediaDetail, {
                                            id: item.id,
                                            status: item.status
                                        }).attempts(conf.jobOption.attempts).backoff({
                                            delay: conf.jobOption.delay,
                                            type: 'fixed'
                                        }).removeOnComplete(true).ttl(conf.jobOption.ttl * 10).save(function (err) {
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
    queue.inactiveCount(conf.keyPrefix.importMediaDetail, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.importMediaDetail, function (err, total) {
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
        kue.Job.rangeByType(conf.keyPrefix.importMediaDetail, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
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
    kue.app.listen(7010);
    var worker = cluster.fork();
    queue.on('error', function (err) {
        console.error(JSON.stringify({role: 'scheduler', err: err}));
    });
    initJob().then(function (data) {
        console.log(data);
        return;
    }).catch(function (err) {
        console.error(err);
        return;
    })
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
    queue.process(conf.keyPrefix.importMediaDetail, function (job, done) {
        try {
            return executeJob.executeJobImportMediaDetail(job.data.id).then(function (result) {
                var detail = {status: 30, statusdesc: "解析成功"};
                detail.updatetime = new Date();
                return jobEnterDatabase.updateImportDetail(job.data.id, detail).then(function (updateResult) {
                    console.log(updateResult);
                    done();
                }).catch(function (err) {
                    console.error(job.data.id + " parse success but update ImportDetail failed at " + new Date())
                    console.error(err);
                    done(err);
                })
            }).catch(function (err) {
                console.error(err);
                var detail = {status: 31, statusdesc: "解析失败,请查看日志"};
                if (err.Error) {
                    detail.statusdesc = err.Error;
                } else if (err.message) {
                    detail.statusdesc = err.message;
                }
                detail.updatetime = new Date();
                return jobEnterDatabase.updateImportDetail(job.data.id, detail).then(function (updateResult) {
                    done(err);
                }).catch(function (error) {
                    console.error(job.data.id + " parse success and update importDetail failed at " + new Date());
                    console.error(error);
                    done(error);
                })
            })
        } catch (e) {
            console.error(e);
            return jobEnterDatabase.updateImportDetail(job.data.id, {
                status: 31,
                statusdesc: "解析失败,抛出异常，请查看日志",
                updatetime: new Date()
            }).then(function (updateResult) {
                done(e);
            }).catch(function (error) {
                console.error(job.data.id + " parse success and update importDetail failed at " + new Date())
                console.error(error);
                done(error);
            })

        }
    });
}
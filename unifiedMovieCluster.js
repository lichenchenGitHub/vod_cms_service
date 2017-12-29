/**
 * Created by lichenchen on 2017/7/3.
 */
var cluster = require("cluster");
var kue = require("kue");
var Redis = require("ioredis");
var unirest = require("unirest");
var Promise = require("bluebird");
var Hasher = require('./lib/hasher');
var hasher = new Hasher();
var conf = require("./conf/config");
var queue = kue.createQueue({
    prefix: conf.queuePrefix.unifiedMovie,
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

var initJob = function () {
    return new Promise(function (resolve, reject) {
        var filter = {where: {iscompleted: 1, isunified: 0}, limit: conf.jobOption.limit, order: 'updatetime ASC'}
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Movies?filter=" + JSON.stringify(filter)));
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
                                var hash = conf.queuePrefix.unifiedMovie + hasher.GetSHA1(item.fileid);
                                keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                    if (err) {
                                        reject({Error: "set " + conf.queuePrefix.unifiedMovie + " key error"})
                                    } else if (msg == 'OK') {
                                        var job = queue.create(conf.keyPrefix.unifiedMovie, item).attempts(conf.jobOption.attempts).backoff({
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
    queue.inactiveCount(conf.keyPrefix.unifiedMovie, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.unifiedMovie, function (err, total) {
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
        kue.Job.rangeByType(conf.keyPrefix.unifiedMovie, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
            if (err) {
                console.error(err);
            } else {
                if (jobs instanceof Array && jobs.length > 0) {
                    jobs.forEach(function (job) {
                        job.remove(function () {
                            console.log('removed ', job.id + ":" + job.data.fileid + " at " + new Date());
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
    kue.app.listen(7015);
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
    queue.process(conf.keyPrefix.unifiedMovie, function (job, done) {
        try {
            return excuteJob.executeJobUnifiedmovie(job.data).then(function (result) {
                if (result.code == 200) {
                    return jobEnterDatabase.updateMovie(job.data.fileid, {isunified: 1, updatetime: new Date()});
                } else {
                    return jobEnterDatabase.updateMovie(job.data.fileid, {isunified: -1, updatetime: new Date()})
                }
            }).then(function (updateResult) {
                console.log(updateResult);
                return done();
            }).catch(function (err) {
                console.error(err);
                return jobEnterDatabase.updateMovie(job.data.fileid, {
                    isunified: -1,
                    updatetime: new Date()
                }).then(function (updateResult) {
                    return done(err);
                }).catch(function (error) {
                    return done(error);
                })
            })
        } catch (e) {
            console.error(e);
            return jobEnterDatabase.updateMovie(job.data.fileid, {
                isunified: -1,
                updatetime: new Date()
            }).then(function (updateResult) {
                return done(e);
            }).catch(function (error) {
                return done(error);
            })

        }
    });
}



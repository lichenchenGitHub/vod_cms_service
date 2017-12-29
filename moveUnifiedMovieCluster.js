/**
 * Created by lichenchen on 2017/6/28.
 */
var cluster = require("cluster");
var kue = require("kue");
var Redis = require("ioredis");
var conf = require("./conf/config");
var unirest = require("unirest");
var Promise = require("bluebird");
var queue = kue.createQueue({
    prefix: conf.queuePrefix.moveUnifiedMovie,
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
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedmovies?filter[where][movestatus]=0&filter[limit]=" + conf.jobOption.limit))
            .pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status != 200) {
                    reject({Error: "initJob moveUnifiedmovie get apiInfo error " + resp.statusCode + " at " + new Date()})
                } else {
                    if (resp.body instanceof Array) {
                        if (resp.body.length > 0) {
                            var initList = resp.body;
                            return Promise.map(initList, function (item, index) {
                                return new Promise(function (resolve, reject) {
                                    var hash = conf.queuePrefix.moveUnifiedMovie + hasher.GetSHA1(item.id.toString());
                                    keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                        if (err) {
                                            reject({Error: "set " + conf.queuePrefix.moveUnifiedMovie + " key error at " + new Date()})
                                        } else if (msg == 'OK') {
                                            var job = queue.create(conf.keyPrefix.moveUnifiedMovie, {
                                                id: item.id,
                                                code: item.code,
                                                name: item.name,
                                                filepath: item.filepath,
                                                type: item.type,
                                                unifiedseriescode: item.unifiedseriescode,
                                                unifiedprogramcode: item.unifiedprogramcode,
                                                movefilename: item.movefilename
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
                            resolve({Warning: "apiInfo moveUnifiedmovie Array length is 0"});
                        }
                    } else {
                        reject({Error: "init moveUnifiedmovie apiInfo is not an Array at" + new Date()})
                    }
                }
            })
    })
}
var addJob = function () {
    queue.inactiveCount(conf.keyPrefix.moveUnifiedMovie, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.moveUnifiedMovie, function (err, total) {
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
        kue.Job.rangeByType(conf.keyPrefix.moveUnifiedMovie, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
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
    kue.app.listen(7014);
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
    queue.process(conf.keyPrefix.moveUnifiedMovie, function (job, done) {
        try {
            if (job.data.movefilename && job.data.movefilename != "") {

            } else {
                job.data.movefilename = null;
            }
            return executeJob.executeJobMoveUnifiedmovie(job.data.id, job.data.code, job.data.name, job.data.filepath, job.data.type, job.data.unifiedseriescode, job.data.movefilename).then(function (result) {
                return jobEnterDatabase.updateUnifiedmovieById(result.data);
            }).then(function (updateReuslt) {
                console.log(updateReuslt);
                if (updateReuslt.code == 200) {
                    return done();
                    // var spmCode = new SPMCode({
                    //     seriescode: job.data.unifiedseriescode,
                    //     programcode: job.data.unifiedprogramcode,
                    //     moviecode: job.data.code
                    // })
                    // spmCode.save(function (err) {
                    //     if (err) {
                    //         console.error("insert into domainTask failed at " + new Date() + " err is :");
                    //         console.error(err);
                    //         return done();
                    //     } else {
                    //         console.log("insert into domainTask success at " + new Date());
                    //         return done();
                    //     }
                    // })
                } else {
                    // console.error(updateReuslt);
                    return done({Error: "update count " + updateReuslt.data});
                }
            }).catch(function (err) {
                console.error(err);
                return jobEnterDatabase.updateUnifiedmovieById({
                    id: job.data.id,
                    movestatus: -1,
                    movestatusdesc: "迁移失败"
                }).then(function (updateResult) {
                    console.error(updateResult);
                    return done(err);
                })
            })
        } catch (e) {
            console.error(e);
            return jobEnterDatabase.updateUnifiedmovieById({
                id: job.data.id,
                movestatus: -1,
                movestatusdesc: "迁移失败"
            }).then(function (updateResult) {
                console.error(updateResult);
                return done(err);
            })
        }
    });
}

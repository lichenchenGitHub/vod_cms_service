/**
 * Created by lichenchen on 2017/8/7.
 */
var cluster = require("cluster");
var kue = require("kue");
var Promise = require("bluebird");
var Redis = require("ioredis");
var conf = require("./conf/config");
var queue = kue.createQueue({
    prefix: conf.queuePrefix.spmCode,
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
var mongoose = require('./lib/mongoose');
var SPMCodeSchema = require("./model/SPMCode");
var SPMCode = mongoose.model("SPMCode", SPMCodeSchema);
var ExecuteJob = require("./lib/executeJob");
var executeJob = new ExecuteJob();
var JobEnterDatabase = require("./lib/jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
var Hasher = require('./lib/hasher');
var hasher = new Hasher();
var initJob = function () {
    return new Promise(function (resolve, reject) {
        SPMCode.find({status: 0}, {}, {limit: conf.jobOption.limit}, function (err, spms) {
            if (err) {
                console.error(err);
                reject({Error: "initJob get spms error  at " + new Date()})
            } else {
                if (spms.length > 0) {
                    return Promise.map(spms, function (item, index) {
                        return new Promise(function (resolve, reject) {
                            var hash = conf.queuePrefix.spmCode + hasher.GetSHA1(item._id.toString());
                            keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                if (err) {
                                    reject({Error: "set " + conf.queuePrefix.spmCode + " key error at " + new Date()})
                                } else if (msg == 'OK') {
                                    var job = queue.create(conf.keyPrefix.spmCode, {
                                        id: item._id,
                                        seriescode: item.seriescode,
                                        programcode: item.programcode,
                                        moviecode: item.moviecode
                                    }).attempts(conf.jobOption.attempts).backoff({
                                        delay: conf.jobOption.delay,
                                        type: 'fixed'
                                    }).removeOnComplete(true).ttl(conf.jobOption.ttl).save(function (err) {
                                        if (err) {
                                            reject({Error: item._id + " : create job err " + err + new Date()});
                                        } else {
                                            resolve({Info: item._id + " : create job success as job " + job.id + " at " + new Date()});
                                        }
                                    })
                                } else {
                                    console.log(item._id);
                                    resolve({info: item._id + ":create job err,key has exists at " + new Date()})
                                }
                            });
                        })
                    })

                } else {
                    resolve({Warning: "apiInfo Array length is 0"});
                }
            }
        })
    });
}
var addJob = function () {
    queue.inactiveCount(conf.keyPrefix.spmCode, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.spmCode, function (err, total) {
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
        kue.Job.rangeByType(conf.keyPrefix.spmCode, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
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
    kue.app.listen(7011);
    var worker = cluster.fork();
    initJob().then(function (data) {
        console.log(data)
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
            console.log('worker ' + worker.process.pid + ' exited success!');
        }
    });
    var quitCallback = function () {
        worker.kill('SIGTERM');
        setTimeout(function () {
            process.exit(0);
        }, 3000);
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
    queue.process(conf.keyPrefix.spmCode, function (job, done) {
        var obj = {id: job.data.id, seriescode: job.data.seriescode, programcode: job.data.programcode, moviecode: job.data.moviecode};
        try {
            return executeJob.executeJobSPMCode(obj).then(function (result) {
                obj.status = 1;
                return jobEnterDatabase.updateSPMCode(obj).then(function (data) {
                    console.log(data);
                    done();
                });
            }).catch(function (err) {
                console.error(err);
                obj.status = -1;
                return jobEnterDatabase.updateSPMCode(obj).then(function (data) {
                    done(err);
                });
            })
        } catch (e) {
            console.error(e);
            obj.status = -1;
            return jobEnterDatabase.updateSPMCode(obj).then(function (data) {
                done(e);
            });
        }
    });
}

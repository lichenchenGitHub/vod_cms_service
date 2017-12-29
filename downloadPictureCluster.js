/**
 * Created by lichenchen on 2017/5/11.
 */
var cluster = require("cluster");
var Promise = require("bluebird");
var Redis = require("ioredis");
var kue = require("kue");
var unirest = require("unirest");
var conf = require("./conf/config");
var tempPrefix = conf.downloadDir.tempPrefix.replace(/\s/g, "");
var desPrefix = conf.downloadDir.destPrefix.replace(/\s/g, "");
var queue = kue.createQueue({
    prefix: conf.queuePrefix.downloadPicture,
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
var poolOption = conf.poolOption;
var ExecuteJob = require("./lib/executeJob");
var executeJob = new ExecuteJob();
var JobEnterDatabase = require("./lib/jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
var Hasher = require('./lib/hasher');
var hasher = new Hasher();
//任务初始化
var initJob = function () {
    return new Promise(function (resolve, reject) {
        var tasks = [];
        var req = unirest.get(conf.strongLoopApi + "Unifiedseries?filter[limit]=" + conf.jobOption.limit + "&filter[where][picdownloadstatus]=0");
        req.pool(conf.poolOption);
        req.end(function (res) {
            if (res.status != 200) {
                reject({Error: "initJob get apiInfo error " + res.statusCode + " at " + new Date()})
            } else {
                if (res.body instanceof Array) {
                    if (res.body.length > 0) {
                        tasks = res.body;
                        tasks.forEach(function (item, index, input) {
                            item.type = 1;
                        })
                        resolve(tasks);

                    } else {
                        resolve(tasks)
                    }
                } else {
                    reject({Error: "init apiInfo is not an Array at" + new Date()})
                }
            }
        });
    }).then(function (tasks) {
        return new Promise(function (resolve, reject) {
            var req = unirest.get(conf.strongLoopApi + "Unifiedprograms?filter[limit]=" + conf.jobOption.limit + "&filter[where][picdownloadstatus]=0");
            req.pool(conf.poolOption);
            req.end(function (res) {
                if (res.status != 200) {
                    console.error("Error: initJob get apiInfo error " + res.statusCode + " at " + new Date());
                    resolve(tasks)
                } else {
                    if (res.body instanceof Array) {
                        if (res.body.length > 0) {
                            res.body.forEach(function (item, index, input) {
                                item.type = 2;
                                tasks.push(item);
                            })
                            resolve(tasks);

                        } else {
                            resolve(tasks)
                        }
                    } else {
                        reject({Error: "init apiInfo is not an Array at" + new Date()})
                    }
                }
            })
        })
    }).then(function (fullTasks) {
        return Promise.map(fullTasks, function (item, index) {
            return new Promise(function (resolve, reject) {
                var hash = conf.queuePrefix.downloadPicture + hasher.GetSHA1(item.cpcontentid);
                keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                    if (err) {
                        reject({Error: "set " + conf.queuePrefix.downloadPicture + " key error"})
                    } else if (msg == 'OK') {
                        var job = queue.create(conf.keyPrefix.downloadPicture, {
                            pictures: [{
                                from: item.pictureurl1,
                                to: "picfilepath1"
                            }, {
                                from: item.pictureurl2,
                                to: "picfilepath2"
                            }, {
                                from: item.pictureurl3,
                                to: "picfilepath3"
                            }, {
                                from: item.pictureurl4,
                                to: "picfilepath4"
                            }, {
                                from: item.pictureurl5,
                                to: "picfilepath5"
                            }, {
                                from: item.pictureurl6,
                                to: "picfilepath6"
                            }, {
                                from: item.pictureurl7,
                                to: "picfilepath7"
                            }, {
                                from: item.pictureurl8,
                                to: "picfilepath8"
                            }, {
                                from: item.pictureurl9,
                                to: "picfilepath9"
                            }, {
                                from: item.pictureurl10,
                                to: "picfilepath10"
                            }],
                            type: item.type,
                            cpcontentid: item.cpcontentid
                        }).attempts(conf.jobOption.attempts).backoff({
                            delay: conf.jobOption.delay,
                            type: 'fixed'
                        }).removeOnComplete(true).ttl(conf.jobOption.ttl).save(function (err) {
                            if (err) {
                                reject({Error: item.cpcontentid + " : create job type " + item.type + " err " + err + new Date()});
                            } else {
                                resolve({Info: item.cpcontentid + " : create job type " + item.type + " success as job " + job.id + " at " + new Date()});
                            }
                        });
                    }
                })
            });
        })
    })
}
//添加任务
var addJob = function () {
    queue.inactiveCount(conf.keyPrefix.downloadPicture, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.downloadPicture, function (err, total) {
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
//清除任务
var removeJob = function () {
    try {
        console.log("remove job start at " + new Date());
        kue.Job.rangeByType(conf.keyPrefix.downloadPicture, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
            if (err) {
                console.error(err);
            } else {
                if (jobs instanceof Array && jobs.length > 0) {
                    jobs.forEach(function (job) {
                        job.remove(function () {
                            console.log('removed ', job.id + ":" + job.data.cpcontentid + " at " + new Date());
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
    kue.app.listen(7008);
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
    //执行任务
    queue.process(conf.keyPrefix.downloadPicture, function (job, done) {
        try {
            //下载图片
            return executeJob.executeJobDownloadPicture(job.data.cpcontentid, job.data.pictures, job.data.type, tempPrefix, desPrefix).then(function (unifiedObj) {
                //如果是unifiedseries 更新us表
                if (job.data.type == 1) {
                    return jobEnterDatabase.updateUnifiedseries(unifiedObj).then(function (data) {
                        console.log(job.data.cpcontentid + " download success");
                        return done();
                    }).catch(function (err) {
                        console.error(err);
                    })
                } else {
                    //否则更新up表
                    return jobEnterDatabase.updateUnifiedprogram(unifiedObj).then(function (data) {
                        console.log(job.data.cpcontentid + " download success");
                        return done();
                    }).catch(function (err) {
                        console.error(err);
                    })
                }
            }).catch(function (err) {
                console.error(err);
                if (job.data.type == 1) {
                    return jobEnterDatabase.updateUnifiedseries({
                        cpcontentid: job.data.cpcontentid,
                        picdownloadstatus: -1
                    }).then(function (data) {
                        return done(err);
                    }).catch(function (err) {
                        console.error(err);
                        return done(err);
                    })
                } else {
                    return jobEnterDatabase.updateUnifiedprogram({
                        cpcontentid: job.data.cpcontentid,
                        picdownloadstatus: -1
                    }).then(function (data) {
                        return done(err);
                    }).catch(function (err) {
                        console.error(err);
                        return done(err);
                    })
                }
            })
        } catch (e) {
            return jobEnterDatabase.updateUnifiedprogram({
                cpcontentid: job.data.cpcontentid,
                picdownloadstatus: -1
            }).then(function (data) {
                return done(err);
            }).catch(function (err) {
                console.error(err);
                return done(err);
            })
        }
    })
}

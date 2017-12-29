/**
 * Created by lichenchen on 2017/4/26.
 */
var cluster = require("cluster");
var kue = require("kue");
var Redis = require("ioredis");
var conf = require("./conf/config");
var unirest = require("unirest");
var Promise = require("bluebird");
var Enums = require("./lib/enums");
var enums = new Enums();
var queue = kue.createQueue({
    prefix: conf.queuePrefix.downloadMovie,
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


var Hasher = require('./lib/hasher');
var hasher = new Hasher();

var initJob = function () {
    return new Promise(function (resolve, reject) {
        var filter = {
            where: {downloadstatus: 0},
            order: "priority DESC",
            limit: conf.jobOption.limit,
            include: {relation: "series", scope: {fields: ["name", "programtype"]}}
        };
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Movies?filter=" + JSON.stringify(filter)))
            .pool(conf.poolOption)
            .end(function (res) {
                if (res.status != 200) {
                    reject({Error: "initJob get apiInfo error " + res.statusCode + " at " + new Date()})
                } else {
                    if (res.body instanceof Array) {
                        if (res.body.length > 0) {
                            var initList = res.body;
                            return Promise.map(initList, function (item, index) {
                                return new Promise(function (resolve, reject) {
                                    var hash = conf.keyPrefix.downloadMovie + hasher.GetSHA1(item.cpcontentid.toString());
                                    keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                        if (err) {
                                            reject({Error: "set " + conf.keyPrefix.downloadMovie + " key error"})
                                        } else if (msg == 'OK') {
                                            if (item.series && item.series.name && item.series.programtype) {
                                                var priority = item.priority;
                                                var catid = null;
                                                for (var key in enums.ProgramType) {
                                                    if (item.series.programtype == enums.ProgramType[key].cname) {
                                                        catid = enums.ProgramType[key].value;
                                                        break;
                                                    }
                                                }
                                                var showid = item.showid;
                                                var vid = item.cpcontentid;
                                                var sname = escape(item.series.name);
                                                var pname = escape(item.name);
                                                var job = queue.create(conf.keyPrefix.downloadMovie, {
                                                    src: conf.src,
                                                    mtype: conf.mtype,
                                                    catid: catid,
                                                    showid: showid,
                                                    vid: vid,
                                                    priority: priority,
                                                    sname: sname,
                                                    pname: pname,
                                                    cpcode: item.cpcode,
                                                    filepath: item.filepath || null,
                                                    fileid: item.fileid,
                                                    type: item.type
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
                                            } else {
                                                reject({Error: item.cpcontentid + " : get seriesInfo error" + new Date()});
                                            }
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
    queue.inactiveCount(conf.keyPrefix.downloadMovie, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.downloadMovie, function (err, total) {
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
        kue.Job.rangeByType(conf.keyPrefix.downloadMovie, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
            if (err) {
                console.error(err);
            } else {
                if (jobs instanceof Array && jobs.length > 0) {
                    jobs.forEach(function (job) {
                        job.remove(function () {
                            console.log('removed ', job.vid + ":" + job.data.vid + " at " + new Date());
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
    kue.app.listen(7022);
    var worker = cluster.fork();
    initJob().then(function (data) {
        console.log(data)
        return;
    }).catch(function (err) {
        console.error(err);
        return;
    });
    var addJobInterval = null;
    addJobInterval = setInterval(addJob, conf.jobOption.addInterval);
    var removeJobInterval = null;
    removeJobInterval = setInterval(removeJob, conf.jobOption.removeInterval);
    queue.on('error', function (err) {
        console.error(JSON.stringify({role: 'scheduler', err: err}));
    });
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
    try {
        queue.process(conf.keyPrefix.downloadMovie, function (job, done) {
            //参数是否齐全判断
            if (job.data.cpcode == "YOUKU") {
                return excuteJob.executeDownloadYOUKUMovie(job.data).then(function (result) {
                    if (result.code == 0) {
                        return jobEnterDatabase.updateMovieByCpcontentid({
                            cpcontentid: result.data.vid,
                            downloadstatus: 0
                        }, {
                            downloadstatus: 1,
                            updatetime: new Date()
                        })
                    } else if (result.code == 3) {
                        return jobEnterDatabase.updateMovieByCpcontentid({
                            cpcontentid: job.data.vid,
                            downloadstatus: 0
                        }, {
                            downloadstatus: 1,
                            updatetime: new Date()
                        })
                    } else {
                        return new Promise(function (resolve, reject) {
                            reject({Error: result.errMsg});
                        })
                    }
                }).then(function (data) {
                    console.log("update movie " + job.data.vid + " succeess at " + new Date())
                    return done();
                }).catch(function (err) {
                    console.error("promise error at " + new Date())
                    console.error(err);
                    return jobEnterDatabase.updateMovieByCpcontentid({
                        cpcontentid: job.data.vid,
                        downloadstatus: 0
                    }, {
                        downloadstatus: -1,
                        updatetime: new Date()
                    }).then(function (data) {
                        console.error("update movie sucecess update at " + new Date())
                        return done(err);
                    }).catch(function (error) {
                        console.error("update movie failed at " + new Date());
                        console.error(error);
                        return done(err);
                    })
                })
            } else if (job.data.cpcode == "APECN") {
                return excuteJob.executeDownloadAPECNMovie

            }else{
                return jobEnterDatabase.updateMovieByCpcontentid({
                    cpcontentid: job.data.fileid,
                    downloadstatus: 0
                }, {
                    downloadstatus: -1,
                    updatetime: new Date()
                }).then(function (data) {
                    console.error("update movie sucecess update at " + new Date())
                    return done(err);
                }).catch(function (error) {
                    console.error("update movie failed at " + new Date());
                    console.error(error);
                    return done(err);
                })
            }
        })
    } catch (e) {
        console.error("catch error at " + new Date())
        console.error(e);
        return jobEnterDatabase.updateMovieByCpcontentid({
            cpcontentid: job.data.vid,
            downloadstatus: 0
        }, {
            downloadstatus: -1,
            updatetime: new Date()
        }).then(function (data) {
            console.error("update movie success at " + new Date());
            return done(e);
        }).catch(function (error) {
            console.error("update movie failed at " + new Date());
            console.error(error);
            return done(e);

        })
    }
}
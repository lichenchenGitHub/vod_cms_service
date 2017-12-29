/**
 * Created by lichenchen on 2017/4/10.
 */
var cluster = require("cluster");
var unirest = require("unirest");
var kue = require("kue");
var Promise = require("bluebird");
var async = require("async");
var Redis = require("ioredis");
var conf = require("./conf/config");
var queue = kue.createQueue({
    prefix: conf.queuePrefix.completeMovieInfo,
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
var TransformObject = require("./lib/transformObject");
var transformObject = new TransformObject();
var Hasher = require('./lib/hasher');
var hasher = new Hasher();

var initJob = function () {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(conf.strongLoopApi + "Movies?filter[limit]=" + conf.jobOption.limit + "&filter[where][downloadstatus]=2&filter[where][iscompleted]=0")
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
                                var hash = conf.queuePrefix.completeMovieInfo + hasher.GetSHA1(item.fileid);
                                keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                    if (err) {
                                        reject({Error: "set " + conf.queuePrefix.completeMovieInfo + " key error"})
                                    } else if (msg == 'OK') {
                                        var job = queue.create(conf.keyPrefix.movieComplete, {
                                            fileid: item.fileid,
                                            type: item.type,
                                            filepath: item.filepath
                                        }).attempts(conf.jobOption.attempts).backoff({
                                            delay: conf.jobOption.delay,
                                            type: 'fixed'
                                        }).removeOnComplete(true).ttl(conf.jobOption.ttl).save(function (err) {
                                            if (err) {
                                                reject({Error: item.fileid + " : create job err " + err + new Date()});
                                            } else {
                                                resolve({Info: item.fileid + " : create job success as job " + job.id + " at " + new Date()});
                                            }
                                        });
                                    } else {
                                        console.log(item.fileid);
                                        resolve({info: item.fileid + ":create job err,key has exists at " + new Date()})
                                    }
                                })
                            }).then(function (data) {
                                return data;
                            })
                        }).then(function (data) {
                            resolve(data);
                        }).catch(function (err) {
                            reject(err);
                        });
                    } else {
                        resolve({Warning: "apiInfo Array length is 0"})
                    }
                } else {
                    reject({Error: "init apiInfo is not an Array at" + new Date()})
                }
            }
        });
    })
}
var addJob = function () {
    queue.inactiveCount(conf.keyPrefix.movieComplete, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.movieComplete, function (err, total) {
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
        kue.Job.rangeByType(conf.keyPrefix.movieComplete, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
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
    kue.app.listen(7007);
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
    queue.process(conf.keyPrefix.movieComplete, function (job, done) {
        try {
            if (job.data.filepath && !isNaN(parseInt(job.data.type))) {
                return executeJob.executeJobMedia(job.data.filepath, job.data.type).then(function (movie) {
                    var movieObj = transformObject.checkPrimaryMovie(movie);
                    if (movieObj.err) {
                        movieObj.iscompleted = -1;
                        movieObj.completereason = "接口调用成功，返回信息不全 ：" + movieObj.err.join("|");
                        movieObj.isunified = -1;
                        movieObj.updateTime = new Date();
                        delete movieObj["err"];
                    } else {
                        movieObj.iscompleted = 1;
                        movieObj.completereason = "调用媒资补全接口成功";
                        movieObj.isunified = 0;
                        movieObj.updateTime = new Date();
                    }
                    return jobEnterDatabase.updateMovie(job.data.fileid, movieObj);
                }).then(function (rebackData) {
                    console.log(rebackData.message);
                    return done();
                }).catch(function (err) {
                    console.error(err);
                    var movie = {};
                    movie.iscompleted = -1;
                    if (err.Error) {
                        movie.completereason = err.Error;
                    } else if (err.message) {
                        movie.completereason = err.message;
                    } else {
                        movie.completereason = JSON.stringify(err);
                    }
                    movie.isunified = -1;
                    movie.updateTime = new Date();
                    return jobEnterDatabase.updateMovie(job.data.fileid, movie).then(function (rebackData) {
                        console.log(rebackData.message);
                        return done(err);
                    }).catch(function (error) {
                        return done(error);
                    })
                })
            } else {
                return jobEnterDatabase.updateMovie(job.data.fileid, {
                    iscompleted: -1,
                    completereason: job.data.cpcontentid + " filepath or videotype is null",
                    updateTime: new Date()
                }).then(function (result) {
                    return done({Error: job.data.cpcontentid + " filepath or videotype is null"})
                }).catch(function (err) {
                    console.error(err);
                })
            }
        } catch (e) {
            console.error(e);
            return jobEnterDatabase.updateMovie(job.data.fileid, {
                iscompleted: -1,
                completereason: "抛出异常",
                updateTime: new Date()
            }).then(function (rebackData) {
                console.error(rebackData.message);
                return done(e);
            }).catch(function (err) {
                return done(err);
            })
        }
    });
}

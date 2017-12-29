/**
 * Created by lichenchen on 2017/4/5.
 */
var cluster = require("cluster");
var kue = require("kue");
var Redis = require("ioredis");
var conf = require("./../conf/config");
var unirest = require("unirest");
var Promise = require("bluebird");
var queue = kue.createQueue({
    prefix: conf.name,
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
var ExecuteJob = require("./../lib/executeJob");
var JobEnterDatabase = require("./../lib/jobEnterDatabase");
var excuteJob = new ExecuteJob();
var jobEnterDatabase = new JobEnterDatabase();
var Hasher = require('./../lib/hasher');
var hasher = new Hasher();


var initJob = function () {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(conf.strongLoopApi + "Injectorders?filter[limit]=" + conf.jobOption.limit + "&filter[where][status]=0");
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
                                var hash = conf.keyPrefix.injectOrder + hasher.GetSHA1(item.id.toString());
                                keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                    if (err) {
                                        reject({Error: "set " + conf.keyPrefix.injectOrder + " key error"})
                                    } else if (msg == 'OK') {
                                        var job = queue.create(conf.keyPrefix.injectOrder, {
                                            id: item.id,
                                            showid: item.showid,
                                            vid: item.vid,
                                            datasources: item.datasources,
                                            contentmngxmlurl: item.contentmngxmlurl,
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
    queue.inactiveCount(conf.keyPrefix.injectOrder, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.injectOrder, function (err, total) {
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
    queue.failed(conf.keyPrefix.injectOrder, function (err, ids) {
        ids.forEach(function (id) {
            kue.Job.get(id, function (err, job) {
                job.remove(function () {
                    console.log('removed ', job.id + ":" + job.data.id + " at " + new Date());
                });
            });
        });
    });

}
if (cluster.isMaster) {
    kue.app.listen(9005);
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
    //单例模式运行
    queue.process(conf.keyPrefix.injectOrder, function (job, done) {
        var seriesName = null;
        var programName = null;
        if (job.data.showid && job.data.vid && job.data.datasources <= 2) {
            console.log("showid :" + job.data.showid + " vid :" + job.data.vid + " datasource:" + job.data.datasources + " at " + new Date());
            //获取series信息
            return excuteJob.executeJobShowid(job.data.showid, false).then(function (seriesObj) {
                console.log("id :" + job.data.id + "  get series api Info success at " + new Date());
                //series信息入库
                return jobEnterDatabase.upsertSeries(seriesObj);
            }).then(function (seriesReback) {
                    console.log("id :" + job.data.id + " series deal database success at " + new Date());
                    seriesName = seriesReback.data.name;
                    //获取program信息
                    return excuteJob.executeJobVid(seriesReback.data, job.data.vid, false);
                })
                .then(function (program) {
                    console.log("id :" + job.data.id + " get program api Info success at " + new Date());
                    //program入库
                    return jobEnterDatabase.upsertProgram(program);
                })
                .then(function (programReback) {
                    console.log("id :" + job.data.id + " program deal database success at " + new Date());
                    programName = programReback.data.name;
                    return excuteJob.executeJobMovie(programReback.data, false);
                }).then(function (movieObj) {
                    console.log("id :" + job.data.id + " get movieInfo success at " + new Date());
                    return jobEnterDatabase.upsertMovie(movieObj);
                }).then(function (data) {
                    console.log("id :" + job.data.id + " movie deal database success at" + new Date());
                    //更新injectOrder表字段信息
                    return jobEnterDatabase.updateInject(job.data.id, 1, seriesName, programName).then(function (data) {
                        console.log("id :" + job.data.id + ": inject Order update  success at " + new Date())
                        return done();
                    });
                }).catch(function (err) {
                    return jobEnterDatabase.updateInject(job.data.id, -1, seriesName, programName).then(function (data) {
                        console.error("id :" + job.data.id + ":update injectOrder sucess, but catch err" + err + " at " + new Date());
                        return done(err);
                    }).catch(function (err) {
                        console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + err + " at " + new Date());
                        return done(err);
                    });
                })
        }
        else if (job.data.showid && job.data.datasources == 2) {
            console.log("showid :" + job.data.showid + " datasources :" + job.data.datasources + " at " + new Date())
            //获取series信息
            return excuteJob.executeJobShowid(job.data.showid, false).then(function (seriesObj) {
                console.log("id :" + job.data.id + "  get series api Info success at " + new Date());
                //series信息入库
                return jobEnterDatabase.upsertSeries(seriesObj);
            }).then(function (seriesReback) {
                    seriesName = seriesReback.data.name;
                    //根据api获取showid&&vid list
                    return excuteJob.executeJobVidByShowid(seriesReback.data);
                })
                .then(function (vlist) {
                    //vlist 入库到injectOrder
                    return jobEnterDatabase.upsertInjectOrder(vlist);
                })
                .then(function (data) {
                    console.log("id :" + job.data.id + " vlist enter database success at " + new Date());
                    //更新injectOrder表状态信息
                    return jobEnterDatabase.updateInject(job.data.id, 1, seriesName, programName).then(function (data) {
                        console.log("id :" + job.data.id + ":update injectOrder sucess at " + new Date());
                        return done();
                    });
                }).catch(function (err) {
                    console.log("id :" + job.data.id + " vlist enter database failed at " + new Date());
                    return jobEnterDatabase.updateInject(job.data.id, -1, seriesName, programName).then(function (data) {
                        console.log("id :" + job.data.id + ":update injectOrder sucess , but insert error at " + new Date());
                        return done(err);
                    }).catch(function (err) {
                        console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + err + " at " + new Date());
                        return done(err);
                    });
                });
        }
        else if (job.data.showid && job.data.datasources < 2) {
            console.log("showid :" + job.data.showid + " datasources :" + job.data.datasources + " at " + new Date())
            //获取series信息
            return excuteJob.executeJobShowid(job.data.showid, false).then(function (seriesObj) {
                console.log("id :" + job.data.id + "  get series api Info success at " + new Date());
                //series信息入库
                return jobEnterDatabase.upsertSeries(seriesObj);
            }).then(function (seriesReback) {
                seriesName = seriesReback.data.name;
                console.log("id :" + job.data.id + " vlist enter database success at " + new Date());
                //更新injectOrder表状态信息
                return jobEnterDatabase.updateInject(job.data.id, 1, seriesName, programName).then(function (data) {
                    console.log("id :" + job.data.id + ":update injectOrder sucess at " + new Date());
                    return done();
                });
            }).catch(function (err) {
                console.log("id :" + job.data.id + " vlist enter database failed at " + new Date());
                return jobEnterDatabase.updateInject(job.data.id, -1, seriesName, programName).then(function (data) {
                    console.log("id :" + job.data.id + ":update injectOrder sucess , but insert error at " + new Date());
                    return done(err);
                }).catch(function (err) {
                    console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + err + " at " + new Date());
                    return done(err);
                });

            })
        }
        else {
            console.log("id :" + job.data.id + " has no showid " + new Date());
            return jobEnterDatabase.updateInject(job.data.id, -1).then(function (data) {
                console.log("id :" + job.data.id + ":update injectOrder sucess , but insert error at " + new Date());
                return done({Error: "showid not exists at " + new Date()});
            }).catch(function (err) {
                console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + err + " at " + new Date());
                return done(err);
            });
        }

    })
}
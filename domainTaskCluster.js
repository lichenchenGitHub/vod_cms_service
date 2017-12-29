/**
 * Created by lichenchen on 2017/8/9.
 */
var cluster = require("cluster");
var kue = require("kue");
var Promise = require("bluebird");
var Redis = require("ioredis");
var conf = require("./conf/config");
var unirest = require("unirest");
var queue = kue.createQueue({
    prefix: conf.queuePrefix.domainTask,
    redis: {
        createClientFactory: function () {
            if (conf.redisConf.default === "cluster") {
                return new Redis.Cluster(conf.redisConf.cluster);
            } else {
                return new Redis(conf.redisConf.normal);
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
var executeJob = new ExecuteJob();
var JobEnterDatabase = require("./lib/jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
var Hasher = require('./lib/hasher');
var hasher = new Hasher();
var SearchDatabase = require("./lib/searchDatabase");
var searchDatabase = new SearchDatabase();

var initJob = function () {
    return new Promise(function (resolve, reject) {
        var filter = {where: {status: 0, retrynum: {lt: 3}}, order: "priority DESC", limit: conf.jobOption.limit};
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Domaintasks?filter=" + JSON.stringify(filter)))
            .pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status != 200) {
                    reject({Error: "initJob get apiInfo error " + resp.statusCode + " at " + new Date()})
                } else {
                    if (resp.body instanceof Array) {
                        if (resp.body.length > 0) {
                            var initList = resp.body;
                            return Promise.map(initList, function (item, index) {
                                return new Promise(function (resolve, reject) {
                                    var hash = conf.queuePrefix.domainTask + hasher.GetSHA1(item.id.toString());
                                    keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                        if (err) {
                                            reject({Error: "set " + conf.queuePrefix.domainTask + " key error"})
                                        } else if (msg == 'OK') {
                                            var job = queue.create(conf.keyPrefix.domainTask, {
                                                id: item.id,
                                                domaincode: item.domaincode,
                                                fileurl: item.orderfilepath,
                                                platform: "cms",
                                                priority: item.priority,
                                                interfaceurl: item.interfaceurl,
                                                retrynum: item.retrynum
                                            }).removeOnComplete(true).ttl(conf.jobOption.ttl).save(function (err) {
                                                if (err) {
                                                    reject({Error: item.id + " : create job err " + err + new Date()});
                                                } else {
                                                    resolve({Info: item.id + " : create job success as job " + job.id + " at " + new Date()});
                                                }
                                            })
                                        } else {
                                            resolve({Warning: "msg is not ok"});
                                        }
                                    })
                                });
                            });
                        } else {
                            resolve({Warning: "apiInfo Array length is 0"});
                        }
                    } else {
                        reject({Error: "init apiInfo is not an Array at" + new Date()});
                    }
                }
            })
    })
}
var addJob = function () {
    queue.inactiveCount(conf.keyPrefix.domainTask, function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= conf.jobOption.total) {
            queue.delayedCount(conf.keyPrefix.domainTask, function (err, total) {
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
        kue.Job.rangeByType(conf.keyPrefix.domainTask, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
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
    kue.app.listen(7017);
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
    queue.process(conf.keyPrefix.domainTask, function (job, done) {
        try {
            var obj = {};
            obj.domaincode = job.data.domaincode;
            obj.fileurl = job.data.fileurl;
            obj.platform = "cms";
            obj.priority = job.data.priority;
            var correlateid = job.data.id.toString() + new Date().getTime();
            obj.correlateID= correlateid;
            return searchDatabase.sendDomainTask(job.data.interfaceurl.replace(/(^\s*)|(\s*$)/g, ""), obj).then(function (result) {
                console.log(result);
                if (result.code == 200) {
                    return jobEnterDatabase.upsertDomainTask({id: job.data.id}, {
                        status: 500,
                        statusdesc: "发送成功",
                        correlateid: correlateid,
                        updatetime: new Date()
                    }).then(function (data) {
                        console.log(data);
                        return done();
                    });
                } else {
                    var number = job.data.retrynum + 1;
                    if (number >= 3) {
                        return jobEnterDatabase.upsertDomainTask({id: job.data.id}, {
                            status: 501,
                            statusdesc: "发送失败",
                            correlateid: correlateid,
                            retrynum: number,
                            updatetime: new Date()
                        }).then(function (result) {
                            console.error(result)
                            return done({Error: result});
                        });
                    } else {
                        return jobEnterDatabase.upsertDomainTask({id: job.data.id}, {
                            retrynum: number,
                            correlateid: correlateid,
                            updatetime: new Date()
                        }).then(function (result) {
                            console.error(result)
                            return done({Error: result});
                        });
                    }

                }
            }).catch(function (err) {
                var number = job.data.retrynum + 1;
                if (number >= 3) {
                    return jobEnterDatabase.upsertDomainTask({id: job.data.id}, {
                        status: 501,
                        statusdesc: "发送失败",
                        correlateid: correlateid,
                        retrynum: number,
                        updatetime: new Date()
                    }).then(function (result) {
                        console.error(result)
                        return done(err);
                    });
                } else {
                    return jobEnterDatabase.upsertDomainTask({id: job.data.id}, {
                        retrynum: number,
                        correlateid: correlateid,
                        updatetime: new Date()
                    }).then(function (result) {
                        console.error(result)
                        return done(err);
                    });
                }
            })

        } catch (e) {
            console.error(e);
            return done(e);
        }
    });
}

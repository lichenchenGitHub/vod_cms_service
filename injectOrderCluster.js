/**
 * Created by lichenchen on 2017/4/5.
 */
var cluster = require("cluster");
var fs = require("fs");
var kue = require("kue");
var Redis = require("ioredis");
var conf = require("./conf/config");
var unirest = require("unirest");
var Promise = require("bluebird");
var Enums = require("./lib/enums");
var enums = new Enums();
var queue = kue.createQueue({
    prefix: conf.queuePrefix.injectOrder,
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
var TranformObject = require("./lib/transformObject");
var transformObject = new TranformObject();
var Hasher = require('./lib/hasher');
var hasher = new Hasher();


var initJob = function () {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Injectorders?filter[limit]=" + conf.jobOption.limit + "&filter[where][datasources][lte]=3&filter[where][status]=0&filter[order]=priority DESC"));
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
                                var hash = conf.queuePrefix.injectOrder + hasher.GetSHA1(item.id.toString());
                                keystore.set(hash, 1, 'EX', conf.jobOption.expireDuration, 'NX', function (err, msg) {
                                    if (err) {
                                        reject({Error: "set " + conf.queuePrefix.injectOrder + " key error"})
                                    } else if (msg == 'OK') {
                                        var type = 0;
                                        if (item.movefilename) {
                                            type = 1;
                                        }
                                        var job = queue.create(conf.keyPrefix.injectOrder, {
                                            id: item.id,
                                            showid: item.showid,
                                            vid: item.vid,
                                            datasources: item.datasources,
                                            type: type,
                                            priority: item.priority,
                                            filepath: item.filepath || null,
                                            movefilename: item.movefilename || null,
                                            contentmngxmlurl: item.contentmngxmlurl || null,
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
                                    } else {
                                        resolve({Warning: "msg is not ok"});
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
    try {
        console.log("remove job start at " + new Date());
        kue.Job.rangeByType(conf.keyPrefix.injectOrder, 'failed', 0, conf.jobOption.removeCount, 'asc', function (err, jobs) {
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
    kue.app.listen(7006);
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
    queue.process(conf.keyPrefix.injectOrder, function (job, done) {
        try {
            var seriesName = null;
            var programName = null;
            var showid = null;
            if (job.data.contentmngxmlurl && job.data.contentmngxmlurl != "" && job.data.datasources == 3) {
                return executeJob.parseCPSXml(job.data.contentmngxmlurl).then(function (obj) {
                    var series = obj.series;
                    series.createtime = new Date();
                    series.updatetime = new Date();
                    var program = obj.program;
                    program.checkstatus = 0;
                    program.createtime = new Date();
                    program.updatetime = new Date();
                    var movie = obj.movie;
                    movie.createtime = new Date();
                    movie.updatetime = new Date();
                    if (series && program && movie) {
                        return jobEnterDatabase.upsertCpsSeries(series).then(function (seriesResult) {
                            return jobEnterDatabase.upsertCpsProgram(program).then(function (programResult) {
                                return jobEnterDatabase.upsertCpsMovie(movie).then(function (movieResult) {
                                    if (series.cpcontentid) {
                                        return jobEnterDatabase.upsertWaitunified({
                                            cpcontentid: series.cpcontentid,
                                            releaseyear: series.releaseyear,
                                            contenttype: 1,
                                            status: 0,
                                            createtime: new Date(),
                                            updatetime: new Date()
                                        });
                                    } else {
                                        return new Promise(function (resolve, reject) {
                                            reject({Error: "series cpcontentid is null at " + new Date()})
                                        })
                                    }
                                })
                            })
                        })
                    } else {
                        return new Promise(function (resolve, reject) {
                            reject({Error: "not get series or program or movie at " + new Date()})
                        })
                    }
                }).then(function (result) {
                    return jobEnterDatabase.updateInject(job.data.id, 10, "解析成功").then(function (data) {
                        return done()
                    })
                }).catch(function (err) {
                    console.error("item " + job.data.id + " error at " + new Date())
                    console.error(err)
                    var statusDesc = "解析失败";
                    if (err.Error) {
                        statusDesc = err.Error;
                    }
                    return jobEnterDatabase.updateInject(job.data.id, 11, statusDesc).then(function (data) {
                        return done(err);
                    }).catch(function (error) {
                        console.error(error)
                        return done(error);
                    })
                })
            } else if (job.data.datasources == 2) {
                if (job.data.showid && job.data.vid) {
                    console.log("showid :" + job.data.showid + " vid :" + job.data.vid + " datasource:" + job.data.datasources + " at " + new Date());
                    //获取series信息
                    return executeJob.executeJobShowid(job.data.showid, job.data.datasources, false).then(function (seriesObj) {
                        console.log("id :" + job.data.id + "  get series api Info success at " + new Date());
                        //series信息入库
                        if (job.data.priority != null) {
                            seriesObj.priority = job.data.priority;
                        }
                        return jobEnterDatabase.upsertSeries(seriesObj);
                    }).then(function (seriesReback) {
                        console.log("id :" + job.data.id + " series deal database success at " + new Date());
                        seriesName = seriesReback.data.name;
                        //获取program信息和待聚合节目集
                        return Promise.join(jobEnterDatabase.upsertWaitunified(executeJob.executeJobWaitunified(seriesReback.data)), executeJob.executeJobVid(seriesReback.data, job.data.vid, job.data.datasources, false), function (waitUnified, program) {
                            if (waitUnified.code === 200) {
                                console.log(waitUnified.data.cpcontentid + " upsert  waitUnified sucess at " + new Date());
                            } else {
                                console.error(waitUnified.data.cpcontentid + " upsert  waitUnified failed at " + new Date())
                            }
                            console.log("id :" + job.data.id + " get program api Info success at " + new Date());
                            return jobEnterDatabase.upsertProgram(program);

                        })
                    }).then(function (programReback) {
                        console.log("id :" + job.data.id + " program deal database success at " + new Date());
                        programName = programReback.data.name;
                        console.log("titie :" + programName);
                        return executeJob.executeJobMovie(programReback.data, job.data.type, false);
                    }).then(function (movieObj) {
                        if (job.data.filepath) {
                            movieObj.filepath = job.data.filepath;
                            movieObj.playurl = job.data.filepath;
                            movieObj.downloadstatus = 2;
                        }
                        if (job.data.movefilename) {
                            movieObj.movefilename = job.data.movefilename;
                        }
                        console.log("id :" + job.data.id + " get movieInfo success at " + new Date());
                        return jobEnterDatabase.upsertMovie(movieObj);
                    }).then(function (data) {
                        console.log("id :" + job.data.id + " movie deal database success at" + new Date());
                        //更新injectOrder表字段信息
                        return jobEnterDatabase.updateInject(job.data.id, 10, "解析成功", seriesName, programName).then(function (data) {
                            console.log("id :" + job.data.id + ": inject Order update  success at " + new Date())
                            return done();
                        });
                    }).catch(function (err) {
                        console.log("err is :")
                        console.error(err);
                        var statusdesc = "解析失败"
                        if (err.Error) {
                            statusdesc = err.Error;
                        } else if (err.message) {
                            statusdesc = err.message
                        } else if (err) {
                            statusdesc = JSON.stringify(err);
                        }
                        return jobEnterDatabase.updateInject(job.data.id, 11, statusdesc, seriesName, programName).then(function (data) {
                            console.error("id :" + job.data.id + ":update injectOrder sucess, but catch err" + err + " at " + new Date());
                            return done(err);
                        }).catch(function (err) {
                            console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + err + " at " + new Date());
                            return done(err);
                        });
                    })
                } else if (job.data.showid && job.data.vid == null) {
                    console.log("showid :" + job.data.showid + " datasources :" + job.data.datasources + " at " + new Date())
                    //获取series信息
                    return executeJob.executeJobShowid(job.data.showid, job.data.datasources, false).then(function (seriesObj) {
                        console.log("id :" + job.data.id + "  get series api Info success at " + new Date());
                        //series信息入库
                        return jobEnterDatabase.upsertSeries(seriesObj);
                    }).then(function (seriesReback) {
                        seriesName = seriesReback.data.name;
                        //根据api获取showid&&vid list
                        return Promise.all([executeJob.executeJobVidByShowid(seriesReback.data, job.data.priority), jobEnterDatabase.upsertWaitunified(executeJob.executeJobWaitunified(seriesReback.data))]).then(function (values) {
                            var waitUnified = values[1];
                            var vlist = values[0];
                            if (waitUnified.code === 200) {
                                console.log(waitUnified.data.cpcontentid + " upsert  waitUnified sucess at " + new Date());
                            } else {
                                console.error(waitUnified.data.cpcontentid + " upsert  waitUnified failed at " + new Date())
                            }
                            return jobEnterDatabase.upsertInjectOrder(vlist);
                        })
                    }).then(function (data) {
                        console.log("id :" + job.data.id + " vlist enter database success at " + new Date());
                        //更新injectOrder表状态信息
                        return jobEnterDatabase.updateInject(job.data.id, 10, "解析成功", seriesName, programName).then(function (data) {
                            console.log("id :" + job.data.id + ":update injectOrder sucess at " + new Date());
                            return done();
                        });
                    }).catch(function (err) {
                        console.error(err);
                        console.error("id :" + job.data.id + " vlist enter database failed at " + new Date());
                        var statusdesc = "解析失败";
                        if (err.Error) {
                            statusdesc = err.Error;
                        } else if (err.message) {
                            statusdesc = err.message
                        } else if (err) {
                            statusdesc = JSON.stringify(err);
                        }
                        return jobEnterDatabase.updateInject(job.data.id, 11, statusdesc, seriesName, programName).then(function (data) {
                            console.error("id :" + job.data.id + ":update injectOrder sucess , but insert error at " + new Date());
                            return done(err);
                        }).catch(function (err) {
                            console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + JSON.stringify(err) + " at " + new Date());
                            return done(err);
                        });
                    });
                } else if (job.data.showid == null && job.data.vid) {
                    console.log("vid :" + job.data.vid + " datasources :" + job.data.datasources + " at " + new Date())
                    return executeJob.executeJobVidByVid(job.data.vid).then(function (programObj) {
                        console.log("id :" + job.data.id + "  get program api Info success at " + new Date());
                        return new Promise(function (resolve, reject) {
                            if (programObj.show && programObj.show.id) {
                                showid = programObj.show.id;
                                return Promise.props({
                                    programInfo: programObj,
                                    seriesInfo: executeJob.executeJobShowid(programObj.show.id, job.data.datasources, false).then(function (seriesObj) {
                                        console.log("id :" + job.data.id + "  get series api Info success at " + new Date());
                                        return jobEnterDatabase.upsertSeries(seriesObj);
                                    })
                                }).then(function (data) {
                                    seriesName = data.seriesInfo.data.name;
                                    return Promise.join(jobEnterDatabase.upsertWaitunified(executeJob.executeJobWaitunified(data.seriesInfo.data)), executeJob.executeJobSeriesProgram(data.seriesInfo.data, data.programInfo, job.data.datasources), function (waitUnified, program) {
                                        if (waitUnified.code === 200) {
                                            console.log(waitUnified.data.cpcontentid + " upsert  waitUnified sucess at " + new Date());
                                        } else {
                                            console.error(waitUnified.data.cpcontentid + " upsert  waitUnified failed at " + new Date())
                                        }
                                        return jobEnterDatabase.upsertProgram(program);
                                    })
                                }).then(function (data) {
                                    resolve(data);
                                }).catch(function (err) {
                                    reject(err)
                                })
                            } else {
                                reject({Error: "get page program  error at " + new Date()})
                            }
                        })
                    }).then(function (programReback) {
                        programName = programReback.data.name;
                        return executeJob.executeJobMovie(programReback.data, job.data.type, false);
                    }).then(function (movieObj) {
                        if (job.data.filepath) {
                            movieObj.filepath = job.data.filepath;
                            movieObj.playurl = job.data.filepath;
                            movieObj.downloadstatus = 2;
                        }
                        if (job.data.movefilename) {
                            movieObj.movefilename = job.data.movefilename;
                        }
                        return jobEnterDatabase.upsertMovie(movieObj);
                        console.log("id :" + job.data.id + ":update movie sucess  at " + new Date());
                    }).then(function (data) {
                        //更新injectOrder表字段信息
                        return jobEnterDatabase.updateInject(job.data.id, 10, "解析成功", seriesName, programName, showid).then(function (data) {
                            console.log("id :" + job.data.id + ":update injectOrder sucess  at " + new Date());
                            return done();
                        });
                    }).catch(function (err) {
                        console.error(err);
                        var statusdesc = "解析失败";
                        if (err.Error) {
                            statusdesc = err.Error;
                        } else if (err.message) {
                            statusdesc = err.message
                        } else if (err) {
                            statusdesc = JSON.stringify(err);
                        }
                        return jobEnterDatabase.updateInject(job.data.id, 11, statusdesc, seriesName, programName, showid).then(function (data) {
                            console.error("id :" + job.data.id + ":update injectOrder sucess, but catch err" + JSON.stringify(err) + " at " + new Date());
                            return done(err);
                        }).catch(function (err) {
                            console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + JSON.stringify(err) + " at " + new Date());
                            return done(err);
                        });
                    })
                } else {
                    console.log("id :" + job.data.id + " has no showid " + new Date());
                    return jobEnterDatabase.updateInject(job.data.id, 11, "both showid and vid are null").then(function (data) {
                        console.log("id :" + job.data.id + ":update injectOrder sucess , but insert error at " + new Date());
                        return done({Error: "showid not exists at " + new Date()});
                    }).catch(function (err) {
                        console.error(err);
                        console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + JSON.stringify(err) + " at " + new Date());
                        return done(err);
                    });
                }
            } else if (job.data.datasources == 1) {
                if (job.data.contentmngxmlurl && typeof(job.data.contentmngxmlurl) != "undefined") {
                    return new Promise(function (resolve, reject) {
                        unirest.get(encodeURI(conf.APECN_filepath_prefix + job.data.contentmngxmlurl)).pool(conf.pool)
                            .end(function (resp) {
                                if (resp.status == 200) {
                                    var result = resp.body;
                                    if (result.collection && result.singleprogram && result.media) {
                                        resolve(result);
                                    } else {
                                        reject({code: "204", data: null, message: "lack of content at " + new Date()})
                                    }
                                } else {
                                    console.error(resp.body.error);
                                    reject({code: resp.status, data: null});
                                }
                            })
                    }).then(function (result) {
                        console.log(result)
                        var collection = result.collection;
                        var singleprogram = result.singleprogram;
                        var media = result.media;
                        return Promise.join(transformObject.checkAPECNSeries(collection), transformObject.checkAPECNProgram(singleprogram), function (collection, singleprogram) {
                            //判断collection、singleprogram是否缺少字段
                            if (collection instanceof Array || singleprogram instanceof Array) {
                                console.error("collection :");
                                console.error(collection);
                                console.error("singleprogram :");
                                console.error(singleprogram);
                                return null;
                            } else {
                                var movieList = [];
                                //判断movie是否缺少字段
                                for (var index in media) {
                                    var movie = transformObject.checkAPECNMovie(media[index]);
                                    if (movie instanceof Array) {
                                        console.error("media :")
                                        console.error(movie);
                                        return null;
                                    } else {
                                        movieList.push(movie);
                                    }
                                }
                                //collection封装成series
                                var series = transformObject.treatAPECNSeries(collection);
                                //singleprogram封装成program
                                var program = transformObject.treatAPECNProgram(singleprogram);
                                //media封装成movie
                                for (var index in movieList) {
                                    movieList[index] = transformObject.treatAPECNMovie(program, movieList[index]);
                                }
                                return {series: series, program: program, movieList: movieList};
                            }
                        }).then(function (object) {
                            return new Promise(function (resolve, reject) {
                                if (object) {
                                    var flag = false;//是否存在源介质标识
                                    for (var index in object.movieList) {
                                        if (object.movieList[index].type == 0) {
                                            flag = true;//存在源介质标识重置为true
                                            break;
                                        }
                                    }
                                    if (flag) {
                                        resolve(object);
                                    } else {
                                        //不存在源介质手动创建一条源介质记录
                                        var primaryMovie = {};
                                        var program = object.program;
                                        primaryMovie.cpcontentid = program.cpcontentid;
                                        primaryMovie.name = program.name;
                                        primaryMovie.showid = program.showid;
                                        primaryMovie.videotype = program.videotype;
                                        primaryMovie.seriesname = program.seriesname;
                                        primaryMovie.cpcode = program.cpcode;
                                        primaryMovie.cpname = program.cpname;
                                        primaryMovie.type = enums.MovieType.PRIMARY.value;
                                        object.movieList.push(primaryMovie);
                                        resolve(object);
                                    }
                                } else {
                                    console.error("object is null at " + new Date());
                                    reject({Error: "object is null"});
                                }
                            })
                        }).then(function (object) {
                            return jobEnterDatabase.updateOrInsertSeriesByCondition({where: {cpcontentid: object.series.cpcontentid}}, object.series).then(function (series) {
                                console.log("series enterdatabse success");
                                return jobEnterDatabase.updateOrInsertProgramByCondition({where: {cpcontentid: object.program.cpcontentid}}, object.program);
                            }).then(function (program) {
                                console.log("program enterdatabase success");
                                return Promise.mapSeries(object.movieList, function (item, index) {
                                    return jobEnterDatabase.updateOrInsertMovieByCondition({
                                        where: {
                                            cpcontentid: item.cpcontentid,
                                            type: item.type
                                        }
                                    }, item)
                                })
                            }).then(function (results) {
                                console.log("movies enterdatabase success");
                                return jobEnterDatabase.upsertWaitunified({
                                    cpcontentid: object.series.cpcontentid,
                                    releaseyear: object.series.releaseyear,
                                    contenttype: 1,
                                    status: 0,
                                    createtime: new Date(),
                                    updatetime: new Date()
                                });
                            }).catch(function (err) {
                                return new Promise(function (resolve, reject) {
                                    reject({Error: JSON.stringify(err)});
                                })
                            })
                        }).then(function (result) {
                            //更新injectOrder表字段信息
                            return jobEnterDatabase.updateInject(job.data.id, 10, "解析成功", collection.collectionname, singleprogram.programname, conf.APECN_prefix_cpcode + collection.collectionid).then(function (data) {
                                console.log("id :" + job.data.id + ":update injectOrder sucess  at " + new Date());
                                return done();
                            });
                        }).catch(function (err) {
                            console.error(err);
                            var statusdesc = "解析失败";
                            if (err.Error) {
                                statusdesc = err.Error;
                            } else if (err.message) {
                                statusdesc = err.message
                            } else if (err) {
                                statusdesc = JSON.stringify(err);
                            }
                            return jobEnterDatabase.updateInject(job.data.id, 11, statusdesc, collection.collectionname, singleprogram.programname, conf.APECN_prefix_cpcode + collection.collectionid).then(function (data) {
                                console.error("id :" + job.data.id + ":update injectOrder sucess, but catch err" + JSON.stringify(err) + " at " + new Date());
                                return done(err);
                            }).catch(function (err) {
                                console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + JSON.stringify(err) + " at " + new Date());
                                return done(err);
                            });

                        })
                    }).catch(function (error) {
                        return jobEnterDatabase.updateInject(job.data.id, 11, JSON.stringify(error)).then(function (data) {
                            console.error("id :" + job.data.id + ":update injectOrder sucess, but catch err" + JSON.stringify(error) + " at " + new Date());
                            return done(err);
                        }).catch(function (err) {
                            console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + JSON.stringify(err) + " at " + new Date());
                            return done(err);
                        });
                    })

                } else {
                    console.error(job.data.id + " datasources " + job.data.datasources + " has no filepath at " + new Date());
                    return jobEnterDatabase.updateInject(job.data.id, 11, "no filepath").then(function (data) {
                        return done({Error: "no filepath at " + new Date()});
                    }).catch(function (err) {
                        console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + JSON.stringify(err) + " at " + new Date());
                        return done(err);
                    });
                }
            } else {
                console.error(job.data.id + "datasources " + job.data.datasources + " not deal at " + new Date());
                return jobEnterDatabase.updateInject(job.data.id, 11, "datasources " + job.data.datasources + " not deal").then(function (data) {
                    return done({Error: "no filepath at " + new Date()});
                }).catch(function (err) {
                    console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + JSON.stringify(err) + " at " + new Date());
                    return done(err);
                });
            }
        } catch (e) {
            console.error(e);
            return jobEnterDatabase.updateInject(job.data.id, 11, JSON.stringify(e)).then(function (data) {
                return done(e);
            }).catch(function (err) {
                console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + JSON.stringify(err) + " at " + new Date());
                return done(err);
            });
        }

    })
}
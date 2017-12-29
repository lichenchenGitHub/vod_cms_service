/**
 * Created by lichenchen on 2017/3/29.
 */
var cluster = require("cluster");
var unirest = require("unirest");
var Promise = require("bluebird");
var kue = require("kue");
var redis = require("redis");
var fs = require("fs");
var conf = require("./../conf/config");
var jquery = fs.readFileSync("./public/javascripts/jquery-1.11.3.min.js").toString();

var numCPUs = require("os").cpus().length;
var poolOption = {
    maxSockets: 100,
    socket_keepalive: true
};

var queue = kue.createQueue({
    prefix: conf.name,
    redis: conf.redisConf.queue
});
var reback = {};
/*
 * 初始化任务队列
 * */
var initJob = function () {
    var req = unirest.get("http://10.3.1.7:7002/api/Injectorders?filter[limit]=8&filter[where][status]=0");
    req.pool(poolOption);
    req.end(function (res) {
        var initList = res.body;
        initList.forEach(function (item, index) {
            var job = queue.create("injectOrders", {
                id: item.id,
                showid: item.showid,
                vid: item.vid,
                datasources: item.datasources,
                contentmngxmlurl: item.contentmngxmlurl,
            }).attempts(3).backoff({
                delay: 1200000,
                type: 'fixed'
            }).removeOnComplete(true).ttl(100000).save(function (err) {
                if (err) {
                    console.error(item.id + " : create job err " + err + new Date());
                } else {
                    console.log(item.id + " : create job success as job " + job.id + " at " + new Date());
                }
            })
        });

    })


}
/*
 * 获取节目集信息
 * showid 节目集唯一标识
 * */
var excuteJobShowid = function (showid) {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(conf.strongLoopApi + "Series/findOne?filter[where][cpcontentid]=" + showid)
        req.pool(poolOption);
        req.end(function (resp) {
            if (resp.status != 200) {
                req = unirest.get(conf.youkuOpenApi.series_prefix + showid);
                req.pool(poolOption);
                req.end(function (res) {
                    if (res.status != 200) {
                        reject({Error: "get page " + conf.youkuOpenApi.series_prefix + showid + " error at " + new Date()})
                    } else {
                        var seriesObj = {};
                        var jsonObj = res.body;
                        seriesObj.cpcontentid = jsonObj.id;
                        seriesObj.name = jsonObj.name;
                        seriesObj.description = jsonObj.description;
                        seriesObj.programType = jsonObj.category;
                        seriesObj.pictureurl1 = jsonObj.poster_large;
                        seriesObj.pictureurl2 = jsonObj.poster;
                        seriesObj.pictureurl3 = jsonObj.thumbnail_large;
                        seriesObj.pictureurl4 = jsonObj.thumbnail;
                        seriesObj.iscompleted = jsonObj.completed;
                        seriesObj.score = parseFloat(jsonObj.score);
                        seriesObj.copyrightstatus = jsonObj.copyright_status;
                        seriesObj.vname = jsonObj.subtitle;
                        seriesObj.checktime = new Date();
                        seriesObj.crbegindate = jsonObj.published;
                        seriesObj.releaseyear = jsonObj.released;
                        seriesObj.programtype2 = jsonObj.genre;
                        seriesObj.originalcountry = jsonObj.area;
                        seriesObj.volumncount = parseInt(jsonObj.episode_count);
                        seriesObj.currentnum = parseInt(jsonObj.episode_updated);
                        seriesObj.viewcount = parseInt(jsonObj.view_count);
                        //seriesObj.distributor = jsonObj.distributor;
                        //seriesObj.production = jsonObj.production;
                        //seriesObj.hasvideotype=jsonObj.hasvideotype;
                        seriesObj.flag = false;
                        resolve(seriesObj);
                    }

                })
            } else {
                resp.body.flag = true;
                resolve(resp.body);
            }
        })
    });
}
/*
 * 获取节目集信息
 * */
var excuteJobVid = function (series, vid) {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(conf.strongLoopApi + "Programs/findOne?filter[where][cpcontentid]=" + vid);
        req.pool(poolOption);
        req.end(function (resp) {
            if (resp.status != 200) {
                var req = unirest.get(conf.youkuOpenApi.program_prefix + vid);
                req.pool(poolOption);
                req.end(function (res) {
                    if (res.status != 200) {
                        reject({Error: "get page " + conf.youkuOpenApi.program_prefix + vid + " error at " + new Date()})
                    } else {
                        var programObj = {};
                        var jsonObj = res.body;
                        programObj.priority = 5;//*默认正片
                        programObj.checkstatus = 0;//*枚举
                        programObj.videotype = 0;//*枚举
                        programObj.cdnstatus = 0;//*枚举
                        programObj.offlinereason = "test";//*下线原因
                        programObj.checktime = new Date();

                        //series 相关信息
                        programObj.seriesname = series.data.name;
                        programObj.seriescode = series.data.code;
                        programObj.cpcode = series.data.cpcode;
                        programObj.cpname = series.data.cpname;
                        programObj.originalname = series.data.originalname;
                        programObj.actordisplay = series.data.actordisplay;
                        programObj.writerdisplay = series.data.writerdisplay;
                        programObj.contentprovider = series.data.contentprovider;
                        programObj.originalcountry = series.data.originalcountry;
                        programObj.releaseyear = series.data.releaseyear;
                        programObj.programtype = series.data.programtype;
                        programObj.programtype2 = series.data.programtype2;
                        programObj.enname = series.data.enname;
                        programObj.vname = series.data.vname;
                        programObj.compere = series.data.compere;
                        programObj.guest = series.data.guest;
                        programObj.dub = series.data.dub;
                        programObj.crbegindate = series.data.crbegindate;
                        programObj.crenddate = series.data.crenddate;
                        programObj.performer = series.data.performer;
                        programObj.writemusic = series.data.writemusic;
                        programObj.writeword = series.data.writeword;
                        programObj.showid = series.data.cpcontentid;
                        if (series.data.programtype === "电影") {
                            programObj.seriesflag = "0";
                        } else {
                            programObj.seriesflag = "1";
                        }
                        programObj.orgairdate = series.data.crbegindate;//*orgairdate

                        //节目相关信息
                        programObj.name = jsonObj.title;
                        programObj.cpcontentid = jsonObj.id;
                        programObj.duration = jsonObj.duration;
                        programObj.pictureurl1 = jsonObj.bigThumbnail;
                        programObj.pictureurl2 = jsonObj.thumbnail;
                        programObj.description = jsonObj.description;
                        programObj.playurl = jsonObj.link;
                        programObj.tags = jsonObj.tags;//*tag
                        if (jsonObj.copyright_type === "reproduced") {
                            programObj.copyrighttype = 1;
                        } else {
                            programObj.copyrighttype = 0;
                        }

                        if (jsonObj.show) {
                            if (jsonObj.show.seq) {
                                programObj.volumncount = jsonObj.show.seq;
                            }
                            if (jsonObj.show.stage) {
                                programObj.stage = jsonObj.show.stage;
                            }
                        }
                        programObj.flag = false;
                        resolve(programObj);
                    }
                })
            } else {
                resp.body.flag = true;
                resolve(resp.body);
            }

        });
    });
}
/*
 * 获取showid 下面的vlist 集合
 * */
var excuteJobVidByShowid = function (series) {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(conf.youkuOpenApi.series_programs_prefix + series.data.cpcontentid);
        req.pool(poolOption);
        req.end(function (resp) {
            if (resp.status != 200) {
                reject({Error: "get page " + conf.youkuOpenApi.series_programs_prefix + series.data.cpcontentid + " error at " + new Date()})
            } else {
                var vlist = [];
                var jsonObj = resp.body;
                var totalCount = jsonObj.total;
                jsonObj.videos.forEach(function (item, index) {
                    vlist.push({showid: series.data.cpcontentid, vid: item.id});
                })
                if (vlist.length == totalCount) {
                    resolve(vlist);
                } else {
                    reject({Error: series.data.cpcontentid + " vlist not equal total at " + new Date()})
                }
            }

        });
    });
}
/*
 * 获取原介质数据
 * */
var excuteJobMovie = function (programReback) {
    return new Promise(function (resolve, reject) {
        if (programReback.data) {
            var movieObj = {};
            movieObj.name = programReback.data.name;
            movieObj.programcode = programReback.data.code;
            movieObj.cpname = programReback.data.cpname;
            movieObj.cpcode = programReback.data.cpcode;
            movieObj.cpcontentid = programReback.data.cpcontentid;
            movieObj.showid = programReback.data.showid;
            resolve(movieObj);
        } else {
            reject({Error: "program is null"});
        }
    });
}
/*
 * 节目信息入库
 * seriesObj 入库节目集信息
 * */
var seriesEnterDatabase = function (seriesObj) {
    return new Promise(function (resolve, reject) {
        if (seriesObj.flag && (seriesObj.flag == true)) {
            delete seriesObj["flag"];
            reback.code = 200;
            reback.data = seriesObj;
            reback.message = "series :" + seriesObj.cpcontentid + " has exists ";
            resolve(reback);
        } else {
            delete seriesObj["flag"];
            var postReq = unirest.post(conf.strongLoopApi + "Series")
                .header('Accept', 'application/json')
                .header('Content-Type', 'application/json')
                .send(seriesObj)
                .end(function (postResp) {
                    if (postResp.status != 200) {
                        if (postResp.body && postResp.body.error && postResp.body.error.errno == 1062) {
                            reback.code = 200;
                            reback.data = seriesObj;
                            reback.message = "series :" + seriesObj.cpcontentid + " has exists ";
                            resolve(reback);
                        } else {
                            reback.code = 500;
                            reject(reback);
                        }
                    } else {
                        reback.code = 200;
                        reback.data = postResp.body;
                        reback.message = "insert success";
                        resolve(reback);
                    }
                })
        }
    });
}
/*
 *
 * */
var programEnterDatabase = function (programObj) {
    return new Promise(function (resolve, reject) {
        if (programObj.flag && (programObj.flag === true)) {
            delete  programObj["flag"];
            reback.code = 200;
            reback.data = programObj;
            reback.message = "program :" + programObj.cpcontentid + " has exists ";
            resolve(reback);

        } else {
            delete programObj["flag"];
            var postReq = unirest.post(conf.strongLoopApi + "Programs")
                .header('Accept', 'application/json')
                .header('Content-Type', 'application/json')
                .send(programObj)
                .end(function (postResp) {
                    if (postResp.status != 200) {
                        if (postResp.body && postResp.body.error && postResp.body.error.errno == 1062) {
                            reback.code = 200;
                            reback.data = programObj;
                            reback.message = "program :" + programObj.cpcontentid + " has exists at " + new Date();
                            resolve(reback);
                        } else {
                            reback.code = 500;
                            reject(reback);
                        }
                    } else {
                        reback.code = 200;
                        reback.data = postResp.body;
                        reback.message = "insert success";
                        resolve(reback);
                    }
                });
        }
    });
}
/*
 * 原介质入库
 * */
var movieEnterDatabase = function (movieObj) {
    return new Promise(function (resolve, reject) {
        var req = unirest.post(conf.strongLoopApi + "Movies")
            .header('Accept', 'application/json')
            .header('Content-Type', 'application/json')
            .send(movieObj)
            .end(function (postResp) {
                if (postResp.status != 200) {
                    if (postResp.body && postResp.body.error && postResp.body.error.errno == 1062) {
                        reback.code = 200;
                        reback.data = movieObj;
                        reback.message = "movie " + movieObj.cpcontentid + " has exists at " + new Date();
                        resolve(reback);
                    } else {
                        reback.code = 500;
                        reback.message = postResp.body.error;
                        reject(reback);
                    }
                } else {
                    reback.code = 200;
                    reback.data = postResp.body;
                    reback.message = "insert or update success";
                    resolve(reback);
                }
            });
    });
}
/*
 * 节目列表入库
 * vlist 批量添加到injectOrder
 * */
var injectOrderEnterDatabase = function (vlist) {
    return Promise.map(vlist, function (item, index) {
        return new Promise(function (resolve, reject) {
            var injectOrderObj = {};
            injectOrderObj.id = 0;
            injectOrderObj.showid = item.showid;
            injectOrderObj.vid = item.vid;
            injectOrderObj.datasources = 2;
            var postReq = unirest.post(conf.strongLoopApi + "Injectorders")
                .header('Accept', 'application/json')
                .header('Content-Type', 'application/json')
                .send(injectOrderObj)
                .end(function (postResp) {
                    if (postResp.status != 200) {
                        reback.code = 500;
                        reject(reback);

                    } else {
                        reback.code = 200;
                        reback.data = postResp.body;
                        reback.message = "insert success";
                        resolve(reback)
                    }

                })
        })
    })
}
/*
 * 更新injectOrder状态
 * id injectOrder唯一标识，status 初始化0，失败-1，成功1
 * */
var updateInject = function (id, status) {
    return new Promise(function (resolve, reject) {
        var injectObj = {};
        injectObj.status = status;
        injectObj.updatetime = new Date();
        var postReq = unirest.post(conf.strongLoopApi + "Injectorders/update?where[id]=" + id)
            .header('Accept', 'application/json')
            .header('Content-Type', 'application/json')
            .send(injectObj)
            .end(function (postRes) {
                if (postRes.status != 200) {
                    reback.status(500);
                    reject(reback);
                } else {
                    if (postRes.body.count == 1) {
                        reback.code = 200;
                        reback.message = "insert or update " + postRes.body.count + " item";
                        resolve(reback);

                    } else {
                        reback.code = 500;
                        reback.message = "insert or update " + postRes.body.count + " item";
                        reject(reback);

                    }
                }
            })
    })

}
/*
 * 定时添加任务
 * */
var addJob = function () {
    queue.inactiveCount(function (err, total) {
        console.log("inactiveCount is :" + total);
        if (total <= 16) {
            queue.delayedCount(function (err, total) {
                console.log("delayedCount is :" + total);
                if (total <= 16) {
                    initJob();
                }
            })
        }
    });

}


var removeJob = function () {
    queue.failed(function (err, ids) {
        ids.forEach(function (id) {
            kue.Job.get(id, function (err, job) {
                job.remove(function () {
                    console.log('removed ', job.id + ":" + job.data.id + " at " + new Date());
                });
            });
        });
    });

}

excuteJobShowid("77af4234015b11e69e2a").then(function (seriesObj) {
    //series信息入库
    return seriesEnterDatabase(seriesObj);
}).then(function (seriesReback) {
    return excuteJobVid(seriesReback, "XMTU2NDM0NzM3Ng==");
}).then(function (programObj) {
    return programEnterDatabase(programObj);
}).then(function (programReback) {
    return excuteJobMovie(programReback)
}).then(function (movieObj) {
    return movieEnterDatabase(movieObj)
}).then(function (data) {
    console.log(data);
}).catch(function (err) {
    console.log(err);
})
//if (cluster.isMaster) {
//    kue.app.listen(9005);
//    queue.on('error', function (err) {
//        console.error(JSON.stringify({role: 'scheduler', err: err}));
//    });
//    var forkWorker = function () {
//        var worker = cluster.fork();
//        worker.on('error', function (err) {
//            console.log('worker error: ' + err);
//        });
//        console.log('worker ' + worker.process.pid + ' forked at: ' + new Date());
//        return worker;
//    };
//    for (var i = 0; i < numCPUs; i++) {
//        forkWorker();
//    }
//    //initJob();
//    //excuteJobShowid("77af4234015b11e69e2a").then(function (seriesObj) {
//    //    //series信息入库
//    //    return seriesEnterDatabase(seriesObj);
//    //}).then(function (seriesReback) {
//    //    return excuteJobVid(seriesReback, "XMTU2NDM0NzM3Ng==");
//    //}).then(function (programObj) {
//    //    return programEnterDatabase(programObj);
//    //}).then(function (programReback) {
//    //    return excuteJobMovie(programReback)
//    //}).then(function(movieObj){
//    //    return movieEnterDatabase(movieObj)
//    //}).then(function(data){
//    //    console.log(data);
//    //}).catch(function(err){
//    //    console.log(err);
//    //})
//    var addJobInterval = null;
//    addJobInterval = setInterval(addJob, 2000);
//    var removeJobInterval = null;
//    removeJobInterval = setInterval(removeJob, 1000 * 60 * 30);
//    cluster.on('exit', function (worker, code, signal) {
//        if (signal) {
//            console.log('worker ' + worker.process.pid + ' was killed by signal: ' + signal);
//        }
//        else if (code !== 0) {
//            console.log('worker ' + worker.process.pid + ' exited with error code: ' + code);
//            forkWorker();
//        }
//        else {
//            console.log('worker ' + worker.process.pid + ' exited success!');
//        }
//    });
//    var quitCallback = function () {
//        queue.shutdown(1000, function (err) {
//            if (addJobInterval) {
//                clearInterval(addJobInterval);
//                addJobInterval = null;
//            }
//            if(removeJobInterval){
//                clearInterval(removeJobInterval);
//                removeJobInterval=null;
//            }
//            for (var id in cluster.workers) {
//                console.log('Closing worker id: ' + id);
//                cluster.workers[id].kill('SIGTERM');
//            }
//            setTimeout(function () {
//                process.exit(0);
//            }, 3000);
//        });
//    }
//    process.once("SIGINT", quitCallback);
//    process.once("SIGTERM", quitCallback);
//} else {
//    queue.process("injectOrders", function (job, done) {
//        if (job.data.showid && job.data.vid && job.data.datasources <= 2) {
//            console.log("showid :" + job.data.showid + " vid :" + job.data.vid + " datasource:" + job.data.datasources + " at " + new Date());
//            //获取series信息
//            return excuteJobShowid(job.data.showid).then(function (seriesObj) {
//                console.log("id :" + job.data.id + "  get series api Info success at " + new Date());
//                //series信息入库
//                return seriesEnterDatabase(seriesObj);
//            }).then(function (seriesReback) {
//                console.log("id :" + job.data.id + " series deal database success at " + new Date());
//                //获取program信息
//                return excuteJobVid(seriesReback, job.data.vid);
//            }).then(function (program) {
//                console.log("id :" + job.data.id + " get program api Info success at " + new Date());
//                //program入库
//                return programEnterDatabase(program);
//            }).then(function (data) {
//                console.log("id :" + job.data.id + " program deal database success at" + new Date());
//                //更新injectOrder表字段信息
//                return updateInject(job.data.id, 1).then(function (data) {
//                    console.log("id :" + job.data.id + ": inject Order update  success at " + new Date())
//                    return done();
//                });
//            }).catch(function (err) {
//                return updateInject(job.data.id, -1).then(function (data) {
//                    console.error("id :" + job.data.id + ":update injectOrder sucess, but catch err" + err + " at " + new Date());
//                    return done(err);
//                }).catch(function (err) {
//                    console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + err + " at " + new Date());
//                    return done(err);
//                });
//            })
//        }
//        else if (job.data.showid && job.datasources == 2) {
//            console.log("showid :" + job.data.showid + " datasources :" + job.data.datasources + " at " + new Date())
//            //获取series信息
//            return excuteJobShowid(job.data.showid).then(function (seriesObj) {
//                console.log("id :" + job.data.id + "  get series api Info success at " + new Date());
//                //series信息入库
//                return seriesEnterDatabase(seriesObj);
//            }).then(function (seriesReback) {
//                //根据api获取showid&&vid list
//                return excuteJobVidByShowid(seriesReback);
//            }).then(function (vlist) {
//                //vlist 入库到injectOrder
//                return injectOrderEnterDatabase(vlist);
//            }).then(function (data) {
//                console.log("id :" + job.data.id + " vlist enter database success at " + new Date());
//                //更新injectOrder表状态信息
//                return updateInject(job.data.id, 1).then(function (data) {
//                    console.log("id :" + job.data.id + ":update injectOrder sucess at " + new Date());
//                    return done();
//                });
//            }).catch(function (err) {
//                console.log("id :" + job.data.id + " vlist enter database failed at " + new Date());
//                return updateInject(job.data.id, -1).then(function (data) {
//                    console.log("id :" + job.data.id + ":update injectOrder sucess , but insert error at " + new Date());
//                    return done(err);
//                }).catch(function (err) {
//                    console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + err + " at " + new Date());
//                    return done(err);
//                });
//            });
//        }
//        else if (job.data.showid && job.datasources < 2) {
//            console.log("showid :" + job.data.showid + " datasources :" + job.data.datasources + " at " + new Date())
//            //获取series信息
//            return excuteJobShowid(job.data.showid).then(function (seriesObj) {
//                console.log("id :" + job.data.id + "  get series api Info success at " + new Date());
//                //series信息入库
//                return seriesEnterDatabase(seriesObj);
//            }).then(function (data) {
//                console.log("id :" + job.data.id + " vlist enter database success at " + new Date());
//                //更新injectOrder表状态信息
//                return updateInject(job.data.id, 1).then(function (data) {
//                    console.log("id :" + job.data.id + ":update injectOrder sucess at " + new Date());
//                    return done();
//                });
//            }).catch(function (err) {
//                console.log("id :" + job.data.id + " vlist enter database failed at " + new Date());
//                return updateInject(job.data.id, -1).then(function (data) {
//                    console.log("id :" + job.data.id + ":update injectOrder sucess , but insert error at " + new Date());
//                    return done(err);
//                }).catch(function (err) {
//                    console.error("id :" + job.data.id + ":update injectOrder failed, and catch err" + err + " at " + new Date());
//                    return done(err);
//                });
//
//            })
//        }
//
//    })
//
//}

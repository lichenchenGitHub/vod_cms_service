/**
 * Created by lichenchen on 2017/4/5.
 */
var Promise = require("bluebird");
var unirest = require("unirest");
var mongoose = require('./mongoose');
var SPMCodeSchema = require("../model/SPMCode");
var SPMCode = mongoose.model("SPMCode", SPMCodeSchema);
var GenerateCode = require("./generateCode");
var generateCode = new GenerateCode();
var generateUniqueCode = require("./generateUniqueCode");
var Enums = require("./enums");
var enums = new Enums();
var SearchDatabase = require("./searchDatabase");
var searchDatabase = new SearchDatabase();
var TransformObject = require("./transformObject");
var Tools = require("./tools");
var tools = new Tools();
var transformObject = new TransformObject();
var Hasher = require("../lib/hasher");
var hasher = new Hasher();
var conf = require("../conf/config");
var sequelize = require("./sequelize");
var spm_alert_record = sequelize.import("../model/SPMAlertRecord");
var poolOption = conf.poolOption;
var JobEnterDatabase = function () {
    this._this = this;
    return this;
}
JobEnterDatabase.prototype.upsertSeries = function (seriesObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        if (seriesObj.cpcontentid) {
            //iscompleted 1 不更新
            if ((seriesObj.flag != null) && (seriesObj.flag == true)) {
                delete seriesObj["flag"];
                if (seriesObj.iscompleted === 1) {
                    reback.code = 200;
                    reback.data = seriesObj;
                    reback.message = "series :" + seriesObj.cpcontentid + " has exists and completed at " + new Date();
                    resolve(reback);
                } else {
                    delete seriesObj["createtime"];
                    var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Series/update?where[cpcontentid]=" + seriesObj.cpcontentid))
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(seriesObj)
                        .end(function (postResp) {
                            if (postResp.status != 200) {
                                reback.code = postResp.statusCode;
                                reback.data = postResp.body.error;
                                console.error(postResp.body.error);
                                reback.message = seriesObj.cpcontentid + " update error at " + new Date();
                                reject(reback);
                            } else {
                                if (postResp.body.count && postResp.body.count > 0) {
                                    reback.code = 200;
                                    reback.message = seriesObj.cpcontentid + " update success at " + new Date();
                                    reback.data = seriesObj;
                                    resolve(reback);
                                } else {
                                    reback.code = 200;
                                    reback.message = seriesObj.cpcontentid + " no update at " + new Date();
                                    reback.data = seriesObj;
                                    resolve(reback);
                                }
                            }
                        });
                }
            } else {
                delete seriesObj["flag"];
                var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Series"))
                    .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                    .send(seriesObj)
                    .end(function (postResp) {
                        if (postResp.status != 200) {
                            if (postResp.body && postResp.body.error && postResp.body.error.errno == 1062) {
                                reback.code = 200;
                                reback.data = seriesObj;
                                reback.message = "series :" + seriesObj.cpcontentid + " has exists ";
                                resolve(reback);
                            } else {
                                reback.code = postResp.statusCode;
                                reback.data = postResp.body.error;
                                console.error(postResp.body.error);
                                reback.message = seriesObj.cpcontentid + " insert failed at " + new Date();
                                reject(reback);
                            }
                        } else {
                            reback.code = 200;
                            //strongLoop主键修改
                            postResp.body.cpcontentid = seriesObj.cpcontentid;
                            reback.data = postResp.body;
                            reback.message = seriesObj.cpcontentid + " insert success at " + new Date();
                            resolve(reback);
                        }
                    })
            }
        } else {
            reback.code = 500;
            reback.message = "seriesObj.cpcontentid is null at" + new Date();
            reject(reback);
        }
    });
}
JobEnterDatabase.prototype.updateOrInsertSeries = function (prefix, seriesObj) {
    var cpcontentid = prefix + "_" + seriesObj.cpcontentid;
    var where = {cpcontentid: cpcontentid};
    seriesObj.cpcontentid = cpcontentid;
    return new Promise(function (resolve, reject) {
        return unirest.post(encodeURI(conf.strongLoopApi + "Series/upsertWithWhere?where=" + JSON.stringify(where))).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(seriesObj)
            .end(function (resp) {
                if (resp.status == 200) {
                    resolve(resp.body);
                } else {
                    console.error(resp.body.error);
                    reject({Error: "http status is not 200 at " + new Date()});
                }
            })
    })
}
JobEnterDatabase.prototype.updateOrInsertSeriesByCondition = function (condition, seriesObj) {
    return new Promise(function (resolve, reject) {
        return unirest.get(conf.strongLoopApi + "Series/findOne?filter=" + encodeURIComponent(JSON.stringify(condition))).pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    var newSeries = transformObject.filterSeries(tools.deleteEmptyProperty(seriesObj));
                    newSeries.updatetime = new Date();
                    return unirest.post(conf.strongLoopApi + "Series/update?where=" + encodeURIComponent(JSON.stringify(condition.where))).pool(conf.poolOption)
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(newSeries)
                        .end(function (postResp) {
                            if (postResp.status == 200) {
                                resolve({code: 200, data: seriesObj});

                            } else {
                                reject({code: postResp.status, data: null});
                            }
                        })

                } else if (resp.status == 404) {
                    return unirest.post(conf.strongLoopApi + "Series").pool(conf.poolOption)
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(seriesObj)
                        .end(function (postResp) {
                            if (postResp.status == 200 || (postResp.status == 500 && postResp.body.error.code == "ER_DUP_ENTRY")) {
                                if (postResp.status == 500) {
                                    console.log(seriesObj.cpcontentid + " " + postResp.body.error.code + " at " + new Date())
                                }
                                resolve({code: 200, data: seriesObj})
                            } else {
                                console.error(seriesObj.cpcontentid + " " + postResp.status + " at " + new Date());
                                reject({code: postResp.status, data: null});
                            }

                        })
                } else {
                    reject({code: resp.status, data: null});
                }
            })
    })
}
JobEnterDatabase.prototype.upsertProgram = function (programObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        if (programObj.cpcontentid) {
            if (programObj.flag && (programObj.flag === true)) {
                delete  programObj["flag"];
                reback.code = 200;
                reback.data = programObj;
                reback.message = "program :" + programObj.cpcontentid + " has exists ";
                resolve(reback);

            } else {
                delete programObj["flag"];
                var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Programs"))
                    .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                    .send(programObj)
                    .end(function (postResp) {
                        if (postResp.status != 200) {
                            if (postResp.body && postResp.body.error && postResp.body.error.errno == 1062) {
                                reback.code = 200;
                                reback.data = programObj;
                                reback.message = "program :" + programObj.cpcontentid + " has exists at " + new Date();
                                resolve(reback);
                            } else {
                                reback.code = postResp.statusCode;
                                reback.data = postResp.body.error;
                                console.error(postResp.body.error);
                                reback.message = programObj.cpcontentid + " insert failed  at " + new Date();
                                reject(reback);
                            }
                        } else {
                            reback.code = 200;
                            //主键ID修改
                            postResp.body.cpcontentid = programObj.cpcontentid;
                            reback.data = postResp.body;
                            reback.message = programObj.cpcontentid + " insert success at " + new Date();
                            resolve(reback);
                        }
                    });
            }
        } else {
            reback.code = 500;
            reback.message = "programObj.cpcontentid is null at" + new Date();
            reject(reback);
        }
    });
}
JobEnterDatabase.prototype.updateOrInsertProgramByCondition = function (condition, programObj) {
    return new Promise(function (resolve, reject) {
        return unirest.get(conf.strongLoopApi + "Programs/findOne?filter=" + encodeURIComponent(JSON.stringify(condition))).pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    var newProgram = transformObject.filterProgram(tools.deleteEmptyProperty(programObj));
                    newProgram.updatetime = new Date();
                    return unirest.post(conf.strongLoopApi + "Programs/update?where=" + encodeURIComponent(JSON.stringify(condition.where))).pool(conf.poolOption)
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(newProgram)
                        .end(function (postResp) {
                            if (postResp.status == 200) {
                                resolve({code: 200, data: programObj})
                            } else {
                                console.error(programObj.cpcontentid + " " + postResp.status + " at " + new Date());
                                reject({code: postResp.status, data: null});
                            }
                        });

                } else if (resp.status == 404) {
                    programObj.checkstatus = enums.CheckStatus.NONE.value;
                    return unirest.post(conf.strongLoopApi + "Programs").pool(conf.poolOption)
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(programObj)
                        .end(function (postResp) {
                            if (postResp.status == 200 || (postResp.status == 500 && postResp.body.error.code == "ER_DUP_ENTRY")) {
                                if (postResp.status == 500) {
                                    console.log(programObj.cpcontentid + " " + postResp.body.error.code + " at " + new Date())
                                }
                                resolve({code: 200, data: programObj});
                            } else {
                                console.log(postResp.body);
                                console.error(programObj.cpcontentid + " " + postResp.status + " at " + new Date());
                                reject({code: postResp.status, data: null});
                            }
                        })
                } else {
                    reject({code: resp.status, data: null});
                }
            })
    })
}
JobEnterDatabase.prototype.upsertMovie = function (movieObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        if (movieObj.cpcontentid) {
            if (movieObj.flag && (movieObj.flag === true)) {
                delete movieObj["flag"];
                reback.code = 200;
                reback.data = movieObj;
                reback.message = "movie :" + movieObj.cpcontentid + " has exists ";
                resolve(reback);
            } else {
                delete movieObj["flag"];
                generateUniqueCode.createMovieCode(enums.Project.CMS.value, enums.Code.FILEID).then(function (movieCode) {
                    movieObj.fileid = movieCode;
                    var req = unirest.post(encodeURI(conf.strongLoopApi + "Movies"))
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(movieObj)
                        .end(function (postResp) {
                            if (postResp.status != 200) {
                                reback.code = postResp.statusCode;
                                reback.data = postResp.body.error;
                                console.error(postResp.body.error);
                                reback.message = movieObj.fileid + " insert or update failed at " + new Date();
                                reject(reback);
                            } else {
                                reback.code = 200;
                                reback.data = postResp.body;
                                reback.data.fileid = movieObj.fileid;
                                reback.message = movieObj.fileid + " insert or update success at " + new Date();
                                resolve(reback);
                            }
                        });
                }).catch(function (err) {
                    console.error(err);
                    reback.code = 500;
                    reback.meessge = "movieObj get fileid  error at " + new Date();
                    reback.data = null;
                    reject(err);
                })
            }
        } else {
            reback.code = 500;
            reback.meessge = "movieObj.cpcontentid is null at " + new Date();
            reback.data = null;
            reject(reback);
        }
    });
}
JobEnterDatabase.prototype.updateOrInsertMovieByCondition = function (condition, movieObj) {
    return new Promise(function (resolve, reject) {
        return unirest.get(conf.strongLoopApi + "Movies/findOne?filter=" + encodeURIComponent(JSON.stringify(condition))).pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    var newMovieObj = transformObject.filterMovie(tools.deleteEmptyProperty(movieObj));
                    newMovieObj.updatetime = new Date();
                    return unirest.post(conf.strongLoopApi + "Movies/update?where=" + encodeURIComponent(JSON.stringify(condition.where))).pool(conf.poolOption)
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(newMovieObj)
                        .end(function (postResp) {
                            if (postResp.status == 200) {
                                resolve({code: 200, data: movieObj});
                            } else {
                                console.error(postResp.body);
                                reject({code: postResp.status, data: postResp.body.error.code});
                            }
                        })
                } else if (resp.status == 404) {
                    return generateUniqueCode.createMovieCode(enums.Project.CMS.value, enums.Code.FILEID).then(function (fileid) {
                        movieObj.fileid = fileid;
                        unirest.post(conf.strongLoopApi + "Movies").pool(conf.poolOption)
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(movieObj)
                            .end(function (postResp) {
                                if (postResp.status == 200 || (postResp.status == 500 && postResp.body.error.code == "ER_DUP_ENTRY")) {
                                    if (postResp.status == 500) {
                                        console.log(movieObj.cpcontentid + " " + " type" + movieObj.type + " " + postResp.body.error.code + " at " + new Date())
                                    }
                                    resolve({code: 200, data: movieObj});
                                } else {
                                    console.log(postResp.body);
                                    reject({code: postResp.status, data: null})
                                }
                            });
                    }).catch(function (err) {
                        console.error(err)
                        reject({code: 500, data: err});
                    })
                } else {
                    reject({code: resp.status, data: null});
                }
            })
    })
}
JobEnterDatabase.prototype.insertMovie = function (movieObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var req = unirest.post(conf.strongLoopApi + "Movies")
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(movieObj)
            .end(function (postResp) {
                if (postResp.status != 200) {
                    reback.code = postResp.statusCode;
                    reback.data = postResp.body.error;
                    console.error(postResp.body.error);
                    reback.message = movieObj.fileid + " insert or update failed at " + new Date();
                    reject(reback);
                } else {
                    reback.code = 200;
                    reback.data = postResp.body;
                    reback.data.fileid = movieObj.fileid;
                    reback.message = movieObj.fileid + " insert or update success at " + new Date();
                    resolve(reback);
                }
            });
    })
}
JobEnterDatabase.prototype.updateMovieByCpcontentid = function (whereCondition, postData) {
    return new Promise(function (resolve, reject) {
        unirest.post(encodeURI(conf.strongLoopApi + "Movies/update?where=" + JSON.stringify(whereCondition))).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(postData)
            .end(function (resp) {
                if (resp.status == 200) {
                    resolve(resp.body);
                } else {
                    reject(resp.body.error);
                }
            })
    })
}
JobEnterDatabase.prototype.upsertInjectOrder = function (vlist) {
    return Promise.map(vlist, function (item, index) {
        return new Promise(function (resolve, reject) {
            var reback = {};
            var injectOrderObj = {};
            injectOrderObj.id = 0;
            injectOrderObj.showid = item.showid;
            injectOrderObj.vid = item.vid;
            injectOrderObj.priority = item.priority;
            injectOrderObj.datasources = 2;
            injectOrderObj.status = 0;
            injectOrderObj.createtime = new Date();
            injectOrderObj.updatetime = new Date();
            var postReq = unirest.post(conf.strongLoopApi + "Injectorders")
                .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                .send(injectOrderObj)
                .end(function (postResp) {
                    if (postResp.status != 200) {
                        reback.code = postResp.statusCode;
                        reback.data = postResp.body.error;
                        console.error(postResp.body.error);
                        reback.message = "insert " + item.vid + " failed at " + new Date();
                        reject(reback);

                    } else {
                        reback.code = 200;
                        reback.data = postResp.body;
                        reback.message = "insert " + item.vid + " success at " + new Date();
                        resolve(reback)
                    }

                })
        })
    })
}
JobEnterDatabase.prototype.updateInject = function (id, status, statusdesc, seriesName, programName, showid) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var injectObj = {};
        injectObj.status = status;
        if (showid) {
            injectObj.showid = showid;
        }
        if (seriesName) {
            injectObj.seriesname = seriesName;
        }
        if (programName) {
            injectObj.programname = programName;
        }
        if (statusdesc) {
            injectObj.statusdesc = statusdesc;
        }
        injectObj.updatetime = new Date();
        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Injectorders/update?where[id]=" + id))
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(injectObj)
            .end(function (postRes) {
                if (postRes.status != 200) {
                    reback.code = postRes.statusCode;
                    reject(reback);
                } else {
                    if (postRes.body.count == 1) {
                        reback.code = 200;
                        reback.message = "insert or update " + postRes.body.count + " item";
                        resolve(reback);
                    } else {
                        reback.code = postRes.statusCode;
                        reback.data = postRes.body.error;
                        console.error(postRes.body.error);
                        reback.message = "insert or update " + postRes.body.count + " item";
                        reject(reback);
                    }
                }
            })
    })
}
JobEnterDatabase.prototype.updateMovie = function (fileid, mediaObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var where = {fileid: fileid};
        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Movies/update?where=" + JSON.stringify(where)))
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(mediaObj)
            .end(function (postResp) {
                if (postResp.status != 200) {
                    reback.code = postResp.statusCode;
                    reback.data = postResp.body.error;
                    console.error(postResp.body.error);
                    reback.messge = "update movie " + fileid + " failed at " + new Date();
                    reject(reback);
                } else {
                    reback.code = 200;
                    reback.data = postResp.body;
                    reback.message = "update movie " + fileid + " success at " + new Date();
                    resolve(reback);
                }

            })
    })
}
JobEnterDatabase.prototype.upsertSensitiveseries = function (sensitiveseriesObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var where = {cpcontentid: sensitiveseriesObj.cpcontentid}
        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Sensitivewordsseries/upsertWithWhere?where=" + JSON.stringify(where)))
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(sensitiveseriesObj)
            .end(function (postResp) {
                if (postResp.status != 200) {
                    reback.code = postResp.statusCode;
                    reback.data = postResp.body.error;
                    reback.message = "sensitiveseries " + sensitiveseriesObj.cpcontentid + "insert or update failed at " + new Date();
                    reject(reback);
                } else {
                    reback.code = 200;
                    reback.data = {
                        status: enums.UnifiedStatus.SENSITIVE_UNIFIED.value,
                        statusdesc: enums.UnifiedStatus.SENSITIVE_UNIFIED.name
                    };
                    reback.message = "sensitiveseries " + sensitiveseriesObj.cpcontentid + "insert or update success at " + new Date();
                    resolve(reback);
                }
            })
    })
}
JobEnterDatabase.prototype.insertSensitiveseries = function (sensitiveseriesObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Sensitivewordsseries"))
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(sensitiveseriesObj)
            .end(function (postResp) {
                if (postResp.status != 200) {
                    reback.code = postResp.statusCode;
                    reback.data = postResp.body.error;
                    reback.message = sensitiveseriesObj.cpcontentid + " insert Sensitivewordsseries error at " + new Date();
                    reject(reback);
                } else {
                    reback.code = 200;
                    reback.data = {
                        status: enums.UnifiedStatus.SENSITIVE_UNIFIED.value,
                        statusdesc: enums.UnifiedStatus.SENSITIVE_UNIFIED.name
                    };
                    reback.message = sensitiveseriesObj.cpcontentid + " insert Sensitivewordsseries success at " + new Date();
                    resolve(reback);
                }
            })
    })
}
JobEnterDatabase.prototype.upsertUnifiedseries = function (unifiedObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedseries/findOne?filter[where][cpcontentid]=" + unifiedObj.cpcontentid))
            .pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    var series = tools.deleteEmptyProperty(transformObject.filterSeries(unifiedObj));//获取series信息
                    var unifiedSeries = tools.filterUnifiedObject(resp.body, series);//获取主媒资中与series键相同的value
                    var seriesString = hasher.GetMD5(JSON.stringify(series));
                    var unifiedSeriesString = hasher.GetMD5(JSON.stringfy(unifiedSeries))
                    if (seriesString == unifiedSeriesString) {
                        reback.code = 200;
                        reback.data = resp.body;
                        reback.message = "unifiedseries " + unifiedObj.cpcontentid + " need not update  at " + new Date();
                        console.log(reback.message);
                        resolve(reback);
                    } else {
                        series.updatetime = new Date();
                        unirest.post(encodeURI(conf.strongLoopApi + "Unifiedseries/update?where[cpcontentid]=" + unifiedObj.cpcontentid))
                            .pool(conf.poolOption)
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(series)
                            .end(function (updateResp) {
                                if (updateResp.status == 200) {
                                    series.code = resp.body.code;
                                    reback.code = 200;
                                    reback.data = series;
                                    reback.message = "unifiedseries " + unifiedObj.cpcontentid + " update success at " + new Date();
                                    console.log(reback.message);
                                    resolve(reback);
                                } else {
                                    reback.code = updateResp.status;
                                    reback.data = updateResp.body.error;
                                    reback.message = "unifiedseries " + unifiedObj.cpcontentid + " update failed at " + new Date();
                                    reject(reback);
                                }
                            })
                    }
                } else {
                    return generateUniqueCode.createUnifiedseriesCode(enums.Project.CMS.value, enums.Code.SERIES).then(function (unifiedseriesCode) {
                        unifiedObj.code = unifiedseriesCode;
                        var postReq = unirest.post(conf.strongLoopApi + "Unifiedseries")
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(unifiedObj)
                            .end(function (postResp) {
                                if (postResp.status != 200) {
                                    reback.code = postResp.statusCode;
                                    reback.data = postResp.body.error;
                                    console.error(postResp.body.error);
                                    reback.message = "unifiedseries " + unifiedObj.cpcontentid + "insert or update failed at " + new Date();
                                    reject(reback);
                                } else {
                                    reback.code = 200;
                                    reback.data = postResp.body;
                                    reback.data.code = unifiedObj.code;
                                    reback.message = "unifiedseries " + unifiedObj.cpcontentid + "insert or update success at " + new Date();
                                    resolve(reback);
                                }
                            })
                    })

                }
            })
    })
}
JobEnterDatabase.prototype.upsertUnifiedseriesseries = function (unifiedseriesseriesObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var filter = {
            where: {
                cpcontentid: unifiedseriesseriesObj.cpcontentid,
                unifiedseriescode: unifiedseriesseriesObj.unifiedseriescode
            }
        };
        if (unifiedseriesseriesObj.isunified == 0) {
            unifiedseriesseriesObj.unifieddesc = enums.UnifiedStatus.WAITING_UNIFIED.name;
        } else if (unifiedseriesseriesObj.isunified == 1) {
            unifiedseriesseriesObj.unifieddesc = enums.UnifiedStatus.SUCCESS_UNIFIED.name;
        } else {
            unifiedseriesseriesObj.unifieddesc = enums.UnifiedStatus.FAILED_UNIFIED.name;
        }
        unirest.get(encodeURI(conf.strongLoopApi + "Unifiedseriesseries/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
            .end(function (resp) {
                //匹配到uss，更新聚合状态
                if (resp.status == 200) {
                    if (resp.body.isunified == -1) {
                        reback.code = 200;
                        reback.message = "cpcontentid " + unifiedseriesseriesObj.cpcontentid + " unifiedseriescode " + unifiedseriesseriesObj.unifiedseriescode + " isunified equal -1,need not unified at " + new Date();
                        reback.data = {
                            status: enums.UnifiedStatus.SUCCESS_UNIFIED.value,
                            statusdesc: enums.UnifiedStatus.SUCCESS_UNIFIED.name
                        };
                        console.log(reback.message);
                        resolve(reback);
                    } else {
                        var sendObj = {
                            isunified: unifiedseriesseriesObj.isunified,
                            unifieddesc: unifiedseriesseriesObj.unifieddesc
                        }
                        if (resp.body.status == 1) {
                            sendObj.status = 1;
                        }
                        unirest.post(encodeURI(conf.strongLoopApi + "Unifiedseriesseries/upsertWithWhere?where=" + JSON.stringify(filter.where))).pool(conf.poolOption)
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(sendObj)
                            .end(function (postResp) {
                                if (postResp.status == 200) {
                                    console.log(postResp.body);
                                    reback.code = 200;
                                    reback.message = "cpcontentid " + unifiedseriesseriesObj.cpcontentid + " unifiedseriescode " + unifiedseriesseriesObj.unifiedseriescode + " upsert success at " + new Date();
                                    reback.data = {
                                        status: enums.UnifiedStatus.SUCCESS_UNIFIED.value,
                                        statusdesc: enums.UnifiedStatus.SUCCESS_UNIFIED.name
                                    };
                                    console.log(reback.message);
                                    resolve(reback);
                                } else {
                                    reback.code = postResp.statusCode;
                                    reback.data = postResp.body.error;
                                    console.error(postResp.body.error);
                                    reback.message = "cpcontentid " + unifiedseriesseriesObj.cpcontentid + " unifiedseriescode " + unifiedseriesseriesObj.unifiedseriescode + " upsert fialed at " + new Date();
                                    reject(reback);
                                }
                            })
                    }
                    //没有匹配到uss 创建uss 对象
                } else if (resp.status == 404) {
                    unirest.post(encodeURI(conf.strongLoopApi + "Unifiedseriesseries")).pool(conf.poolOption)
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(unifiedseriesseriesObj)
                        .end(function (postResp) {
                            if (postResp.status == 200) {
                                reback.code = 200;
                                reback.message = "cpcontentid " + unifiedseriesseriesObj.cpcontentid + " unifiedseriescode " + unifiedseriesseriesObj.unifiedseriescode + " upsert success at " + new Date();
                                reback.data = {
                                    status: enums.UnifiedStatus.SUCCESS_UNIFIED.value,
                                    statusdesc: enums.UnifiedStatus.SUCCESS_UNIFIED.name
                                };
                                resolve(reback);
                            } else {
                                reback.code = postResp.statusCode;
                                reback.data = postResp.body.error;
                                console.error(postResp.body.error);
                                reback.message = "cpcontentid " + unifiedseriesseriesObj.cpcontentid + " unifiedseriescode " + unifiedseriesseriesObj.unifiedseriescode + " upsert fialed at " + new Date();
                                reject(reback);
                            }
                        })
                } else {
                    reback.code = resp.statusCode;
                    reback.data = resp.body.error;
                    console.error(resp.body.error);
                    reback.message = "cpcontentid " + unifiedseriesseriesObj.cpcontentid + " find in us error at " + new Date();
                    reject(reback);
                }
            });
    })
}
JobEnterDatabase.prototype.updateUnifiedseriesseries = function (filter, content) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Unifiedseriesseries/update?where=" + JSON.stringify(filter))).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(content)
            .end(function (postResp) {
                if (postResp.status == 200) {
                    reback.code = 200;
                    reback.data = postResp.body.count;
                    reback.message = "update Unifiedseriesseries success at " + new Date();
                    resolve(reback);
                } else {
                    reback.code = postResp.statusCode;
                    reback.data = null;
                    reback.message = "update Unifiedseriesseries failed at " + new Date();
                    reject(reback);
                }
            })
    });
}
JobEnterDatabase.prototype.upsertUnunifiedmedia = function (ununifiedmediaObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var postReq = unirest.post(conf.strongLoopApi + "Ununifiedmedia/upsertWithWhere?where[cpcontentid]=" + ununifiedmediaObj.cpcontentid + "&where[contenttype]=" + ununifiedmediaObj.contenttype)
            .pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(ununifiedmediaObj)
            .end(function (postResp) {
                if (postResp.status == 200) {
                    reback.code = 200;
                    reback.data = {
                        status: enums.UnifiedStatus.SUCCESS_UNIFIED.value,
                        statusdesc: enums.UnifiedStatus.SUCCESS_UNIFIED.name
                    };
                    reback.message = ununifiedmediaObj.cpcontentid + " cpcontentid " + ununifiedmediaObj.contenttype + " contenttype upsert success at " + new Date();
                    resolve(reback);
                } else {
                    if (postResp.status == 500 && postResp.body.error.errno == 1062) {
                        reback.code = 200;
                        reback.data = {
                            status: enums.UnifiedStatus.SUCCESS_UNIFIED.value,
                            statusdesc: enums.UnifiedStatus.SUCCESS_UNIFIED.name
                        };
                        reback.message = ununifiedmediaObj.cpcontentid + " cpcontentid " + ununifiedmediaObj.contenttype + " contenttype exists success at " + new Date();
                        resolve(reback);
                    } else {
                        reback.code = postResp.statusCode;
                        reback.data = postResp.body.error;
                        console.error(postResp.body.error);
                        reback.message = ununifiedmediaObj.cpcontentid + " cpcontentid " + ununifiedmediaObj.contenttype + " contenttype upsert success at " + new Date();
                        reject(reback);
                    }
                }
            })
    })
}
JobEnterDatabase.prototype.insertUnunifiedmedia = function (ununifiedmediaObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Ununifiedmedia")).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(ununifiedmediaObj)
            .end(function (postResp) {
                if (postResp.status == 200) {
                    reback.code = 200;
                    reback.data = postResp.body;
                    reback.message = "insert ununifiedmedia success at " + new Date();
                    resolve(reback);
                } else {
                    if (postResp.status == 500 && postResp.body.error.errno == 1062) {
                        reback.code = 200;
                        reback.data = ununifiedmediaObj
                        reback.message = "ununifiedmedia exisits at " + new Date();
                        resolve(reback);
                    } else {
                        reback.code = postResp.statusCode;
                        reback.data = postResp.body.error;
                        reback.message = "insert ununifiedmedia failed at " + new Date();
                        reject(reback);
                    }
                }
            })
    })
}
JobEnterDatabase.prototype.upsertWaitunified = function (waitunifiedObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var filter = {where: {cpcontentid: waitunifiedObj.cpcontentid}};
        unirest.get(encodeURI(conf.strongLoopApi + "Waitunifieds/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    delete waitunifiedObj["createtime"];
                    unirest.post(encodeURI(conf.strongLoopApi + "Waitunifieds/update?where=" + JSON.stringify(filter.where))).pool(conf.poolOption)
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(waitunifiedObj)
                        .end(function (postRes) {
                            if (postRes.status != 200) {
                                reback.code = postRes.statusCode;
                                reback.data = postRes.body.error;
                                console.error(postRes.body.error);
                                reback.message = waitunifiedObj.cpcontentid + " update waitunified error at " + new Date();
                                reject(reback);
                            } else {
                                reback.code = 200;
                                reback.data = postRes.body.count;
                                reback.message = waitunifiedObj.cpcontentid + " update waitunified success at " + new Date();
                                resolve(reback);
                            }
                        })
                } else if (resp.status == 404) {
                    unirest.post(encodeURI(conf.strongLoopApi + "Waitunifieds")).pool(conf.poolOption)
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(waitunifiedObj)
                        .end(function (postRes) {
                            if (postRes.status != 200) {
                                reback.code = postRes.statusCode;
                                reback.data = postRes.body.error;
                                console.error(postRes.body.error);
                                reback.message = waitunifiedObj.cpcontentid + " insert waitunified error at " + new Date();
                                reject(reback);
                            } else {
                                reback.code = 200;
                                reback.data = postRes.body;
                                reback.data.cpcontentid = waitunifiedObj.cpcontentid;
                                reback.message = waitunifiedObj.cpcontentid + " insert waitunified success at " + new Date();
                                resolve(reback);
                            }
                        })
                } else {
                    reback.code = resp.status;
                    reback.data = resp.body.error;
                    reback.message = waitunifiedObj.cpcontentid + " get waitunified failed at " + new Date();
                    reject(reback);
                }
            })
    })

}
JobEnterDatabase.prototype.upsertSensitiveprogram = function (sensitiveprogramObj) {
    console.log("sensitiveprogramObj is :")
    console.log(sensitiveprogramObj);
    return new Promise(function (resolve, reject) {
        var reback = {};
        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Sensitivewordsprograms/upsertWithWhere?where[cpcontentid]=" + sensitiveprogramObj.cpcontentid + "&where[sensitivewords]=" + sensitiveprogramObj.sensitivewords))
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(sensitiveprogramObj)
            .end(function (postResp) {
                if (postResp.status == 200) {
                    reback.code = 200;
                    reback.data = postResp.body;
                    reback.message = sensitiveprogramObj.cpcontentid + " upsert sp success at " + new Date();
                    resolve(reback);
                } else {
                    if (postResp.status == 500 && postResp.body.error.errno == 1062) {
                        reback.code = 200;
                        reback.data = sensitiveprogramObj;
                        reback.message = sensitiveprogramObj.cpcontentid + "  exists at " + new Date();
                        resolve(reback);
                    } else {
                        reback.code = postResp.statusCode;
                        reback.data = postResp.body.error;
                        console.error(postResp.body.error)
                        reback.message = sensitiveprogramObj.cpcontentid + " upsert sp failed at " + new Date();
                        reject(reback);
                    }
                }
            })

    })
}
JobEnterDatabase.prototype.insertSensitiveprogram = function (sensitiveprogramObj) {
    console.log("sensitiveprogramObj is :")
    console.log(sensitiveprogramObj);
    return new Promise(function (resolve, reject) {
        var reback = {};
        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Sensitivewordsprograms")).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(sensitiveprogramObj)
            .end(function (postResp) {
                if (postResp.status == 200) {
                    reback.code = 200;
                    reback.data = postResp.body;
                    reback.message = "insert sensitivewordsprograms success at " + new Date();
                    resolve(reback);
                } else {
                    reback.code = postResp.statusCode;
                    reback.data = postResp.body.error;
                    reback.message = "insert sensitivewordsprograms failed at " + new Date();
                    reject(reback);
                }
            })
    })
}
JobEnterDatabase.prototype.upsertUnifiedprogramprogram = function (unifiedprogramprogramObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Unifiedprogramprograms/upsertWithWhere?where[cpcontentid]=" + unifiedprogramprogramObj.cpcontentid + "&where[unifiedprogramcode]=" + unifiedprogramprogramObj.unifiedprogramcode))
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(unifiedprogramprogramObj)
            .end(function (postResp) {
                if (postResp.status == 200) {
                    reback.code = 200;
                    reback.data = postResp.body;
                    reback.messge = unifiedprogramprogramObj.cpcontentid + " upsert upp success at " + new Date();
                    resolve(reback);
                } else {
                    reback.code = postResp.statusCode;
                    reback.data = postResp.body.error;
                    console.error(postResp.body.error)
                    reback.messge = unifiedprogramprogramObj.cpcontentid + " upsert upp failed at " + new Date();
                    reject(reback);
                }
            })
    })

}
JobEnterDatabase.prototype.upsertUnifiedprogram = function (unifiedprogramObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedprograms/findOne?filter[where][cpcontentid]=" + unifiedprogramObj.cpcontentid))
            .pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    reback.code = 200;
                    reback.data = resp.body;
                    reback.message = unifiedprogramObj.cpcontentid + " in up";
                    resolve(reback);
                } else {
                    return generateUniqueCode.createUnifiedprogramCode(enums.Project.CMS.value, enums.Code.PROGRAM).then(function (unifiedprogramCode) {
                        unifiedprogramObj.code = unifiedprogramCode;
                        unifiedprogramObj.createtime = new Date();
                        unifiedprogramObj.updatetime = new Date();
                        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Unifiedprograms"))
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(unifiedprogramObj)
                            .end(function (postResp) {
                                if (postResp.status == 200) {
                                    reback.code = 200;
                                    reback.data = postResp.body;
                                    reback.data.code = unifiedprogramObj.code;
                                    reback.message = unifiedprogramObj.cpcontentid + " upsert up sucess at " + new Date();
                                    resolve(reback);
                                } else {
                                    reback.code = postResp.statusCode;
                                    reback.data = postResp.body.error;
                                    console.error(postResp.body.error)
                                    reback.message = unifiedprogramObj.cpcontentid + " upsert up  failed at " + new Date();
                                    reject(reback);
                                }
                            })
                    })
                }

            })
    })
}
JobEnterDatabase.prototype.upsertUnifiedprogramByFilter = function (unifiedprogramObj, filter) {
    return new Promise(function (resolve, reject) {
        unirest.get(encodeURI(conf.strongLoopApi + "Unifiedprograms/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
            .end(function (resp) {
                var reback = {};
                if (resp.status == 200) {
                    if (unifiedprogramObj.ismain || (unifiedprogramObj.ismain == false && unifiedprogramObj.srccpcode == resp.body.srccpcode)) {
                        delete unifiedprogramObj["ismain"];
                        var filterProgram = tools.deleteEmptyProperty(transformObject.filterSeries(unifiedprogramObj));//获取program信息
                        var unifiedProgram = tools.filterUnifiedObject(resp.body, filterProgram);
                        var filterProgramString = hasher.GetMD5(JSON.stringify(filterProgram));//计算 program MD5
                        var unifiedProgramString = hasher.GetMD5(JSON.stringify(unifiedProgram));//计算 unifiedProgam MD5
                        if (filterProgramString == unifiedProgramString) {
                            //相等不做更新操作
                            console.log("program need not update us at " + new Date());
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = "unifiedprograms :" + resp.body.cpcontentid + " need not update at " + new Date();
                            console.log(reback.message);
                            resolve(reback);
                        } else {
                            console.log("program need update us at " + new Date());
                            var where = {cpcontentid: resp.body.cpcontentid};
                            unirest.post(encodeURI(conf.strongLoopApi + "Unifiedprograms/upsertWithWhere?where=" + JSON.stringify(where))).pool(conf.poolOption)
                                .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                                .send(filterProgram)
                                .end(function (postResp) {
                                    if (postResp.status == 200) {
                                        reback.code = 200;
                                        reback.data = postResp.body;
                                        reback.message = "unifiedprograms :" + resp.body.cpcontentid + " update success at " + new Date();
                                        resolve(reback);
                                    } else {
                                        reback.code = postResp.statusCode;
                                        reback.data = postResp.body.error;
                                        reback.message = "unifiedprograms :" + resp.body.cpcontentid + " update failed at " + new Date();
                                        reject(reback);
                                    }
                                })

                        }
                    } else {
                        reback.code = 200;
                        reback.data = resp.body;
                        reback.message = unifiedprogramObj.cpcontentid + " match up success ,not main media at " + new Date();
                        resolve(reback);
                    }
                } else {
                    return generateUniqueCode.createUnifiedprogramCode(enums.Project.CMS.value, enums.Code.PROGRAM).then(function (unifiedprogramCode) {
                        unifiedprogramObj.code = unifiedprogramCode;
                        unifiedprogramObj.createtime = new Date();
                        unifiedprogramObj.updatetime = new Date();
                        var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Unifiedprograms"))
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(unifiedprogramObj)
                            .end(function (postResp) {
                                if (postResp.status == 200) {
                                    reback.code = 200;
                                    reback.data = postResp.body;
                                    reback.data.code = unifiedprogramObj.code;
                                    reback.message = unifiedprogramObj.cpcontentid + " insert up sucess at " + new Date();
                                    resolve(reback);
                                } else {
                                    reback.code = postResp.statusCode;
                                    reback.data = postResp.body.error;
                                    reback.message = unifiedprogramObj.cpcontentid + " insert  up  failed at " + new Date();
                                    reject(reback);
                                }
                            })
                    })
                }
            })
    })
}
JobEnterDatabase.prototype.upserUnifiedmovie = function (unifiedmovieObj) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var filter = {};
        filter.where = {fileid: unifiedmovieObj.fileid};
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedmovies/findOne?filter=" + JSON.stringify(filter)))
            .pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    reback.code = 200;
                    reback.data = resp.body;
                    reback.message = unifiedmovieObj.fileid + " in um";
                    resolve(reback);
                } else {
                    if (resp.status == 404) {
                        return generateUniqueCode.createUnifiedmovieCode(enums.Project.CMS.value, enums.Code.MOVIE).then(function (unifiedmovieCode) {
                            unifiedmovieObj.code = unifiedmovieCode;
                            unifiedmovieObj.createtime = new Date();
                            unifiedmovieObj.updatetime = new Date();
                            var postReq = unirest.post(encodeURI(conf.strongLoopApi + "Unifiedmovies"))
                                .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                                .send(unifiedmovieObj)
                                .end(function (postResp) {
                                    if (postResp.status == 200) {
                                        reback.code = 200;
                                        reback.data = postResp.body;
                                        reback.data.fileid = unifiedmovieObj.fileid;
                                        reback.data.code = unifiedmovieObj.code;
                                        reback.message = unifiedmovieObj.fileid + " upsert um success at " + new Date();
                                        resolve(reback);
                                    } else {
                                        reback.code = postResp.statusCode;
                                        reback.data = postResp.body.error;
                                        console.error(postResp.body.error);
                                        reback.message = unifiedmovieObj.fileid + " upsert um failed " + new Date();
                                        reject(reback);
                                    }

                                })
                        })
                    } else {
                        reback.code = resp.statusCode;
                        reback.data = resp.body.error;
                        console.error(resp.body.error);
                        reback.message = unifiedmovieObj.fileid + " upsert um failed";
                        reject(reback);

                    }
                }
            })
    })
}
JobEnterDatabase.prototype.updateUnifiedseries = function (unifiedSeries) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        unifiedSeries.updatetime = new Date();
        var postReq = unirest.post(conf.strongLoopApi + "UnifiedSeries/update?where[cpcontentid]=" + unifiedSeries.cpcontentid)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(unifiedSeries)
            .end(function (postResp) {
                if (postResp.statusCode == 200) {
                    reback.code = postResp.statusCode;
                    reback.data = postResp.body.count;
                    reback.message = unifiedSeries.cpcontentid + " update  " + reback.data + " items success at " + new Date();
                    resolve(reback);
                } else {
                    reback.code = postResp.statusCode;
                    reback.data = postResp.body.error;
                    console.error(postResp.body.error);
                    reback.message = unifiedSeries.cpcontentid + " update failed at " + new Date();
                    reject(reback);
                }
            })

    })
}
JobEnterDatabase.prototype.updateUnifiedprogram = function (unifiedProgram) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        unifiedProgram.updatetime = new Date();
        var postReq = unirest.post(conf.strongLoopApi + "Unifiedprograms/update?where[cpcontentid]=" + unifiedProgram.cpcontentid)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(unifiedProgram)
            .end(function (postResp) {
                if (postResp.statusCode == 200) {
                    reback.code = postResp.statusCode;
                    reback.data = postResp.body.count;
                    reback.message = unifiedProgram.cpcontentid + " update  " + reback.data + " items success at " + new Date();
                    resolve(reback);
                } else {
                    reback.code = postResp.statusCode;
                    reback.data = postResp.body.error;
                    console.error(postResp.body.error);
                    reback.message = unifiedProgram.cpcontentid + " update failed at " + new Date();
                    reject(reback);
                }
            })

    })
}
JobEnterDatabase.prototype.updateUnifiedmovieById = function (unifiedMovie) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        unirest.post(encodeURI(conf.strongLoopApi + "Unifiedmovies/update?where[id]=" + unifiedMovie.id))
            .pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(unifiedMovie)
            .end(function (resp) {
                if (resp.status == 200) {
                    if (resp.body.count && resp.body.count == 1) {
                        reback.code = 200;
                        reback.message = "update unifiedmovie success at " + new Date();
                        reback.data = resp.body.count;
                        resolve(reback);

                    } else {
                        reback.code = 500;
                        reback.message = "update unifiedmovie suceess at " + new Date();
                        reback.data = resp.body.count;
                        resolve(reback);
                    }
                } else {
                    reback.code = resp.statusCode;
                    reback.message = "request error at " + new Date();
                    reback.data = null;
                    reject(reback);
                }
            })
    })
}
JobEnterDatabase.prototype.upsertImportMediaDetail = function (importMediaDetail) {
    return new Promise(function (resolve, reject) {
        importMediaDetail.updatetime = new Date();
        var filter = {
            where: {
                cpcode: importMediaDetail.cpcode,
                seriesname: importMediaDetail.seriesname,
                programvolumncount: importMediaDetail.programvolumncount,
                programname: importMediaDetail.programname,
                importmediaid: importMediaDetail.importmediaid
            }
        }
        var req = unirest.get(conf.strongLoopApi + "Importmediadetails/findOne?&filter=" + encodeURIComponent(JSON.stringify(filter))).pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    unirest.post(encodeURI(conf.strongLoopApi + "Importmediadetails/update?where=" + JSON.stringify(filter.where)))
                        .pool(conf.poolOption)
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send(importMediaDetail)
                        .end(function (res) {
                            if (res.status == 200) {
                                if (res.body.count == 1) {
                                    resolve(res.body);
                                } else {
                                    reject({Error: "update item count " + res.body.count + ",please connection developer"})
                                }
                            } else {
                                reject(res.body.error);
                            }
                        })
                } else {
                    importMediaDetail.id = 0;
                    importMediaDetail.createtime = new Date();
                    unirest.post(encodeURI(conf.strongLoopApi + "Importmediadetails")).pool(conf.poolOption)
                        .header('Accept', 'application/json')
                        .header('Content-Type', 'application/json')
                        .send(importMediaDetail)
                        .end(function (res) {
                            if (res.status == 200) {
                                resolve(res.body)
                            } else {
                                reject(res.body.error);
                            }
                        })
                }
            })

    });
}
JobEnterDatabase.prototype.updateImportMedia = function (id, importMedia) {
    return new Promise(function (resolve, reject) {
        var filter = {where: {"id": id}};
        unirest.get(encodeURI(conf.strongLoopApi + "Importmedia/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
            .end(function (res) {
                if (res.status == 200) {
                    if (res.body.status == 0 || res.body.status == 10) {
                        unirest.post(encodeURI(conf.strongLoopApi + "Importmedia/update?where=" + JSON.stringify(filter.where))).pool(conf.poolOption)
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(importMedia)
                            .end(function (resp) {
                                if (resp.status == 200) {
                                    if (resp.body.count == 1) {
                                        resolve(resp.body);
                                    } else {
                                        reject({Error: "update item count " + resp.body.count + ",please connection developer"})
                                    }
                                } else {
                                    reject({Error: resp.body.error});
                                }
                            })
                    } else {
                        resolve(res.body);
                    }

                } else {
                    reject({Error: res.body.error})
                }
            })
    })
}
//导入节目集，根据cp、名称、发行年份、一级分类匹配series是否存在，存在，update，反之insert
JobEnterDatabase.prototype.importSeries = function (series) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var releaseyear = series.releaseyear;
        if (releaseyear.indexOf("-")) {
            releaseyear = releaseyear.split("-")[0]
        }
        var filter = {
            where: {
                cpcode: series.cpcode,
                name: series.name,
                programtype: series.programtype,
                releaseyear: {regexp: "^" + releaseyear}
            }
        };
        unirest.get(conf.strongLoopApi + "Series/findOne?filter=" + encodeURIComponent(JSON.stringify(filter)))
            .pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    var filterSeries = tools.deleteEmptyProperty(transformObject.filterSeries(series));//获取series信息
                    //不更新cpcontentid
                    delete filterSeries["cpcontentid"];
                    var unifiedSeries = tools.filterUnifiedObject(resp.body, filterSeries);//获取主媒资中与series键相同的value
                    //比较数据库中字段与导入字段是否相等
                    if (JSON.stringify(filterSeries) == JSON.stringify(unifiedSeries)) {
                        //相等不做更新操作
                        console.log("series need not update us at " + new Date());
                        reback.code = 200;
                        reback.data = resp.body;
                        reback.message = series.cpcode + ":" + series.name + " need not update  at " + new Date();
                        console.log(reback.message);
                        resolve(reback);
                    } else {
                        //不相等更新series
                        console.log("series need update us at " + new Date());
                        filterSeries.updatetime = new Date();
                        var whereCondition = {cpcontentid: resp.body.cpcontentid};
                        unirest.post(encodeURI(conf.strongLoopApi + "Series/upsertWithWhere?where=" + JSON.stringify(whereCondition)))
                            .pool(conf.poolOption)
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(filterSeries)
                            .end(function (res) {
                                if (res.status == 200) {
                                    reback.code = 200;
                                    reback.message = series.cpcode + ":" + series.name + " update success at " + new Date();
                                    reback.data = res.body;
                                    console.log(reback.message);
                                    resolve(reback)
                                } else {
                                    console.error(res.body.error);
                                    reback.code = res.statusCode;
                                    reback.message = series.cpcode + ":" + series.name + " update failed at " + new Date();
                                    reback.data = null;
                                    reject(reback);
                                }

                            })
                    }
                } else {
                    //没有匹配到series，执行insert
                    if (resp.status == 404) {
                        return new Promise(function (resolve, reject) {
                            if (series.cpcontentid && series.cpcontentid != "") {
                                resolve(series.cpcontentid);
                            } else {
                                return generateUniqueCode.createSeriesCode(series.cpcode, enums.Project.CMS.value, enums.Code.IMPORT_SERIES).then(function (seriesCpcontentid) {
                                    resolve(seriesCpcontentid);
                                }).catch(function (err) {
                                    reject(err);
                                })
                            }
                        }).then(function (seriesCpcontentid) {
                            series.cpcontentid = seriesCpcontentid;
                            series.createtime = new Date();
                            series.updatetime = new Date();
                            unirest.post(conf.strongLoopApi + "Series").pool(conf.poolOption)
                                .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                                .send(series)
                                .end(function (postResp) {
                                    if (postResp.status == 200) {
                                        reback.code = 200;
                                        reback.message = series.cpcode + ":" + series.name + " insert success at " + new Date();
                                        postResp.body.cpcontentid = series.cpcontentid;
                                        reback.data = postResp.body;
                                        resolve(reback);
                                    } else {
                                        reback.code = postResp.statusCode;
                                        reback.message = series.cpcode + ":" + series.name + " insert fialed at " + new Date();
                                        reback.data = postResp.body.error;
                                        reject(reback);
                                    }
                                })
                        }).catch(function (err) {
                            reject(err);
                        })

                    } else {
                        reback.code = resp.statusCode;
                        reback.message = series.cpcode + ":" + series.name + " request error at " + new Date();
                        reback.data = resp.body.error;
                        reject(reback);
                    }
                }
            })
    })
}
//导入节目，根据cp，节目集名称，剧集序号、一级分类匹配program，存在update，反之，insert
JobEnterDatabase.prototype.importProgram = function (program) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var releaseyear = program.releaseyear;
        if (releaseyear.indexOf("-")) {
            releaseyear = releaseyear.split("-")[0];
        }
        var filter = {
            where: {
                cpcode: program.cpcode,
                seriesname: escape(program.seriesname),
                volumncount: program.volumncount,
                programtype: program.programtype,
                releaseyear: {regexp: "^" + releaseyear}

            }
        };
        unirest.get(conf.strongLoopApi + "Programs/findOne?filter=" + encodeURIComponent(JSON.stringify(filter)))
            .pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    var filterProgram = tools.deleteEmptyProperty(transformObject.filterProgram(program));//获取program信息
                    //不更新cpcontentid
                    delete filterProgram["cpcontentid"];
                    var unifiedProgram = tools.filterUnifiedObject(resp.body, filterProgram);//获取主媒资中与program键相同的value
                    //比较数据库和导入字段
                    if (JSON.stringify(filterProgram) == JSON.stringify(unifiedProgram)) {
                        //相等，不做更新操作
                        console.log("program need not update us at " + new Date());
                        reback.code = 200;
                        reback.data = resp.body;
                        reback.message = program.cpcode + ":" + program.name + " need not update  at " + new Date();
                        console.log(reback.message);
                        resolve(reback);
                    } else {
                        //不相等，更新
                        console.log("program need update  at " + new Date());
                        filterProgram.updatetime = new Date();
                        var whereCondition = {cpcontentid: resp.body.cpcontentid};
                        unirest.post(encodeURI(conf.strongLoopApi + "Programs/upsertWithWhere?where=" + JSON.stringify(whereCondition)))
                            .pool(conf.poolOption)
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(filterProgram)
                            .end(function (res) {
                                if (res.status == 200) {
                                    reback.code = 200;
                                    reback.message = program.cpcode + ":" + program.name + " update success at " + new Date();
                                    reback.data = res.body;
                                    console.log(reback.message);
                                    resolve(reback)
                                } else {
                                    console.error(res.body.error);
                                    reback.code = res.statusCode;
                                    reback.message = program.cpcode + ":" + program.name + " update failed at " + new Date();
                                    reback.data = null;
                                    reject(reback);
                                }

                            })
                    }

                } else {
                    //没有匹配到program，执行insert操作
                    if (resp.status == 404) {
                        return new Promise(function (resolve, reject) {
                            if (program.cpcontentid && program.cpcontentid != "") {
                                resolve(program.cpcontentid);
                            } else {
                                return generateUniqueCode.createProgramCode(program.cpcode, enums.Project.CMS.value, enums.Code.IMPORT_PROGRAM).then(function (programCpcontentid) {
                                    resolve(programCpcontentid);
                                }).catch(function (err) {
                                    reject(err);
                                })
                            }
                        }).then(function (programCpcontentid) {
                            program.cpcontentid = programCpcontentid;
                            program.createtime = new Date();
                            program.updatetime = new Date();
                            unirest.post(conf.strongLoopApi + "Programs").pool(conf.poolOption)
                                .header('Accept', 'application/json')
                                .header('Content-Type', 'application/json')
                                .send(program)
                                .end(function (postResp) {
                                    if (postResp.status == 200) {
                                        reback.code = 200;
                                        reback.message = program.cpcode + ":" + program.name + " " + program.volumncount + " insert success at " + new Date();
                                        postResp.body.cpcontentid = program.cpcontentid;
                                        reback.data = postResp.body;
                                        console.log(reback.message);
                                        resolve(reback);
                                    } else {
                                        console.error(postResp.body.error);
                                        reback.code = postResp.statusCode;
                                        reback.message = program.cpcode + ":" + program.name + " insert fialed at " + new Date();
                                        reback.data = postResp.body.error;
                                        reject(reback);
                                    }
                                });
                        })

                    } else {
                        reback.code = resp.statusCode;
                        reback.message = program.cpcode + ":" + program.name + " request error at " + new Date();
                        console.error(reback.message);
                        reback.data = resp.body.error;
                        reject(reback);
                    }
                }
            })
    })
}
//导入介质
JobEnterDatabase.prototype.importMovie = function (movie, importDetail, bitRate) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        //原介质
        if (movie.type == enums.MovieType.PRIMARY.value) {
            movie.transcodestatus = 0;
            var filter = {where: {cpcontentid: movie.cpcontentid, type: movie.type}};
            //匹配原介质，cpcontentid，type
            unirest.get(encodeURI(conf.strongLoopApi + "Movies/findOne?filter=" + JSON.stringify(filter)))
                .pool(conf.poolOption)
                .end(function (resp) {
                    if (resp.status == 200) {
                        //匹配成功，比较数据库字段与导入字段
                        var filterMovie = tools.deleteEmptyProperty(transformObject.filterProgram(movie));//获取movie信息
                        var unifiedMovie = tools.filterUnifiedObject(resp.body, filterMovie);//获取主媒资中与program键相同的value
                        //相同，不做更新操作
                        if (JSON.stringify(filterMovie) == JSON.stringify(unifiedMovie)) {
                            console.log("movie need not update us at " + new Date());
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = resp.body.cpcontentid + ":type " + resp.body.type + " need not update at " + new Date();
                            console.log(reback.message);
                            resolve(reback);
                        } else {
                            //不同更新数据库字段
                            console.log("movie need update  at " + new Date());
                            filterMovie.updatetime = new Date();
                            filterMovie.iscompleted = 0;
                            var whereCondition = {
                                cpcontentid: resp.body.cpcontentid,
                                type: resp.body.type
                            };
                            unirest.post(encodeURI(conf.strongLoopApi + "Movies/upsertWithWhere?where=" + JSON.stringify(whereCondition)))
                                .pool(conf.poolOption)
                                .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                                .send(filterMovie)
                                .end(function (res) {
                                    if (res.status == 200) {
                                        reback.code = 200;
                                        reback.message = resp.body.cpcontentid + ":type " + resp.body.type + " update success at " + new Date();
                                        reback.data = res.body;
                                        console.log(reback.message);
                                        resolve(reback)
                                    } else {
                                        console.error(res.body.error);
                                        reback.code = res.statusCode;
                                        reback.message = resp.body.cpcontentid + ":type " + resp.body.type + " update  failed at " + new Date();
                                        reback.data = null;
                                        reject(reback);
                                    }

                                })
                        }
                    } else {
                        if (resp.status == 404) {
                            //匹配失败，执行movie insert操作
                            return generateUniqueCode.createMovieCode(enums.Project.CMS.value, enums.Code.FILEID).then(function (movieFileid) {
                                movie.fileid = movieFileid;
                                movie.createtime = new Date();
                                movie.updatetime = new Date();
                                unirest.post(conf.strongLoopApi + "Movies").pool(conf.poolOption)
                                    .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                                    .send(movie)
                                    .end(function (postResp) {
                                        if (postResp.status == 200) {
                                            reback.code = 200;
                                            reback.message = movie.cpcontentid + ":type " + movie.type + +" insert success at " + new Date();
                                            postResp.body.fileid = movie.fileid;
                                            reback.data = postResp.body;
                                            resolve(reback);
                                        } else {
                                            reback.code = 500;
                                            reback.message = movie.cpcontentid + ":type " + movie.type + +" insert failed at " + new Date();
                                            postResp.body.fileid = movie.fileid;
                                            reback.data = postResp.body.error;
                                            reject(reback);
                                        }
                                    });
                            })

                        } else {
                            //查询异常，抛出异常信息
                            reback.code = resp.statusCode;
                            reback.message = movie.cpcontentid + ":type " + movie.type + " find movies error at " + new Date();
                            reback.data = resp.body.error;
                            reject(reback);
                        }
                    }
                })
        } else {
            //成品介质，导入规格存在
            if (bitRate) {
                //根据cpcontentid，介质类型、导入规格作为唯一条件匹配成品介质
                var filter = {
                    where: {
                        cpcontentid: movie.cpcontentid,
                        type: movie.type,
                        movieformat: importDetail.movieformat
                    }
                };
                return searchDatabase.getMovieByFilter(filter).then(function (movieResult) {
                    if (movieResult.code != 200) {
                        //匹配失败，执行insert擦做
                        return transformObject.completeMovie(movie).then(function (movieObj) {
                            return generateUniqueCode.createMovieCode(enums.Project.CMS.value, enums.Code.FILEID).then(function (movieFileid) {
                                movie.fileid = movieFileid;
                                movie = tools.deepCopy(movieObj, movie);
                                movie.createtime = new Date();
                                movie.updatetime = new Date();
                                movie.iscompleted = 1;
                                console.log("movie is :")
                                console.log(movie);
                                return JobEnterDatabase.prototype.insertMovie(movie).then(function (insertResult) {
                                    console.log("endProductMovie insert success at " + new Date())
                                    resolve(insertResult)
                                }).catch(function (err) {
                                    console.error(err);
                                    reject(err);
                                })
                            })
                        }).catch(function (err) {
                            console.error(err);
                            reject(err);
                        })
                    } else {
                        //匹配成功
                        movie.iscompleted = 1;
                        movie.cpcontentid = movieResult.data.cpcontentid;
                        movie.showid = movieResult.data.showid;
                        movie.updatetime = new Date();
                        delete movie["createtime"];
                        var filterMovie = tools.deleteEmptyProperty(transformObject.filterProgram(movie));//获取movie信息
                        var unifiedMovie = tools.filterUnifiedObject(movieResult.data, filterMovie);//获取主媒资中与movie键相同的value
                        //比较数据库和导入字段
                        if (JSON.stringify(filterMovie) == JSON.stringify(unifiedMovie)) {
                            //相同不做更新操作
                            console.log("movie need not update us at " + new Date());
                            reback.code = 200;
                            reback.data = movieResult.data;
                            reback.message = movieResult.data.cpcontentid + ":type " + movieResult.data.type + " need not update at " + new Date();
                            console.log(reback.message);
                            resolve(reback);
                        } else {
                            //不同，更新匹配到的成品介质
                            console.log("movie need update  at " + new Date());
                            filterMovie.updatetime = new Date();
                            filterMovie.isunified = 0;
                            unirest.post(encodeURI(conf.strongLoopApi + "Movies/upsertWithWhere?where=" + JSON.stringify(filter.where)))
                                .pool(conf.poolOption)
                                .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                                .send(filterMovie)
                                .end(function (res) {
                                    if (res.status == 200) {
                                        reback.code = 200;
                                        reback.message = movieResult.data.cpcontentid + ":type " + movieResult.data.type + " update success at " + new Date();
                                        reback.data = res.body;
                                        console.log(reback.message);
                                        resolve(reback)
                                    } else {
                                        console.error(res.body.error);
                                        reback.code = res.statusCode;
                                        reback.message = movieResult.data.cpcontentid + ":type " + movieResult.data.type + " update  failed at " + new Date();
                                        reback.data = null;
                                        reject(reback);
                                    }

                                })
                        }
                    }
                })
            } else {
                //导入规格不存在，抛出异常
                reback.code = 404;
                reback.message = "not find bitRate at " + new Date();
                reback.data = null;
                reject(reback);
            }

        }
    })
}
JobEnterDatabase.prototype.updateImportDetail = function (id, importDetail) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var filter = {where: {"id": id}};
        unirest.get(encodeURI(conf.strongLoopApi + "Importmediadetails/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
            .end(function (res) {
                if (res.status == 200) {
                    if (res.body.status == 0) {
                        unirest.post(encodeURI(conf.strongLoopApi + "Importmediadetails/update?where=" + JSON.stringify(filter.where))).pool(conf.poolOption)
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(importDetail)
                            .end(function (resp) {
                                console.log(resp.body);
                                if (resp.status == 200) {
                                    reback.code = 200;
                                    reback.message = "update " + id + " success at " + new Date();
                                    reback.data = resp.body;
                                    resolve(reback);
                                } else {
                                    reback.code = resp.statusCode;
                                    reback.message = "update " + id + " failed at " + new Date();
                                    reback.data = resp.body.error;
                                    reject(reback);
                                }
                            })
                    } else {
                        reback.code = 200;
                        reback.message = id + "need not update at " + new Date();
                        reback.data = res.body;
                        resolve(reback);
                    }
                } else {
                    reback.code = res.statusCode;
                    reback.data = res.body.error;
                    reback.message = id + " find error at " + new Date();
                    reject(reback);
                }
            })
    })
}
JobEnterDatabase.prototype.insertDomainTask = function (obj) {
    return new Promise(function (resolve, reject) {
        unirest.post(encodeURI(conf.strongLoopApi + "Domaintasks")).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(obj)
            .end(function (res) {
                if (res.status == 200) {
                    resolve(res.body);
                } else {
                    reject(res.body.error);
                }
            })
    })
}
JobEnterDatabase.prototype.updateDomainTask = function (whereConditions, updateFields) {
    return new Promise(function (resolve, reject) {
        unirest.post(encodeURI(conf.strongLoopApi + "Domaintasks/update?where=" + JSON.stringify(whereConditions))).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(updateFields)
            .end(function (res) {
                if (res.status == 200) {
                    resolve(res.body);
                } else {
                    reject(resp.body.error);
                }
            })
    })
}
JobEnterDatabase.prototype.upsertDomainTask = function (whereCondition, obj) {
    return new Promise(function (resolve, reject) {
        unirest.post(encodeURI(conf.strongLoopApi + "Domaintasks/upsertWithWhere?where=" + JSON.stringify(whereCondition))).pool(conf, poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(obj)
            .end(function (res) {
                if (res.status == 200) {
                    resolve(res.body);
                } else {
                    reject(res.body.error);
                }
            })
    })
}
JobEnterDatabase.prototype.upsertDomainTaskList = function (list, obj) {
    return new Promise(function (resolve, reject) {
        if (list.length <= 0) {
            reject({Error: "list length is 0,have not domain at " + new Date()})
        } else {
            return searchDatabase.getDomainTaskSPMInfo(obj.programcode, obj.moviecode).then(function (pmInfo) {
                for (var item in list) {
                    list[item].seriescode = obj.seriescode;
                    list[item].programcode = obj.programcode;
                    list[item].moviecode = obj.moviecode;
                    list[item].seriesname = pmInfo.seriesName;
                    list[item].programname = pmInfo.programName;
                    list[item].category = pmInfo.category;
                    list[item].playurl = pmInfo.playURL;
                }
                return Promise.mapSeries(list, function (item, index) {
                    var domainTask = {};
                    var conditions = {
                        domaincode: item.domaincode,
                        seriescode: item.seriescode,
                        programcode: item.programcode,
                        moviecode: item.moviecode
                    };
                    if (!item.actiontype) {
                        item.actiontype = 1;
                    }
                    if (item.actiontype == 1) {
                        item.createtime = new Date();
                        item.updatetime = new Date();
                    } else {
                        item, updatetime = new Date();
                    }
                    item.status = 0;
                    item.interfaceurl = conf.domainTaskUrl;
                    item.orderfilepath = conf.domainCallbackUrl + item.domaincode + "/" + item.actiontype + "/" + item.seriescode + "/" + item.programcode + "/" + item.moviecode;
                    item.status = 0;
                    domainTask = tools.deepCopy(item);
                    return JobEnterDatabase.prototype.upsertDomainTask(conditions, domainTask).then(function (domaintask) {
                        return domaintask;
                    });
                }).then(function (result) {
                    resolve(result);
                }).catch(function (err) {
                    reject(err);
                })
            })
        }
    });
}
JobEnterDatabase.prototype.updateSPMCode = function (obj) {
    return new Promise(function (resolve, reject) {
        SPMCode.findByIdAndUpdate(obj.id, {$set: {status: obj.status}}, function (err, spmCode) {
            if (err) {
                reject(err)
            } else {
                resolve(spmCode);
            }
        })
    })
}
JobEnterDatabase.prototype.updateDomainTask = function (obj) {
    return new Promise(function (resolve, reject) {
        return domainTask.findByIdAndUpdate(obj.id, {$set: {status: obj.status}}, function (err, domaintask) {
            if (err) {
                reject(err);
            } else {
                resolve(domaintask);
            }
        });
    })
}
JobEnterDatabase.prototype.upsertCpsSeries = function (seriesObj) {
    var where = {cpcontentid: seriesObj.cpcontentid};
    return new Promise(function (resolve, reject) {
        return unirest.get(encodeURI(conf.strongLoopApi + "Series/findOne?filter=" + JSON.stringify({where: where}))).pool(conf.poolOption)
            .end(function (res) {
                if (res.status == 200) {
                    delete seriesObj["createtime"];
                }
                return unirest.post(encodeURI(conf.strongLoopApi + "Series/upsertWithWhere?where=" + JSON.stringify(where)))
                    .pool(conf.poolOption)
                    .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                    .send(seriesObj)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            resp.cpcontentid = seriesObj.cpcontentid;
                            resolve(resp.body);
                        } else {
                            console.error(resp.body.error);
                            reject({Error: "upsert cpsSeries failed at " + new Date()});
                        }
                    })
            })
    })
}
JobEnterDatabase.prototype.upsertCpsProgram = function (programObj) {
    var where = {cpcontentid: programObj.cpcontentid};
    return new Promise(function (resolve, reject) {
        return unirest.get(encodeURI(conf.strongLoopApi + "Programs/findOne?filter=" + JSON.stringify({where: where}))).pool(conf.poolOption)
            .end(function (res) {
                if (res.status == 200) {
                    delete programObj["createtime"];
                }
                return unirest.post(encodeURI(conf.strongLoopApi + "Programs/upsertWithWhere?where=" + JSON.stringify(where)))
                    .pool(conf.poolOption)
                    .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                    .send(programObj)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            resolve(resp.body);
                        } else {
                            console.error(resp.body.error);
                            reject({Error: "upsert cpsProgram failed at " + new Date()});
                        }
                    })
            })
    })
}
JobEnterDatabase.prototype.upsertCpsMovie = function (movieObj) {
    var where = {fileid: movieObj.fileid};
    return new Promise(function (resolve, reject) {
        return unirest.get(encodeURI(conf.strongLoopApi + "Movies/findOne?filter=" + JSON.stringify({where: where}))).pool(conf.poolOption)
            .end(function (res) {
                if (res.status == 200) {
                    delete movieObj["createtime"];
                }
                return unirest.post(encodeURI(conf.strongLoopApi + "Movies/upsertWithWhere?where=" + JSON.stringify(where)))
                    .pool(conf.poolOption)
                    .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                    .send(movieObj)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            resolve(resp.body);
                        } else {
                            console.error(resp.body.error);
                            reject({Error: "upsert movie failed at " + new Date()});
                        }
                    })
            })
    })
}
JobEnterDatabase.prototype.findAndUpdateUnifiedseries = function (unifiedObj, item) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var filter = {};
        filter.where = {
            code: item.unifiedseriescode
        };
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedseries/findOne?filter=" + JSON.stringify(filter)))
            .pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    var series = tools.deleteEmptyProperty(transformObject.filterSeries(unifiedObj));//获取series信息
                    //不更新cpcontentid
                    delete series["cpcontentid"];
                    var unifiedSeries = tools.filterUnifiedObject(resp.body, series);//获取主媒资中与series键相同的value
                    var seriesString = hasher.GetMD5(JSON.stringify(series));//计算series md5值
                    var unifiedSeriesString = hasher.GetMD5(JSON.stringify(unifiedSeries));//计算 unifiedSeries md5值
                    if (seriesString == unifiedSeriesString) {
                        console.log("need not update us");
                        reback.code = 200;
                        reback.data = item;
                        reback.message = "unifiedseries " + item.cpcontentid + " need not update  at " + new Date();
                        console.log(reback.message);
                        resolve(reback);
                    } else {
                        console.log("need update us");
                        series.updatetime = new Date();
                        unirest.post(encodeURI(conf.strongLoopApi + "Unifiedseries/update?where=" + JSON.stringify(filter.where)))
                            .pool(conf.poolOption)
                            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                            .send(series)
                            .end(function (updateResp) {
                                if (updateResp.status == 200) {
                                    reback.code = 200;
                                    reback.data = item;
                                    reback.message = "unifiedseries " + item.cpcontentid + " update success at " + new Date();
                                    console.log(reback.message);
                                    resolve(reback);
                                } else {
                                    reback.code = updateResp.status;
                                    reback.data = updateResp.body.error;
                                    reback.message = "unifiedseries " + item.cpcontentid + " update failed at " + new Date();
                                    reject(reback);
                                }
                            })
                    }
                } else {
                    reback.code = resp.statusCode;
                    reback.data = resp.body.error;
                    reback.message = item.cpcontentid + " not find error us at " + new Date();
                    console.log(reback.message)
                    reject(reback);
                }
            })
    })
}
JobEnterDatabase.prototype.updateSPMAlertRecords = function (where, values) {
    return new Promise(function (resolve, reject) {
        spm_alert_record.update(values, where).then(function (result) {
            resolve(result)
        }).catch(function (err) {
            reject(err);
        })
    })
}
module.exports = JobEnterDatabase;
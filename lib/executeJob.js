/**
 * Created by lichenchen on 2017/4/1.
 */
var fs = require("fs");
var Promise = require("bluebird");
var unirest = require("unirest");
var readline = require('readline');
var parseString = require('xml2js').parseString;
var conf = require("../conf/config");
var TransformObject = require("./transformObject");
var transformObject = new TransformObject();
var SearchDatabase = require("./searchDatabase");
var searchDatabase = new SearchDatabase();
var Enums = require("./enums");
var enums = new Enums();
var Tools = require("./tools");
var tools = new Tools();
var JobEnterDatabase = require("./jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
var DealFile = require("./dealFile");
var dealFile = new DealFile();
var poolOption = conf.poolOption;

var ExecuteJob = function executeJob() {
}
ExecuteJob.prototype.executeJobShowid = function (showid, datasources, update) {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Series/findOne?filter[where][cpcontentid]=" + enums.DataSources[datasources] + showid))
        req.pool(poolOption);
        req.end(function (resp) {
            if (resp.status != 200) {
                req = unirest.get(conf.youkuOpenApi.series_prefix + showid);
                req.pool(poolOption);
                req.end(function (res) {
                    if (res.status != 200) {
                        reject({Error: "get page " + conf.youkuOpenApi.series_prefix + showid + " error at " + new Date()})
                    } else {
                        if (typeof(res.body.id) != "undefined" && res.body.id != null) {
                            if (res.body.state == "normal") {
                                var seriesObj = transformObject.transShowinfo(res.body, update)
                                seriesObj.flag = false;
                                return resolve(seriesObj);
                            } else {
                                return reject({Error: showid + " state is " + res.body.state + " at " + new Date()})
                            }
                        } else {
                            return reject({Error: "get series info " + showid + "error at " + new Date()})
                        }
                    }

                })
            } else {
                resp.body.flag = true;
                resolve(resp.body);
            }
        })
    });
}
ExecuteJob.prototype.executeJobVid = function (series, vid, datasources, update) {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Programs/findOne?filter[where][cpcontentid]=" + enums.DataSources[datasources] + vid));
        req.pool(poolOption);
        req.end(function (resp) {
            if (resp.status != 200) {
                req = unirest.get(encodeURI(conf.youkuOpenApi.program_prefix + vid));
                req.pool(poolOption);
                req.end(function (res) {
                    if (res.status != 200) {
                        reject({Error: "get page " + conf.youkuOpenApi.program_prefix + vid + " error at " + new Date()})
                    } else {
                        if (res.body.id == null || typeof(res.body.id) == "undefined") {
                            reject({Error: "get program info " + vid + "error at " + new Date()})
                        } else {
                            if (res.body.state == "normal") {
                                var programObj = transformObject.transProgram(res.body, series, update);
                                programObj.flag = false;
                                return resolve(programObj);
                            } else {
                                return reject({Error: vid + " state is " + res.body.state + " at " + new Date()})
                            }
                        }
                    }
                })
            } else {
                resp.body.flag = true;
                resolve(resp.body);
            }

        });
    });

}
ExecuteJob.prototype.executeJobVidByVid = function (vid) {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(encodeURI(conf.youkuOpenApi.program_prefix + vid));
        req.pool(poolOption);
        req.end(function (res) {
            if (res.status != 200) {
                reject({Error: "get page " + conf.youkuOpenApi.program_prefix + vid + " error at " + new Date()})
            } else {
                if (res.body.state == "normal") {
                    var programObj = res.body;
                    return resolve(programObj);
                } else {
                    return reject({Error: vid + " state is " + res.body.state + " at " + new Date()})
                }
            }
        })
    });
}
ExecuteJob.prototype.executeJobSeriesProgram = function (series, program, datasources, update) {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(conf.strongLoopApi + "Programs/findOne?filter[where][cpcontentid]=" + enums.DataSources[datasources] + program.id);
        req.pool(poolOption);
        req.end(function (resp) {
            if (resp.status != 200) {
                var programObj = transformObject.transProgram(program, series, update);
                programObj.flag = false;
                resolve(programObj);
            } else {
                resp.body.flag = true;
                resolve(resp.body);
            }
        })
    })
}
ExecuteJob.prototype.executeJobVidByShowid = function (series, priority) {
    return new Promise(function (resolve, reject) {
        var showid = series.cpcontentid.split("_")[1];
        var req = unirest.get(encodeURI(conf.youkuOpenApi.series_programs_prefix + showid));
        req.pool(poolOption);
        req.end(function (resp) {
            if (resp.status != 200) {
                reject({Error: "get page " + conf.youkuOpenApi.series_programs_prefix + showid + " error at " + new Date()})
            } else {
                var vlist = [];
                var jsonObj = resp.body;
                var totalCount = jsonObj.total;
                if (jsonObj.videos && (jsonObj.videos instanceof Array)) {

                    jsonObj.videos.forEach(function (item, index) {
                        vlist.push({showid: showid, vid: item.id, priority: priority});
                    })
                    if (vlist.length == totalCount) {
                        resolve(vlist);
                    } else {
                        reject({Error: showid + " vlist not equal total at " + new Date()})
                    }
                } else {
                    reject({Error: showid + " vlist not an array at " + new Date()})
                }
            }

        });
    });
}
ExecuteJob.prototype.executeJobMovie = function (program, type, update) {
    return new Promise(function (resolve, reject) {
        if (program) {
            var req = unirest.get(encodeURI(conf.strongLoopApi + "Movies/findOne?filter[where][cpcontentid]=" + program.cpcontentid + "&filter[where][type]=" + type));
            req.pool(poolOption);
            req.end(function (resp) {
                if (resp.status != 200) {
                    var movieObj = transformObject.transMovie(program, type, update);
                    movieObj.flag = false;
                    resolve(movieObj);

                } else {
                    resp.body.flag = true;
                    resolve(resp.body);
                }
            });
        } else {
            reject({Error: "program is null"});
        }
    });
}
ExecuteJob.prototype.executeJobMedia = function (filePath, movieType) {
    return new Promise(function (resolve, reject) {
        var req = unirest.post(encodeURI(conf.mediaInfoUrl))
            .pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send({file_name: conf.filepathPrefix + filePath})
            .end(function (res) {
                if (res.status != 200) {
                    reject({Error: "get page " + conf.mediaInfoUrl + conf.filepathPrefix + filePath + " Error " + res.statusCode + " at " + new Date()});
                } else {
                    if (res.body.status != 0) {
                        reject({Error: res.body.detail + " at " + new Date()})
                    } else {
                        if (res.body.file_info) {
                            var xml = res.body.file_info;
                            parseString(xml, {
                                explicitArray: false,
                                normalizeTags: false,
                                ignoreAttrs: false,
                                trim: true,
                                mergeAttrs: true
                            }, function (err, result) {
                                if (result.mediainfo) {
                                    if (result.mediainfo.file) {
                                        if (result.mediainfo.file.track) {
                                            var movie = {};
                                            var track = result.mediainfo.file.track;
                                            var flag = true;
                                            if (track instanceof Array) {
                                                console.log("track is array at " + new Date());
                                                for (var item in track) {
                                                    if (track[item].type) {
                                                        if (track[item].type === "General") {
                                                            movie = transformObject.treatGeneral(track[item], movie, movieType)
                                                        } else if (track[item].type === "Video") {
                                                            movie = transformObject.treatVideo(track[item], movie, movieType)
                                                        } else if (track[item].type === "Audio") {
                                                            movie = transformObject.treatAudio(track[item], movie, movieType);
                                                        }

                                                    } else {
                                                        flag = false;
                                                        break;
                                                    }

                                                }
                                            } else {
                                                console.log("track is object at " + new Date())
                                                if (track.type === "General") {
                                                    movie = transformObject.treatGeneral(track, movie, movieType)
                                                } else if (track.type === "Video") {
                                                    movie = transformObject.treatVideo(track, movie, movieType)
                                                } else if (track.type === "Audio") {
                                                    movie = transformObject.treatAudio(track, movie, movieType);
                                                } else {
                                                    flag = false;
                                                }
                                            }
                                            if (flag == true) {
                                                movie.updatetime = new Date();
                                                console.log(movie);
                                                resolve(movie);

                                            } else {
                                                reject({Error: filePath + "  file track type is null at " + new Date()})
                                            }

                                        } else {
                                            reject({Error: filePath + " track is null"});
                                        }
                                    } else {
                                        reject({Error: filePath + " file is null"})
                                    }
                                }
                                else {
                                    reject({Error: filePath + " mediainfo is null"});
                                }

                            });
                        }
                        else {
                            reject({Error: filePath + ": file_info is null at " + new Date})
                        }

                    }
                }

            })
        ;
    })
}
ExecuteJob.prototype.executeJobWaitunified = function (seriesObj) {
    return transformObject.transWaitunified(seriesObj);
}
ExecuteJob.prototype.groupUnunifiedmedia = function (cpcontentid, unifiedSeries, ununifiedMedia) {
    return searchDatabase.getUnunifiedmediaByFilter({where: {cpcontentid: cpcontentid}}).then(function (unifiedmediaResult) {
        if (unifiedmediaResult.code == 200) {
            if (unifiedmediaResult.data.status == 1) {
                return new Promise(function (resolve, reject) {
                    resolve(unifiedmediaResult);
                })
            } else {
                return searchDatabase.getUnifiedSeriesByFilter({where: {cpcontentid: cpcontentid}}).then(function (unifiedseriesResult) {
                    if (unifiedseriesResult.code == 200) {
                        var reback = {};
                        return new Promise(function (resolve, reject) {
                            var series = tools.deleteEmptyProperty(transformObject.filterSeries(unifiedSeries));
                            delete series["cpcontentid"];
                            var unifiedSeriesObj = tools.filterUnifiedObject(unifiedseriesResult.data, series);//获取主媒资中与series键相同的value
                            if (JSON.stringify(series) == JSON.stringify(unifiedSeriesObj)) {
                                console.log("need not update us");
                                reback.code = 204;
                                reback.data = unifiedseriesResult.data;
                                reback.message = "unifiedseries " + cpcontentid + " need not update  at " + new Date();
                                resolve(reback);
                            } else {
                                series.updatetime = new Date();
                                console.log(series);
                                unirest.post(encodeURI(conf.strongLoopApi + "Unifiedseries/update?where=" + JSON.stringify({cpcontentid: cpcontentid})))
                                    .pool(conf.poolOption)
                                    .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                                    .send(series)
                                    .end(function (updateResp) {
                                        if (updateResp.status == 200) {
                                            reback.code = 200;
                                            reback.data = updateResp.body.count;
                                            reback.message = "unifiedseries " + cpcontentid + " update success at " + new Date();
                                            console.log(reback.message);
                                            resolve(reback);
                                        } else {
                                            reback.code = updateResp.status;
                                            reback.data = updateResp.body.error;
                                            reback.message = "unifiedseries " + cpcontentid + " update failed at " + new Date();
                                            reject(reback);
                                        }
                                    })
                            }
                        }).then(function (updateResult) {
                            if (updateResult.code == 200) {
                                console.log("uss need update at " + new Date());
                                return searchDatabase.getUnifiedseriesseriesByFilter({where: {cpcontentid: cpcontentid}}).then(function (unifiedseriesseriesResult) {
                                    console.log("unifiedseriesseriesResult:");
                                    console.log(unifiedseriesseriesResult);
                                    return jobEnterDatabase.upsertUnifiedseriesseries({
                                        unifiedseriescode: unifiedseriesseriesResult.data.unifiedseriescode,
                                        cpcontentid: cpcontentid,
                                        isunified: 0
                                    })
                                })
                            } else {
                                console.log("uss need not update at " + new Date());
                                return new Promise(function (resolve, reject) {
                                    resolve(updateResult);
                                })
                            }
                        })
                    } else {
                        return searchDatabase.getUnifiedseriesseriesByFilter({where: {cpcontentid: cpcontentid}}).then(function (unifiedseriesseriesResult) {
                            console.log("unifiedseriesseriesResult:");
                            console.log(unifiedseriesseriesResult);
                            return jobEnterDatabase.upsertUnifiedseriesseries({
                                unifiedseriescode: unifiedseriesseriesResult.data.unifiedseriescode,
                                cpcontentid: cpcontentid,
                                isunified: 0
                            })
                        })
                    }
                })
            }
        } else {
            ununifiedMedia.status = 1;
            return jobEnterDatabase.insertUnunifiedmedia(ununifiedMedia);
        }
    })
}
ExecuteJob.prototype.groupSeries = function (cpcontentid, series) {
    //没有匹配到敏感词，是主媒资不和其他媒资聚合
    if (series.data.contentproviders && series.data.contentproviders.isunified === 0 && series.data.contentproviders.ismainmedia === 1) {
        //创建主媒资
        delete series.data["contentproviders"];
        var unifiedSeries = transformObject.transUnifiedseries(series.data);
        return jobEnterDatabase.upsertUnifiedseries(unifiedSeries).then(function (unifiedseriesResult) {
            //创建关联关系
            return jobEnterDatabase.upsertUnifiedseriesseries({
                unifiedseriescode: unifiedseriesResult.data.code,
                cpcontentid: unifiedseriesResult.data.cpcontentid,
                cpcode: unifiedseriesResult.data.srccpcode,
                status: 1,
                isunified: 0
            });
        });

    } else if (series.data.contentproviders && series.data.contentproviders.isunified === 1 && series.data.contentproviders.ismainmedia === 1) {
        console.log("isunified ismainmedia ");
        //没有匹配到敏感词，是主媒资和其他来源聚合
        delete series.data["contentproviders"];
        var unifiedSeries = transformObject.transUnifiedseries(series.data);
        //匹配主媒资
        return searchDatabase.matchUnifiedSeries(series.data).then(function (matchResult) {
            console.log("matchResult is:");
            console.log(matchResult);
            if (matchResult.code == 200) {
                //匹配到主媒资，创建关联关系
                return Promise.mapSeries(matchResult.data, function (item, index) {
                    //如果cp和主媒资相同，更新主媒资，创建关联关系
                    if (item.status == 1) {
                        //更新主媒资
                        return jobEnterDatabase.findAndUpdateUnifiedseries(unifiedSeries, item).then(function (updateUnifiedseries) {
                            //创建关联关系
                            return jobEnterDatabase.upsertUnifiedseriesseries(updateUnifiedseries.data);
                        })
                    } else {
                        //cp和主媒资不同，创建关联关系
                        return jobEnterDatabase.upsertUnifiedseriesseries(item);
                    }
                })
            } else if (matchResult.code == 404) {
                //没有匹配到主媒资，创建主媒资
                return jobEnterDatabase.upsertUnifiedseries(unifiedSeries).then(function (unifiedseriesResult) {
                    //创建关联关系
                    return jobEnterDatabase.upsertUnifiedseriesseries({
                        unifiedseriescode: unifiedseriesResult.data.code,
                        cpcontentid: unifiedseriesResult.data.cpcontentid,
                        cpcode: unifiedseriesResult.data.srccpcode,
                        status: 1,
                        isunified: 0
                    });
                });

            } else {
                //匹配返回异常，插入带聚合表中
                return jobEnterDatabase.upsertUnunifiedmedia({
                    cpcontentid: cpcontentid,
                    contenttype: enums.MediaType.SERIES.value
                })
            }
        })
    } else if (series.data.contentproviders && series.data.contentproviders.isunified === 1 && series.data.contentproviders.ismainmedia === 0) {
        //不是主媒资和其他媒资聚合
        delete series.data["contentproviders"];
        var unifiedSeries = transformObject.transUnifiedseries(series.data);
        //匹配主媒资
        return searchDatabase.matchUnifiedSeries(series.data).then(function (matchResult) {
            console.log(matchResult);
            if (matchResult.code == 200) {
                //成功匹配主媒资，创建关联关系
                return Promise.mapSeries(matchResult.data, function (item, index) {
                    return jobEnterDatabase.upsertUnifiedseriesseries(item);
                })
            } else {
                //匹配失败，插入手动待聚合
                return ExecuteJob.prototype.groupUnunifiedmedia(cpcontentid, unifiedSeries, matchResult.data);
            }
        });
    } else {
        //既不是主媒资又不和其他媒资，插入手动待聚合
        delete series.data["contentproviders"];
        var unifiedSeries = transformObject.transUnifiedseries(series.data);
        return ExecuteJob.prototype.groupUnunifiedmedia(cpcontentid, unifiedSeries, {
            cpcontentid: cpcontentid,
            contenttype: enums.MediaType.SERIES.value
        });
    }
}
//节目集聚合任务
ExecuteJob.prototype.executeJobUnifiedseries = function (cpcontentid, keywords) {
    var filter = {
        where: {cpcontentid: cpcontentid, isdelete: 0},
        include: {
            relation: "contentproviders",
            scope: {where: {validstarttime: {lte: new Date()}, validendtime: {gte: new Date()}}}
        }
    };
    //查询联合查询series cp，查询敏感词列表
    return Promise.join(searchDatabase.getSeriesByFilter(filter), searchDatabase.getSensitivewords(keywords), function (series, sensitiveWords) {
        if (sensitiveWords.code == 404) {
            return ExecuteJob.prototype.groupSeries(cpcontentid, series);
        } else if (sensitiveWords.code == 200) {
            //包含敏感词,判断是否在sensitiveseries中存在
            return searchDatabase.getSensitivewordsseriesByFilter({where: {cpcontentid: series.data.cpcontentid}}).then(function (sensitivewordsserieResult) {
                if (sensitivewordsserieResult.code == 200) {
                    if (sensitivewordsserieResult.data.status != -1) {
                        return new Promise(function (resolve, reject) {
                            sensitivewordsserieResult.code = 204;
                            resolve(sensitivewordsserieResult);
                        })
                    } else {
                        return ExecuteJob.prototype.groupSeries(cpcontentid, series);
                    }
                } else {
                    return jobEnterDatabase.insertSensitiveseries({
                        cpcontentid: series.data.cpcontentid,
                        sensitivewords: sensitiveWords.data,
                        status: 1
                    })
                }
            })
        } else {
            //匹配敏感词失败，抛出异常
            return new Promise(function (resolve, reject) {
                console.log("match sensitive words inner error at " + new Date())
                reject(sensitiveWords);
            })
        }
    })

}
ExecuteJob.prototype.groupProgram = function (item) {
    var unifiedProgram = transformObject.transUnifiedprogram(item.data, item.usInfo);
    if (item.usInfo.srccpcode == unifiedProgram.srccpcode) {
        unifiedProgram.ismain = true;
    } else {
        unifiedProgram.ismain = false;
    }
    //查upp判断是否已聚合
    return searchDatabase.getUnifiedProgramprogram(item.data.cpcontentid).then(function (uppResult) {
        if (uppResult.code == 200) {
            console.log("upp  exists");
            //聚合返回
            return jobEnterDatabase.upsertUnifiedprogramByFilter(unifiedProgram, {where: {code: uppResult.data.unifiedprogramcode}})
        } else {
            console.log("upp not exists");
            //判断up中uscode和volumn是否存在
            return jobEnterDatabase.upsertUnifiedprogramByFilter(unifiedProgram, {
                where: {
                    unifiedseriescode: unifiedProgram.unifiedseriescode,
                    volumncount: unifiedProgram.volumncount,
                    movietype1: unifiedProgram.movietype1
                }
            }).then(function (matchUnifiedprogramResult) {
                return jobEnterDatabase.upsertUnifiedprogramprogram({
                    cpcontentid: item.data.cpcontentid,
                    unifiedprogramcode: matchUnifiedprogramResult.data.code
                }).then(function (unifiedprogramprogramObj) {
                    //将聚合失败的movie 重置为待聚合
                    return jobEnterDatabase.updateMovieByCpcontentid({
                        cpcontentid: unifiedprogramprogramObj.data.cpcontentid,
                        isunified: -1
                    }, {isunified: 0, updatetime: new Date()});
                })
            })
        }
    })
}
//节目聚合任务
ExecuteJob.prototype.executeJobUnifiedprograms = function (unifiedseriescode, cpcontentid) {
    var filter = {
        where: {unifiedseriescode: unifiedseriescode, cpcontentid: cpcontentid},
        include: ["unifiedseries", {relation: "programs", scope: {where: {isdelete: 0}}}]
    };
    //联合查询主媒资节目集信息、该条节目集下所有节目信息
    return searchDatabase.getUnifiedseriesseriesByFilter(filter).then(function (uspResult) {
        var programList = uspResult.data.programs;
        var unifiedSeries = uspResult.data.unifiedseries;
        //遍历节目信息是否包含敏感词
        return Promise.mapSeries(programList, function (item, index) {
            if ((item.volumncount && item.volumncount != 0) || item.videotype == 7) {
                //如果是综艺，判断敏感词
                if (item.programtype == "综艺") {
                    //综艺敏感词判断
                    var keywords = [];
                    if (item.name) {
                        keywords.push(item.name);
                    }
                    if (item.actordisplay) {
                        keywords.push(item.actordisplay);
                    }
                    if (item.writerdisplay) {
                        keywords.push(item.writerdisplay);
                    }
                    if (item.compere) {
                        keywords.push(item.compere)
                    }
                    if (item.guest) {
                        keywords.push(item.guest)
                    }
                    return searchDatabase.getSensitivewords(keywords).then(function (sensitiveResult) {
                        if (sensitiveResult.code == 200) {
                            //包含敏感词
                            return {
                                dealType: 0,
                                data: {sensitivewords: sensitiveResult.data, cpcontentid: item.cpcontentid}
                            }
                        } else {
                            //不包含敏感词
                            return {dealType: 1, data: item, usInfo: unifiedSeries}
                        }
                    })
                } else {
                    //节目不为综艺
                    return {dealType: 1, data: item, usInfo: unifiedSeries}
                }
            } else {
                //集数不存,分类不聚合在插入手动聚合表
                return searchDatabase.getUnunifiedmediaByFilter({
                    where: {
                        cpcontentid: cpcontentid,
                        contenttype: enums.MediaType.PROGRAM.value
                    }
                }).then(function (ununifiedmediaResult) {
                    if (ununifiedmediaResult.code == 200) {
                        return {dealType: -1, data: item, usInfo: unifiedSeries};
                    } else {
                        return jobEnterDatabase.insertUnunifiedmedia({
                            cpcontentid: item.cpcontentid,
                            contenttype: enums.MediaType.PROGRAM.value,
                            status: 1
                        }).then(function (unununifiedmedia) {
                            return {dealType: -1, data: item, usInfo: unifiedSeries};
                        })
                    }
                })
            }
        })
    }).then(function (resultList) {
        //遍历匹配结果
        return Promise.mapSeries(resultList, function (item, index) {
            //集数不存在
            if (item.dealType == -1) {
                return item;
            }
            //判断是否包含敏感词
            else if (item.dealType == 0) {
                //包含进入节目敏感词列表
                return searchDatabase.getSensitivewordsprogramByFilter({where: {cpcontentid: item.data.cpcontentid}}).then(function (sensitivewordsprogramResult) {
                    if (sensitivewordsprogramResult.code == 200) {
                        if (sensitivewordsprogramResult.data.status == 1) {
                            return sensitivewordsprogramResult;
                        } else {
                            return ExecuteJob.prototype.groupProgram(item);
                        }
                    } else {
                        item.data.status = 1;
                        return jobEnterDatabase.insertSensitiveprogram(item.data);
                    }
                })
            } else {
                return ExecuteJob.prototype.groupProgram(item);
            }
        })
    });
}
ExecuteJob.prototype.executeJobDownloadPicture = function (cpcontentid, pictures, type, tempPrefix, desPrefix) {
    //下载每张不为空的picture
    return Promise.mapSeries(tools.clearNullArr(pictures), function (item, index) {
        //判断临时目录是否存在，不存在则创建；下载临时文件
        return tools.existsFile(tempPrefix).then(function (isExists) {
            if (isExists.code == 200) {
                //下载临时文件
                return dealFile.downloadPic(item.from, type, tempPrefix, item.to);
            } else {
                //创建临时目录
                return tools.createMkdir(tempPrefix).then(function (isCreate) {
                    //下载临时文件
                    return dealFile.downloadPic(item.from, type, tempPrefix, item.to)
                });
            }
        })

    }).then(function (array) {
        return Promise.map(array, function (item, index) {
            //创建目标目录，转移文件
            return dealFile.createDestPath(item.data.tempFile, item.data.fileName, item.data.suffix, desPrefix).then(function (fileInfo) {
                return tools.renameFile(fileInfo.data.tempFile, fileInfo.data.fullPath);
            }).then(function (renameInfo) {
                renameInfo.fieldName = item.data.fieldName;
                console.log(renameInfo);
                return renameInfo;
            })
        }).then(function (results) {
            //拼接更新对象
            var unifiedSeries = {cpcontentid: cpcontentid, picdownloadstatus: 1}
            results.forEach(function (item, index, input) {
                unifiedSeries[item.fieldName] = item.data;
            })
            return unifiedSeries;
        })
    })

}
// ExecuteJob.prototype.executeJobImportMedia = function (id, name, cpcode, cpname, filepath, priority) {
//     console.log(conf.importBaseFilepath + filepath);
//     return dealFile.transExcelToArray(conf.importBaseFilepath + filepath).then(function (result) {
//         var total = result.length;//读入总条数
//         console.log(id + " read total count " + total)
//         return Promise.mapSeries(result, function (item, index) {
//             var importMediaDetail = transformObject.formatImportDetail(item, id, name, cpcode, cpname, priority);
//             if (importMediaDetail.err != null) {
//                 return new Promise(function (resolve, reject) {
//                     var errInfo = "索引  " + index;
//                     if (importMediaDetail.programname) {
//                         errInfo += " 节目 " + importMediaDetail.programname + " ";
//                     }
//                     errInfo += importMediaDetail.err.join('|');
//                     reject({Error: errInfo + " at " + new Date()})
//                 })
//             } else {
//                 return jobEnterDatabase.upsertImportMediaDetail(importMediaDetail);
//             }
//         }).catch(function (err) {
//             if (err.Error) {
//                 err.total = total;
//             }
//             return new Promise(function (resolve, reject) {
//                 reject(err);
//             })
//         })
//     })
// }
ExecuteJob.prototype.parseImportMedia = function (id, name, cpcode, cpname, priority, prefix, relativePath) {
    return new Promise(function (resolve, reject) {
        var sourcePath = prefix + relativePath;
        var fileName = sourcePath.replace(/(.*\/)*([^.]+).*/ig, "$2");
        var fileExt = sourcePath.replace(/.+\./, "");
        var index = sourcePath.lastIndexOf("\/");
        var filePath = sourcePath.substring(0, index + 1);
        var index2 = relativePath.lastIndexOf("\/");
        var filePath2 = relativePath.substring(0, index2 + 1);
        console.log("filePath is :")
        console.log(filePath);
        try {
            fs.exists(sourcePath, function (exists) {
                if (exists) {
                    var rl = readline.createInterface({
                        input: fs.createReadStream(sourcePath),
                    });
                    var destPath = filePath + fileName + "_log" + "." + fileExt;
                    var excuteLog = filePath2 + fileName + "_log" + "." + fileExt;
                    var writeStream = fs.createWriteStream(destPath);
                    var temp = 0;
                    var total = 0;
                    var success = 0;
                    var failed = 0;
                    var count = 0;
                    rl.on('line', function (line) {
                        rl.pause();
                        if (line != null && typeof(line) != "undefined" && line != "") {
                            temp++;
                            var importMediaArr = line.split("\t");
                            var importMediaDetail = transformObject.transImportMedia(importMediaArr);
                            if (importMediaDetail.err) {
                                console.log("error")
                                failed++;
                                var content = importMediaArr.concat(importMediaDetail.err).join("\t");
                                return writeStream.write(content + "\n", function () {
                                        count = success + failed;
                                        if (total != 0 && total == count) {
                                            console.log("parse finish");
                                            rl.close();
                                            writeStream.close();
                                            resolve({total: total, success: success, failed: failed, executeLog: excuteLog})
                                        } else {
                                            console.log("continue readline");
                                            rl.resume();
                                        }
                                    }
                                )
                            } else {
                                importMediaDetail.importmediaid = id;
                                importMediaDetail.importmedianame = name;
                                importMediaDetail.cpcode = cpcode;
                                importMediaDetail.cpname = cpname;
                                importMediaDetail.priority = priority;
                                importMediaDetail.status = 0;
                                importMediaDetail.statusdesc = "待解析";
                                return jobEnterDatabase.upsertImportMediaDetail(importMediaDetail).then(function (data) {
                                    success++;
                                    writeStream.write(line + "\n", function () {
                                        count = success + failed;
                                        if (total != 0 && total == count) {
                                            console.log("parse finish");
                                            rl.close();
                                            writeStream.close();
                                            resolve({
                                                total: total,
                                                success: success,
                                                failed: failed,
                                                executeLog: excuteLog
                                            })
                                        } else {
                                            console.log("continue readline");
                                            rl.resume();
                                        }
                                    })
                                }).catch(function (err) {
                                    console.error(err);
                                    failed++;
                                    writeStream.write(line + "\t" + "入库出错", function () {
                                        count = success + failed;
                                        if (total != 0 && total == count) {
                                            console.log("parse finish");
                                            rl.close();
                                            writeStream.close();
                                            resolve({
                                                total: total,
                                                success: success,
                                                failed: failed,
                                                executeLog: excuteLog
                                            })
                                        } else {
                                            console.log("continue readline");
                                            rl.resume();
                                        }
                                    })
                                })
                            }
                        } else {
                            if (total != 0 && total == count) {
                                console.log("parse finish");
                                rl.close();
                                writeStream.close();
                                resolve({total: total, success: success, failed: failed, executeLog: excuteLog})
                            } else {
                                console.log("continue readline");
                                rl.resume();
                            }
                        }
                    });
                    rl.on('pause', function () {
                        console.log('Readline paused.');
                    });
                    rl.on("resume", function () {
                        console.log("Readline resume");
                    })
                    rl.on("close", function () {
                        total = temp;
                        if (total == 0) {
                            writeStream.close();
                            reject({Error: "taotal count is 0"})
                        }
                        console.log("Read finish");
                    })
                } else {
                    console.error(sourcePath + " not exsits at " + new Date())
                    reject({Error: sourcePath + " not exists at " + new Date()})
                }
            })
        } catch (e) {
            console.log("catch error at " + new Date())
            reject({Error: "catch error at " + new Date(), data: e})
        }
    })
}
ExecuteJob.prototype.executeJobImportMediaDetail = function (id) {
    return searchDatabase.getImportDetail(id).then(function (importDetail) {
        return new Promise(function (resolve, reject) {
            //判断importDetail字段是否合法
            var detail = transformObject.checkImportDetail(importDetail);
            //合法
            if (detail) {
                if (detail.err && detail.err.length == 0) {
                    resolve(detail.importDetail);
                } else {
                    var errInfo = "";
                    if (importDetail.programname) {
                        errInfo += importDetail.programname + " ";
                    }
                    errInfo += detail.err.join("|");
                    console.error(errInfo);
                    reject({Error: errInfo + " at " + new Date()});
                }
                //不合法抛出异常
            } else {
                console.error("importDetail is null at " + new Date());
                reject({Error: "importDetail is null at " + new Date});
            }
        })
    }).then(function (importDetail) {
        return new Promise(function (resolve, reject) {
            //生成series信息
            var series = transformObject.treatSeries(importDetail);
            //生成series成功
            if (series) {
                //节目集入库
                return Promise.props({
                    importDetail: importDetail,
                    series: jobEnterDatabase.importSeries(series)
                }).then(function (seriesResult) {
                    console.log(series.name + " upsert series success at " + new Date())
                    resolve(seriesResult);
                }).catch(function (err) {
                    console.error(series.name + " upsert series failed at " + new Date())
                    console.error(err);
                    reject({Error: series.name + " upsert series failed at " + new Date()});
                })
            } else {
                //生成series失败抛出异常
                reject({Error: "series is null at " + new Date()})
            }
        })

    }).then(function (seriesResult) {
        return new Promise(function (resolve, reject) {
            if (seriesResult.importDetail && seriesResult.series && seriesResult.series.code == 200) {
                //生成program
                var program = transformObject.treatProgram(seriesResult.importDetail, seriesResult.series.data);
                //生成program成功
                if (program) {
                    //更新节目集待聚合waitUnified，program入库
                    return Promise.props({
                        waitUnified: jobEnterDatabase.upsertWaitunified(ExecuteJob.prototype.executeJobWaitunified(seriesResult.series.data)),
                        importDetail: seriesResult.importDetail,
                        program: jobEnterDatabase.importProgram(program)
                    }).then(function (programResult) {
                        if (programResult.waitUnified && programResult.waitUnified.code == 200) {
                            console.log(seriesResult.series.data.cpcontentid + " 进入待聚合任务表成功 at " + new Date())

                        } else {
                            console.error(programResult.program.data.showid + " 进入带聚合任务表失败 at " + new Date())
                        }
                        console.log(program.name + " upsert program success at " + new Date())
                        resolve(programResult);
                    }).catch(function (err) {
                        console.error(program.name + " upsert program failed at " + new Date());
                        console.error(err);
                        reject({Error: program.name + " upsert program failed at " + new Date()});
                    })
                } else {
                    reject({Error: "program is null at " + new Date()});
                }
            } else {
                reject({Error: "seriesResult not format at " + new Date()})
            }
        })
    }).then(function (programResult) {
        return new Promise(function (resolve, reject) {
            if (programResult.importDetail && programResult.program && programResult.program.code == 200) {
                //生成movieList
                var movieList = transformObject.treatMvoie(programResult.importDetail, programResult.program.data);
                //介质存在
                if (movieList.length > 0) {
                    return Promise.mapSeries(movieList, function (item, index) {
                        //成品介质入库
                        if (item.type == enums.MovieType.END_PRODUCT.value) {
                            //查询导入规格
                            return Promise.props({
                                bitRate: searchDatabase.getBitRate(programResult.importDetail.movieformat),
                                movie: item
                            }).then(function (result) {
                                if (result.bitRate.code == 200) {
                                    //导入规格存在，成品介质入库
                                    console.log("get biteRate success ,endProductMovie prepare to enter database at " + new Date());
                                    return jobEnterDatabase.importMovie(result.movie, programResult.importDetail, result.bitRate.data);
                                } else {
                                    //导入规格不存在舍弃该条记录
                                    return new Promise(function (resolve, reject) {
                                        reject({
                                            code: 404,
                                            message: "not find bitRate at " + new Date(),
                                            data: null
                                        });
                                    })
                                }
                            })
                        } else {
                            //原介质入库
                            console.log("primary movie prepare to enter database at " + new Date());
                            return jobEnterDatabase.importMovie(item, programResult.importDetail, null)
                        }
                    }).then(function (data) {
                        console.log(data);
                        resolve(data)
                    }).catch(function (err) {
                        reject({Error: JSON.stringify(err)});
                    })
                } else {
                    //介质不存在抛出异常
                    reject({Error: "movieList length is 0 at " + new Date()})
                }
            } else {
                reject({Error: "programResult not format at " + new Date()})
            }
        })

    })
}
ExecuteJob.prototype.executeJobMoveUnifiedmovie = function (id, code, name, filepath, type, unifiedseriescode, movefilename) {
    var movie = {
        id: id,
        code: code,
        name: name,
        type: type,
        filepath: filepath
    };
    return Promise.props({
        movie: movie,
        series: searchDatabase.getUnifiedseries(unifiedseriescode)
    }).then(function (result) {
        return new Promise(function (resolve, reject) {
            var reback = {};
            var movie = result.movie;
            var series = result.series.data;
            var address = tools.formatMovieAddress(series, movie, movefilename);
            if (address && address != "") {
                var postObj = {
                    id: movie.id,
                    sourceFilePath: movie.filepath,
                    formatFilePath: address,
                    priority: 5,
                    type: 1,
                    callback: conf.movieUnifiedMovieCallback
                }
                unirest.post(conf.moveUnifiedMovieApi)
                    .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                    .send(postObj)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            if (resp.body.code == 0) {
                                reback.code = 200;
                                reback.message = movie.id + " 调用接口返回成功  at " + new Date();
                                reback.data = resp.body;
                                reback.data.id = movie.id;
                                reback.data.movestatus = 1;
                                reback.data.movestatusdesc = "迁移中";
                                reback.data.updatetime = new Date();
                                resolve(reback);
                            } else {
                                reback.code = 500;
                                reback.message = movie.id + " 调用接口返回失败  at  " + new Date();
                                reback.data = {};
                                reback.data.id = movie.id;
                                reback.data.movestatus = -1;
                                reback.data.movestatusdesc = "迁移失败";
                                reback.data.updatetime = new Date();
                                resolve(reback);
                            }

                        } else {
                            reback.code = resp.statusCode;
                            reback.message = "接口调用请求失败 at " + new Date();
                            reback.data = null;
                            reject(reback);
                        }
                    })
            } else {
                reback.code = 500;
                reback.message = "filepath format error at " + new Date();
                reback.data = null;
                reject(reback);
            }
        })
    })
}
ExecuteJob.prototype.executeJobUnifiedmovie = function (item) {
    var filter = {where: {cpcontentid: item.cpcontentid}, include: "unifiedprograms"}
    return searchDatabase.getUnifiedProgramprogramByFilter(filter).then(function (uppResult) {
        if (uppResult.code == 200) {
            if (uppResult.data.unifiedprograms) {
                var unifiedProgram = uppResult.data.unifiedprograms;
                item.unifiedseriescode = unifiedProgram.unifiedseriescode;
                item.unifiedseriescpcontentid = unifiedProgram.unifiedseriescpcontentid;
                item.unifiedprogramcode = unifiedProgram.code;
                item.unifiedprogramcpcontentid = unifiedProgram.cpcontentid;
                return jobEnterDatabase.upserUnifiedmovie(item)
            } else {
                return new Promise(function (resolve, reject) {
                    resolve({code: 404, data: null, message: "unifiedprograms not exists"})
                })
            }
        } else if (uppResult.code == 404) {
            console.log("upp not exists");
            return new Promise(function (resolve, reject) {
                resolve({code: 404, data: null, message: "upp not exists"});
            })
        } else {
            return new Promise(function (resolve, reject) {
                reject(uppResult);
            })
        }
    })
}
ExecuteJob.prototype.executeImportMediaDetailResult = function (importmediaid) {
    var reback = {};
    return searchDatabase.getImportMediaDetailCount({
        importmediaid: importmediaid,
        status: 0
    }).then(function (waitingResult) {
        return new Promise(function (resolve, reject) {
            try {
                if (waitingResult.data == 0) {
                    return Promise.join(searchDatabase.getImportMediaDetailCount({
                        importmediaid: importmediaid,
                        status: 30
                    }), searchDatabase.getImportMediaDetailCount({
                        importmediaid: importmediaid,
                        status: 31
                    }), function (successResult, failedResult) {
                        reback.code = 200;
                        reback.data = {successCount: successResult.data, failedCount: failedResult.data};
                        reback.message = "get count success at " + new Date();
                        resolve(reback);
                    })
                } else {
                    reback.code = 206;
                    reback.message = "waiting count > 0 at " + new Date();
                    reback.data = waitingResult.data;
                    resolve(reback);
                }
            } catch (err) {
                reject(err);
            }
        })
    })
}
ExecuteJob.prototype.executeJobSPMCode = function (obj) {
    return new Promise(function (resolve, reject) {
        console.log(obj);
        console.log(obj.seriescode);
        return searchDatabase.getPackageDomain(obj.seriescode).then(function (list) {
            return jobEnterDatabase.upsertDomainTaskList(list, obj).then(function (domaintaskList) {
                resolve(domaintaskList);
            })
        }).catch(function (err) {
            console.error(err);
            reject(err);
        })
    })
}
ExecuteJob.prototype.executeCpsProgramList = function (programList, vid, series, token) {
    //遍历节目
    return Promise.mapSeries(programList, function (programNumber, index) {
        //获取单条节目信息
        return searchDatabase.getCpsMediaInfo(vid, programNumber, token).then(function (programInfo) {
            var program = transformObject.transCpsProgam(programInfo, series);
            if (program.checkstatus) {
            } else {
                program.checkstatus = 0;
            }
            //单条节目入库
            return jobEnterDatabase.upsertCpsProgram(program).then(function (programResult) {
                var cpsMovieeObjList = programInfo.refthirdvideo;
                //获取介质列表
                var movieList = cpsMovieeObjList.map(function (item, index, input) {
                    return transformObject.transCpsMovie(item, programResult);
                });
                //介质逐条入库
                return Promise.mapSeries(movieList, function (movie, index) {
                    return jobEnterDatabase.upsertCpsMovie(movie);
                }).then(function (movieList) {
                    return movieList;
                })
            })
        })
    }).then(function (programResult) {
        return programResult.length;
    }).catch(function (err) {
        console.error(err);
        throw new Error(err);
    })
}
ExecuteJob.prototype.executeDownloadYOUKUMovie = function (postData) {
    return new Promise(function (resolve, reject) {
        unirest.post(encodeURI(conf.downloadYoukuMovie)).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(postData)
            .end(function (resp) {
                if (resp.status == 200) {
                    console.log(resp.body);
                    resolve(resp.body);
                } else {
                    console.error(resp.body.error);
                    reject(resp.body.error);
                }
            })
    });
}
ExecuteJob.prototype.executeDownloadAPECNMovie = function (postData) {
    return new Promise(function (resolve, reject) {
        unirest.post(encodeURI(conf.downloadAPECNMovie)).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(postData)
            .end(function (resp) {
                if (resp.status == 200) {
                    console.log(resp.body);
                    resolve(resp.body);
                } else {
                    console.error(resp.body.error);
                    reject(resp.body.error);
                }
            })
    })
}
ExecuteJob.prototype.parseCPSXml = function (xmlurl) {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(xmlurl).pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status != 200) {
                    reject({Error: "get " + xmlurl + " error ,http status is " + resp.status + " at " + new Date()})
                } else {
                    var xml = resp.body;
                    parseString(xml, {
                        explicitArray: false,
                        normalizeTags: true,
                        ignoreAttrs: false,
                        trim: true,
                        mergeAttrs: true
                    }, function (err, result) {
                        if (err) {
                            reject({Error: JSON.stringify(err) + " at " + new Date()})
                        } else {
                            var objects = result.adi.objects.object;
                            var mappings = result.adi.mappings.mapping;
                            if (objects && mappings) {
                                var series = {};
                                var program = {};
                                var movie = {};
                                var picture = [];
                                for (var i in objects) {
                                    if (objects[i].ElementType == "Series") {
                                        series = tools.getCpsObj(objects[i].property);
                                        series.cpcontentid = series.contentprovider + "_" + objects[i].Code;
                                        series.cpcode = series.contentprovider;
                                        // series.update = mappings[i].Action;
                                    } else if (objects[i].ElementType == "Program") {
                                        program = tools.getCpsObj(objects[i].property);
                                        program.cpcontentid = program.contentprovider + "_" + objects[i].Code;
                                        program.cpcode = program.contentprovider;
                                        // program.update = mappings[i].Action;
                                    } else if (objects[i].ElementType == "Movie") {
                                        movie = tools.getCpsObj(objects[i].property)
                                        movie.fileid = objects[i].Code;
                                        // movie.update = mappings[i].Action;
                                    } else if (objects[i].ElementType == "Picture") {
                                        var item = tools.getCpsObj(objects[i].property);
                                        item.code = objects[i].Code;
                                        picture.push(item);
                                    } else {
                                        console.log("not in mediaInfo")
                                    }

                                }
                                var seriesPictureArr = [];
                                var programPictureArr = [];
                                for (var i in mappings) {
                                    if (mappings[i].ElementType == "Program" && mappings[i].ParentType == "Series") {
                                        program.showid = series.contentprovider + "_" + mappings[i].ParentCode;
                                    } else if (mappings[i].ElementType == "Movie" && mappings[i].ParentType == "Program") {
                                        movie.cpcontentid = program.contentprovider + "_" + mappings[i].ParentCode;
                                        movie.filepath = movie.targetfilepath;
                                    } else if (mappings[i].ElementType == "Series" && mappings[i].ParentType == "Picture") {
                                        for (var j in picture) {
                                            if (picture[j].code == mappings[i].ParentCode) {
                                                seriesPictureArr.push(conf.ott_images_prefix + picture[j].fileurl)
                                            }
                                        }
                                    } else if (mappings[i].ElementType = "Program" && mappings[i].ParentType == "Picture") {
                                        for (var j in picture) {
                                            if (picture[j].code == mappings[i].ParentCode) {
                                                programPictureArr.push(conf.ott_images_prefix + picture[j].fileurl)
                                            }
                                        }
                                    }
                                }
                                for (var i in  seriesPictureArr) {
                                    var index = parseInt(i) + 1;
                                    series["picture" + index] = seriesPictureArr[i];
                                }
                                for (var i in programPictureArr) {
                                    var index = parseInt(i) + 1;
                                    program["picture" + index] = programPictureArr[i];
                                }
                                series.duration = series.duration * 60;
                                delete series["status"];
                                series.definition = enums.DefinitionCPS[series.definition];
                                series.hasvideotype = enums.VideoType.POSITIVE.name;
                                series.pinyin = tools.getPinyinAll(series.name);
                                var originalcountry = series.originalcountry.split("|");
                                for (var i = 0; i < originalcountry.length; i++) {
                                    for (var j = 0; j < enums.Regions.length; j++) {
                                        if (originalcountry[i] == enums.Regions[j].name) {
                                            originalcountry[i] = enums.Regions[j].value;
                                        }
                                    }
                                }
                                series.originalcountry = originalcountry.join("|");
                                series.pinyinsuoxie = tools.getPinyinFirst(series.name);
                                for (var i in enums.ProgramTypeMapping) {
                                    if (enums.ProgramTypeMapping[i].name == series.programtype) {
                                        series.programtype = enums.ProgramTypeMapping[i].value;
                                    }
                                }
                                program.seriesname = series.name;
                                program.duration = program.duration * 60;
                                program.definition = enums.DefinitionCPS[program.definition];
                                program.videotype = enums.VideoType.POSITIVE.value;
                                program.videodesc = enums.VideoType.POSITIVE.name;
                                var programOriginalcountry = program.originalcountry.split("|");
                                for (var i = 0; i < programOriginalcountry.length; i++) {
                                    for (var j = 0; j < enums.Regions.length; j++) {
                                        if (programOriginalcountry[i] == enums.Regions[j].name) {
                                            programOriginalcountry[i] = enums.Regions[j].value;
                                        }
                                    }
                                }
                                program.originalcountry = programOriginalcountry.join("|");
                                delete program["status"];
                                movie.fileformat = movie.videotype;
                                delete movie["videotype"];
                                movie.type = 0;
                                movie.cpcode = program.cpcode;
                                movie.downloadstatus = 2;
                                movie.iscompleted = -1;
                                movie.isunified = -1;
                                movie.seriesname = series.name;
                                if (movie.duration) {
                                    movie.duration = movie.duration * 60;
                                }
                                if (movie.filepath) {
                                    movie.filepath = movie.targetfilepath;
                                }
                                if (movie.screenformat) {
                                    movie.width = movie.screenformat.split("*")[0];
                                    movie.height = movie.screenformat.split("*")[1];// program.
                                }
                                return searchDatabase.getCpInfo({where: {code: series.contentprovider}}).then(function (result) {
                                    if (result.code == 200) {
                                        series.cpname = result.data.name;
                                        program.cpname = series.cpname;
                                        movie.cpname = program.cpname;
                                        resolve({series: series, program: program, movie: movie});
                                    } else {
                                        console.error(series.contentprovider + " has no cpname at " + new Date());
                                        console.error(series.cpcontentid + ":series has no cpname at" + new Date());
                                        console.error(program.cpcontentid + ":program has no cpname at" + new Date());
                                        console.error(program.cpcontentid + ":movie has no cpname at" + new Date());
                                        resolve({series: series, program: program, movie: movie});
                                    }
                                })

                            } else {
                                reject({Error: "get " + xmlurl + " objects or mapping error at " + new Date()})
                            }
                        }

                    })
                }
            })
    })
}
module.exports = ExecuteJob;
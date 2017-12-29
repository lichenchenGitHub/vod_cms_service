/**
 * Created by lichenchen on 2017/7/20.
 */
var express = require('express');
var router = express.Router();
var Promise = require("bluebird");
var unirest = require("unirest");
// var mongoose = require('../lib/mongoose');
// var DomainTask = require("../model/domainTask");
// var domainTask = mongoose.model("domainTask", DomainTask);
var conf = require("../conf/config");
var TransformObject = require("../lib/transformObject");
var transformObject = new TransformObject();
var generateUniqueCode = require("../lib/generateUniqueCode");
var Enums = require("../lib/enums");
var enums = new Enums();
var Tools = require("../lib/tools");
var tools = new Tools();
var SearchDatabase = require("../lib/searchDatabase");
var searchDatabase = new SearchDatabase();
var JobEnterDatabase = require("../lib/jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
/* GET users listing. */
router.post('/unifiedUnunifiedseries', function (req, res, next) {
    try {
        var reback = {};
        return new Promise(function (resolve, reject) {
            //iscreate=1，创建主媒
            if (req.body.iscreate == 1 && req.body.cpcontentid) {
                var filter = {where: {cpcontentid: req.body.cpcontentid}}
                unirest.get(encodeURI(conf.strongLoopApi + "Unifiedseries/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 202;
                            reback.data = null;
                            reback.message = req.body.cpcontentid + " has in unifiedseries";
                            reject(reback);
                        } else {
                            unirest.get(encodeURI(conf.strongLoopApi + "Series/findOne?filter=" + JSON.stringify(filter)))
                                .pool(conf.poolOption)
                                .end(function (resp) {
                                    if (resp.status == 200) {
                                        var series = resp.body;
                                        return generateUniqueCode.createUnifiedseriesCode(enums.Project.CMS.value, enums.Code.SERIES).then(function (unifiedseriesCode) {
                                            var unifiedSeries = transformObject.transUnifiedseries(series);
                                            unifiedSeries.code = unifiedseriesCode;
                                            unifiedSeries.createtime = new Date();
                                            unifiedSeries.updatetime = new Date();
                                            unirest.post(encodeURI(conf.strongLoopApi + "Unifiedseries"))
                                                .pool(conf.poolOption)
                                                .headers({
                                                    'Accept': 'application/json',
                                                    'Content-Type': 'application/json'
                                                })
                                                .send(unifiedSeries)
                                                .end(function (resp) {
                                                    if (resp.status == 200) {
                                                        var where = {
                                                            unifiedseriescode: unifiedseriesCode,
                                                            cpcontentid: series.cpcontentid
                                                        };
                                                        var unifiedseriesseries = {
                                                            unifiedseriescode: unifiedseriesCode,
                                                            cpcontentid: series.cpcontentid,
                                                            cpcode: series.cpcode,
                                                            status: 1,
                                                            isunified: 0,
                                                            unifieddesc: "待聚合"
                                                        }
                                                        unirest.post(encodeURI(conf.strongLoopApi + "Unifiedseriesseries/upsertWithWhere?where=" + JSON.stringify(where)))
                                                            .pool(conf.poolOption)
                                                            .headers({
                                                                'Accept': 'application/json',
                                                                'Content-Type': 'application/json'
                                                            })
                                                            .send(unifiedseriesseries)
                                                            .end(function (resp) {
                                                                if (resp.status == 200) {
                                                                    reback.code = resp.statusCode;
                                                                    reback.data = resp.body;
                                                                    reback.message = "unified success at " + new Date();
                                                                    resolve(reback);
                                                                } else {
                                                                    reback.code = resp.statusCode;
                                                                    reback.data = resp.body.error;
                                                                    reback.message = "insert unifiedseries success but upsert unifiedseriesseries failed at " + new Date();
                                                                    reject(reback);
                                                                }
                                                            })
                                                    } else {
                                                        reback.code = resp.statusCode;
                                                        reback.data = resp.body.error;
                                                        reback.message = "insert unifiedseries failed at " + new Date();
                                                        reject(reback);
                                                    }

                                                })
                                        })
                                    } else {
                                        reback.code = resp.statusCode;
                                        reback.data = resp.body.error;
                                        reback.message = req.body.cpcontentid + ": get series failed at " + new Date();
                                        reject(reback);
                                    }

                                })
                        }
                    })
                //iscreate=0，创建关联关系
            } else if (req.body.iscreate == 0 && req.body.cpcontentid && req.body.unifiedseriescode && req.body.cpcode) {
                var where = {
                    unifiedseriescode: req.body.unifiedseriescode,
                    cpcontentid: req.body.cpcontentid
                };
                var unifiedseriesseries = {
                    unifiedseriescode: req.body.unifiedseriescode,
                    cpcontentid: req.body.cpcontentid,
                    cpcode: req.body.cpcode,
                    status: 0,
                    isunified: 0
                }
                return jobEnterDatabase.upsertUnifiedseriesseries(unifiedseriesseries).then(function (result) {
                    resolve(result);
                }).catch(function (err) {
                    reject(err);
                })
                //更新主媒资
            } else if (req.body.iscreate == 2 && req.body.cpcontentid && req.body.unifiedseriescode) {
                Promise.join(searchDatabase.getUnifiedseries(req.body.unifiedseriescode), searchDatabase.getSeries(req.body.cpcontentid), function (unifiedSeriesResult, seriesResult) {
                    var series = seriesResult.data;
                    if (unifiedSeriesResult.data.srccpcode == series.cpcode) {
                        var filterSeries = tools.deleteEmptyProperty(transformObject.filterUnifiedseries(series));//获取series信息
                        var unifiedSeries = tools.filterUnifiedObject(unifiedSeriesResult.data, filterSeries);//获取主媒资中与series键相同的value
                        if (JSON.stringify(filterSeries) == JSON.stringify(unifiedSeries)) {
                            reback.code = 200;
                            reback.data = 0;
                            reback.message = "need not update,unifiedseries is the same with series at " + new Date();
                            resolve(reback);
                        } else {
                            delete filterSeries["cpcontentid"];
                            filterSeries.updatetime = new Date();
                            var where = {code: req.body.unifiedseriescode}
                            unirest.post(encodeURI(conf.strongLoopApi + "Unifiedseries/update?where=" + JSON.stringify(where))).pool(conf.poolOption)
                                .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                                .send(filterSeries)
                                .end(function (result) {
                                    if (result.status == 200) {
                                        reback.code = 200;
                                        reback.data = result.body.count;
                                        reback.message = "update " + result.body.count + " item at " + new Date();
                                        resolve(reback);
                                    } else {
                                        reback.code = result.status;
                                        reback.data = result.body.error;
                                        reback.message = "update failed at " + new Date();
                                    }
                                })
                        }

                    } else {
                        reback.code = 400;
                        reback.data = null;
                        reback.messge = "unifiedSeries srccpcode not equal series cpcode  at " + new Date();
                        reject(reback)
                    }
                })

            } else {
                reback.code = 400;
                reback.data = null;
                reback.messge = "params error at " + new Date();
                reject(reback)
            }
        }).then(function (result) {
            return res.status(200).json(result);
        }).catch(function (err) {
            return res.status(200).json(err);
        })
    } catch (e) {
        return res.status(500).json({Error: e});
    }
});
router.post('/unifiedUnunifiedprogram', function (req, res, next) {
    var reback = {};
    console.log(req.body);
    return new Promise(function (resolve, reject) {
        if (req.body.iscreate == 1) {
            var filter = {where: {cpcontentid: req.body.cpcontentid}}
            unirest.get(encodeURI(conf.strongLoopApi + "Unifiedprograms/findOne?filter=" + JSON.stringify(filter)))
                .pool(conf.poolOption)
                .end(function (resp) {
                    console.log(resp.body);
                    if (resp.status == 200) {
                        reback.code = 202;
                        reback.data = null;
                        reback.message = req.body.cpcontentid + " has in unifiedprogram";
                        resolve(reback);

                    } else {
                        unirest.get(encodeURI(conf.strongLoopApi + "Programs/findOne?filter=" + JSON.stringify(filter)))
                            .pool(conf.poolOption)
                            .end(function (resp) {
                                if (resp.status == 200) {
                                    var program = resp.body;
                                    var usCondition = {where: {cpcontentid: program.showid}};
                                    unirest.get(encodeURI(conf.strongLoopApi + "Unifiedseriesseries/findOne?filter=" + JSON.stringify(usCondition)))
                                        .pool(conf.poolOption)
                                        .end(function (resp) {
                                            if (resp.status == 200) {
                                                var unifiedseriesseries = resp.body;
                                                var upCondition = {
                                                    where: {
                                                        unifiedseriescode: unifiedseriesseries.unifiedseriescode,
                                                        volumncount: program.volumncount
                                                    }
                                                }
                                                unirest.get(encodeURI(conf.strongLoopApi + "Unifiedprograms/findOne?filter=" + JSON.stringify(upCondition)))
                                                    .pool(conf.poolOption)
                                                    .end(function (resp) {
                                                        if (resp.status == 200) {
                                                            reback.code = 202;
                                                            reback.data = null;
                                                            reback.message = "节目集 " + unifiedseriesseries.unifiedseriescode + " volumncount " + program.volumncount + " has exists";
                                                            resolve(reback);
                                                        } else {
                                                            Promise.props({
                                                                unifiedseries: searchDatabase.getUnifiedseries(unifiedseriesseries.unifiedseriescode),
                                                                unifiedprogamCode: generateUniqueCode.createUnifiedprogramCode(enums.Project.CMS.value, enums.Code.PROGRAM)
                                                            }).then(function (result) {
                                                                console.log(result);
                                                                var unifiedProgam = transformObject.transUnifiedprogram(program, result.unifiedseries.data);
                                                                unifiedProgam.code = result.unifiedprogamCode;
                                                                return jobEnterDatabase.upsertUnifiedprogram(unifiedProgam).then(function (unifiedProgramResult) {
                                                                    return jobEnterDatabase.upsertUnifiedprogramprogram({
                                                                        cpcontentid: req.body.cpcontentid,
                                                                        unifiedprogramcode: unifiedProgramResult.data.code
                                                                    }).then(function (unifiedprogramprogramObj) {
                                                                        //将聚合失败的movie 重置为待聚合
                                                                        return jobEnterDatabase.updateMovieByCpcontentid({
                                                                            cpcontentid: unifiedprogramprogramObj.data.cpcontentid,
                                                                            isunified: -1
                                                                        }, {
                                                                            isunified: 0,
                                                                            updatetime: new Date()
                                                                        }).then(function (result) {
                                                                            reback.code = 200;
                                                                            reback.data = result;
                                                                            reback.message = "unified movie success at " + new Date();
                                                                            resolve(reback);
                                                                        }).catch(function (err) {
                                                                            reback.code = 500;
                                                                            reback.data = err;
                                                                            reback.message = "unified movie error at " + new Date();
                                                                            reject(reback);
                                                                        })
                                                                    })
                                                                })
                                                            })
                                                        }
                                                    })

                                            } else {
                                                reback.code = resp.statusCode;
                                                reback.data = resp.body.error;
                                                reback.message = req.body.cpcontentid + " has no unifiedseries,please unifiedseries";
                                                reject(reback);
                                            }
                                        })

                                } else {
                                    reback.code = resp.statusCode;
                                    reback.data = resp.body.error;
                                    reback.message = "get program error at " + new Date();
                                    reject(reback);
                                }
                            })
                    }
                })
        } else {
            return jobEnterDatabase.upsertUnifiedprogramprogram({
                cpcontentid: req.body.cpcontentid,
                unifiedprogramcode: req.body.unifiedprogramcode
            }).then(function (unifiedprogramprogramObj) {
                return jobEnterDatabase.updateMovieByCpcontentid({
                    cpcontentid: unifiedprogramprogramObj.data.cpcontentid,
                    isunified: -1
                }, {
                    isunified: 0,
                    updatetime: new Date()
                }).then(function (result) {
                    reback.code = 200;
                    reback.data = result;
                    reback.message = "unified movie success at " + new Date();
                    resolve(reback);
                }).catch(function (err) {
                    reback.code = 500;
                    reback.data = err;
                    reback.message = "unified movie error at " + new Date();
                    reject(reback);
                })
            })
        }
    }).then(function (result) {
        return res.status(200).json(result);
    }).catch(function (err) {
        return res.status(500).json({Error: err});
    })
})
router.get('/getDomainTaskInfo/:domainCode/:contentType/:actionType/:uscode/:upcode/:umcode', function (req, res) {
    console.log(req.params.uscode);
    console.log(req.params.umcode);
    console.log(req.params.upcode);
    if (req.params.domainCode && req.params.domainCode != "" && req.params.contentType && req.params.contentType == 3 && req.params.uscode && req.params.uscode != "" && req.params.upcode && req.params.upcode != "" && req.params.umcode && req.params.umcode != "") {
        Promise.props({
            series: searchDatabase.getUsByCode(req.params.uscode),
            program: searchDatabase.getUpByCode(req.params.upcode),
            movie: searchDatabase.getUmByCode(req.params.umcode)
        }).then(function (result) {
            var data = {data: {}};
            var series = {};
            var program = {};
            var movie = {};
            movie.name = result.movie.name;
            movie.code = result.movie.code;
            movie.programcode = result.movie.unifiedProgramCode;
            movie.cpcontentid = result.movie.cpContentID;
            movie.audioformat = result.movie.audioFormat;
            movie.screenformat = result.movie.width + "x" + result.movie.height;
            movie.duration = result.movie.duration;
            movie.filesize = result.movie.fileSize
            movie.bitratetype = result.movie.videoBitRate;
            movie.videotype = result.movie.bitRateMode;
            movie.type = result.movie.videoType;
            movie.sourceurl = result.movie.playURL;
            movie.fileurl = result.movie.playURL;
            movie.playurl = result.movie.playURL
            movie.md5 = result.movie.md5;
            program.name = result.program.name;
            program.code = result.program.code;
            program.ordernumber = result.program.orderNumber;
            program.sortname = result.program.sortName;
            program.searchname = result.program.searchName;
            program.actordisplay = result.program.kPeople;
            program.writerdisplay = result.program.director;
            program.originalcountry = result.program.originalCountry;
            program.language = result.program.language;
            program.releaseyear = result.program.releaseYear;
            program.orgairdate = result.program.orgairDate;
            program.licensingwindowstart = result.program.licensingWindowStart;
            program.licensingwindowend = result.program.licensingWindowEnd;
            program.displayasnew = result.program.displayAsNew;
            program.displayaslastchance = result.program.displayAsLastChance;
            program.macrovision = result.program.macrovision;
            program.description = result.program.description;
            program.pricetaxin = result.program.price;
            program.sourcetype = result.program.sourceType;
            program.seriesflag = result.program.seriesFlag;
            program.contentprovider = result.program.cpcode;
            program.keywords = result.program.keyWords;
            program.tags = result.program.tags;
            program.viewpoint = result.program.viewPoint;
            program.starlevel = result.program.starLevel;
            program.rating = result.program.rating;
            program.awards = result.program.awards;
            program.length = result.program.duration;
            program.programtype = result.program.programType;
            program.programtype2 = result.program.programType2;
            program.cpcontentid = result.program.cpContentID;
            program.seriescode = result.program.unifiedSeriesCode;
            program.seriesname = result.program.unifiedSeriesName;
            program.volumncount = result.program.volumnCount;
            program.picture1 = result.program.pictureurl1;
            program.picture2 = result.program.pictureurl2;
            program.picture3 = result.program.pictureurl3;
            program.picture4 = result.program.pictureurl4;
            series.name = result.series.name;
            series.code = result.series.code;
            series.ordernumber = result.series.orderNumber;
            series.sortname = result.series.sortName;
            series.searchname = result.series.searchName;
            series.orgairdate = result.series.orgairDate;
            series.licensingwindowstart = result.series.licensingWindowStart;
            series.licensingwindowend = result.series.licensingWindowEnd;
            series.displayasnew = result.series.displayAsNew;
            series.displayaslastcchance = result.series.displayAsLastcChance;
            series.macrovision = result.series.macrovision;
            series.price = result.series.price;
            series.description = result.series.description;
            series.kpeople = result.series.kPeople;
            series.director = result.series.director;
            series.scriptwriter = result.series.scriptWriter;
            series.compere = result.series.compere;
            series.guest = result.series.guest;
            series.seriestype = result.series.seriesType;
            series.copyright = result.series.copyright;
            series.contentprovider = result.series.cpcode;
            series.programtype = result.series.programType;
            series.programtype2 = result.series.programType2;
            series.picture1 = result.series.pictureurl1;
            series.picture2 = result.series.pictureurl2;
            series.picture3 = result.series.pictureurl3;
            series.picture4 = result.series.pictureurl4;
            series.cpcode = result.series.cpcode;
            series.cpname = result.series.cpname;
            switch (parseInt(req.params.actionType)) {
                case 1:
                    data.action = "regist";
                    break;
                case 2:
                    data.action = "update";
                    break;
                case 3:
                    data.action = "delete"
                    break;
                case 4:
                    data.action = "offline";
                    break;
                case 5:
                    data.action = "online";
                    break;
                default:
                    data.action = "error";
                    break;
            }
            data.data.series = series;
            data.data.program = program;
            data.data.movie = movie;
            return res.status(200).json(data);
        }).catch(function (err) {
            return res.status(500).json({Error: err})
        })

    } else {
        return res.status(200).json({code: 200, message: "params error at " + new Date()})
    }
});
router.get('/getDomainTaskInfo/:domainCode/:contentType/:actionType/:code', function (req, res) {
    console.log(req.params.code);
    if (req.params.domainCode && req.params.domainCode != "" && req.params.contentType && req.params.contentType != "" && req.params.code && req.params.code != "") {
        if (req.params.contentType == 1) {
            return searchDatabase.getUsByCode(req.params.code).then(function (result) {
                var data = {data: {}};
                var series = {};
                series.name = result.name;
                series.code = result.code;
                series.ordernumber = result.orderNumber;
                series.sortname = result.sortName;
                series.searchname = result.searchName;
                series.orgairdate = result.orgairDate;
                series.licensingwindowstart = result.licensingWindowStart;
                series.licensingwindowend = result.licensingWindowEnd;
                series.displayasnew = result.displayAsNew;
                series.displayaslastcchance = result.displayAsLastcChance;
                series.macrovision = result.macrovision;
                series.price = result.price;
                series.description = result.description;
                series.kpeople = result.kPeople;
                series.director = result.director;
                series.scriptwriter = result.scriptWriter;
                series.compere = result.compere;
                series.guest = result.guest;
                series.seriestype = result.seriesType;
                series.copyright = result.copyright;
                series.contentprovider = result.cpcode;
                series.programtype = result.programType;
                series.programtype2 = result.programType2;
                series.picture1 = result.pictureurl1;
                series.picture2 = result.pictureurl2;
                series.picture3 = result.pictureurl3;
                series.picture4 = result.pictureurl4;
                series.cpcode = result.cpcode;
                series.cpname = result.cpname;
                data.data.series = series;
                switch (parseInt(req.params.actionType)) {
                    case 1:
                        data.action = "regist";
                        break;
                    case 2:
                        data.action = "update";
                        break;
                    case 3:
                        data.action = "delete"
                        break;
                    case 4:
                        data.action = "offline";
                        break;
                    case 5:
                        data.action = "online";
                        break;
                    default:
                        data.action = "error";
                        break;
                }
                return res.status(200).json(data)
            }).catch(function (err) {
                return res.status(500).json({Error: err})
            })
        } else if (req.params.contentType == 2) {
            return searchDatabase.getUpByCode(req.params.code).then(function (result) {
                var data = {data: {}};
                var program = {};
                program.name = result.name;
                program.code = result.code;
                program.ordernumber = result.orderNumber;
                program.sortname = result.sortName;
                program.searchname = result.searchName;
                program.actordisplay = result.kPeople;
                program.writerdisplay = result.director;
                program.originalcountry = result.originalCountry;
                program.language = result.language;
                program.releaseyear = result.releaseYear;
                program.orgairdate = result.orgairDate;
                program.licensingwindowstart = result.licensingWindowStart;
                program.licensingwindowend = result.licensingWindowEnd;
                program.displayasnew = result.displayAsNew;
                program.displayaslastchance = result.displayAsLastChance;
                program.macrovision = result.macrovision;
                program.description = result.description;
                program.pricetaxin = result.price;
                program.sourcetype = result.sourceType;
                program.seriesflag = result.seriesFlag;
                program.contentprovider = result.cpcode;
                program.keywords = result.keyWords;
                program.tags = result.tags;
                program.viewpoint = result.viewPoint;
                program.starlevel = result.starLevel;
                program.rating = result.rating;
                program.awards = result.awards;
                program.length = result.duration;
                program.programtype = result.programType;
                program.programtype2 = result.programType2;
                program.cpcontentid = result.cpContentID;
                program.seriescode = result.unifiedSeriesCode;
                program.seriesname = result.unifiedSeriesName;
                program.volumncount = result.volumnCount;
                program.picture1 = result.pictureurl1;
                program.picture2 = result.pictureurl2;
                program.picture3 = result.pictureurl3;
                program.picture4 = result.pictureurl4;
                switch (parseInt(req.params.actionType)) {
                    case 1:
                        data.action = "regist";
                        break;
                    case 2:
                        data.action = "update";
                        break;
                    case 3:
                        data.action = "delete"
                        break;
                    case 4:
                        data.action = "offline";
                        break;
                    case 5:
                        data.action = "online";
                        break;
                    default:
                        data.action = "error";
                        break;
                }
                data.data.program = program;
                return res.status(200).json(data);

            }).catch(function (err) {
                return res.status(500).json({Error: err})
            })
        } else {
            return res.status(200).json({code: 200, message: "contentType not format at " + new Date()})
        }
    } else {
        return res.status(200).json({code: 200, message: "params error at " + new Date()})
    }
})
router.post('/distributeUnifiedseries', function (req, res) {
    if ((req.body.unifiedseriesCode && (typeof(req.body.unifiedseriesCode) == "string" || req.body.unifiedseriesCode instanceof Array)) && req.body.domainCode && req.body.actionType) {
        if (typeof(req.body.unifiedseriesCode) == "string") {
            return Promise.join(searchDatabase.getSPMCodeList(req.body.unifiedseriesCode), searchDatabase.getDomain({where: {code: req.body.domainCode}}), function (list, domain) {
                for (var item in list) {
                    list[item].domaincode = req.body.domainCode;
                    list[item].actiontype = req.body.actionType;
                    list[item].domainname = domain.name;
                    list[item].cmsid = domain.cmsid;
                    list[item].sopid = domain.sopid;
                    list[item].interfaceurl = conf.domainTaskUrl;
                }
                return Promise.mapSeries(list, function (item, index) {
                    var condition = {
                        domaincode: item.domaincode,
                        seriescode: item.seriescode,
                        programcode: item.programcode,
                        moviecode: item.moviecode
                    };
                    if (item.actiontype == 1) {
                        item.createtime = new Date();
                        item.updatetime = new Date();
                    } else {
                        item.updatetime = new Date();
                    }
                    item.orderfilepath = conf.domainCallbackUrl + item.domaincode + "/" + item.actiontype + "/" + item.seriescode + "/" + item.programcode + "/" + item.moviecode;
                    item.status = 0;
                    return jobEnterDatabase.upsertDomainTask(condition, item).then(function (domainTask) {
                        return domainTask;
                    });
                }).then(function (result) {
                    return res.status(200).json({code: 200, message: "upsert  success " + new Date()})
                }).catch(function (err) {
                    return res.status(200).json({code: 500, message: "inner error", error: err});
                })
            })
        } else {
            return Promise.mapSeries(req.body.unifiedseriesCode, function (item, index) {
                return Promise.join(searchDatabase.getSPMCodeList(item), searchDatabase.getDomain({where: {code: req.body.domainCode}}), function (list, domain) {
                    for (var item in list) {
                        list[item].domaincode = req.body.domainCode;
                        list[item].actiontype = req.body.actionType;
                        list[item].domainname = domain.name;
                        list[item].cmsid = domain.cmsid;
                        list[item].sopid = domain.sopid;
                        list[item].interfaceurl = conf.domainTaskUrl;
                    }
                    return Promise.mapSeries(list, function (spm, index) {
                        var condition = {
                            domaincode: spm.domaincode,
                            seriescode: spm.seriescode,
                            programcode: spm.programcode,
                            moviecode: spm.moviecode
                        };
                        if (spm.actiontype == 1) {
                            spm.createtime = new Date();
                            spm.updatetime = new Date();
                        } else {
                            spm.updatetime = new Date();
                        }
                        spm.orderfilepath = conf.domainCallbackUrl + spm.domaincode + "/" + spm.actiontype + "/" + spm.seriescode + "/" + spm.programcode + "/" + spm.moviecode;
                        spm.status = 0;
                        return jobEnterDatabase.upsertDomainTask(condition, spm).then(function (domainTask) {
                            return domainTask;
                        });
                    })
                });
            }).then(function (result) {
                return res.status(200).json({code: 200, message: "upsert success at " + new Date()})
            }).catch(function (err) {
                return res.status(200).json({code: 500, message: "inner error", error: err});
            })
        }
    } else {
        return res.status(200).json({code: 400, message: "parameter not formatted correctly"})
    }
});
router.post('/distributePackage', function (req, res) {
    if (req.body.packageId && (typeof(req.body.packageId) == "string" || req.body.packageId instanceof Array) && req.body.priority && req.body.domainCode) {
        if (typeof(req.body.packageId) == "string") {
            return searchDatabase.getSPMCodeListByPackageId(req.body.packageId, req.body.domainCode).then(function (list) {
                for (var item in list) {
                    list[item].priority = req.body.priority;
                }
                return Promise.map(list, function (item, index) {
                    var condition = {
                        domaincode: item.domaincode,
                        seriescode: item.seriescode,
                        programcode: item.programcode,
                        moviecode: item.moviecode
                    };
                    if (item.actiontype == 1) {
                        item.createtime = new Date();
                        item.updatetime = new Date();
                    } else {
                        item.updatetime = new Date();
                    }
                    item.interfaceurl = conf.domainTaskUrl;
                    item.orderfilepath = conf.domainCallbackUrl + item.domaincode + "/" + item.actiontype + "/" + item.seriescode + "/" + item.programcode + "/" + item.moviecode;
                    item.status = 0;
                    return jobEnterDatabase.upsertDomainTask(condition, item);
                }).then(function (result) {
                    return res.status(200).json({code: 200, message: "upsert success at " + new Date()})
                }).catch(function (err) {
                    return res.status(200).json({code: 500, message: "inner error", error: err});
                })
            })
        } else {
            return Promise.mapSeries(req.body.packageId, function (item, index) {
                return searchDatabase.getSPMCodeListByPackageId(item, req.body.domainCode).then(function (list) {
                    for (var item in list) {
                        list[item].priority = req.body.priority;
                    }
                    return Promise.mapSeries(list, function (spm, index) {
                        var condition = {
                            domaincode: spm.domaincode,
                            seriescode: spm.seriescode,
                            programcode: spm.programcode,
                            moviecode: spm.moviecode
                        };
                        if (spm.actiontype == 1) {
                            spm.createtime = new Date();
                            spm.updatetime = new Date();
                        } else {
                            spm.updatetime = new Date();
                        }
                        spm.interfaceurl = conf.domainTaskUrl;
                        spm.orderfilepath = conf.domainCallbackUrl + spm.domaincode + "/" + spm.actiontype + "/" + spm.seriescode + "/" + spm.programcode + "/" + spm.moviecode;
                        spm.status = 0;
                        return jobEnterDatabase.upsertDomainTask(condition, spm);
                    }).then(function (result) {
                        return result;
                    })
                })
            }).then(function (result) {
                return res.status(200).json({code: 200, message: "upsert success at " + new Date()})
            }).catch(function (err) {
                return res.status(200).json({code: 500, message: "inner error", error: err});
            })
        }
    } else {
        return res.status(200).json({code: 400, message: "parameter not formatted correctly"})
    }
});
router.post('/domainTaskCallback', function (req, res) {
    if (req.body.correlateID && (req.body.resultStatus != null) && req.body.domainCode) {
        var condition = {correlateid: req.body.correlateID};
        var obj = {status: 2000, statusdesc: "分发域处理成功"};
        if (req.body.resultStatus == 0) {
            obj.updatetime = new Date();

        } else {
            obj.status = 502;
            obj.statusdesc = "分发域处理失败";
            obj.updatetime = new Date();
        }
        return jobEnterDatabase.upsertDomainTask(condition, obj).then(function (data) {
            return res.status(200).json({code: 200, message: "update domainTask success at " + new Date()});
        }).catch(function (err) {
            return res.status(200).json({code: 500, message: "update domainTask success at " + new Date()})
        })
    } else {
        return res.status(200).json({code: 400, message: "bad request at " + new Date()});
    }
});
// router.post('/downloadCallback', function (req, res) {
//     var showid = enums.DataSources[0] + req.body.showid;
//     var vid = enums.DataSources[0] + req.body.vid;
//     var downloadstatus = req.body.dstat;
//     var filepath = req.body.fpath;
//     var playurl = req.body.fpath;
//     var filesize = req.body.fsize;
//     var md5 = req.body.fhash;
//     var postData = {
//         cpcontentid: vid,
//         showid: showid,
//         downloadstatus: downloadstatus,
//         filepath: filepath,
//         playurl: playurl,
//         filesize: filesize,
//         md5: md5,
//         updatetime: new Date()
//     }
//     console.log(req.body);
//     var whereCondition = {cpcontentid: postData.cpcontentid, showid: postData.showid, downloadstatus: 1, type: 0};
//     unirest.post(encodeURI(conf.strongLoopApi + "Movies/update?where=" + JSON.stringify(whereCondition)))
//         .pool(conf.poolOption)
//         .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
//         .send(postData)
//         .end(function (resp) {
//             console.log(resp.body);
//             if (resp.status == 200) {
//                 return res.status(200).json({
//                     code: 200,
//                     message: "update movie success at " + new Date(),
//                     data: resp.body.count
//                 });
//             } else {
//                 return res.status(resp.statusCode).json({
//                     code: resp.statusCode,
//                     message: "update movie failed at" + new Date()
//                 })
//             }
//         })
// });
router.post('/downloadCallback', function (req, res) {
    console.log(req.body);
    if (req.body.dstat && typeof(req.body.dstat) != "undefined" && req.body.cpcode && typeof(req.body.cpcode) != "undefined") {
        var postData = {};
        var whereCondition = {};
        if (req.body.dstat == 2) {
            switch (req.body.cpcode) {
                case "YOUKU":
                    postData.downloadstatus = req.body.dstat;
                    postData.filepath = req.body.fpath;
                    postData.playurl = req.body.fpath;
                    postData.md5 = req.body.fhash;
                    postData.filesize = req.body.fsize;
                    whereCondition.showid = req.body.showid;
                    whereCondition.cpcontentid = req.body.vid;
                    whereCondition.type = 0;
                    break;
                case "APECN":
                    postData.downloadstatus = req.body.dstat;
                    postData.filepath = req.body.fpath;
                    postData.playurl = req.body.fpath;
                    postData.md5 = req.body.fhash;
                    postData.filesize = req.body.fsize;
                    whereCondition.showid = req.body.showid;
                    whereCondition.cpcontentid = req.body.vid;
                    whereCondition.fileid = req.body.fcode;
                    break;
                default:
                    postData.downloadstatus = req.body.dstat;
                    postData.filepath = req.body.fpath;
                    postData.playurl = req.body.fpath;
                    postData.md5 = req.body.fhash;
                    postData.filesize = req.body.fsize;
                    whereCondition.showid = req.body.showid;
                    whereCondition.cpcontentid = req.body.vid;
                    whereCondition.fileid = req.body.fcode;
                    break;

            }
        } else {
            switch (req.body.cpcode) {
                case "YOUKU":
                    postData.downloadstatus = req.body.dstat;
                    whereCondition.showid = req.body.showid;
                    whereCondition.cpcontentid = req.body.vid;
                    whereCondition.type = 0;
                    break;
                case "APECN":
                    postData.downloadstatus = req.body.dstat;
                    whereCondition.showid = req.body.showid;
                    whereCondition.cpcontentid = req.body.vid;
                    whereCondition.fileid = req.body.fcode;
                    break;
                default:
                    postData.downloadstatus = req.body.dstat;
                    whereCondition.showid = req.body.showid;
                    whereCondition.cpcontentid = req.body.vid;
                    whereCondition.fileid = req.body.fcode;
                    break;

            }
        }
        postData.updatetime = new Date();
        console.log("postData is :" + JSON.stringify(postData));
        console.log("whereCondition is:" + JSON.stringify(whereCondition));
        unirest.post(conf.strongLoopApi + "Movies/update?where=" + encodeURIComponent(JSON.stringify(whereCondition))).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(postData)
            .end(function (resp) {
                if (resp.status == 200) {
                    return res.status(200).json({code: 0, message: "update success at " + new Date()})
                } else {
                    return res.status(200).json({code: 500, messge: "update error at " + new Date()})
                }
            })

    } else {
        return res.status(200).json({code: 10, message: "parameter_empty at " + new Date()})
    }
});
router.post("/movieMoveInfo", function (req, res) {
    var params = req.body;
    if (params.id && typeof (params.id) != "undefined" && params.status && typeof(params.status) != "undefined") {
        var postData = {};
        var whereCondition = {};
        whereCondition.fileid = params.id;
        if (params.status == 8 && params.formatFilePath && typeof (params.formatFilePath) != "undefined" && params.md5 && typeof(params.md5) != "undefined") {
            postData.downloadstatus = 2;
            postData.filepath = params.formatFilePath;
            postData.md5 = params.md5;
        } else {
            postData.downloadstatus = -1;
            console.error(params.id + ":" + params.statusDesc + " at " + new Date());
        }
        postData.updatetime = new Date();
        unirest.post(conf.strongLoopApi + "Movies/update?where=" + encodeURIComponent(JSON.stringify(whereCondition))).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(postData)
            .end(function (resp) {
                if (resp.status == 200) {
                    console.log(params.id + " update " + JSON.stringify(resp.body));
                    return res.status(200).json({
                        code: 200,
                        message: "update " + params.id + " success at " + new Date()
                    });
                } else {
                    console.error(params.id + " update failed at " + new Date());
                    return res.status(200).json({code:500,message:params.id+" update failed at "+new Date()})
                }
            })
    } else {
        return res.status(200).json({code: 400, message: "lack of params at " + new Date()});
    }
})
module.exports = router;
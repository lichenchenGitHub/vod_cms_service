/**
 * Created by lichenchen on 2017/4/18.
 */
var sequelize = require("./sequelize");
var spm_alert_record = sequelize.import("../model/SPMAlertRecord");
var conf = require("../conf/config");
var unirest = require("unirest");
var Promise = require("bluebird");
var mongoose = require('./mongoose');
var SPMCodeSchema = require("../model/SPMCode");
var SPMCode = mongoose.model("SPMCode", SPMCodeSchema);
var DomainTaskSchema = require("../model/domainTask");
var domainTask = mongoose.model("domainTask", DomainTaskSchema);
var Tools = require("./tools");
var tools = new Tools();
var Enums = require("./enums");
var enums = new Enums();

var SearchDatabase = (function () {
    function _searchDatabase() {
    }

    _searchDatabase.prototype = {
        getSeries: function (cpcontentid) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Series/findOne?filter[where][cpcontentid]=" + cpcontentid)).pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status === 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = cpcontentid + " get data success at " + new Date();
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = null;
                            reback.message = cpcontentid + " get data error at " + new Date();
                            reject(reback);
                        }
                    })
            })
        },
        getSeriesByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Series/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status === 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = "get series data success at " + new Date();
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = null;
                            reback.message = "get series data error at " + new Date();
                            reject(reback);
                        }
                    })
            })
        },
        getSensitivewords: function (keywords) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                if (keywords.length <= 0) {
                    reback.code = 404;
                    reback.data = null;
                    reback.message = "get sensitive words error at " + new Date();
                    resolve(reback);
                } else {
                    var filter = {fields: {name: true},};
                    var req = unirest.get(encodeURI(conf.strongLoopApi + "Sensitivewords?filter=" + JSON.stringify(filter)))
                        .pool(conf.poolOption)
                        .end(function (resp) {
                            if (resp.status == 200) {
                                if (resp.body.length <= 0) {
                                    reback.code = 404;
                                    reback.data = null;
                                    reback.message = "sensitive words list is null  at " + new Date();
                                    resolve(reback);
                                } else {
                                    var sensitiveList = resp.body;
                                    var name = [];
                                    for (var s in sensitiveList) {
                                        for (var key in keywords) {
                                            if (keywords[key].indexOf(sensitiveList[s].name) >= 0) {
                                                name.push(sensitiveList[s].name);
                                            }
                                        }
                                    }
                                    if (name && name.length > 0) {
                                        reback.code = 200;
                                        reback.data = name.join("|");
                                        reback.message = "get sensitive words success at " + new Date();
                                        resolve(reback);
                                    } else {
                                        reback.code = 404;
                                        reback.data = null;
                                        reback.message = "get sensitive words failed at " + new Date();
                                        resolve(reback);
                                    }

                                }
                            } else {
                                reback.code = resp.statusCode;
                                reback.data = resp.body.error;
                                reback.message = "get sensitive words error at " + new Date();
                                reject(reback);
                            }
                        })
                }
            })
        },
        getContentProvider: function (code) {
            return new Promise(function (resolve, reject) {
                    var reback = {};
                    var nowDate = new Date();
                    var req = unirest.get(encodeURI(conf.strongLoopApi + "Contentproviders/findOne?filter[where][code]=" + code + "&filter[where][status]=1&filter[where][validstarttime][lt]=" + nowDate + "&filter[where][validendtime][gt]=" + nowDate))
                        .pool(conf.poolOption)
                        .end(function (resp) {
                            if (resp.status != 200) {
                                reback.code = resp.statusCode;
                                reback.data = null;
                                reback.message = "get cp " + code + " page error";
                                reject(reback);
                            } else {
                                reback.code = 200;
                                reback.data = resp.body;
                                reback.message = "unified with other media";
                                resolve(reback);
                            }
                        })
                }
            );

        },
        matchUnifiedSeries: function (seriesObj) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var filter = {};
                var releaseyear = seriesObj.releaseyear;
                if (releaseyear.indexOf("-")) {
                    releaseyear = releaseyear.split("-")[0]
                }
                filter.where = {
                    name: seriesObj.name,
                    programtype: seriesObj.programtype,
                    originalcountry:seriesObj.originalcountry,
                    releaseyear: {regexp: "^" + releaseyear}
                };
                filter.include = {
                    relation: 'contentproviders', scope: {
                        where: {validstarttime: {lte: new Date()}, validendtime: {gte: new Date()}}
                    }
                }
                var req = unirest.get(conf.strongLoopApi + "Unifiedseries?filter=" + encodeURIComponent(JSON.stringify(filter))).pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status != 200) {
                            reback.code = resp.statusCode;
                            reback.message = seriesObj.cpcontentid + " request error";
                            reback.data = {
                                cpcontentid: seriesObj.cpcontentid,
                                contenttype: enums.MediaType.SERIES.value
                            };
                            reject(reback);
                        } else {
                            if (resp.body.length <= 0) {
                                reback.code = 404;
                                reback.message = seriesObj.cpcontentid + " match cp array length=0 at " + new Date();
                                reback.data = {
                                    cpcontentid: seriesObj.cpcontentid,
                                    contenttype: enums.MediaType.SERIES.value
                                };
                                resolve(reback);
                            } else {
                                var arr = [];
                                console.log("match series result");
                                console.log(resp.body);
                                for (var item in resp.body) {
                                    if (resp.body[item].contentproviders && resp.body[item].contentproviders.isunified == 1) {
                                        var mainMedia = {};
                                        if (seriesObj.cpcode == resp.body[item].contentproviders.code) {
                                            if (arr.length > 0) {
                                                arr.splice(0, arr.length);
                                            }
                                            mainMedia.status = 1;
                                            mainMedia.unifiedseriescode = resp.body[item].code;
                                            mainMedia.cpcontentid = seriesObj.cpcontentid;
                                            mainMedia.cpcode = seriesObj.cpcode;
                                            mainMedia.isunified = 0;
                                            arr.push(mainMedia);
                                            break;
                                        } else {
                                            mainMedia.status = 0;
                                            mainMedia.unifiedseriescode = resp.body[item].code;
                                            mainMedia.cpcontentid = seriesObj.cpcontentid;
                                            mainMedia.cpcode = seriesObj.cpcode;
                                            mainMedia.isunified = 0;
                                            arr.push(mainMedia);
                                        }
                                    }
                                }
                                if (arr.length <= 0) {
                                    reback.code = 404;
                                    reback.message = seriesObj.cpcontentid + " match unifiedSeries null at " + new Date();
                                    reback.data = {
                                        cpcontentid: seriesObj.cpcontentid,
                                        contenttype: enums.MediaType.SERIES.value
                                    };
                                    resolve(reback);
                                } else {
                                    reback.code = 200;
                                    reback.message = seriesObj.cpcontentid + " match unifiedSeries success at" + new Date();
                                    reback.data = arr;
                                    resolve(reback);
                                }
                            }
                        }
                    })
            })

        },
        getUnifiedseries: function (code) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var filter = {};
                filter.where = {};
                filter.where.code = code;
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedseries/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = "get us code " + code + " success at " + new Date();
                            resolve(reback)
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = null;
                            reback.message = "get us code " + code + " failed at " + new Date();
                            reject(reback);
                        }
                    })
            })
        },
        getProgramsBySeries: function (showid) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var req = unirest.get(conf.strongLoopApi + "Programs?filter[where][showid]=" + showid)
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = showid + " get programs success at " + new Date();
                            resolve(reback)
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = null;
                            reback.message = showid + " get programs failed at " + new Date();
                            reject(reback);
                        }
                    })
            })
        },
        getUnifiedProgramprogram: function (cpcontentid) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedprogramprograms/findOne?filter[where][cpcontentid]=" + cpcontentid))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = cpcontentid + " exists in upp";
                            resolve(reback);
                        } else {
                            if (resp.status == 404) {
                                reback.code = resp.statusCode;
                                reback.data = resp.body;
                                reback.message = cpcontentid + " not in upp at " + new Date();
                                resolve(reback);
                            } else {
                                reback.code = resp.statusCode;
                                reback.data = null;
                                reback.meessge = cpcontentid + " search err at " + new Date();
                                reject(reback);
                            }
                        }
                    })
            })
        },
        getUnifiedProgramprogramByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedprogramprograms/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = "obj exists in upp at " + new Date();
                            resolve(reback);
                        } else {
                            if (resp.status == 404) {
                                reback.code = resp.statusCode;
                                reback.data = resp.body;
                                reback.message = "obj not in upp at " + new Date();
                                resolve(reback);
                            } else {
                                reback.code = resp.statusCode;
                                reback.data = resp.body.error;
                                reback.meessge = "obj search err at " + new Date();
                                reject(reback);
                            }
                        }
                    })
            })
        },
        getUnifiedprogram: function (unifiedseriescode, volumncount) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var filter = {where: {unifiedseriescode: unifiedseriescode, volumncount: volumncount}};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedprograms/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = unifiedseriescode + " unifiedseriescode " + volumncount + " volumncount in up at " + new Date();
                            resolve(reback);
                        } else {
                            if (resp.status == 404) {
                                reback.code = resp.statusCode;
                                reback.data = null;
                                reback.messge = unifiedseriescode + " unifiedseriescode " + volumncount + " volumncount not in up at " + new Date();
                                resolve(reback);
                            } else {
                                reback.code = resp.statusCode;
                                reback.data = null;
                                reback.messge = unifiedseriescode + " unifiedseriescode " + volumncount + " volumncount err in up at " + new Date();
                                reject(reback);
                            }
                        }
                    })
            })
        },
        getUnifiedprogramByCode: function (code) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var filter = {};
                filter.where = {"code": code};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedprograms/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = code + " unifiedprogramcode in up at " + new Date();
                            resolve(reback);
                        } else {
                            if (resp.status == 404) {
                                reback.code = resp.statusCode;
                                reback.data = null;
                                reback.messge = code + " unifiedprogramcode not in up at " + new Date();
                                resolve(reback);
                            } else {
                                reback.code = resp.statusCode;
                                reback.data = null;
                                reback.messge = code + " unifiedprogramcode  err in up at " + new Date();
                                reject(reback);
                            }
                        }
                    })
            })
        },
        getMovieByProgram: function (unifiedprogramObj) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var filter = {where: {cpcontentid: unifiedprogramObj.cpcontentid, iscompleted: 1, isunified: {neq: 1}}};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Movies?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = resp.statusCode;
                            var movieList = resp.body;
                            if (movieList instanceof Array) {
                                movieList.forEach(function (item, index) {
                                    if (item.type == 0) {
                                        if (item.downloadstatus == 2) {
                                            if (unifiedprogramObj.unifiedprogramcode) {
                                                item.unifiedprogramcode = unifiedprogramObj.unifiedprogramcode;
                                            } else {
                                                item.unifiedprogramcode = unifiedprogramObj.code;
                                            }
                                            item.unifiedseriescode = unifiedprogramObj.unifiedseriescode;
                                            item.unifiedseriescpcontentid = unifiedprogramObj.unifiedseriescpcontentid;
                                            item.unifiedprogramcpcontentid = unifiedprogramObj.cpcontentid;
                                        } else {
                                            movieList.splice(index, 1);
                                        }
                                    } else {
                                        if (item.transcodestatus == 20) {
                                            if (unifiedprogramObj.unifiedprogramcode) {
                                                item.unifiedprogramcode = unifiedprogramObj.unifiedprogramcode;
                                            } else {
                                                item.unifiedprogramcode = unifiedprogramObj.code;
                                            }
                                            item.unifiedseriescode = unifiedprogramObj.unifiedseriescode;
                                            item.unifiedseriescpcontentid = unifiedprogramObj.unifiedseriescpcontentid;
                                            item.unifiedprogramcpcontentid = unifiedprogramObj.cpcontentid;
                                        } else {
                                            movieList.splice(index, 1);
                                        }
                                    }
                                })
                            } else {
                                movieList = [];
                            }
                            reback.data = movieList;
                            reback.message = unifiedprogramObj.cpcontentid + " get movies success at " + new Date();
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = resp.body;
                            reback.message = unifiedprogramObj.cpcontentid + " get movies failed at " + new Date();
                            reject(reback);
                        }
                    })
            })

        },
        getImportDetail: function (id) {
            return new Promise(function (resolve, reject) {
                var filter = {where: {id: id, status: 0}};
                unirest.get(encodeURI(conf.strongLoopApi + "Importmediadetails/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            resolve(resp.body)
                        } else {
                            reject(resp.body.error);
                        }
                    })
            })
        },
        getBitRate: function (name) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var filter = {where: {name: escape(name)}};
                unirest.get(encodeURI(conf.strongLoopApi + "Bitrates/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.message = "get bitRate success at " + new Date();
                            reback.data = resp.body;
                            resolve(reback);
                        } else {
                            reback.code = resp.code;
                            reback.message = "get bitRate failed at " + new Date();
                            reback.data = resp.body.error;
                            resolve(reback);
                        }
                    })
            });
        },
        getMovieByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                console.log(filter);
                unirest.get(encodeURI(conf.strongLoopApi + "Movies/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption).end(function (resp) {
                    if (resp.status == 200) {
                        reback.code = 200;
                        reback.message = "find end product movie success at " + new Date();
                        reback.data = resp.body;
                        resolve(reback);
                    } else if (resp.status == 404) {
                        reback.code = resp.statusCode;
                        reback.message = "not find end product movie at " + new Date();
                        reback.data = null;
                        resolve(reback);
                    } else {
                        reback.code = resp.statusCode;
                        reback.message = "request end product movie at " + new Date();
                        reback.data = resp.body.error;
                        reject(reback);
                    }
                })
            })
        },
        getUnifiedseriesseriesByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                unirest.get(encodeURI(conf.strongLoopApi + "/Unifiedseriesseries/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.message = "get uss info by filter success at " + new Date();
                            reback.data = resp.body;
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.message = "get uss info by filter failed at " + new Date();
                            reback.data = resp.body.error;
                            reject(reback);
                        }
                    })
            })
        },
        getImportMediaDetailCount: function (conditions) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                unirest.get(encodeURI(conf.strongLoopApi + "Importmediadetails/count?where=" + JSON.stringify(conditions)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.message = "get Importmediadetails count success at " + new Date();
                            reback.data = resp.body.count;
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.message = "get Importmediadetails count failed at " + new Date();
                            reback.data = resp.body.error;
                            reject(reback);
                        }
                    })

            });
        },
        getProgramTypeByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                unirest.get(encodeURI(conf.strongLoopApi + "Programtypes/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = resp.statusCode;
                            reback.data = resp.body;
                            reback.message = "get programtype success at " + new Date();
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = resp.body.error;
                            reback.message = "get programtype failed at " + new Date();
                            reject(reback);
                        }
                    })
            })
        },
        getPackageDomain: function (uscode) {
            return new Promise(function (resolve, reject) {
                sequelize.query("select dm.cmsID as cmsid,dm.sopID as sopid,dm.`name` as domainname, pd.domainCode as domaincode,pd.actionType as actiontype, pk.priority as priority from PackageUnifiedseries as pu,PackageDomain as pd,Package as pk,Domain as dm where pu.packageId=pd.packageId  and pu.packageId=pk.id and dm.code=pd.domainCode and  pu.unifiedseriesCode = :unifiedseriesCode and pd.status=1",
                    {replacements: {unifiedseriesCode: uscode}, type: sequelize.QueryTypes.SELECT}
                ).then(function (packageDomains) {
                    resolve(packageDomains);
                }).catch(function (err) {
                    reject(err);
                })
            })
        },
        getDomainTaskSPMInfo: function (upcode, umcode) {
            return new Promise(function (resolve, reject) {
                sequelize.query("SELECT up.unifiedSeriesName as seriesName,up.`name` as programName,up.programType as category,um.code,um.playURL from UnifiedProgram as up,UnifiedMovie as um where um.unifiedProgramCode=up.code  and up.code=:upcode and um.code=:umcode",
                    {
                        replacements: {upcode: upcode, umcode: umcode},
                        type: sequelize.QueryTypes.SELECT,
                        plain: true
                    }).then(function (pmInfo) {
                    resolve(pmInfo);
                }).catch(function (err) {
                    reject(err);
                })
            })
        },
        getUsByCode: function (code) {
            return new Promise(function (resolve, reject) {
                sequelize.query('select * from UnifiedSeries where code=:code', {
                    replacements: {code: code},
                    type: sequelize.QueryTypes.SELECT,
                    plain: true
                }).then(function (unifiedSeries) {
                    resolve(unifiedSeries);
                }).catch(function (err) {
                    reject(err);
                })
            })
        },
        getUpByCode: function (code) {
            return new Promise(function (resolve, reject) {
                sequelize.query('select * from UnifiedProgram where code=:code', {
                    replacements: {code: code},
                    type: sequelize.QueryTypes.SELECT,
                    plain: true
                }).then(function (unifiedProgram) {
                    resolve(unifiedProgram);
                }).catch(function (err) {
                    reject(err);
                })
            })
        },
        getUmByCode: function (code) {
            return new Promise(function (resolve, reject) {
                sequelize.query('select * from UnifiedMovie where code=:code', {
                    replacements: {code: code},
                    type: sequelize.QueryTypes.SELECT,
                    plain: true
                }).then(function (unifiedMovie) {
                    resolve(unifiedMovie);
                }).catch(function (err) {
                    reject(err);
                })
            })
        },
        getSPMCodeList: function (uscode) {
            return new Promise(function (resolve, reject) {
                sequelize.query('select up.unifiedSeriesCode as seriescode,up.unifiedSeriesName as seriesname,up.programType as category,up.code as programcode,up.name as programname, um.code as moviecode ,um.playURL as playurl from UnifiedProgram as up,UnifiedMovie as um where up.code=um.unifiedProgramCode and up.unifiedSeriesCode=:code', {
                    replacements: {code: uscode},
                    type: sequelize.QueryTypes.SELECT
                }).then(function (list) {
                    resolve(list);
                }).catch(function (err) {
                    reject(err);
                })
            })
        },
        getDomain: function (condition) {
            return new Promise(function (resolve, reject) {
                unirest.get(encodeURI(conf.strongLoopApi + "Domains/findOne?filter=" + JSON.stringify(condition)))
                    .pool(conf.poolOption).end(function (resp) {
                    if (resp.status == 200) {
                        resolve(resp.body);
                    } else {
                        reject(resp.body.error);
                    }
                })
            })
        },
        getSPMCodeListByPackageId: function (packageId, domainCode) {
            return new Promise(function (resolve, reject) {
                sequelize.query("select dm.cmsid as cmsid,dm.sopid as sopid,dm.name as domainname,pd.domainCode as domaincode,pu.unifiedSeriesCode as seriescode,up.code as programcode,up.unifiedSeriesName as seriesname,up.name as programname, up.programType as category,um.code as moviecode,um.playURL as playurl,pd.actionType as actiontype from PackageDomain as pd,PackageUnifiedseries as pu,UnifiedProgram as up,UnifiedMovie as um,Domain as dm where pd.packageId=pu.packageId and dm.code=pd.domainCode and pu.unifiedseriesCode=up.unifiedSeriesCode and up.code=um.unifiedProgramCode and pd.packageId=:packageId and pd.domainCode=:domainCode", {
                    replacements: {packageId: packageId, domainCode: domainCode},
                    type: sequelize.QueryTypes.SELECT
                }).then(function (list) {
                    resolve(list)
                }).catch(function (err) {
                    reject(err);
                })
            })
        },
        sendDomainTask: function (interfaceUrl, obj) {
            console.log(obj);
            return new Promise(function (resolve, reject) {
                unirest.post(interfaceUrl).pool(conf.poolOption)
                    .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                    .send(obj)
                    .end(function (resp) {
                        console.log(resp.body);
                        if (resp.status == 200) {
                            resolve(resp.body);
                        } else {
                            console.error(resp.body);
                            reject(resp.body);
                        }
                    })
            });
        },
        getCpsMediaList: function (params) {
            return new Promise(function (resolve, reject) {
                console.log(encodeURI(conf.cps_prefix_test + "/contentPackage/mediaList?" + params));
                unirest.get(encodeURI(conf.cps_prefix_test + "/contentPackage/mediaList?" + params))
                    .headers({"Authorization": "Basic YmlnbWVkaWE6Y2libmF1dGg="})
                    .end(function (resp) {
                        if (resp.status == 200) {
                            if (resp.body.code == 200) {
                                console.log(resp.body.msg);
                                resolve(resp.body.data);
                            } else {
                                reject({Error: "return value code is " + resp.body.code + " message is " + resp.body.msg});
                            }
                        } else {
                            reject({Error: "http status is not 200"})
                        }
                    })
            })
        },
        getCpsMediaInfo: function (vid, sid, token) {
            return new Promise(function (resolve, reject) {
                unirest.get(encodeURI(conf.cps_prefix_test + "/contentPackage/mediaInfo?appId=" + conf.appId + "&vid=" + vid + "&sid=" + sid + "&token=" + token))
                    .pool(conf.poolOption)
                    .headers({"Authorization": "Basic YmlnbWVkaWE6Y2libmF1dGg="})
                    .end(function (resp) {
                        if (resp.status == 200) {
                            if (resp.body.code == 200) {
                                resolve(resp.body.data);
                            } else {
                                reject({Error: "return value code is " + resp.body.code + " message is " + resp.body.msg})
                            }
                        } else {
                            reject({Error: "http status is not 200"});
                        }
                    })
            })
        },
        getCpsMediaListSeries: function (vid, token) {
            return new Promise(function (resolve, reject) {
                unirest.get(encodeURI(conf.cps_prefix_test + "/contentPackage/mediaList/series?appId=" + conf.appId + "&vid=" + vid + "&token=" + token))
                    .pool(conf.pool)
                    .headers({"Authorization": "Basic YmlnbWVkaWE6Y2libmF1dGg="})
                    .end(function (resp) {
                        if (resp.status == 200) {
                            if (resp.body.code == 200) {
                                console.log(resp.body.msg);
                                resolve(resp.body.data);
                            } else {
                                console.error(resp.body.msg);
                                reject({Error: "return value code is " + resp.body.code + " message is " + resp.body.msg});
                            }
                        } else {
                            reject({Error: "http status is not 200"});
                        }
                    })
            })
        },
        getSensitivewordsseriesByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Sensitivewordsseries/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = "get Sensitivewordsseries success at " + new Date();
                            resolve(reback);
                        } else if (resp.status == 404) {
                            reback.code = resp.statusCode;
                            reback.data = null;
                            reback.message = "not find  Sensitivewordsseries at " + new Date();
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = resp.body.error;
                            reback.message = "get Sensitivewordsseries error at " + new Date();
                            reject(reback);
                        }
                    })
            })
        },
        getSensitivewordsprogramByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Sensitivewordsprograms/findOne?filter=" + JSON.stringify(filter)))
                    .pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = "get Sensitivewordsprograms success at " + new Date();
                            resolve(reback);
                        } else if (resp.status == 404) {
                            reback.code = resp.statusCode;
                            reback.data = null;
                            reback.message = "not find  Sensitivewordsprograms at " + new Date();
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = resp.body.error;
                            reback.message = "get Sensitivewordsprograms error at " + new Date();
                            reject(reback);
                        }
                    })
            })
        },
        getUnunifiedmediaByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Ununifiedmedia/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = "get Ununifiedmedia success at " + new Date();
                            resolve(reback);
                        } else if (resp.status == 404) {
                            reback.code = resp.statusCode;
                            reback.data = null;
                            reback.message = "not find  Ununifiedmedia at " + new Date();
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = resp.body.error;
                            reback.message = "get Ununifiedmedia error at " + new Date();
                            reject(reback);
                        }
                    })
            })
        },
        getUnifiedSeriesByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                var reback = {};
                var req = unirest.get(encodeURI(conf.strongLoopApi + "Unifiedseries/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = "get unifiedseries success at " + new Date();
                            resolve(reback);
                        } else if (resp.status == 404) {
                            reback.code = resp.statusCode;
                            reback.data = null;
                            reback.message = "not find unifiedseries at " + new Date();
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = resp.body.error;
                            reback.message = "find unifiedseries error at " + new Date();
                            reject(reback);
                        }
                    })
            })
        },
        getSPMAlertRecordByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                spm_alert_record.findAll(filter).then(function (result) {
                    resolve(result);
                }).catch(function (err) {
                    reject(err);
                });
            })
        },
        getCpInfo: function (filter) {
            return new Promise(function (resolve, reject) {
                unirest.get(encodeURI(conf.strongLoopApi + "Contentproviders/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
                    .end(function (resp) {
                        console.log(resp.body)
                        if (resp.status == 200) {
                            resolve({code: 200, data: resp.body});
                        } else {
                            resolve({code: 404, data: null});
                        }
                    })
            })
        },
        getProgramByFilter: function (filter) {
            return new Promise(function (resolve, reject) {
                return unirest.get(encodeURI(conf.strongLoopApi + "Programs/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
                    .end(function (resp) {
                        var reback = {};
                        if (resp.status == 200) {
                            reback.code = 200;
                            reback.data = resp.body;
                            reback.message = JSON.stringify(filter) + " program  find at " + new Date();
                            resolve(reback);
                        } else if (resp.status == 404) {
                            reback.code = resp.statusCode;
                            reback.data = null;
                            reback.messge = JSON.stringify(filter) + " program not find at " + new Date();
                            resolve(reback);
                        } else {
                            reback.code = resp.statusCode;
                            reback.data = null;
                            reback.messge = JSON.stringify(filter) + " program error at " + new Date();
                            reject(reback);
                        }
                    })
            })
        }
    }
    return _searchDatabase;
})
();
module.exports = SearchDatabase;

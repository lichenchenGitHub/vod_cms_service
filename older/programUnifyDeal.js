/**
 * Created by lichenchen on 2017/11/22.
 */
var unirest = require("unirest");
var Promise = require("bluebird");
var fs = require("fs");
var SearchDatabase = require("../lib/searchDatabase");
var searchDatabase = new SearchDatabase();
var JobEnterDatabase = require("../lib/jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
var Enums = require("../lib/enums");
var enums = new Enums();
var TransformObject = require("../lib/transformObject");
var transformObject = new TransformObject();
var generateUniqueCode = require("../lib/generateUniqueCode");
var conf = require("../conf/config.json");
const Writable = require('stream').Writable;
const StringDecoder = require('string_decoder').StringDecoder;
const byline = require('byline');
class QueryDataStream extends Writable {
    constructor(options) {
        // Calls the stream.Writable() constructor
        super(options);
        // ...
    }

    _write(chunk, enc, done) {
        var decoder = new StringDecoder('utf8');
        var content = decoder.write(chunk);
        var arr = content.split("\t");
        var unifiedProgramCode = arr[0].replace(/(^\s*)|(\s*$)/g, "");
        var cpcontentid = arr[1].replace(/(^\s*)|(\s*$)/g, "");
        console.log("unifiedProgramCode is :" + unifiedProgramCode);
        console.log("cpcontentid is :" + cpcontentid);
        var programUnified = function (upcode, cpcontentid) {
            return new Promise(function (resolve, reject) {
                return Promise.join(searchDatabase.getUnifiedprogramByCode(upcode), searchDatabase.getProgramByFilter({where: {cpcontentid: cpcontentid}}), function (unifiedProgramResult, programResult) {
                    if (unifiedProgramResult.code == 200 && programResult.code == 200) {
                        var unifiedProgram = unifiedProgramResult.data;
                        var program = programResult.data;
                        if (unifiedProgram.cpcontentid == program.cpcontentid) {
                            resolve({
                                code: 201,
                                result: true,
                                message: "code :" + upcode + " cpcontentid :" + cpcontentid + " is main media at " + new Date()
                            })
                        } else {
                            if (unifiedProgram.srccpcode == program.cpcode && unifiedProgram.volumncount == program.volumncount && unifiedProgram.movietype1 == program.videotype) {
                                resolve({
                                    code: 201,
                                    result: true,
                                    message: "code :" + upcode + " cpcontentid :" + cpcontentid + " is binded with main media at " + new Date()
                                })
                            }
                            else if (program.cpcode == "YOUKU" && unifiedProgram.srccpcode == program.cpcode && program.showid == unifiedseriescpcontentid && unifiedProgram.volumncount == program.volumncount && unifiedProgram.movietype1 != program.videotype) {
                                var unifiedProgramObj = transformObject.transUnifiedprogram(program, {
                                    code: unifiedProgram.unifiedseriescode,
                                    cpcontentid: unifiedProgram.unifiedseriescpcontentid,
                                    name: unifiedProgram.unifiedseriesname,
                                    scriptwriter: unifiedProgram.scriptwriter
                                })
                                unifiedProgramObj.createtime = new Date();
                                unifiedProgramObj.updatetime = new Date();
                                return generateUniqueCode.createUnifiedprogramCode(enums.Project.CMS.value, enums.Code.PROGRAM).then(function (unifiedprogramCode) {
                                    unifiedProgramObj.code = unifiedprogramCode;
                                    return unirest.post(encodeURI(conf.strongLoopApi + "Unifiedprograms")).pool(conf.poolOption)
                                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                                        .send(unifiedProgramObj)
                                        .end(function (resp) {
                                            if (resp.status == 200) {
                                                var upWhere = {cpcontentid: unifiedProgramObj.cpcontentid};
                                                return unirest.post(encodeURI(conf.strongLoopApi + "Unifiedprogramprograms/update?where=" + JSON.stringify(upWhere))).pool(conf.poolOption)
                                                    .headers({
                                                        'Accept': 'application/json',
                                                        'Content-Type': 'application/json'
                                                    })
                                                    .send({unifiedprogramcode: unifiedprogramCode})
                                                    .end(function (upResult) {
                                                        if (upResult.status == 200) {
                                                            console.log(cpcontentid + ":up update " + upResult.body.count + " item");
                                                            var umWhere = {unifiedprogramcpcontentid: unifiedProgramObj.cpcontentid};
                                                            return unirest.post(encodeURI(conf.strongLoopApi + "Unifiedmovies/update?where=" + JSON.stringify(umWhere))).pool(conf.poolOption)
                                                                .headers({
                                                                    'Accept': 'application/json',
                                                                    'Content-Type': 'application/json'
                                                                })
                                                                .send({
                                                                    unifiedprogramcode: unifiedprogramCode,
                                                                    updatetime: new Date()
                                                                })
                                                                .end(function (umResult) {
                                                                    if (umResult.status == 200) {
                                                                        console.log(cpcontentid + ":um update " + umResult.body.count + " item");
                                                                        resolve({
                                                                            code: 200,
                                                                            result: true,
                                                                            message: "code :" + upcode + " cpcontentid :" + cpcontentid + " is competed at " + new Date()
                                                                        });
                                                                    } else {
                                                                        console.error(umResult.body.error);
                                                                        resolve({
                                                                            code: 503,
                                                                            result: true,
                                                                            message: "code :" + upcode + " cpcontentid :" + cpcontentid + "update upp success,but update um failed at " + new Date()
                                                                        })
                                                                    }
                                                                })
                                                        } else {
                                                            console.error(upResult.body.error);
                                                            resolve({
                                                                code: 502,
                                                                result: true,
                                                                message: "code :" + upcode + " cpcontentid :" + cpcontentid + "upsert up success,but update upp failed at " + new Date()
                                                            })
                                                        }
                                                    })
                                            } else {
                                                if (resp.status == 500) {
                                                    if (resp.body.error.code == "ER_DUP_ENTRY") {
                                                        console.log(resp.body.error);
                                                        resolve({
                                                            code: 200,
                                                            result: true,
                                                            message: "code :" + upcode + " cpcontentid :" + cpcontentid + " exsits in main media at " + new Date()
                                                        });
                                                    } else {
                                                        console.error(resp.body.error);
                                                        resolve({
                                                            code: 501,
                                                            result: false,
                                                            message: "code :" + upcode + " cpcontentid :" + cpcontentid + " create main media error at " + new Date()
                                                        });
                                                    }
                                                } else {
                                                    console.error(resp.body.error);
                                                    resolve({
                                                        code: 501,
                                                        result: false,
                                                        message: "code :" + upcode + " cpcontentid :" + cpcontentid + " create main media error at " + new Date()
                                                    });
                                                }

                                            }

                                        })
                                })
                            }
                            else if (program.cpcode == "YOUKU" && unifiedProgram.srccpcode == program.cpcode && (unifiedProgram.volumncount != program.volumncount || unifiedProgram.unifiedseriescpcontentid != program.showid)) {
                                var unifiedProgramObj = transformObject.transUnifiedprogram(program, {
                                    code: unifiedProgram.unifiedseriescode,
                                    cpcontentid: unifiedProgram.unifiedseriescpcontentid,
                                    name: unifiedProgram.unifiedseriesname,
                                    scriptwriter: unifiedProgram.scriptwriter
                                })
                                unifiedProgramObj.unifiedseriescpcontentid = program.showid;
                                unifiedProgramObj.createtime = new Date();
                                unifiedProgramObj.updatetime = new Date();
                                return generateUniqueCode.createUnifiedprogramCode(enums.Project.CMS.value, enums.Code.PROGRAM).then(function (unifiedprogramCode) {
                                    unifiedProgramObj.code = unifiedprogramCode;
                                    return unirest.post(encodeURI(conf.strongLoopApi + "Unifiedprograms")).pool(conf.poolOption)
                                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                                        .send(unifiedProgramObj)
                                        .end(function (resp) {
                                            if (resp.status == 200) {
                                                var upWhere = {cpcontentid: unifiedProgramObj.cpcontentid};
                                                return unirest.post(encodeURI(conf.strongLoopApi + "Unifiedprogramprograms/update?where=" + JSON.stringify(upWhere))).pool(conf.poolOption)
                                                    .headers({
                                                        'Accept': 'application/json',
                                                        'Content-Type': 'application/json'
                                                    })
                                                    .send({unifiedprogramcode: unifiedprogramCode})
                                                    .end(function (upResult) {
                                                        if (upResult.status == 200) {
                                                            console.log(cpcontentid + ":up update " + upResult.body.count + " item");
                                                            var mWhere = {cpcontentid: unifiedProgramObj.cpcontentid};
                                                            return unirest.post(encodeURI(conf.strongLoopApi + "Movies/update?where=" + JSON.stringify(mWhere))).pool(conf.poolOption)
                                                                .headers({
                                                                    'Accept': 'application/json',
                                                                    'Content-Type': 'application/json'
                                                                })
                                                                .send({
                                                                    isunified: 0,
                                                                    updatetime: new Date()
                                                                })
                                                                .end(function (mResult) {
                                                                    if (mResult.status == 200) {
                                                                        console.log(cpcontentid + ":um update " + mResult.body.count + " item");
                                                                        resolve({
                                                                            code: 200,
                                                                            result: true,
                                                                            message: "code :" + upcode + " cpcontentid :" + cpcontentid + " is competed at " + new Date()
                                                                        });
                                                                    } else {
                                                                        console.error(mResult.body.error);
                                                                        resolve({
                                                                            code: 503,
                                                                            result: true,
                                                                            message: "code :" + upcode + " cpcontentid :" + cpcontentid + "update upp success,but update m failed at " + new Date()
                                                                        })
                                                                    }
                                                                })
                                                        } else {
                                                            console.error(upResult.body.error);
                                                            resolve({
                                                                code: 502,
                                                                result: true,
                                                                message: "code :" + upcode + " cpcontentid :" + cpcontentid + "upsert up success,but update upp failed at " + new Date()
                                                            })
                                                        }
                                                    })
                                            } else {
                                                if (resp.status == 500) {
                                                    if (resp.body.error.code == "ER_DUP_ENTRY") {
                                                        console.log(resp.body.error);
                                                        resolve({
                                                            code: 200,
                                                            result: true,
                                                            message: "code :" + upcode + " cpcontentid :" + cpcontentid + " exsits in main media at " + new Date()
                                                        });
                                                    } else {
                                                        console.error(resp.body.error);
                                                        resolve({
                                                            code: 501,
                                                            result: false,
                                                            message: "code :" + upcode + " cpcontentid :" + cpcontentid + " create main media error at " + new Date()
                                                        });
                                                    }
                                                } else {
                                                    console.error(resp.body.error);
                                                    resolve({
                                                        code: 501,
                                                        result: false,
                                                        message: "code :" + upcode + " cpcontentid :" + cpcontentid + " create main media error at " + new Date()
                                                    });
                                                }

                                            }

                                        })
                                })
                            }
                            else {
                                resolve({
                                    code: 504,
                                    result: false,
                                    message: "code :" + upcode + " cpcontentid :" + cpcontentid + " is unified un find type  at " + new Date()
                                })
                            }
                        }

                    } else {
                        console.error("code :" + upcode + " cpcontentid :" + cpcontentid + " program or unifiedProgram not exsits at " + new Date())
                        resolve({
                            code: 500,
                            result: false,
                            message: "code :" + upcode + " cpcontentid :" + cpcontentid + " create main media error at " + new Date()
                        });
                    }
                }).catch(function (err) {
                    console.error(JSON.stringify(err));
                    reject(err);
                })
            })
        }
        programUnified(unifiedProgramCode, cpcontentid).then(function (result) {
            if (result.code == 200 || result.code == 201) {
                console.log(result);
                done(null, chunk);
            } else {
                console.error(result);
                done(null, chunk);
            }
        }).catch(function (err) {
            console.error(err);
            done(null, chunk);
        })
    }
}
var queryDataStream = new QueryDataStream({objectMode: true});
var rs = fs.createReadStream("./restart.txt", {encoding: 'utf-8'});
byline.createStream(rs).pipe(queryDataStream);

/**
 * Created by lichenchen on 2017/11/28.
 */
/**
 * Created by lichenchen on 2017/11/20.
 */
const unirest = require("unirest");
const conf = require("../conf/config.json");
const Promise = require("bluebird");
const sequelize = require("../lib/sequelize");
const fs = require("fs");
const Writable = require('stream').Writable;
var Enums = require("../lib/enums");
var enums = new Enums();
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
        var cpcontentid = arr[1].replace(/(^\s*)|(\s*$)/g, "");
        var vid = cpcontentid.split("_")[1];
        var unifiedProgramCode = arr[0].replace(/(^\s*)|(\s*$)/g, "")
        var checkVideoType = function (vid) {
            return new Promise(function (resolve, reject) {
                try {
                    unirest.get(encodeURI(conf.youkuOpenApi.program_prefix + vid)).pool(conf.poolOption)
                        .end(function (resp) {
                            if (resp.status == 200) {
                                if (resp.body && typeof(resp.body.show) != "undefined" && resp.body.show && resp.body.show.type) {
                                    resolve({code: 200, data: resp.body.show.type});
                                } else {
                                    resolve({code: 204, message: vid + " :get show error"});
                                }
                            } else {
                                console.error(vid + " " + resp.status + " error at " + new Date());
                                resolve({code: resp.statusCode, data: null});
                            }
                        })
                } catch (e) {
                    resolve({code: 500, data: JSON.stringify(e)});
                }
            })
        }
        checkVideoType(vid).then(function (result) {
                if (result.code == 200) {
                    done(null,chunk);
                } else if (result.code == 204) {
                    try {
                        sequelize.query("update Program set videoType=:videoType,videoDesc=:videoDesc,updateTime=:updateTime where cpContentID= :cpContentID", {
                            replacements: {
                                cpContentID: cpcontentid,
                                videoType: enums.VideoType.OTHER.value,
                                videoDesc: enums.VideoType.OTHER.name,
                                updateTime: new Date()
                            },
                            type: sequelize.QueryTypes.UPDATE
                        }).spread(function (results, metadata) {
                            sequelize.query("insert into UnunifiedMedia (cpContentID,contentType,status) values (:cpContentID,2,1)", {
                                replacements: {
                                    cpContentID: cpcontentid
                                },
                                type: sequelize.QueryTypes.INSERT
                            }).spread(function (results, metadata) {
                                done(null, chunk);
                                sequelize.query("delete from UnifiedprogramProgram where cpContentID= :cpContentID", {
                                    replacements: {
                                        cpContentID: cpcontentid
                                    },
                                    type: sequelize.QueryTypes.DELETE
                                }).spread(function (results, metadata) {
                                    console.log(vid + " delete success at " + new Date())
                                    done(null, chunk);
                                }).catch(function (err) {
                                    console.error(err);
                                    done(null, chunk);
                                })
                            }).catch(function (err) {
                                if (err.original.code = "ER_DUP_ENTRY") {
                                    sequelize.query("delete from UnifiedprogramProgram where cpContentID= :cpContentID", {
                                        replacements: {
                                            cpContentID: cpcontentid
                                        },
                                        type: sequelize.QueryTypes.DELETE
                                    }).spread(function (results, metadata) {
                                        console.log(vid + " delete success at " + new Date())
                                        done(null, chunk);
                                    }).catch(function (err) {
                                        console.error("error is :")
                                        console.error(err);
                                        done(null, chunk);
                                    })
                                } else {
                                    console.error(err);
                                    done(null, chunk);
                                }
                            })
                        }).catch(function (err) {
                            console.error(err);
                            done(null, chunk);
                        })

                    } catch (e) {
                        console.error(JSON.stringify(e));
                        done(null, chunk);
                    }
                }

                else {
                    console.error(vid + ": get api info error at" + new Date());
                    done(null, chunk);
                }
            }
        )

    }
}
var queryDataStream = new QueryDataStream({objectMode: true});
var rs = fs.createReadStream("./restart.txt", {encoding: 'utf-8'});
byline.createStream(rs).pipe(queryDataStream);

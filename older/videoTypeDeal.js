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
                                    resolve({code: 200, data: "正片"});
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
                    var type = result.data;
                    var typeCount = 7;
                    for (var key in enums.VideoType) {
                        if (enums.VideoType[key].name == type) {
                            typeCount = enums.VideoType[key].value;
                            break;
                        }
                    }
                    sequelize.query("update Program set videoType=:videoType,videoDesc=:videoDesc,updateTime=:updateTime where cpContentID= :cpContentID", {
                        replacements: {
                            videoType: typeCount,
                            videoDesc: type,
                            cpContentID: cpcontentid,
                            updateTime: new Date()
                        },
                        type: sequelize.QueryTypes.UPDATE
                    }).spread(function (results, metadata) {
                        sequelize.query("update UnifiedProgram set movieType1=:movieType1,updateTime=:updateTime where code=:code", {
                            replacements: {
                                movieType1: typeCount,
                                code: unifiedProgramCode,
                                updateTime: new Date()
                            },
                            type: sequelize.QueryTypes.UPDATE
                        }).spread(function (results, metadata) {
                            console.log(vid + " update suceess at " + new Date());
                            done(null, chunk);
                        })

                    }).catch(function (err) {
                        console.error(JSON.stringify(err) + " at " + new Date())
                        done(null, chunk);
                    })
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
var rs = fs.createReadStream("./uppErrors.txt", {encoding: 'utf-8'});
byline.createStream(rs).pipe(queryDataStream);
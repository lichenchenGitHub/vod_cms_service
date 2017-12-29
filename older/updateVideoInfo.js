/**
 * Created by lichenchen on 2017/11/27.
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
        var cpcontentid = arr[0].replace(/(^\s*)|(\s*$)/g, "");
        var vid = cpcontentid.split("_")[1];
        var showid = arr[1].replace(/(^\s*)|(\s*$)/g, "");
        var youkuShowid = showid.split("_")[1];
        var checkVideoType = function (vid) {
            return new Promise(function (resolve, reject) {
                try {
                    unirest.get(encodeURI(conf.youkuOpenApi.program_prefix + vid)).pool(conf.poolOption)
                        .end(function (resp) {
                            if (resp.status == 200) {
                                var reback = {};
                                if (resp.body && typeof(resp.body.show) != "undefined" && resp.body.show) {
                                    if (resp.body.show.type) {
                                        reback.type = resp.body.show.type;
                                    }
                                    if (resp.body.show.seq) {
                                        reback.volumnCount = resp.body.show.seq;
                                    }
                                    if (resp.body.show.stage) {
                                        reback.stage = resp.body.show.stage;
                                    }
                                    if (resp.body.show.id) {
                                        reback.id = resp.body.show.id;
                                    }
                                    if (reback.type && reback.volumnCount && reback.stage) {
                                        reback.code = 200;
                                        resolve(reback);
                                    } else {
                                        console.error(vid + " get showinfo error at  " + new Date())
                                        reback.code = 204;
                                        resolve(reback);

                                    }
                                } else {
                                    console.error(vid + " get showinfo error at " + new Date())
                                    resolve({code: 204});
                                }
                            } else {
                                console.error(vid + " " + resp.status + " error at " + new Date());
                                resolve({code: resp.statusCode});
                            }
                        })
                } catch (e) {
                    console.error(JSON.stringify(e));
                    resolve({code: 500});
                }
            })
        }
        checkVideoType(vid).then(function (result) {
                if (result.code == 200) {
                    var type = result.type;
                    var typeCount = 7;
                    for (var key in enums.VideoType) {
                        if (enums.VideoType[key].name == type) {
                            typeCount = enums.VideoType[key].value;
                            break;
                        }
                    }
                    console.log(result.id);
                    console.log(youkuShowid);
                    if (result.id == youkuShowid) {
                        sequelize.query("update Program set volumnCount=:volumnCount,stage=:stage,videoType=:videoType,videoDesc=:videoDesc,updateTime=:updateTime where cpContentID= :cpContentID", {
                            replacements: {
                                volumnCount: result.volumnCount,
                                stage: result.stage,
                                videoType: typeCount,
                                videoDesc: type,
                                cpContentID: cpcontentid,
                                updateTime: new Date()
                            },
                            type: sequelize.QueryTypes.UPDATE
                        }).spread(function (results, metadata) {
                            console.log(metadata);
                            console.log(vid + " update suceess at " + new Date());
                            done(null, chunk);

                        }).catch(function (err) {
                            console.error(JSON.stringify(err) + " at " + new Date())
                            done(null, chunk);
                        })
                    } else {
                        sequelize.query("update Program set showid=:showid,volumnCount=:volumnCount,stage=:stage,videoType=:videoType,videoDesc=:videoDesc,updateTime=:updateTime where cpContentID= :cpContentID", {
                            replacements: {
                                showid: "YOUKU_" + result.id,
                                volumnCount: result.volumnCount,
                                stage: result.stage,
                                videoType: typeCount,
                                videoDesc: type,
                                cpContentID: cpcontentid,
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
                                console.log(vid + " insert ununifiedMedia success at " + new Date());
                                done(null, chunk);
                            }).catch(function(err){
                                if (err.original.code = "ER_DUP_ENTRY") {
                                    console.log(vid + "has in ununifiedMedia at "+new Date());
                                    done(null,chunk);
                                }else{
                                    console.error(err);
                                    done(null,chunk);
                                }
                            })

                        }).catch(function (err) {
                            console.error(err);
                            done(null, chunk);
                        })

                    }
                }else if(result.code==204){
                    sequelize.query("update Program set showid=:showid,videoType=:videoType,videoDesc=:videoDesc,updateTime=:updateTime where cpContentID= :cpContentID", {
                        replacements: {
                            showid:null,
                            videoType: enums.VideoType.OTHER.value,
                            videoDesc: enums.VideoType.OTHER.name,
                            cpContentID: cpcontentid,
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
                            console.log(vid + " insert ununifiedMedia success at " + new Date());
                            done(null, chunk);
                        }).catch(function(err){
                            if (err.original.code = "ER_DUP_ENTRY") {
                                console.log(vid + " has in ununifiedMedia at "+new Date());
                                done(null,chunk);
                            }else{
                                console.error(err);
                                done(null,chunk);
                            }
                        })

                    }).catch(function (err) {
                        console.error(err);
                        done(null, chunk);
                    })

                } else {
                    console.error(vid + ": get api info error at" + new Date());
                    done(null, chunk);
                }
            }
        )
    }
}
var queryDataStream = new QueryDataStream({objectMode: true});
var rs = fs.createReadStream("./programShowid.txt", {encoding: 'utf-8'});
byline.createStream(rs).pipe(queryDataStream);
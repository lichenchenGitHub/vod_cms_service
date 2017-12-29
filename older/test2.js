/**
 * Created by lichenchen on 2017/4/5.
 */
// var GenerateCode = require('./lib/generateCode');
// var Enums = require("./lib/enums");
// var enmus = new Enums();
// var Promise = require("bluebird");
// var cluster = require("cluster");
// var numCPUs = require("os").cpus().length;
// var generateCode = new GenerateCode();
// var generateCode2 = new GenerateCode();
// var ExecuteJob=require("./lib/executeJob");
// var executeJob=new ExecuteJob();
// var JobEnterDatabase=require("./lib/jobEnterDatabase");
// var jobEnterDatabase=new JobEnterDatabase();
// var SearchDatabase = require("./lib/searchDatabase");
// var searchDatabase = new SearchDatabase();
// searchDatabase.getContentProvider("YOUKU").then(function(data){
//     console.log(data)
// }).catch(function(err){
//     console.log(err)
// })
//executeJob.executeJobShowid("b1a7477ecd7f11e68fae").then(function(data){
//    return jobEnterDatabase.seriesEnterDatabase(data);
//}).then(function(data){
//    console.log(data);
//})

//Promise.map([1,2,3,4,5,6,7,8,9,10],function(item,index){
//    console.log("program："+ generateCode.createCode(enmus.Project.CMS.value, enmus.Code.PROGRAM));
//    console.log("movie:"+generateCode2.createCode(enmus.Project.CMS.value, enmus.Code.MOVIE));
//})

//if (cluster.isMaster) {
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
//    var generateCode = new GenerateCode();
//    //Promise.map([1,2,3,4,5,6,,7,8,9,10],function(item,index){
//    //    console.log(generateCode.createCode(enmus.Project.CMS.value, enmus.Code.SERIES));
//    //})
//    Promise.map([1,2,3,4,5,6,,7,8,9,10],function(item,index){
//        console.log("program："+ generateCode.createCode(enmus.Project.CMS.value, enmus.Code.PROGRAM));
//        Promise.map([1,2,3,4,5,6,,7,8,9,10],function(item,index){
//            console.log("movie:"+generateCode.createCode(enmus.Project.CMS.value, enmus.Code.MOVIE));
//        })
//    })
//}

//var Redis = require('ioredis');
//var kue = require('kue');

//var excuteJob=require("./lib/excuteJob");
//var test= new excuteJob();
//test.excuteJobShowid("77af4234015b11e69e2a").then(function(data){
//    console.log(data);
//})

//var cluster = new Redis.Cluster([{
//    port: 6381,
//    host: '10.3.1.7'
//}, {
//    port: 6380,
//    host: '10.3.1.8'
//},
//    {
//        port: 6379,
//        host: '10.3.1.8'
//    },
//    {
//        port: 6381,
//        host: '10.3.1.8'
//    }
//]);
//cluster.get("test",function(err,res){
//    console.log("test is :"+res);
//})
//cluster.get("test2",function(err,res){
//    console.log("test2 is :"+res);
//})
//cluster.get("test3",function(err,res){
//    console.log("test3 is :"+res);
//})
//var redis = new Redis({
//    port: 6379,
//    host: 'r-2ze7177d2e77a2a4.redis.rds.aliyuncs.com',
//    password: '0AurNMBji2qT'
//})
//redis.set("test","bar");
//redis.get("test",function(err,res){
//    console.log("test is :"+res);
//})


//var ExcuteJob = require("./lib/executeJob");
//var excuteJob = new ExcuteJob();
//var EnterDatabase = require("./lib/jobEnterDatabase");
//var enterDatabase = new EnterDatabase();
//excuteJob.excuteJobShowid("cc00102e962411de83b1").then(function (seriesObj) {
//    return enterDatabase.seriesEnterDatabase(seriesObj);
//}).then(function (seriesReback) {
//    //console.log(series);
//    return excuteJob.excuteJobVid(seriesReback.data, "XMjU1MTIzODc5Ng==");
//}).then(function (programObj) {
//    return enterDatabase.programEnterDatabase(programObj)
//}).then(function(programReback){
//    return excuteJob.excuteJobMovie(programReback.data)
//}).then(function(movieObj){
//    return enterDatabase.movieEnterDatabase(movieObj)
//}).then(function(data){
//    console.log(data);
//}).catch(function (err) {
//    console.log(err);
//})
//excuteJob.excuteJobShowid("77af4234015b11e69e2a")
//    .then(function (seriesObj) {
//        return enterDatabase.seriesEnterDatabase(seriesObj);
//    }).then(function (seriesReback) {
//    //console.log(series);
//    return excuteJob.excuteJobVidByShowid(seriesReback.data);
//}).then(function(vlist){
//    return enterDatabase.injectOrderEnterDatabase(vlist);
//}).then(function(data){
//    console.log(data)
//}).catch(function(err){
//    console.log(err);
//})

//excuteJob.excuteJobShowid("3d0469e864b811e4a080")
//    .then(function (seriesObj) {
//        return enterDatabase.seriesEnterDatabase(seriesObj);
//    }).then(function (seriesReback) {
//    console.log(seriesReback);
//}).catch(function(err){
//    console.log(err);
//})

//var unirest=require("unirest");
//unirest.post("http://10.4.1.8:18888/api/mediainfo/")
//    .header('Accept', 'application/json')
//    .header('Content-Type', 'application/json')
//    .send({file_name:"\/vol\/zjj\/test\/1.mp4 "})
//    .end(function (postResp) {
//        console.log(postResp.body);
//
//    });
//unirest.get("http://10.4.1.8:18888/api/mediainfo/?file_name=/vol/zjj/test/1.mp4").end(function (res) {
//    console.log(res.body)
//})
//executeJob.executeJobUnifiedseries("YOUKU_443f6ab2566611e2b16f").then(function(data){
//    console.log(data);
//}).catch(function(err){
//    console.log(err);
//})
//searchDatabase.getSeries("YOUKU_77af4234015b11e69e2a").then(function(data){
//    console.log(data);
//})
// console.log(parseInt(29408163));
// var unirest = require("unirest");
// var conf = require("./conf/config");
// var Promise = require("bluebird");
//
// initJob().then(function (data) {
//     console.log(data);
// });
// var cluster = require("cluster");
// var unirest = require("unirest");
// var kue = require("kue");
// var Promise = require("bluebird");
// var Redis = require("ioredis");
// var conf = require("./conf/config");
// if (conf.redisConf.default === "cluster") {
//     var keystore = new Redis.Cluster(conf.redisConf.cluster);
// } else {
//     var keystore = new Redis(conf.redisConf.normal);
// }
// keystore.set("test",true,function(err,msg){
//     console.log(err);
//     console.log(msg);
// });
// keystore.get('test', function (err, res) {
//     console.log(err);
//     console.log(res);
// });
// var moment = require('moment');
// var date=moment("1:44:00","HH:mm:ss")
// console.log(date.hour());
// console.log(date.minute());
// console.log(date.second());

// var unirest = require("unirest");
// var moment = require('moment');
// var Promise = require("bluebird");
// var conf = require("./conf/config.json");
// var Constants = require("./lib/constants");
// var constants = new Constants();
// var Enums = require("./lib/enums");
// var enums = new Enums();
//
// var ExecuteJob = require("./lib/executeJob");
// var JobEnterDatabase = require("./lib/jobEnterDatabase");
// var SearchDataBase = require("./lib/searchDatabase");
// var TransformObject = require("./lib/transformObject");
// var transformObject = new TransformObject();
// var executeJob = new ExecuteJob();
// var jobEnterDatabase = new JobEnterDatabase();
// var searchDataBase = new SearchDataBase();
// var Hasher = require('./lib/hasher');
// var hasher = new Hasher();

// executeJob.executeJobImportMediaDetail(1731).then(function (result) {
//     console.log(result);
//     var detail = {status: 30, statusdesc: "解析成功"};
//     detail.updatetime = new Date();
//     // return jobEnterDatabase.updateImportDetail(1731, detail).then(function (updateResult) {
//     //     console.log(updateResult);
//     // }).catch(function (err) {
//     //     console.error("update ImportDetail failed at " + new Date())
//     //     console.error(err);
//     // })
// }).catch(function (err) {
//     console.error(err);
//     var detail = {status: 31, statusdesc: "解析失败"};
//     detail.updatetime = new Date();
//     // return jobEnterDatabase.updateImportDetail(1731, detail).catch(function (err) {
//     //     console.error("update importDetail failed at " + new Date())
//     //     console.error(err);
//     // })
// })
// var generateUniqueCode = require("./lib/generateUniqueCode");
// var Promise = require("bluebird");
// Promise.map([1,2,3],function(item,index){
//     return generateUniqueCode.createunifiedseriesCode("230", "0001").then(function (result) {
//         console.log(result);
//         return result;
//     })
// }).then(function(data){
//     console.log(data);
// }).catch(function (err) {
//     console.log(err);
// })
// const obj = {
//     name: "Fred",
//     age: 42,
//     id: 1
// }

// //simple destructuring
// const { name } = obj;
// console.log("name", name);
//
// //assigning multiple variables at one time
// const { age, id } = obj;
// console.log("age", age);
// console.log("id", id);
//
// //using different names for the properties
// const { name: personName } = obj;
// console.log("personName", personName);
// const obj = {
//     prop1: 1,
//     prop2: 2
// }
//
// // previously you would need to do something like this:
// const firstProp = obj.prop1;
// const secondProp = obj.prop2;
// console.log(firstProp, secondProp);
// // etc.
//
// // however now you can do this on the same line:
// const {prop1, prop2} = obj;
// console.log(prop1, prop2);
var unirest = require("unirest");
var conf = require("../conf/config");
// var getUndownloadMovieList = function () {
//     return new Promise(function (resolve, reject) {
//         var filter = {where: {downloadstatus: 0}, limit: conf.jobOption.limit}
//         unirest.get(encodeURI(conf.strongLoopApi + "Movies?filter="+JSON.stringify(filter))).pool(conf.poolOption)
//             .end(function (resp) {
//                 if (resp.status == 200) {
//                     console.log(resp.body);
//                     resolve(resp.body);
//                 }else{
//                     console.error(resp.body.error);
//                     reject({Error:resp.body.error});
//                 }
//             })
//     })
// }
// getUndownloadMovieList().then(function(data){
//     console.log(data);
// }).catch(function(err){
//     console.error(err);
// })
// var dowloadInterfaceTest = function () {
//     return new Promise(function (resolve, reject) {
//         var sname = escape("镇魂街 第一季");
//         var pname = escape("镇魂街 第一季 02");
//         var postData = {
//             src: 2,
//             priority: 0,
//             catid: 97,
//             showid: "518127c0b08d11e68fae",
//             vid: "XMjkzNDEwMzEyNA==",
//             mtype: 0,
//             sname: sname,
//             pname: pname
//         };
//         console.log(postData);
//         unirest.post(encodeURI(conf.downloadYoukuMovie)).pool(conf.poolOption)
//             .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
//             .send(postData)
//             .end(function (resp) {
//                 if (resp.status == 200) {
//                     resolve(resp.body);
//                 } else {
//                     console.error(resp.body.error);
//                     reject(resp.body.error);
//                 }
//             })
//     })
// }
// dowloadInterfaceTest().then(function (data) {
//     console.log("success");
//     console.log(data);
// }).catch(function (err) {
//     console.error("failed");
//     console.error(err);
// })
var Enums = require("../lib/enums");
var enums = new Enums();
var getUnunifiedMovie = function (src, mtype, cpcode) {
    var reback = {};
    var filter = {
        where: {cpcode: cpcode, type: 0, downloadstatus: 0},
        order:"priority DESC",
        include: {relation: "series", scope: {fields: ["name", "programtype"]}}
    };
    return new Promise(function (resolve, reject) {
            unirest.get(encodeURI(conf.strongLoopApi + "Movies/findOne?filter=" + JSON.stringify(filter))).pool(conf.poolOption)
                .end(function (resp) {
                    if (resp.status != 200) {
                        reback.code = resp.statusCode;
                        reback.message = "get movie error at " + new Date();
                        reback.data = null;
                        reject(reback);
                    } else {
                        if (resp.body.series && resp.body.series.name) {
                            var movieData = resp.body;
                            var priority = movieData.priority;
                            var catid = null;
                            for (var key in enums.ProgramType) {
                                if (movieData.series.programtype == enums.ProgramType[key].cname) {
                                    catid = enums.ProgramType[key].value;
                                    break;
                                }
                            }
                            var showid = movieData.showid.split("_")[1];
                            var vid = movieData.cpcontentid.split("_")[1];
                            var sname = escape(resp.body.series.name);
                            var pname = escape(resp.body.name);
                            reback.code = resp.statusCode;
                            reback.message = "get movie success at " + new Date();
                            var data = {
                                src: src,
                                priority: priority,
                                catid: catid,
                                showid: showid,
                                vid: vid,
                                mtype: mtype,
                                sname: sname,
                                pname: pname
                            }
                            reback.data = data;
                            resolve(reback);
                        }
                    }
                })
        }
    )
}
getUnunifiedMovie(2, 0, "YOUKU").then(function (data) {
    console.log(data.data);
    return new Promise(function (resolve, reject) {
        unirest.post(encodeURI(conf.downloadYoukuMovie)).pool(conf.poolOption)
            .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
            .send(data.data)
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
}).catch(function (err) {
    console.error(err);
})
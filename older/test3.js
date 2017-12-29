/**
 * Created by lichenchen on 2017/4/20.
 */
var unirest = require("unirest");
var conf = require("../conf/config");
var Promise = require("bluebird");
var SearchDatabase = require("../lib/searchDatabase");
var searchDatabse = new SearchDatabase();
var Tools = require("../lib/tools");
var tools = new Tools();
var Enums = require("../lib/enums");
var enums = new Enums();
var JobEnterDatabase = require("../lib/jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
var TransformObject = require("../lib/transformObject");
var transformObject = new TransformObject();
unirest.get(encodeURI(conf.strongLoopApi+"Series/findOne?filter="+JSON.stringify({name:escape("小黄人&格鲁日记")}))).pool(conf.poolOption)

    .end(function(resp){
        console.log(resp.body);
    })
// var getUnifiedSeries = function () {
//     return new Promise(function (resolve, reject) {
//         var reback = {};
//         var req = unirest.get(conf.strongLoopApi + "Unifiedseriesseries/findOne?filter[where][status]=1")
//             .pool(conf.poolOption)
//             .end(function (resp) {
//                 if (resp.status == 200) {
//                     reback.code = 200;
//                     reback.message = "get uss info success at " + new Date();
//                     reback.data = resp.body;
//                     resolve(reback);
//                 } else {
//                     reback.code = resp.statusCode;
//                     reback.message = "get uss info failed at " + new Date();
//                     reback.data = null;
//                     reject(reback);
//                 }
//
//             })
//     })
// }
// getUnifiedSeries().then(function (uss) {
//     return Promise.props({
//         usInfo: searchDatabse.getUnifiedseries(uss.data.unifiedseriescode),
//         sensitiveList: searchDatabse.getSensitivewords(),
//         programList: searchDatabse.getProgramsBySeries(uss.data.cpcontentid)
//     }).then(function (data) {
//         return Promise.map(data.programList.data, function (item, index) {
//             if (item.volumncount && item.volumncount != 0) {
//                 if (item.programtype == "综艺") {
//                     return tools.hasSensitiveWords(data.sensitiveList.data, item, enums.MediaType.PROGRAM.value).then(function (result) {
//                         if (result.code != 200) {
//                             return {dealType: 0, data: result.data}
//
//                         } else {
//                             return {dealType: 1, data: item, usInfo: data.usInfo.data}
//                         }
//                     })
//                 } else {
//                     return {isSensitive: false, data: item, usInfo: data.usInfo.data}
//                 }
//             } else {
//                 return jobEnterDatabase.upsertUnunifiedmedia({
//                     cpcontentid: item.cpcontentid,
//                     contenttype: enums.MediaType.PROGRAM.value
//                 }).then(function (unununifiedmediaResult) {
//                     return {dealType: -1, data: item, usInfo: data.usInfo.data}
//                 })
//             }
//
//         })
//
//     }).then(function (hasSensitiveList) {
//         return Promise.map(hasSensitiveList, function (item, index) {
//             if(item.dealType==-1)
//             {
//                 return item;
//             }
//             else if (item.dealType==0) {
//                 return jobEnterDatabase.upsertSensitiveprogram(item.data);
//             } else {
//                 return searchDatabse.getUnifiedProgramprogram(item.data.cpcontentid).then(function (uppResult) {
//                     if (uppResult.code == 200) {
//                         return uppResult;
//                     } else {
//                         var unifiedProgram = transformObject.transUnifiedprogram(item.data, item.usInfo);
//                         return searchDatabse.getUnifiedprogram(unifiedProgram.unifiedseriescode, unifiedProgram.volumncount)
//                             .then(function (matchUnifiedprogramResult) {
//                                 if (matchUnifiedprogramResult.code == 200) {
//                                     return jobEnterDatabase.upsertUnifiedprogramprogram({
//                                         cpcontentid: matchUnifiedprogramResult.data.cpcontentid,
//                                         unifiedprogramcode: matchUnifiedprogramResult.data.code
//                                     }).then(function (unifiedprogramprogramObj) {
//                                         return searchDatabse.getMovieByProgram(matchUnifiedprogramResult.data);
//                                     }).then(function(movieObj){
//                                         return Promise.map(movieObj.data,function(item,index){
//                                             return jobEnterDatabase.upserUnifiedmovie(item);
//                                         })
//                                     })
//                                 } else {
//                                     return jobEnterDatabase.upsertUnifiedprogram(unifiedProgram).then(function (unifiedProgramResult) {
//                                         return jobEnterDatabase.upsertUnifiedprogramprogram({
//                                                 cpcontentid: unifiedProgramResult.data.cpcontentid,
//                                                 unifiedprogramcode: unifiedProgramResult.data.code
//                                             })
//                                             .then(function (unifiedprogramprogramObj) {
//                                                 return searchDatabse.getMovieByProgram(unifiedProgramResult.data);
//                                             })
//                                             .then(function(movieObj){
//                                                 console.log(movieObj.data);
//                                                 return Promise.map(movieObj.data,function(item,index){
//                                                     return jobEnterDatabase.upserUnifiedmovie(item);
//
//                                                 })
//                                             })
//                                     })
//                                 }
//                             })
//                     }
//
//                 })
//
//             }
//         });
//     }).then(function (data) {
//         console.log(data);
//     }).catch(function (err) {
//         console.error(err);
//     })
// })

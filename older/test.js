// var unirest = require("unirest");
// var Promise = require("bluebird");
// var parseString = require('xml2js').parseString;
// var conf = require("./conf/config");
// var Tools = require("./lib/tools");
// var tools = new Tools();
// var Exec = require("./lib/executeJob");
// var JobEnterDatabase = require("./lib/jobEnterDatabase");
// var jobEnterDatabase = new JobEnterDatabase();
// var exec = new Exec();
// exec.parseCPSXml("http://114.247.94.25:6888/2017/11/01/150951798109506_20171101150246.xml").then(function (obj) {
//     var series = obj.series;
//     series.createtim
//     var program = obj.program;
//     program.checkstatus = 0;
//     var movie = obj.movie;
//     if (series && program && movie) {
//         return jobEnterDatabase.upsertCpsSeries(series).then(function (seriesResult) {
//             return jobEnterDatabase.upsertCpsProgram(program).then(function (programResult) {
//                 return jobEnterDatabase.upsertCpsMovie(movie).then(function (movieResult) {
//                     if (series.cpcontentid) {
//                         return jobEnterDatabase.upsertWaitunified({
//                             cpcontentid: series.cpcontentid,
//                             releaseyear: series.releaseyear,
//                             contenttype: 1,
//                             status: 0,
//                             createtime: new Date(),
//                             updatetime: new Date()
//                         });
//                     } else {
//                         return new Promise(function (resolve, reject) {
//                             reject({Error: "series cpcontentid is null at " + new Date()})
//                         })
//                     }
//                 })
//             })
//         })
//     } else {
//         return new Promise(function (resolve, reject) {
//             reject({Error: "not get series or program or movie at " + new Date()})
//         })
//     }
// }).then(function (result) {
//     console.log(result);
// }).catch(function (err) {
//     console.error(err);
// })
// var parseXML = function (xmlurl) {
//     return new Promise(function (resolve, reject) {
//         var req = unirest.get(xmlurl).pool(conf.poolOption)
//             .end(function (resp) {
//                 if (resp.status != 200) {
//                     reject({Error: "get " + xmlurl + " error ,http status is " + resp.status + " at " + new Date()})
//                 } else {
//                     var xml = resp.body;
//                     parseString(xml, {
//                         explicitArray: false,
//                         normalizeTags: true,
//                         ignoreAttrs: false,
//                         trim: true,
//                         mergeAttrs: true
//                     }, function (err, result) {
//                         if (err) {
//                             reject({Error: JSON.stringify(err) + " at " + new Date()})
//                         } else {
//                             var objects = result.adi.objects.object;
//                             var mappings = result.adi.mappings.mapping;
//                             if (objects && mappings) {
//                                 var series = {};
//                                 var program = {};
//                                 var movie = {};
//                                 var picture = [];
//                                 for (var i in objects) {
//                                     if (objects[i].ElementType == "Series") {
//                                         series = tools.getCpsObj(objects[i].property)
//                                         series.cpcontentid = "CPS_" + objects[i].Code;
//                                         series.update = mappings[i].Action;
//                                     } else if (objects[i].ElementType == "Program") {
//                                         program = tools.getCpsObj(objects[i].property)
//                                         program.cpcontentid = "CPS_" + objects[i].Code;
//                                         program.update = mappings[i].Action;
//                                     } else if (objects[i].ElementType == "Movie") {
//                                         movie = tools.getCpsObj(objects[i].property)
//                                         movie.fileid = objects[i].Code;
//                                         movie.update = mappings[i].Action;
//                                     } else if (objects[i].ElementType == "Picture") {
//                                         var item = tools.getCpsObj(objects[i].property);
//                                         item.code = objects[i].Code;
//                                         picture.push(item);
//                                     } else {
//                                         console.log("not in mediaInfo")
//                                     }
//
//                                 }
//                                 var seriesPictureArr = [];
//                                 var programPictureArr = [];
//                                 for (var i in mappings) {
//                                     if (mappings[i].ElementType == "Program" && mappings[i].ParentType == "Series") {
//                                         program.showid = mappings[i].ParentCode;
//                                     } else if (mappings[i].ElementType == "Movie" && mappings[i].ParentType == "Program") {
//                                         movie.cpcontentid = mappings[i].ParentCode;
//                                     } else if (mappings[i].ElementType == "Series" && mappings[i].ParentType == "Picture") {
//                                         for (var j in picture) {
//                                             if (picture[j].code == mappings[i].ParentCode) {
//                                                 seriesPictureArr.push(conf.ott_images_prefix + picture[j].fileurl)
//                                             }
//                                         }
//                                     } else if (mappings[i].ElementType = "Program" && mappings[i].ParentType == "Picture") {
//                                         for (var j in picture) {
//                                             if (picture[j].code == mappings[i].ParentCode) {
//                                                 programPictureArr.push(conf.ott_images_prefix + picture[j].fileurl)
//                                             }
//                                         }
//                                     }
//                                 }
//                                 for (var i in  seriesPictureArr) {
//                                     var index = parseInt(i) + 1;
//                                     series["picture" + index] = seriesPictureArr[i];
//                                 }
//                                 for (var i in programPictureArr) {
//                                     var index = parseInt(i) + 1;
//                                     program["picture" + index] = programPictureArr[i];
//                                 }
//                                 series.cpcode = "CPS";
//                                 series.cpname = "CPS";
//                                 program.seriesname = series.name;
//                                 program.cpcode = series.cpcode;
//                                 program.cpname = series.cpname;
//                                 program.duration = program.duration * 60;
//                                 movie.fileformat = movie.videotype;
//                                 delete movie["videotype"];
//                                 movie.type = 0;
//                                 movie.cpname = program.cpname;
//                                 movie.cpcode = program.cpcode;
//                                 movie.downloadstatus = 2;
//                                 if (movie.duration) {
//                                     movie.duration = movie.duration * 60;
//                                 }
//                                 if (movie.filepath) {
//                                     movie.filepath = movie.targetfilepath;
//                                 }
//                                 if (movie.screenformat) {
//                                     movie.width = movie.screenformat.split("*")[0];
//                                     movie.height = movie.screenformat.split("*")[1];// program.
//                                 }
//                                 movie.iscompleted = 1;
//                                 resolve({series: series, program: program, movie: movie});
//                             } else {
//                                 reject({Error: "get " + xmlurl + " objects or mapping error at " + new Date()})
//                             }
//                         }
//
//                     })
//                 }
//             })
//     })
// }
// exec.parseCPSXml("http://114.247.94.25:6888/2016/08/31/1472655180310_20160831225421.xml").then(function(data){
//     console.log(data);
// })
// const fs = require('fs');
// var readable = fs.createReadStream("test2.js", {encoding: 'utf8'})
// readable.on('data', function (chunk) {
//     if (chunk.length == 10);
//     {
//         readable.pause();
//         console.log('got %d bytes of data', chunk.length);
//         console.log(chunk)
//         console.log(chunk.toString())
//         // readable.pause();
//         console.log('there will be no more data for 1 second');
//         setTimeout(function () {
//             console.log('now data will start flowing again');
//             readable.resume();
//         }, 1000);
//     }
// });
// const fs = require("fs");
// const unirest = require("unirest");
// const mysql = require('mysql');
// const Writable = require('stream').Writable;
// var connection = mysql.createConnection({
//     host: '10.3.1.10',
//     user: 'guttvdev',
//     password: 'devGuttv123',
//     database: 'vod_cms'
// });
//
//
// var poolOption = {
//     maxSockets: 500,
// };
// class QueryDataStream extends Writable {
//     constructor(options) {
//         // Calls the stream.Writable() constructor
//         super(options);
//         // ...
//     }
//
//     _write(chunk, enc, done) {
//         // parse row data
//         // var vid = obj.cpContentID.split('_')[1];
//         // console.log('vid: ' + vid);
//         var content=obj.toString();
//         console.log(obj.toString());
//         callback(null,obj);
//         // var getVideoData = function (vid) {
//         //     return new Promise(function (resolve, reject) {
//         //         var uri = 'http://119.254.98.182:31006/youku/openapi/videos/show/vid/' + vid;
//         //
//         //         var req = unirest.get(uri);
//         //         req.timeout(60000);
//         //         req.pool(poolOption);
//         //         req.end(function (res) {
//         //             if (res.status != 200) {
//         //                 reject(new Error('http status: ' + res.status + ', url: ' + url));
//         //             }
//         //             else {
//         //                 var data = res.body;
//         //                 resolve(data);
//         //             }
//         //         });
//         //     });
//         // }
//         //
//         // getVideoData(vid).then(function (data) {
//         //     if (data.show) {
//         //         console.log('vid: ' + vid + ', type: ' + data.show.type);
//         //     }
//         //     callback(null, obj);
//         // }).catch(function (err) {
//         //     console.error(err);
//         //     callback(null, obj);
//         // });
//     }
// }
// connection.connect();
//
// var query = 'select showid, cpContentID, videoType from Program';
// var dataStream = new QueryDataStream({objectMode: true});
// //let dataStream = new require('fs').WriteStream('./out.txt');
// fs.createReadStream("./program1_log.txt").pipe(dataStream);
// var fs = require("fs");
// function readLines(input, func) {
//     var remaining = '';
//     input.on('data', function (data) {
//         remaining += data;
//         var index = remaining.indexOf('\n');
//         while (index > -1) {
//             var line = remaining.substring(0, index);
//             remaining = remaining.substring(index + 1);
//             func(line);
//             index = remaining.indexOf('\n');
//         }
//
//     });
//
//     input.on('end', function () {
//         if (remaining.length > 0) {
//             func(remaining);
//         }
//     });
// }
//
// function func(data) {
//     console.log(data);
//     container.push(data);
// }
//
// var input = fs.createReadStream("program1.txt");
// readLines(input, func);
// var readline = require('readline');
// var fs = require("fs");
// var rl = readline.createInterface({
//     input: fs.createReadStream("program1.txt")
// });
// var temp=0;
// rl.on('line', function (line) {
//     rl.pause();
//     console.log(temp++);
//     console.log(line);
//
//
// })
// rl.on('pause', function () {
//     console.log("temp is:"+temp)
//     console.log('Readline paused.');
//     // rl.resume()
// });
// rl.on("resume", function () {
//     console.log("Readline resume");
// })
// rl.on("close", function () {
//     console.log("Read finish");
// });
// var test="20.67890";
// console.log(Math.floor(parseFloat(test)));
// var Hasher = require("../lib/hasher");
// var hasher = new Hasher();
// var test = {a: "test", b: "1"};
// var test2 = {a: "test", b: "1"};
// console.log(hasher.GetMD5(JSON.stringify(test)));
// console.log(hasher.GetMD5(JSON.stringify(test2)));
// var a = 2;
// var b = 1;
// var c = a > b ? true : false;
// console.log(c);

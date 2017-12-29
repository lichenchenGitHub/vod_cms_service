// var fs = require("fs");
// var path = require("path");
// var mime = require("mime-types");
// var unirest = require("unirest");
// var crypto = require('crypto');
// var Promise = require("bluebird");
// var mkdirp = require("mkdirp");
// var through2 = require("through2");
// var conf = require("./conf/config");
// var hash = crypto.createHash('md5');
// var suffix = null;
var conf = require("../conf/config");
var tempPrefix = conf.downloadDir.tempPrefix.replace(/\s/g, "");
var desPrefix = conf.downloadDir.destPrefix.replace(/\s/g, "");
// var fileExists = function (filepath) {
//     return new Promise(function (resolve, reject) {
//         fs.exists(filepath, function (exists) {
//             if (exists) {
//                 resolve({code: 200});
//             }
//             else {
//                 resolve({code: 404});
//             }
//         })
//     });
// }
// var mkdirCreate = function (mkdir) {
//     return new Promise(function (resolve, reject) {
//         mkdirp(mkdir, function (err) {
//             if (err) {
//                 console.log(err);
//                 reject({code: 404})
//             } else {
//                 resolve({code: 200})
//             }
//         });
//     })
//
// }
// var fileRename = function (oldPath, newPath) {
//     return new Promise(function (resolve, reject) {
//         fs.rename(oldPath, newPath, function (err) {
//             if (err) {
//                 console.log("重命名文件失败")
//                 console.log(err);
//                 reject({code: 404})
//             } else {
//                 resolve({code: 200})
//             }
//         })
//     })
// }
// var downloadPic = function (url) {
//     return new Promise(function (resolve, reject) {
//         var code = new Date().getTime();
//         unirest.request(url)
//             .on('response', function (response) {
//                 if (response.statusCode == 200) {
//                     suffix = mime.extension(response.headers["content-type"]);
//                 } else {
//                     console.log("response error");
//                     reject({code: response.statusCode})
//                 }
//             })
//             .on('error', function (err) {
//                 console.log("receive stream error")
//                 reject(err);
//             })
//             .pipe(through2(function (chunk, enc, callback) {
//                 hash.update(chunk);
//                 callback(null, chunk);
//             })).pipe(fs.createWriteStream(tempPrefix + code)).on('finish', function () {
//             var fileName = hash.digest("hex").toUpperCase();
//             var fullPath = path.join(desPrefix, fileName.substr(0, 2), fileName.substr(-2, 2));
//             return fileExists(fullPath).then(function (data) {
//                 if (data.code == 200) {
//                     return fileRename(tempPrefix + code, path.join(fullPath, fileName)+"."+suffix)
//                 } else {
//                     return mkdirCreate(fullPath).then(function (data) {
//                         if (data.code == 200) {
//                             return fileRename(tempPrefix + code, path.join(fullPath, fileName)+"."+suffix);
//                         } else {
//                             reject({code: 404});
//                         }
//                     })
//
//                 }
//             })
//
//         })
//     })
// }
//
// fileExists(tempPrefix).then(function (data) {
//     return new Promise(function (resolve, reject) {
//         if (data.code == 200) {
//             resolve({code: 200});
//         } else {
//             return mkdirCreate(tempPrefix)
//         }
//     })
// }).then(function (data) {
//     return downloadPic("http://r1.ykimg.com/050E000051B4345C67583921DD08A805");
// }).then(function(data){
//     console.log(data);
// }).catch(function (err) {
//     console.error(err);
// })
var Tools = require("../lib/tools");
var tools = new Tools();
var DealFile = require("../lib/dealFile");
var dealFile = new DealFile();
var ExecuteJob = require("../lib/executeJob");
var executeJob = new ExecuteJob();
// return tools.existsFile(tempPrefix).then(function (data) {
//     if (data.code == 200) {
//         return dealFile.downloadPic("http://r1.ykimg.com/050E000051B4345C67583921DD08A805", 1)
//     } else {
//         return tools.createMkdir(tempPrefix).then(function (data) {
//             return dealFile.downloadPic("http://r1.ykimg.com/050E000051B4345C67583921DD08A805", 1, tempPrefix);
//         })
//     }
//
// }).then(function (data) {
//     return dealFile.createDestPath(data.data.tempFile, data.data.fileName, data.data.suffix, desPrefix)
// }).then(function (test) {
//     return tools.renameFile(test.data.tempFile, test.data.fullPath)
// }).then(function (data) {
//     console.log("test2")
//     console.log(data);
// }).catch(function (err) {
//     console.error(err);
// })
executeJob.executeJobDownloadPicture("YOUKU_b1ce591fc29d11e68fae", [{from:"http://r3.ykimg.com/050E000058DB52D6ADBA1F2B0C0A3898",to:"picfilepath1"},{from: null,to:null},{from:"http://r4.ykimg.com/050B000058DB52C8ADBAC396C60A564C",to:"picfilepath3"}], 1, tempPrefix, desPrefix)
.then(function(data){
    console.log(data);
}).catch(function(err){
    console.log(err);
})
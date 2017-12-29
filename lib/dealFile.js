var fs = require("fs");
var path = require("path");
var crypto = require('crypto');
var Promise = require("bluebird");
var unirest = require("unirest");
var mime = require("mime-types");
var through2 = require("through2");
var XLSX = require("xlsx");
var conf = require("../conf/config");
var Tools = require("./tools");
var tools = new Tools();
var GenerateCode = require("./generateCode");
var generateCode = new GenerateCode();
var Enums = require("./enums");
var enums = new Enums();
var DealFile = (function () {
    function _dealFile() {
    };
    _dealFile.prototype = {
        downloadPic: function (url, type, tempPrefix, fieldName) {
            return new Promise(function (resolve, reject) {
                var suffix = null;
                var hash = crypto.createHash('md5');
                var tempFile = null;
                if (type == 1) {
                    tempFile = tempPrefix + generateCode.createSeriesCode(enums.Project.CMS.value, enums.Code.SERIES);
                } else {
                    tempFile = tempPrefix + generateCode.createProgramCode(enums.Project.CMS.value, enums.Code.PROGRAM)
                }
                var request = unirest.request(url)
                    .on('response', function (response) {
                        if (response.statusCode == 200) {
                            suffix = mime.extension(response.headers["content-type"]);
                        } else {
                            console.error("response error response code is " + response.statusCode);
                            reject({code: response.statusCode, messge: "get " + url + " failed at " + new Date()})
                        }
                    })
                    .on('error', function (err) {
                        console.error(url + " receive stream error at " + new Date())
                        reject({code: 500, messge: err});
                    })
                    .pipe(through2(function (chunk, enc, callback) {
                        hash.update(chunk);
                        callback(null, chunk);
                    })).pipe(fs.createWriteStream(tempFile)).on('finish', function () {
                        var fileName = hash.digest("hex").toUpperCase();
                        if (fileName) {
                            resolve({
                                code: 200,
                                message: "tempFile create sucess",
                                data: {fileName: fileName, tempFile: tempFile, suffix: suffix, fieldName: fieldName}
                            })
                        } else {
                            reject({code: 500, message: "tempFile create failed"})
                        }
                    })
            })
        },
        createDestPath: function (tempFile, fileName, suffix, desPrefix) {
            return new Promise(function (resolve, reject) {
                if (suffix && suffix != "") {
                    var fullPath = desPrefix + fileName.substr(0, 2) + "/" + fileName.substr(-2, 2) + "/";
                    return tools.existsFile(fullPath).then(function (exists) {
                        if (exists.code == 200) {
                            console.log(exists.message);
                            resolve({
                                code: 200,
                                data: {tempFile: tempFile, fullPath: fullPath + fileName + "." + suffix}
                            })
                        } else {
                            console.log(exists.message);
                            return tools.createMkdir(fullPath).then(function (isCreate) {
                                if (isCreate.code == 200) {
                                    console.log(isCreate.message);
                                    resolve({
                                        code: 200,
                                        data: {tempFile: tempFile, fullPath: fullPath + fileName + "." + suffix}
                                    })
                                } else {
                                    console.log(isCreate.message);
                                    reject({code: 404, message: isCreate.message});
                                }
                            })

                        }
                    })
                }
                else {
                    reject({code: 500, messge: "suffix 获取失败 at " + new Date()})
                }
            })

        },
        transExcelToArray: function (filePath) {
            return new Promise(function (resolve, reject) {
                try {
                    var workbook = XLSX.readFile(filePath);
                    var sheetNames = workbook.SheetNames;
                    var array = new Array();
                    workbook.SheetNames.forEach(function (sheetName) {
                        var worksheet = workbook.Sheets[sheetName];
                        array = array.concat(XLSX.utils.sheet_to_json(worksheet));
                    });
                    console.log(filePath + " read into RAM success at " + new Date())
                    resolve(array);
                } catch (err) {
                    console.error(filePath + " read into RAM error at " + new Date());
                    console.error(err);
                    reject(err);
                }
            })
        }
    }
    return _dealFile;
})();
module.exports = DealFile;
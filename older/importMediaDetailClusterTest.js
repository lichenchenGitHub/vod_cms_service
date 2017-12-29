/**
 * Created by lichenchen on 2017/6/13.
 */
var unirest = require("unirest");
var conf = require("../conf/config");
var Promise = require("bluebird");
var TransformObject = require("../lib/transformObject");
var transformObject = new TransformObject();
var fs = require("fs");
var XLSX = require('xlsx');

var getImportInfo = function () {
    return new Promise(function (resolve, reject) {
        var importObj = {};
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Importmedia/findOne")).pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    importObj.code = 200;
                    importObj.data = resp.body;
                    importObj.message = "get Importmedia info success at " + new Date();
                    resolve(importObj);
                } else {
                    reject({Error: "get Importmedia info success at " + new Date()})
                }

            })
    })
}
var upsertImportMediaDetail = function (importMediaDetail) {
    return new Promise(function (resolve, reject) {
        importMediaDetail.updatetime = new Date();
        var req = unirest.get(encodeURI(conf.strongLoopApi + "Importmediadetails/findOne?filter[where][cpcode]=" + importMediaDetail.cpcode + "&filter[where][programname]=" + importMediaDetail.programname)).pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status == 200) {
                    unirest.post(encodeURI(conf.strongLoopApi + "Importmediadetails/update?where[cpcode]=" + importMediaDetail.cpcode + "&where[programname]=" + importMediaDetail.programname))
                        .pool(conf.poolOption)
                        .header('Accept', 'application/json')
                        .header('Content-Type', 'application/json')
                        .send(importMediaDetail)
                        .end(function (res) {
                            if (res.status == 200) {
                                if (res.body.count == 1) {
                                    resolve(res.body);
                                } else {
                                    reject({Error: "update item count " + res.body.count + ",please connection developer"})
                                }
                            } else {
                                reject(res.body.error);
                            }
                        })
                } else {
                    importMediaDetail.id = 0;
                    importMediaDetail.createtime = new Date();
                    unirest.post(encodeURI(conf.strongLoopApi + "Importmediadetails")).pool(conf.poolOption)
                        .header('Accept', 'application/json')
                        .header('Content-Type', 'application/json')
                        .send(importMediaDetail)
                        .end(function (res) {
                            if (res.status == 200) {
                                resolve(res.body)
                            } else {
                                reject(res.body.error);
                            }
                        })
                }
            })

    });
}
var updateImportMedia = function (id, importMedia) {
    return new Promise(function (resolve, reject) {
        unirest.post(conf.strongLoopApi + "Importmedia/update?where[id]=" + id).pool(conf.poolOption)
            .header('Accept', 'application/json')
            .header('Content-Type', 'application/json')
            .send(importMedia)
            .end(function (resp) {
                if (resp.status == 200) {
                    if (resp.body.count == 1) {
                        resolve(resp.body);
                    } else {
                        reject({Error: "update item count " + resp.body.count + ",please connection developer"})
                    }
                } else {
                    reject(resp.body.error);
                }
            })
    })

}
var formatImportDetail = function (excelItem, importMedia) {
    var importMediaDetail = transformObject.transImportMediaObj(excelItem);
    importMediaDetail.importmediaid = importMedia.data.id;
    importMediaDetail.importmedianame = importMedia.data.name;
    importMediaDetail.cpcode = importMedia.data.cpcode;
    importMediaDetail.cpname = importMedia.data.cpname;
    importMediaDetail.priority = importMedia.data.priority;
    importMediaDetail.status = 0;
    importMediaDetail.statusdesc = "待解析";
    return importMediaDetail;
}
// getImportInfo().then(function (importMedia) {
//     return new Promise(function (resolve, reject) {
//         var workbook = XLSX.readFile(importMedia.data.filepath);
//         var importMediaDetail = transformObject.transImportMediaObj(XLSX.utils.sheet_to_json(workbook.Sheets["电影模板"])[0]);
//         importMediaDetail.importmediaid = importMedia.data.id;
//         importMediaDetail.importmedianame = importMedia.data.name;
//         importMediaDetail.cpcode = importMedia.data.cpcode;
//         importMediaDetail.cpname = importMedia.data.cpname;
//         importMediaDetail.priority=importMedia.data.priority;
//         importMediaDetail.status = 0;
//         importMediaDetail.statusdesc = "待解析";
//         resolve(importMediaDetail);
//     })
// }).then(function (importMediaDetail) {
//     return upsertImportMediaDetail(importMediaDetail);
// }).then(function (data) {
//     console.log(data);
// })
getImportInfo().then(function (filepath) {
    return new Promise(function (resolve, reject) {
        var workbook = XLSX.readFile(importMedia.data.filepath);
        var sheetNames = workbook.SheetNames;
        var array = new Array();
        workbook.SheetNames.forEach(function (sheetName) {
            var worksheet = workbook.Sheets[sheetName];
            array = array.concat(XLSX.utils.sheet_to_json(worksheet));
        });
        var result = {data: array, importMedia: importMedia}
        resolve(result);
    })
}).then(function (result) {
    return Promise.map(result.data, function (item, index) {
        var importMediaDetail = formatImportDetail(item, result.importMedia);
        return upsertImportMediaDetail(importMediaDetail)
    })
}).then(function (upsertInfo) {
        var impotMedia={};
        impotMedia.status=10;
        impotMedia.statusdesc="解析中"
        impotMedia.totalcount=upsertInfo.length;
        return updateImportMedia(43,impotMedia)
}).then(function(data){
    console.log(data);
}).catch(function(err){
    console.error(err);
})
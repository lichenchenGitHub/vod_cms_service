/**
 * Created by lichenchen on 2017/4/14.
 */
var unirest = require("unirest");
var conf = require("./../conf/config");
var Promise = require("bluebird");
var Enums = require("./../lib/enums");
var enums = new Enums();
var reback = {};
var getSeriesInfo = function (apiUrl) {
    return new Promise(function (resolve, reject) {
        var reback = {};
        var req = unirest.get(apiUrl)
            .pool(conf.poolOption)
            .end(function (resp) {
                if (resp.status != 200) {
                    reback.code = resp.statusCode;
                    reback.data = null;
                    reback.message = "get data error";
                    reject(reback);
                } else {
                    reback.code = resp.statusCode;
                    reback.data = resp.body;
                    reback.message = "get data success";
                    resolve(reback);
                }

            })
    })

}
var getSensitiveords = function (apiUrl) {
    return new Promise(function (resolve, reject) {
        var req = unirest.get(apiUrl).pool(conf.poolOption).end(function (resp) {
            if (resp.status != 200) {
                reback.code = resp.statusCode;
                reback.data = null;
                reback.message = apiUrl + " get page error";
                reject(reback);
            } else {
                reback.code = resp.statusCode;
                reback.data = resp.body;
                reback.message = apiUrl + " get page success";
                resolve(reback);
            }
        })
    })
}
var getContentProvider = function (code) {
    var reback = {};
    return new Promise(function (resolve, reject) {
        var req = unirest.get(conf.strongLoopApi + "Contentproviders/findOne?filter[where][code]=" + code + "&filter[where][status]=1"+"&filter[where][validStartTime][lte]="+new Date()+"&filter[where][validEndTime][gte]="+new Date()).pool(conf.poolOption).end(function (resp) {
            if (resp.status != 200) {
                reback.code = resp.statusCode;
                reback.data = null;
                reback.message = "get cp " + code + " page error";
                reject(reback);
            } else {
                reback.code = resp.statusCode;
                reback.data = resp.body;
                reback.message = "get cp " + code + " page success";
                resolve(reback);
            }
        })
    });

}
var hasSensitiveWords = function (sensitiveWordsList, obj, type) {
    return new Promise(function (resolve, reject) {
            var reback = {};
            var sensitiveWords = null;
            var hasSensitiveWords = false;
            var matchItems = {name: null, director: null, kperple: null, compere: null, guest: null};
            if (enums.MediaType.SERIES.value === type || enums.MediaType.PROGRAM.value === type) {
                matchItems.name = obj.name;
                matchItems.director = obj.actordisplay;
                matchItems.kperple = obj.writerdisplay;
                matchItems.compere = obj.compere;
                matchItems.guest = obj.guest;
                sensitiveWordsList.forEach(function (item, index) {
                    for (var attr in matchItems) {
                        if (matchItems[attr].indexOf(item.name,0) > -1) {
                            hasSensitiveWords = true;
                            sensitiveWords=item.name;
                            break;
                        }
                    }
                    if (hasSensitiveWords) {
                        return;
                    }
                });
                if(hasSensitiveWords){
                    reback.code=500;
                    reback.message=obj.cpcontentid+" has sensitive words";
                    reback.data={code:obj.code,sensitiveWords:sensitiveWords};

                }else{
                    reback.code=200;
                    reback.message=obj.cpcontentid+" has not sensitive words";
                    reback.data={code:obj.code,sensitiveWords:null};
                }
                resolve(reback);

            } else {
                reback.code = 500;
                reback.message = "type is not series or program at " + new Date();
                reback.data = null;
                reject(reback);
            }

        }
    );

}
var upsertSensitiveSeries=function(sensitiveObj){
    return new Promise(function (resolve, reject) {
        var reback={};
        var req=unirest.get(conf.strongLoopApi+"Sensitivewordsseries/findOne?filter[where][code]="+sensitiveObj.code+"&filter[where][]")
            .pool(conf.poolOption).end(function(resp){
                if(resp.status==200){

                }
            })
    })
}
Promise.join(getSensitiveords(conf.strongLoopApi + "Sensitivewords?filter[fields][name]=true"), getSeriesInfo(conf.strongLoopApi + "Series/findOne?filter[where][cpcontentid]=b1a7477ecd7f11e68fae"), function (sensitiveWordList,seriesObj) {
    return hasSensitiveWords(sensitiveWordList.data,seriesObj.data,1);
}).then(function(sensitiveWordsInfo){
    if(sensitiveWordsInfo.code===200){

    }else{

        console.log(sensitiveWordsInfo)
    }
}).catch(function(err){
    console.log(err)
});

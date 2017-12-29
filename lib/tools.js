/**
 * Created by lichenchen on 2017/4/6.
 */
var unirest = require("unirest");
var pinyin = require("pinyin");
var Enums = require("../lib/enums");
var fs = require("fs");
var Promise = require("bluebird");
var mkdirp = require("mkdirp");
var mime = require("mime-types");
var enums = new Enums();
var Hasher = require("../lib/hasher");
var hasher = new Hasher();
var conf = require("../conf/config");
var Tools = (function () {
    function _tools() {
    }

    _tools.prototype = {
        getPinyinAll: function (str) {
            var strArray = pinyin(str, {style: pinyin.STYLE_NORMAL});
            if (strArray.length <= 0) {
                return null;
            } else {
                var result = strArray.join(" ")
                if (result.length > 1024) {
                    return result.substring(0, 1024);
                } else {
                    return result;
                }
            }
        },
        getPinyinFirst: function (str) {
            var strArray = pinyin(str, {style: pinyin.STYLE_FIRST_LETTER});
            if (strArray.length <= 0) {
                return null;
            } else {
                var result = "";
                for (var i = 0; i < strArray.length; i++) {
                    if (i === (strArray.length - 1)) {
                        result += strArray.slice(0, i + 1).join("");
                    } else {
                        result += strArray.slice(0, i + 1).join("") + " ";
                    }
                }
                if (result.length > 1024) {
                    return result.substring(0, 1024);
                } else {
                    return result;
                }

            }
        },
        convertArrayToString: function (array, separator) {
            if (array.length <= 0) {
                return null;
            } else {
                var result = array.join(separator);
                return result.length > 255 ? result.substring(0, 255) : result;
            }
        },
        replaceChar: function (str, original, current) {
            var reg = new RegExp(original, "g");
            var result = str.replace(reg, current);
            return result.length > 255 ? result.substring(0, 255) : result;
        },
        getObjNames: function (objArray, separator) {
            var temp = [];
            objArray.forEach(function (item, index) {
                if (item.name) {
                    temp.push(item.name);
                }
            })
            return this.convertArrayToString(temp, separator);
        },
        formatDate: function (now, fmt) {
            //author: meizz
            var o = {
                "M+": now.getMonth() + 1,                 //月份
                "d+": now.getDate(),                    //日
                "H+": now.getHours(),                   //小时
                "m+": now.getMinutes(),                 //分
                "s+": now.getSeconds(),                 //秒
                "q+": Math.floor((now.getMonth() + 3) / 3), //季度
                "S": now.getMilliseconds()             //毫秒
            };
            if (/(y+)/.test(fmt))
                fmt = fmt.replace(RegExp.$1, (now.getFullYear() + "").substr(4 - RegExp.$1.length));
            for (var k in o)
                if (new RegExp("(" + k + ")").test(fmt))
                    fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
            return fmt;
        },
        hasSensitiveWords: function (sensitiveWordsList, obj, type) {
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
                            if (matchItems[attr]) {
                                if (matchItems[attr].indexOf(item.name, 0) > -1) {
                                    hasSensitiveWords = true;
                                    sensitiveWords = item.name;
                                    break;
                                }
                            }
                        }
                        if (hasSensitiveWords) {
                            return;
                        }
                    });
                    if (hasSensitiveWords) {
                        reback.code = 500;
                        reback.message = obj.cpcontentid + " has sensitive words";
                        reback.data = {cpcontentid: obj.cpcontentid, sensitivewords: sensitiveWords};

                    } else {
                        reback.code = 200;
                        reback.message = obj.cpcontentid + " has not sensitive words";
                        reback.data = obj;
                    }
                    resolve(reback);

                } else {
                    reback.code = 500;
                    reback.message = "type is not series or program at " + new Date();
                    reback.data = null;
                    reject(reback);
                }

            });
        },
        deepCopy: function (p, c) {
            var c = c || {};
            for (var i in p) {
                if (p[i] != null && typeof(p[i]) != "undefined" && p[i] != "") {
                    c[i] = p[i];
                }
            }
            return c;
        },
        //判断文件或者文件夹是否存在
        existsFile: function (filepath) {
            return new Promise(function (resolve, reject) {
                fs.exists(filepath, function (exists) {
                    if (exists) {
                        resolve({code: 200, message: "filepath :" + filepath + " exists at " + new Date()});
                    }
                    else {
                        resolve({code: 404, message: "filepath :" + filepath + " not exists at " + new Date()});
                    }
                })
            });
        },
        //创建层级文件夹
        createMkdir: function (mkdir) {
            return new Promise(function (resolve, reject) {
                mkdirp(mkdir, function (err) {
                    if (err) {
                        console.log(err);
                        reject({code: 404, message: "创建 " + mkdir + " 文件夹失败 at " + new Date()})
                    } else {
                        resolve({code: 200, message: "创建 " + mkdir + " 文件夹成功 at " + new Date()})
                    }
                });
            })
        },
        //重命名
        renameFile: function (fromPath, toPath) {
            return new Promise(function (resolve, reject) {
                fs.rename(fromPath, toPath, function (err, res) {
                    if (err) {
                        console.log(err);
                        reject({code: 404, message: "重命名 " + fromPath + " 失败 at " + new Date()})
                    } else {
                        resolve({
                            code: 200,
                            message: "文件 " + fromPath + " 重命名为 " + toPath + " 成功 at" + new Date(),
                            data: toPath
                        });
                    }
                })
            })
        },
        //删除空值
        clearNullArr: function (arr) {
            for (var i = 0, len = arr.length; i < len; i++) {
                if (!arr[i].from || arr[i].from == '' || arr[i].from === undefined) {
                    arr.splice(i, 1);
                    len--;
                    i--;
                }
            }
            return arr;
        },
        getArrayIndex: function (arr, el) {
            for (var i = 0, n = arr.length; i < n; i++) {
                if (arr[i] === el) {
                    return i;
                }
            }
            return -1;
        },
        //获取http地址
        formatContent: function (content) {
            var formatContent = content.match(/(http[s]?:\/\/([\w-]+.)+([:\d+])?(\/[\w-\.\/\?%&=]*)?)/gi);
            if (formatContent[0]) {
                formatContent[0] = formatContent[0].replace(/[\u4E00-\u9FA5\u3002|\uff1f|\uff01|\uff0c|\u3001|\uff1b|\uff1a|\u201c|\u201d|\u2018|\u2019|\uff08|\uff09|\u300a|\u300b|\u3008|\u3009|\u3010|\u3011|\u300e|\u300f|\u300c|\u300d|\ufe43|\ufe44|\u3014|\u3015|\u2026|\u2014|\uff5e|\ufe4f|\uffe5]/g, "")
                return formatContent[0].replace(/\(|\)/g, "");
            }
            else {
                return null;
            }
        },
        //聚合介质地址规范
        formatMovieAddress: function (series, movie, movefilename) {
            var formatAddress = null;
            var prefix = null;
            if (movie.type != null) {
                switch (movie.type) {
                    case 0:
                        prefix = conf.primaryMoviePrefix;
                        break;
                    case 1:
                        prefix = conf.endProductMoviePrefix;
                        break;
                    default:
                        prefix = null;
                        break;
                }
                if (prefix) {
                    if (movie.filepath && movie.filepath.indexOf(".") > 0) {
                        var programType = Tools.prototype.getProgramType(series.programtype);
                        var exname = movie.filepath.split(".");
                        if (series.cpcode && series.programtype && series.code && series.name && movie.name && movie.code) {
                            if (movie.type == 0) {
                                formatAddress = prefix + "/" + series.cpcode + "/" + programType + "/" + series.code + "/" + encodeURIComponent(series.name) + "/" + encodeURIComponent(movie.name) + "/" + movie.code + "/" + movie.code + "." + exname[exname.length - 1];
                            } else {
                                if (movefilename) {
                                    formatAddress = prefix + "/" + series.cpcode + "/" + programType + "/" + series.code + "/" + encodeURIComponent(series.name) + "/" + encodeURIComponent(movie.name) + "/" + movie.code + "/transcode/" + movefilename + "." + exname[exname.length - 1];
                                } else {
                                    return null;
                                }
                            }
                            return formatAddress;
                        } else {
                            return null;
                        }
                    } else {
                        return null;
                    }
                } else {
                    return null;
                }
            } else {
                return null;
            }

        },
        //获取节目类型
        getProgramType: function (programType) {
            var programValue = "";
            for (var index in enums.ProgramType) {
                if (enums.ProgramType[index].cname == programType) {
                    programValue = enums.ProgramType[index].value;
                    break;
                }
            }
            if (programValue && programValue != "") {
                return programValue;
            } else {
                return 10000;
            }
        },
        //Json对象属性大写换为小写
        lowerJSONKey: function (jsonObj) {
            for (var key in jsonObj) {
                jsonObj[key.toLowerCase()] = jsonObj[key];
                delete(jsonObj[key]);
            }
            return jsonObj;
        },
        //获取token
        getCpsToken: function () {
            var appId = conf.appId;
            var appSecret = conf.appSecret;
            var timestamp = Math.round(new Date().getTime() / 1000);
            var code = hasher.GetMD5("timestamp=" + timestamp + "&appSecret=" + appSecret);
            return new Promise(function (resolve, reject) {
                var req = unirest.get(encodeURI(conf.cps_prefix_test + "/contentPackage/token?appId=" + appId + "&timestamp=" + timestamp + "&code=" + code)).pool(conf.poolOption)
                    .end(function (resp) {
                        if (resp.status == 200) {
                            if (resp.body.code == 200) {
                                console.log(resp.body.msg);
                                resolve(resp.body.data);
                            } else {
                                reject({Error: "return value code is " + resp.body.code + " message :" + resp.body.msg});
                            }

                        } else {
                            reject({Error: "http status is not 200"})
                        }
                    })
            });
        },
        //获取文件后缀名
        getSuffixName: function (fileName) {
            var index1 = fileName.lastIndexOf(".");
            var index2 = fileName.length;
            return fileName.substring(index1, index2);
        },
        //json 转为params
        transJsonToParams: function (params) {
            var array = [];
            for (var prop in params) {
                array.push(prop + "=" + params[prop])
            }
            if (array.length >= 1) {
                if (array.length == 1) {
                    return array[0];
                } else {
                    for (var i = 1; i < array.length; i++) {
                        array[0] += "&" + array[i];
                    }
                    return array[0];
                }
            } else {
                return "";
            }
        },
        //删除Json中的空值
        deleteEmptyProperty: function (object) {
            for (var i in object) {
                var value = object[i];
                if (value == '' || value == null || typeof(value) == "undefined") {
                    delete object[i];
                }
            }
            return object;
        },
        filterUnifiedObject: function (unifiedObject, object) {
            var filterObj = {};
            for (var o in object) {
                filterObj[o] = unifiedObject[o];
            }
            return filterObj;
        },
        compareUnifiedObject: function (unifiedObject, object) {
            var flag = true;
            for (var i in object) {
                if (object[i] != unifiedObject[i]) {
                    flag = false;
                    break;
                }
            }
            return flag;
        },
        getCpsObj: function (property) {
            var obj = {};
            for (var j in property) {
                if (property[j].Name && property[j]._) {
                    obj[property[j].Name] = property[j]._
                }
            }
            obj = Tools.prototype.lowerJSONKey(obj);
            return obj;
        }

    }
    return _tools;
})();
module.exports = Tools;
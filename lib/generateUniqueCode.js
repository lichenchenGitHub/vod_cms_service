/**
 * Created by lichenchen on 2017/7/20.
 */
var Redis = require("ioredis");
var Promise = require("bluebird");
var conf = require("../conf/config");
var Tools = require("./tools");
var tools = new Tools();
var ROTATION = 99999;
var Seq = 0;
if (conf.redisConf.default === "cluster") {
    var codeStore = new Redis.Cluster(conf.redisConf.cluster);
} else {
    var codeStore = new Redis(conf.redisConf.normal);
}
exports.createUnifiedseriesCode = function (pj, code) {
    return new Promise(function (resolve, reject) {
        codeStore.get("unifiedseriesCode", function (err, result) {
            if (err) {
                reject(err)
            } else {
                if (result && result >= ROTATION) {
                    codeStore.set("unifiedseriesCode", Seq)
                } else {
                    codeStore.incr("unifiedseriesCode");
                }
                codeStore.get("unifiedseriesCode", function (err, result) {
                    if (err) {
                        reject(err)
                    } else {
                        var unifiedseriesCode = pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + result).slice(-5));
                        resolve(unifiedseriesCode);
                    }
                })
            }
        })
    })
}
exports.createUnifiedprogramCode = function (pj, code) {
    return new Promise(function (resolve, reject) {
        codeStore.get("unifiedprogramCode", function (err, result) {
            if (err) {
                reject(err)
            } else {
                if (result && result >= ROTATION) {
                    codeStore.set("unifiedprogramCode", Seq)
                } else {
                    codeStore.incr("unifiedprogramCode");
                }
                codeStore.get("unifiedprogramCode", function (err, result) {
                    if (err) {
                        reject(err)
                    } else {
                        var unifiedprogramCode = pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + result).slice(-5));
                        resolve(unifiedprogramCode);
                    }
                })
            }
        })
    })
}
exports.createUnifiedmovieCode = function (pj, code) {
    return new Promise(function (resolve, reject) {
        codeStore.get("unifiedmovieCode", function (err, result) {
            if (err) {
                reject(err)
            } else {
                if (result && result >= ROTATION) {
                    codeStore.set("unifiedmovieCode", Seq)
                } else {
                    codeStore.incr("unifiedmovieCode");
                }
                codeStore.get("unifiedmovieCode", function (err, result) {
                    if (err) {
                        reject(err)
                    } else {
                        var unifiedmovieCode = pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + result).slice(-5));
                        resolve(unifiedmovieCode);
                    }
                })
            }
        })
    })
}
exports.createMovieCode = function (pj, code) {
    return new Promise(function (resolve, reject) {
        codeStore.get("movieCode", function (err, result) {
            if (err) {
                reject(err)
            } else {
                if (result && result >= ROTATION) {
                    codeStore.set("movieCode", Seq)
                } else {
                    codeStore.incr("movieCode");
                }
                codeStore.get("movieCode", function (err, result) {
                    if (err) {
                        reject(err)
                    } else {
                        var movieCode = pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + result).slice(-5));
                        resolve(movieCode);
                    }
                })
            }
        })
    })
}
exports.createSeriesCode = function (cp, pj, code) {
    return new Promise(function (resolve, reject) {
        codeStore.get("seriesCode", function (err, result) {
            if (err) {
                reject(err)
            } else {
                if (result && result >= ROTATION) {
                    codeStore.set("seriesCode", Seq)
                } else {
                    codeStore.incr("seriesCode");
                }
                codeStore.get("seriesCode", function (err, result) {
                    if (err) {
                        reject(err)
                    } else {
                        var movieCode = cp + "_" + pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + result).slice(-5));
                        resolve(movieCode);
                    }
                })
            }
        })
    })
}
exports.createProgramCode = function (cp, pj, code) {
    return new Promise(function (resolve, reject) {
        codeStore.get("programCode", function (err, result) {
            if (err) {
                reject(err)
            } else {
                if (result && result >= ROTATION) {
                    codeStore.set("programCode", Seq)
                } else {
                    codeStore.incr("programCode");
                }
                codeStore.get("programCode", function (err, result) {
                    if (err) {
                        reject(err)
                    } else {
                        var progamCode = cp + "_" + pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + result).slice(-5));
                        resolve(progamCode);
                    }
                })
            }
        })
    })
}
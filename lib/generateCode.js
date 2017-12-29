/**
 * Created by lichenchen on 2017/4/12.
 */
var Tools = require("./tools");
var tools = new Tools();
var GenerateCode = (function () {
    var seriesSeq = 0;
    var programSeq = 0;
    var movieSeq = 0;
    var fileSeq=0;
    var importSeriesSeq=0;
    var importProgramSeq=0;
    var ROTATION = 99999;

    function _generateCode() {
    }

    _generateCode.prototype = {
        createSeriesCode: function (pj, code) {
            if (seriesSeq > ROTATION) {
                seriesSeq = 0;
            }
            return pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + (seriesSeq++)).slice(-5));
        },
        createProgramCode: function (pj, code) {
            if (programSeq > ROTATION) {
                programSeq = 0;
            }
            return pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + (programSeq++)).slice(-5));
        },
        createMovieCode:function(pj,code){
            if (movieSeq > ROTATION) {
                movieSeq = 0;
            }
            return pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + (movieSeq++)).slice(-5));
        },
        createFileId:function(pj,code){
            if (fileSeq > ROTATION) {
                fileSeq = 0;
            }
            return pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + (fileSeq++)).slice(-5));
        },
        createImportSeriesCode:function(pj,code){
            if (importSeriesSeq > ROTATION) {
                importSeriesSeq= 0;
            }
            return pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + (importSeriesSeq++)).slice(-5));
        },
        createImportProgramCode:function(pj,code){
            if (importProgramSeq > ROTATION) {
                importProgramSeq= 0;
            }
            return pj + code + tools.formatDate(new Date(), "yyyyMMddHHmmss") + ((Array(5).join(0) + (importProgramSeq++)).slice(-5));
        }
    }
    return _generateCode;
})();
module.exports = GenerateCode;
/**
 * Created by lichenchen on 2017/12/13.
 */
const conf = require("../conf/config.json");
const APECN_prefix=conf.APECN_prefix_cpcode;
const ftp_prefix=conf.APECN_ftp_prefix;
const fs = require("fs");
const Promise = require("bluebird");
var unirest = require("unirest");
var file = "./older/testAPECN.json";
// var result = JSON.parse(fs.readFileSync(file));
var Enums = require("../lib/enums");
var enums = new Enums();
var Tools = require("../lib/tools");
var tools = new Tools();
var JobEnterDatabase = require("../lib/jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
var checkAPECNSeries = function (collection) {
    var err = [];
    if (collection.collectionid == null || typeof(collection.collectionid) == "undefined") {
        err.push("节目集id为空");
    }
    if (collection.collectionname == null || typeof(collection.collectionname) == "undefined") {
        err.push("节目集名称为空")
    }
    if (collection.total == null || typeof(collection.total) == "undefined") {
        err.push("总集数为空");
    }
    if (collection.updatenumber == null || typeof(collection.updatenumber) == "undefined") {
        err.push("更新至为空");
    }
    if (collection.releasedate == null || typeof(collection.releasedate) == "undefined") {
        err.push("发行年份为空");
    }
    if (collection.totallength == null || typeof(collection.totallength) == "undefined" || Number(collection.totallength) <= 0) {
        err.push("总时长为空|0");
    }
    if (collection.firstclass == null || typeof(collection.firstclass) == "undefined") {
        err.push("一级分类为空")
    } else {
        if (collection.firstclass == "电影" || collection.firstclass == "电视剧") {
            if (collection.director == null || typeof(collection.director) == "undefined") {
                err.push("导演为空")
            }
            if (collection.performer == null || typeof(collection.performer) == "undefined") {
                err.push("主演为空");
            }
        }
    }
    if (collection.secondclass == null || typeof(collection.secondclass) == "undefined") {
        err.push("二级分类为空")
    }
    if (collection.finish == null || typeof(collection.finish) == "undefined") {
        err.push("是否完结为空")
    }
    if (collection.collectionabstract == null || typeof(collection.collectionabstract) == "undefined") {
        err.push("节目集简介为空");
    }
    if (collection.ppbfilepath == null || typeof(collection.ppbfilepath) == "undefined") {
        err.push("竖版海报（大）为空");
    }
    if (collection.ppsfilepath == null || typeof(collection.ppsfilepath) == "undefined") {
        err.push("竖版海报（小）为空");
    }
    if (collection.bpbfilepath == null || typeof(collection.bpbfilepath) == "undefined") {
        err.push("横板海报（大）为空");
    }
    if (collection.bpsfilepath == null || typeof(collection.bpsfilepath) == "undefined") {
        err.push("横板海报（小）为空");
    }
    if (collection.rubyrosefilepath == null || typeof(collection.rubyrosefilepath) == "undefined") {
        err.pusj("海报（大）为空");
    }
    if (err.length <= 0) {
        return collection;
    } else {
        return err;
    }
}
var checkAPECNProgram = function (singleprogram) {
    var err = [];
    if (singleprogram.singleid == null || typeof(singleprogram.singleid) == "undefined") {
        err.push("节目id为空");
    }
    if (singleprogram.programname == null || typeof(singleprogram.programname) == "undefined") {
        err.push("节目名称为空");
    }
    if (singleprogram.collectionid == null || typeof(singleprogram.collectionid) == "undefined") {
        err.push("节目集为空");
    }
    if (singleprogram.collectionname == null || typeof(singleprogram.collectionname) == "undefined") {
        err.push("节目集名称为空");
    }
    if (singleprogram.programnumber == null || typeof (singleprogram.programnumber) == "undefined") {
        err.push("集数为空");
    }
    if (singleprogram.issue == null || typeof(singleprogram.issue) == "undefined") {
        err.push("期数为空");
    }
    if (singleprogram.duration == null || typeof(singleprogram.duration) == "undefined") {
        err.push("时长为空");
    }
    if (singleprogram.singleabstract == null || typeof(singleprogram.singleabstract) == "undefined") {
        err.push("节目简介为空");
    }
    if (singleprogram.ppbfilepath == null || typeof(singleprogram.ppbfilepath) == "undefined") {
        err.push("竖版海报（大）为空");
    }
    if (singleprogram.ppsfilepath == null || typeof(singleprogram.ppsfilepath) == "undefined") {
        err.push("竖版海报（小）为空");
    }
    if (singleprogram.bpbfilepath == null || typeof(singleprogram.bpbfilepath) == "undefined") {
        err.push("横版海报（大）为空");
    }
    if (singleprogram.bpsfilepath == null || typeof(singleprogram.bpsfilepath) == "undefined") {
        err.push("横板海报（小）为空");
    }
    if (err.length <= 0) {
        return singleprogram;
    } else {
        return err;
    }
}
var checkAPECNMovie = function (media) {
    var err = [];
    if (media.collectionid == null || typeof(media.collectionid) == "undefined") {
        err.push("节目集id为空");
    }
    if (media.singleid == null || typeof(media.singleid) == "undefined") {
        err.push("节目id为空");
    }
    if (media.mediaid == null || typeof(media.mediaid) == "undefined") {
        err.push("介质id为空");
    }
    if (media.videowidth == null || typeof(media.videowidth) == "undefined") {
        err.push("视频宽度（videowidth）为空");
    }
    if (media.videohigh == null || typeof(media.videohigh) == "undefined") {
        err.push("视频高度（videohigh）为空");
    }
    if (media.videoframerate == null || typeof(media.videoframerate) == "undefined") {
        err.push("视频帧率（videoframerate）为空");
    }
    if (media.videocode == null || typeof(media.videocode) == "undefined") {
        err.push("视频编码（videocode）为空");
    }
    if (media.videostream == null || typeof(media.videostream) == "undefined" || Number(media.videostream) <= 0) {
        err.push("视频码率（videostream）为空|0")
    }
    if (media.audiocode == null || typeof(media.audiocode) == "undefined") {
        err.push("音频编码（audiocode）为空");
    }
    if (media.audiostream == null || typeof(media.audiostream) == "undefined") {
        err.push("音频码率（audiostream）为空");
    }
    if (media.md5 == null || typeof(media.md5) == "undefined") {
        err.push("md5 为空");
    }
    if (media.videofilepath == null || typeof(media.videofilepath) == "undefined") {
        err.push("视频文件路径（videofilepath)为空");
    }
    if (media.filebitratemode == null || typeof(media.filebitratemode) == "undefined") {
        err.push("视频文件码率模式(filebitratemode)为空");
    }
    if (media.filesize == null || typeof(media.filesize) == "undefined" || Number(media.filesize) <= 0) {
        err.push("文件大小（filesize）为空");
    }
    if (media.overallbitrate == null || typeof(media.overallbitrate) == "undefined") {
        err.push("混合码率模式（overallbitrate）为空");
    }
    if (media.videobitratemode == null || typeof(media.videobitratemode) == "undefined") {
        err.push("视频码率模式（videobitratemode）为空");
    }
    if (media.overallbitrate == null || typeof(media.overallbitrate) == "undefined" || Number(media.overallbitrate) <= 0) {
        err.push("平均混合码率（overallbitrate）为空|0")
    }
    if (err.length <= 0) {
        return media;
    } else {
        return err;
    }

}
var treatAPECNSeries = function (collection) {
    var series = {};
    series.cpcontentid = APECN_prefix + collection.collectionid;//节目集cpcontentid
    series.name = collection.collectionname;//节目集名称
    series.pinyin = tools.getPinyinAll(series.name);
    series.pinyinsuoxie = tools.getPinyinFirst(series.name);
    series.volumncount = collection.total;//总集数
    series.currentnum = collection.updatenumber;//更新至
    series.actordisplay = collection.director.split("、").join("|");//导演
    series.performer = collection.performer;//主演
    series.writerdisplay = collection.performer;//表演者
    series.orgairdate = collection.premieredate;//首映日期
    series.originalcountry = collection.country;//地区
    series.language = collection.language;//语言
    series.releaseyear = collection.releasedate;//发行年份
    series.duration = collection.totallength;//时长
    series.programtype = collection.firstclass;//一级分类
    series.programType2 = collection.secondclass;//二级分类
    series.definition = collection.clarity;//清晰度
    series.compere = collection.compere;
    series.guest = collection.guest;//主持人
    series.pictureurl1 = ftp_prefix + collection.ppbfilepath;//竖版海报（大）
    series.pictureurl2 = ftp_prefix + collection.ppsfilepath;//竖版海报（小）
    series.pictureurl3 = ftp_prefix + collection.bpbfilepath;//横板海报（大）
    series.pictureurl4 = ftp_prefix + collection.bpsfilepath;//横板海报（小）
    series.pictureurl5 = ftp_prefix + collection.rubyrosefilepath;//海报（大）
    //是否完结
    if (collection.finish == "未完结") {
        series.iscompleted = 0;
    } else {
        series.iscompleted = 1;
    }
    //是否缺集
    if (collection.lack == "否") {
        series.ismissing = 1;
    } else {
        series.ismissing = 0;
    }
    series.description = collection.collectionabstract;//节目集描述
    series.cpcode = enums.CPInfo.APECN.value;//cpcode
    series.cpname = enums.CPInfo.APECN.name;//cpname
    series.contentprovider = enums.CPInfo.APECN.value;//cpcode
    return series;
}
var treatAPECNProgram = function (singleprogram) {
    var program = {};
    program.cpcontentid = APECN_prefix + singleprogram.singleid;//cpcontentid
    program.name = singleprogram.programname;//节目名称
    program.seriesname = singleprogram.collectionname;//节目集名称
    program.volumncount = singleprogram.programnumber;//集数
    program.stage = singleprogram.issue;//期号
    program.actordisplay = singleprogram.director.split("、").join("|");//导演
    program.writerdisplay = singleprogram.performer;//主演
    program.performer = singleprogram.performer;//表演者
    program.keywords = singleprogram.keyword;//关键词
    program.originalcountry = singleprogram.country;//地区
    program.duration = singleprogram.duration;//时常（秒）
    program.programtype = singleprogram.firstclass;//一级分类
    program.programtype2 = singleprogram.secondclass;//二级分类
    program.definition = singleprogram.clarity;//清晰度
    program.compere = singleprogram.compere;//主持人
    program.guest = singleprogram.guest;//嘉宾
    program.videodesc = singleprogram.videotype;//影片类型描述
    program.videotype = 7;
    for (var key in enums.VideoType) {
        if (enums.VideoType[key].name == singleprogram.videotype) {
            program.videotype = enums.VideoType[key].value;//影片类型
        }
        break;
    }
    program.showid = APECN_prefix + singleprogram.collectionid;//节目集cpcontentid
    program.description = singleprogram.singleabstract;//节目描述
    program.pictureurl1 = ftp_prefix + singleprogram.ppbfilepath;//竖版海报（大）
    program.pictureurl2 = ftp_prefix + singleprogram.ppsfilepath;//竖版海报（小）
    program.pictureurl3 = ftp_prefix + singleprogram.bpbfilepath;//横版海报（大）
    program.pictureurl4 = ftp_prefix + singleprogram.bpsfilepath;//横板海报（小）
    program.cpcode = enums.CPInfo.APECN.value;//cpcode
    program.cpname = enums.CPInfo.APECN.name;//cpname
    program.contentprovider = enums.CPInfo.APECN.value;//cpcode
    return program;
}
var treatAPECNMovie = function (program, media) {
    var movie = {};
    //介质类型
    if (Number(media.type) == 8) {
        movie.type = enums.MovieType.PRIMARY.value;
    } else if (Number(media.type) == 2) {
        movie.type = enums.MovieType.END_PRODUCT.value;
    }
    movie.cpcontentid = APECN_prefix + media.singleid;//cpcontentid
    movie.name = program.name;//介质名称
    movie.showid = program.showid;//节目集cpcontentid
    movie.mediaid = media.mediaid;//介质Id
    movie.videotype = program.videotype;//影片类型
    movie.seriesname = program.seriesname;//节目集名称
    movie.cpcode = program.cpcode;//cpcode
    movie.cpname = program.cpname;//cpname

    movie.overallBitRate = media.overallbitrate;//总体码率
    movie.fileformat = media.outputformat;//文件格式
    movie.bitratemode = media.filebitratemode;//视频码率
    movie.filesize = media.filesize;//文件大小
    movie.md5 = media.md5;//文件md5
    movie.filepath = media.videofilepath;//文件路径
    movie.playurl = ftp_prefix + media.videofilepath;//播放地址

    movie.videoformat = media.videocode;//视频编码
    movie.videobitrate = media.videostream//视频码率
    movie.width = media.videowidth;//视频宽度
    movie.height = media.videohigh;//视频高度
    movie.scantype = media.videomethod;//扫描方式
    movie.framerate = Math.floor(parseFloat(media.videoframerate));//帧率

    movie.audioformat = media.audiocode;//音频编码
    movie.audiobitrate = media.audiostream;//音频码率
    movie.samplingrate = media.audiosampling;//采样率
    movie.downloadstatus = enums.MovieDownloadStatus.DOWNLOAD_WAITING.value;//状态待下载
    return movie;
}
unirest.get(encodeURI("http://10.3.1.8:9030/apecn/ba/d9/baa4ed73829bebe566d1052e33818ed9.json")).pool(conf.pool)
    .end(function (resp) {
        var result = resp.body;
        console.log(result)
        const APECN_prefix = "APECN_";
        const ftp_prefix = "ftp://guttv_ct:Apecn0okMju7@219.142.7.46:21/";
        var collection = result.collection;
        var singleprogram = result.singleprogram;
        var media = result.media;

        var series = treatAPECNSeries(collection)
        var program = treatAPECNProgram(singleprogram);
        Promise.join(checkAPECNSeries(collection), checkAPECNProgram(singleprogram), function (collection, singleprogram) {
            //判断collection、singleprogram是否缺少字段
            if (collection instanceof Array || singleprogram instanceof Array) {
                console.error("collection :");
                console.error(collection);
                console.error("singleprogram :");
                console.error(singleprogram);
                return null;
            } else {
                var movieList = [];
                //判断movie是否缺少字段
                for (var index in media) {
                    var movie = checkAPECNMovie(media[index]);
                    if (movie instanceof Array) {
                        console.error("media :")
                        console.error(movie);
                        return null;
                    } else {
                        movieList.push(movie);
                    }
                }
                //collection封装成series
                var series = treatAPECNSeries(collection);
                //singleprogram封装成program
                var program = treatAPECNProgram(singleprogram);
                //media封装成movie
                for (var index in movieList) {
                    movieList[index] = treatAPECNMovie(program, movieList[index]);
                }
                return {series: series, program: program, movieList: movieList};
            }
        }).then(function (object) {
            return new Promise(function (resolve, reject) {
                if (object) {
                    var flag = false;//是否存在源介质标识
                    for (var index in object.movieList) {
                        if (object.movieList[index].type == 0) {
                            flag = true;//存在源介质标识重置为true
                            break;
                        }
                    }
                    if (flag) {
                        resolve(object);
                    } else {
                        //不存在源介质手动创建一条源介质记录
                        var primaryMovie = {};
                        primaryMovie.cpcontentid = program.cpcontentid;
                        primaryMovie.name = program.name;
                        primaryMovie.showid = program.showid;
                        primaryMovie.videotype = program.videotype;
                        primaryMovie.seriesname = program.seriesname;
                        primaryMovie.cpcode = program.cpcode;
                        primaryMovie.cpname = program.cpname;
                        primaryMovie.type = enums.MovieType.PRIMARY.value;
                        object.movieList.push(primaryMovie);
                        resolve(object)
                    }
                } else {
                    console.error("object is null at " + new Date());
                    reject({Error: "object is null"});
                }
            })
        }).then(function (object) {
            return jobEnterDatabase.updateOrInsertSeriesByCondition({where: {cpcontentid: object.series.cpcontentid}}, object.series).then(function (series) {
                console.log("series enterdatabse success");
                return jobEnterDatabase.updateOrInsertProgramByCondition({where: {cpcontentid: object.program.cpcontentid}}, object.program);
            }).then(function (program) {
                console.log("program enterdatabase success");
                return Promise.mapSeries(object.movieList, function (item, index) {
                    return jobEnterDatabase.updateOrInsertMovieByCondition({
                        where: {
                            cpcontentid: item.cpcontentid,
                            type: item.type
                        }
                    }, item)
                })
            }).then(function (results) {
                console.log("movie series");
                console.log(results);
            }).catch(function (err) {
                console.error(err);
            })
        })
    })



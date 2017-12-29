/**
 * Created by lichenchen on 2017/4/6.
 */
var moment = require("moment");
var unirest = require("unirest");
var parseString = require('xml2js').parseString;
var conf = require("../conf/config");
var Enums = require("./enums");
var enums = new Enums();
var Constants = require("./constants");
var constants = new Constants();
var Tools = require("./tools");
var tools = new Tools();
var matchNumber = new RegExp(require("../conf/config").matchNumber);
var GenerateCode = require("./generateCode");
var generateCode = new GenerateCode();
var Promise = require("bluebird");
var ObjectTranform = (function () {
    function _objectTransform() {
    };
    _objectTransform.prototype = {
        transShowinfo: function (jsonObj, update) {
            var seriesObj = {};
            seriesObj.cpcontentid = enums.CPInfo.YOUKU.value + "_" + jsonObj.id;
            seriesObj.name = jsonObj.name.replace(/(^\s*)|(\s*$)/g, "");//去掉前后空格

            //isupdate
            if (!update) {
                seriesObj.checkstatus = enums.CheckStatus.NONE.value;
                seriesObj.cdnstatus = constants.YOUKU_SERIES_CDNSTATUS;//暂时没用
                seriesObj.price = constants.YOUKU_SERIES_PRICE;//暂时没用
                // 默认缺集
                seriesObj.ismissing = enums.MediaIsMessing.TRUE.value;
                seriesObj.createtime = new Date();
            }
            seriesObj.contentprovider = enums.CPInfo.YOUKU.value;
            seriesObj.cpcode = enums.CPInfo.YOUKU.value;
            seriesObj.cpname = enums.CPInfo.YOUKU.name;
            seriesObj.description = jsonObj.description;
            //一级分类映射
            var category = jsonObj.category;
            for (var i in enums.ProgramTypeMapping) {
                if (enums.ProgramTypeMapping[i].name == category) {
                    category = enums.ProgramTypeMapping[i].value;
                }
            }
            seriesObj.programtype = jsonObj.category;
            seriesObj.pictureurl1 = jsonObj.poster_large;
            seriesObj.pictureurl2 = jsonObj.poster;
            seriesObj.pictureurl3 = jsonObj.thumbnail_large;
            seriesObj.pictureurl4 = jsonObj.thumbnail;
            if (jsonObj.completed != null) {
                seriesObj.iscompleted = jsonObj.completed;
            } else {
                seriesObj.iscompleted = 0;
            }
            seriesObj.score = parseFloat(jsonObj.score);
            seriesObj.copyrightstatus = jsonObj.copyright_status;
            // 优酷版权到期，节目集下线
            if (enums.CopyrightStatus.EXPIRED.name === jsonObj.copyright_status) {
                seriesObj.checkstatus = enums.CheckStatus.OFFLINE.value;
                seriesObj.checkcontent = enums.CopyrightStatus.EXPIRED.value;
                seriesObj.offlinereason = enums.CopyrightStatus.EXPIRED.value;
                seriesObj.checktime = new Date();
            }
            seriesObj.vname = jsonObj.subtitle;
            //版权起始时间
            seriesObj.crbegindate = jsonObj.published;
            seriesObj.releaseyear = jsonObj.released;
            //拼音
            seriesObj.pinyin = tools.getPinyinAll(jsonObj.name);
            //拼音缩写
            seriesObj.pinyinsuoxie = tools.getPinyinFirst(jsonObj.name);
            // 处理别名 0其他语言，1英文
            if (jsonObj.alias && jsonObj.alias.length > 0) {
                var enname = [];
                var originalname = [];
                jsonObj.alias.forEach(function (item, index) {
                    if (item.type === "0") {
                        originalname.push(item.alias);
                    } else if (item.type === "1") {
                        enname.push(item.alias);
                    }
                })
                seriesObj.enname = tools.convertArrayToString(enname, constants.SEP);
                seriesObj.originalname = tools.convertArrayToString(originalname, constants.SEP);
            }
            //二级分类逗号改竖线
            if (jsonObj.genre && jsonObj.genre != "") {
                seriesObj.programtype2 = tools.replaceChar(jsonObj.genre, ",", constants.SEP);
            }
            //地区逗号改竖线，映射
            if (jsonObj.area && jsonObj.area != "") {
                var originalcountry = jsonObj.area.split(",");
                for (var i = 0; i < originalcountry.length; i++) {
                    for (var j = 0; j < enums.Regions.length; j++) {
                        if (originalcountry[i] == enums.Regions[j].name) {
                            originalcountry[i] = enums.Regions[j].value;
                        }
                    }
                }
                seriesObj.originalcountry = originalcountry.join(constants.SEP);
                // seriesObj.originalcountry = tools.replaceChar(jsonObj.area, ",", constants.SEP);
            }
            //是否收费，设置版权到期时间
            if (jsonObj.premium) {
                seriesObj.crenddate = jsonObj.premium.offlinetime;
            }
            // 处理总集数
            //getEpisode_count getEpisode_collected()取数值大的
            seriesObj.volumncount = parseInt(jsonObj.episode_count) > parseInt(jsonObj.episode_collected) ? parseInt(jsonObj.episode_count) : parseInt(jsonObj.episode_collected);
            seriesObj.currentnum = parseInt(jsonObj.episode_updated);
            seriesObj.viewcount = parseInt(jsonObj.view_count);

            //发行公司数组转化为竖线分隔字符串
            if (jsonObj.distributor && jsonObj.distributor.length > 0) {
                seriesObj.distributor = tools.getObjNames(jsonObj.distributor, constants.SEP);
            }
            //制作公司数组转化为竖线分隔字符串
            if (jsonObj.production && jsonObj.production.length > 0) {
                seriesObj.production = tools.getObjNames(jsonObj.production, constants.SEP)
            }
            //处理类型数组转化为竖线分隔字符串
            if (jsonObj.hasvideotype && jsonObj.hasvideotype.length > 0)
                seriesObj.hasvideotype = tools.convertArrayToString(jsonObj.hasvideotype, constants.SEP);
            //处理attr
            if (jsonObj.attr) {
                var attr = jsonObj.attr;
                //导演
                if (attr.director && attr.director.length > 0) {
                    seriesObj.actordisplay = tools.getObjNames(attr.director, constants.SEP);
                }
                //领衔主演
                if (attr.starring && attr.starring.length > 0) {
                    seriesObj.writerdisplay = tools.getObjNames(attr.starring, constants.SEP);
                } else if (attr.performer && attr.performer.length > 0) {
                    seriesObj.writerdisplay = tools.getObjNames(attr.performer, constants.SEP);
                }
                //主演
                if (attr.performer && attr.performer.length > 0) {
                    seriesObj.performer = tools.getObjNames(attr.performer, constants.SEP);
                } else if (attr.starring && attr.starring.length > 0) {
                    seriesObj.performer = tools.getObjNames(attr.starring, constants.SEP);
                }
                //主持人
                if (attr.host && attr.host.length > 0) {
                    seriesObj.compere = tools.getObjNames(attr.host, constants.SEP);
                }
                //配音
                if (attr.voice && attr.voice.length > 0) {
                    seriesObj.dub = tools.getObjNames(attr.voice, constants.SEP);
                }
                //作词
                if (attr.lyricswriter && attr.lyricswriter.length > 0) {
                    seriesObj.writeword = tools.getObjNames(attr.lyricswriter, constants.SEP);
                }
                //作曲
                if (attr.composer && attr.composer.length > 0) {
                    seriesObj.writemusic = tools.getObjNames(attr.composer, constants.SEP);
                }
                //编剧
                if (attr.screenwriter && attr.screenwriter.length > 0) {
                    seriesObj.screenwriter = tools.getObjNames(attr.screenwriter, constants.SEP);
                }
                //电视台
                if (attr.tv_station && attr.tv_station.length > 0) {
                    seriesObj.tvstation = tools.getObjNames(attr.tv_station, constants.SEP)
                }
                //演唱者
                if (attr.singer && attr.singer.length > 0) {
                    seriesObj.singer = tools.getObjNames(attr.singer, constants.SEP);
                }
                //教师
                if (attr.teacher && attr.teacher.length > 0) {
                    seriesObj.teacher = tools.getObjNames(attr.teacher, constants.SEP)
                }

            }
            seriesObj.updatetime = new Date();
            return seriesObj;
        },
        transProgram: function (jsonObj, series, update) {
            var programObj = {};
            //isupdate
            if (!update) {
                programObj.checkstatus = enums.CheckStatus.NONE.value;
                programObj.cdnstatus = constants.YOUKU_SERIES_CDNSTATUS;
                if (series.priority != null) {
                    programObj.priority = series.priority;
                } else {
                    programObj.priority = 5;
                }
                programObj.createtime = new Date();
                //programObj.code = generateCode.createProgramCode(enums.Project.CMS.value, enums.Code.PROGRAM);
            }

            // 优酷版权到期，节目集下线，节目也下线
            if (series.copyrightstatus === enums.CopyrightStatus.EXPIRED.name) {
                programObj.checkstatus = enums.CheckStatus.OFFLINE.value;
                programObj.checkcontent = enums.CopyrightStatus.EXPIRED.value;
                programObj.offlinereason = enums.CopyrightStatus.EXPIRED.value;
                programObj.checktime = new Date();
            }

            //series 相关信息
            programObj.seriesname = series.name;
            programObj.seriescode = series.code;
            programObj.cpcode = series.cpcode;
            programObj.cpname = series.cpname;
            programObj.originalname = series.originalname;
            programObj.actordisplay = series.actordisplay;
            programObj.writerdisplay = series.writerdisplay;
            programObj.contentprovider = series.contentprovider;
            programObj.originalcountry = series.originalcountry;
            programObj.releaseyear = series.releaseyear;
            programObj.programtype = series.programtype;
            programObj.programtype2 = series.programtype2;
            programObj.enname = series.enname;
            programObj.vname = series.vname;
            programObj.compere = series.compere;
            programObj.guest = series.guest;
            programObj.dub = series.dub;
            programObj.crbegindate = series.crbegindate;
            programObj.crenddate = series.crenddate;
            programObj.performer = series.performer;
            programObj.writemusic = series.writemusic;
            programObj.writeword = series.writeword;
            programObj.showid = series.cpcontentid;
            if (series.programtype === "电影") {
                programObj.seriesflag = "0";
            } else {
                programObj.seriesflag = "1";
            }
            programObj.orgairdate = series.crbegindate;

            //节目相关信息
            programObj.name = jsonObj.title.replace(/(^\s*)|(\s*$)/g, "");//去除前后空格
            programObj.cpcontentid = series.cpcode + "_" + jsonObj.id;
            programObj.duration = jsonObj.duration;
            programObj.pictureurl1 = jsonObj.bigThumbnail;
            programObj.pictureurl2 = jsonObj.thumbnail;
            programObj.description = jsonObj.description;
            programObj.playurl = jsonObj.link;
            programObj.videotype = enums.VideoType.OTHER.value;
            programObj.videodesc = enums.VideoType.OTHER.name;
            if (jsonObj.show && jsonObj.show.type) {
                for (var key in enums.VideoType) {
                    if (enums.VideoType[key].name == jsonObj.show.type) {
                        programObj.videotype = enums.VideoType[key].value;
                        programObj.videodesc = jsonObj.show.type;
                        break;
                    }
                }
            }
            if (jsonObj.tags && jsonObj.tags != "") {
                programObj.tags = tools.replaceChar(jsonObj.tags, ",", constants.SEP);//逗号转为竖线分隔
            }
            //0原创，1转载
            if (jsonObj.copyright_type === "reproduced") {
                programObj.copyrighttype = 1;
            } else {
                programObj.copyrighttype = 0;
            }

            if (jsonObj.show) {
                if (jsonObj.show.seq) {
                    programObj.volumncount = jsonObj.show.seq;
                }
                if (jsonObj.show.stage) {
                    programObj.stage = jsonObj.show.stage;
                }
            }
            programObj.updatetime = new Date();
            return programObj;

        },
        transMovie: function (program, type, update) {
            var movieObj = {};
            //是否更新
            if (!update) {
                movieObj.transcodestatus = enums.TranscodeStatus.WAIT.value;
                movieObj.iscompleted = enums.MediaInfoCompleted.NONE.value;
                movieObj.checkstatus = enums.CheckStatus.NONE.value;
                movieObj.downloadstatus = enums.MovieDownloadStatus.DOWNLOAD_WAITING.value;
                movieObj.type = enums.MovieType.PRIMARY.value;
                // 默认正片
                movieObj.videotype = enums.VideoType.POSITIVE.value;
                movieObj.createtime = new Date();
                //movieObj.code = generateCode.createMovieCode(enums.Project.CMS.value, enums.Code.MOVIE);
            }


            // 节目状态下线，源介质下线
            if (program.checkstatus && program.checkstatus === enums.CheckStatus.OFFLINE.value) {
                movieObj.checkstatus = enums.CheckStatus.OFFLINE.value;
                movieObj.checkcontent = enums.CopyrightStatus.EXPIRED.value;
                movieObj.offlinereason = enums.CopyrightStatus.EXPIRED.value;
                movieObj.checktime = new Date();
            }
            movieObj.name = program.name;
            movieObj.programcode = program.code;
            movieObj.cpname = program.cpname;
            movieObj.cpcode = program.cpcode;
            movieObj.cpcontentid = program.cpcontentid;
            movieObj.showid = program.showid;
            movieObj.seriesname = program.seriesname;
            movieObj.type = type;
            if (program.priority !== null) {
                movieObj.priority = program.priority;
            } else {
                movieObj.priority = 5;
            }
            movieObj.updatetime = new Date();
            return movieObj;
        },
        transWaitunified: function (seriesObj) {
            var waitunified = {};
            waitunified.cpcontentid = seriesObj.cpcontentid;
            waitunified.releaseyear = seriesObj.releaseyear;
            waitunified.status = enums.UnifiedStatus.WAITING_UNIFIED.value;
            waitunified.statusdesc = enums.UnifiedStatus.WAITING_UNIFIED.name;
            waitunified.createtime = new Date();
            waitunified.updatetime = new Date();
            waitunified.contenttype = enums.MediaType.SERIES.value;
            return waitunified;
        },
        treatGeneral: function (item, movie, movieType) {
            //文件格式
            if (item.format) {
                if (item.format instanceof Array) {
                    movie.fileformat = item.format[0];
                } else {
                    movie.fileformat = item.format;
                }
            }
            //时长
            if (item.duration) {
                var duration = null;
                if (item.duration instanceof Array) {
                    item.duration.forEach(function (value, number) {
                        if (matchNumber.test(value)) {
                            duration = parseInt(value);
                            return;
                        }

                    })
                    if (!duration) {
                        duration = parseInt(parseInt(item.duration[0]))
                    }
                } else {
                    duration = item.duration;
                }
                duration = duration / 1000;
                movie.duration = duration.toString();
            }
            //总体码率
            if (item.overall_bit_rate) {
                if (item.overall_bit_rate instanceof Array) {
                    item.overall_bit_rate.forEach(function (value, number) {
                        if (matchNumber.test(value)) {
                            movie.overallbitrate = value;
                            return;
                        }
                    })
                    if (!movie.overallbitrate) {
                        movie.overallbitrate = item.overall_bit_rate[0];
                    }
                } else {
                    movie.overallbitrate = item.overall_bit_rate;
                }
            }
            //码率模式
            if (item.overall_bit_rate_mode) {
                if (item.overall_bit_rate_mode instanceof Array) {
                    movie.bitratemode = item.overall_bit_rate_mode[0];
                } else {
                    movie.bitratemode = item.overall_bit_rate_mode;
                }
            }
            //帧率
            if (item.frame_rate) {
                if (item.frame_rate instanceof Array) {
                    item.frame_rate.forEach(function (value, number) {
                        if (matchNumber.test(value)) {
                            movie.framerate = parseInt(value).toString();
                            return;
                        }
                    })
                    if (!movie.framerate) {
                        movie.framerate = item.frame_rate[0];
                    }
                } else {
                    movie.framerate = parseInt(item.frame_rate).toString();
                }
            }
            //文件大小
            // if (movieType === enums.MovieType.END_PRODUCT.value) {
            //     if (item.file_size) {
            //         if (item.file_size instanceof Array) {
            //             item.file_size.forEach(function (value, number) {
            //                 if (matchNumber.test(value)) {
            //                     movie.filesize = value;
            //                     return;
            //                 }
            //             })
            //             if (!movie.filesize) {
            //                 movie.filesize = item.file_size[0]
            //             }
            //         }
            //     } else {
            //         movie.filesize = item.file_size;
            //     }
            // }
            if (item.file_size) {
                if (item.file_size instanceof Array) {
                    item.file_size.forEach(function (value, number) {
                        if (matchNumber.test(value)) {
                            movie.filesize = value;
                            return;
                        }
                    })
                    if (!movie.filesize) {
                        movie.filesize = item.file_size[0]
                    }
                }
            } else {
                movie.filesize = item.file_size;
            }
            return movie;
        },
        treatVideo: function (item, movie, movieType) {
            //视频格式
            if (item.format) {
                if (item.format instanceof Array) {
                    movie.videoformat = item.format[0];
                } else {
                    movie.videoformat = item.format;
                }
            }
            //宽
            if (item.width) {
                if (item.width instanceof Array) {
                    item.width.forEach(function (value, number) {
                        if (matchNumber.test(value)) {
                            movie.width = value;
                            return;
                        }
                    })
                    if (!movie.width) {
                        movie.width = item.width[0];
                    }
                } else {
                    movie.width = item.width;
                }
            }
            //高
            if (item.height) {
                if (item.height instanceof Array) {
                    item.height.forEach(function (value, number) {
                        if (matchNumber.test(value)) {
                            movie.height = value;
                            return;
                        }
                    })
                    if (!movie.height) {
                        movie.height = item.height;
                    }
                } else {
                    movie.height = item.height;
                }
            }
            //位深
            if (item.bit_depth) {
                if (item.bit_depth instanceof Array) {
                    item.bit_depth.forEach(function (value, number) {
                        if (matchNumber.test(value)) {
                            movie.bitdepth = value;
                            return;
                        }
                    })
                    if (!movie.bitdepth) {
                        movie.bitdepth = item.bit_depth[0];
                    }
                } else {
                    movie.bitdepth = item.bitdepth;
                }
            }
            //原介质
            if (movieType === enums.MovieType.PRIMARY.value) {
                //如果码率为空取视频码率
                if (!movie.bitratemode && item.frame_rate_mode) {
                    //格式CBR/VBR
                    if (item.frame_rate_mode instanceof Array) {
                        item.frame_rate_mode.forEach(function (value, number) {
                            if (value === "Constant") {
                                movie.bitratemode = "CBR";
                                return;
                            }
                        })
                        if (!movie.bitratemode) {
                            movie.bitratemode = "VBR"
                        }
                    } else {
                        if (item.frame_rate_mode === "Constant") {
                            movie.bitratemode = "CBR";
                        } else {
                            movie.bitratemode = "VBR";
                        }
                    }
                }

                //视频码率
                if (item.bit_rate) {
                    if (item.bit_rate instanceof Array) {
                        item.bit_rate.forEach(function (value, number) {
                            if (matchNumber.test(value)) {
                                movie.videobitrate = value;
                                return;
                            }
                        })
                        if (!movie.videobitrate) {
                            movie.videobitrate = item.bit_rate[0];
                        }
                    } else {
                        movie.videobitrate = item.bit_rate;
                    }
                }
            } else if (movieType === enums.MovieType.END_PRODUCT.value) {
                //码率格式CBR/VBR
                if (!movie.bitratemode && item.bit_rate_mode) {
                    if (item.bit_rate_mode instanceof Array) {
                        movie.bitratemode = item.bit_rate_mode[0];
                    } else {
                        movie.bitratemode = item.bit_rate_mode;
                    }
                }
                //视频码率
                if (movie.bitratemode === "VBR") {
                    if (item.maximum_bit_rate) {
                        if (item.maximum_bit_rate instanceof Array) {
                            movie.videobitrate = item.maximum_bit_rate[0];
                        } else {
                            movie.videobitrate = item.maximum_bit_rate;
                        }
                    }
                } else {
                    if (item.nominal_bit_rate) {
                        if (item.nominal_bit_rate instanceof Array) {
                            movie.videobitrate = item.nominal_bit_rate[0];
                        } else {
                            movie.videobitrate = item.nominal_bit_rate
                        }
                    }
                }
            }
            return movie;
        },
        treatAudio: function (item, movie, movieTyepe) {
            //音频格式
            if (item.format) {
                if (item.format instanceof Array) {
                    movie.audioformat = item.format[0];
                } else {
                    movie.audioformat = item.format;
                }
            }
            //采样率
            if (item.sampling_rate) {
                if (item.sampling_rate instanceof Array) {
                    item.sampling_rate.forEach(function (value, number) {
                        if (matchNumber.test(value)) {
                            movie.samplingrate = value;
                            return;
                        }
                    })
                    if (!movie.samplingrate) {
                        movie.samplingrate = item.sampling_rate[0];
                    }
                } else {
                    movie.samplingrate = item.sampling_rate;
                }
            }
            if (item.bit_rate) {
                if (item.bit_rate instanceof Array) {
                    item.bit_rate.forEach(function (value, number) {
                        if (matchNumber.test(value)) {
                            movie.audiobitrate = value;
                            return;
                        }
                    })
                    if (!movie.audiobitrate) {
                        movie.audiobitrate = item.bit_rate[0];
                    }
                } else {
                    movie.audiobitrate = item.bit_rate;
                }

            }
            return movie;
        },
        transUnifiedseries: function (series) {
            var unifiedSeries = tools.deepCopy(series, unifiedSeries);
            unifiedSeries.cpcode = enums.CPInfo.HQHY.value;
            unifiedSeries.cpname = enums.CPInfo.HQHY.name;
            unifiedSeries.srccpcode = series.cpcode;
            unifiedSeries.srccpname = series.cpname;
            delete unifiedSeries["actordisplay"];
            unifiedSeries.director = series.actordisplay;
            delete unifiedSeries["writerdisplay"];
            unifiedSeries.kpeople = series.writerdisplay;
            delete unifiedSeries["screenwriter"];
            unifiedSeries.scriptwriter = series.screenwriter;
            return unifiedSeries;
        },
        transUnifiedprogram: function (program, unifiedSeries) {
            program.unifiedseriescode = unifiedSeries.code;
            program.unifiedseriescpcontentid = unifiedSeries.cpcontentid;
            program.unifiedseriesname = unifiedSeries.name;
            program.scriptwriter = unifiedSeries.scriptwriter;
            program.srccpcode = program.cpcode;
            program.srccpname = program.cpname;
            program.cpcode = enums.CPInfo.HQHY.value;
            program.cpname = enums.CPInfo.HQHY.name;
            program.director = program.actordisplay;
            program.kpeople = program.writerdisplay;
            program.movietype1 = program.videotype;
            return program;
        },
        transUnifiedmovie: function (programObj) {
            var unifiedMovie = {};
            tools.deepCopy(programObj, unifiedMovie)

        },
        transImportMediaObj: function (importMediaDetail, type) {
            var importMediaObj = {};
            var err = [];
            // 节目集编号
            if (importMediaDetail["节目集编号（cp）"] && importMediaDetail["节目集编号（cp）"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.seriescpcontentid = importMediaDetail["节目集编号（cp）"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            }
            //节目编号
            if (importMediaDetail["节目编号（cp）"] && importMediaDetail["节目编号（cp）"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.programcpcontentid = importMediaDetail["节目编号（cp）"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            }
            //节目集名称
            if (importMediaDetail["节目集名称"] && importMediaDetail["节目集名称"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.seriesname = importMediaDetail["节目集名称"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("节目集为空");
            }
            //节目名称
            if (importMediaDetail["节目名称"] && importMediaDetail["节目名称"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.programname = importMediaDetail["节目名称"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("节目为空");
            }
            //节目类型
            if (importMediaDetail["节目类型"] && importMediaDetail["节目类型"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.programtype = importMediaDetail["节目类型"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("一级分类为空");
            }
            //二级分类
            if (importMediaDetail["二级分类"] && importMediaDetail["二级分类"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.programtype2 = importMediaDetail["二级分类"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("二级分类为空");
            }
            //地区
            if (importMediaDetail["地区"] && importMediaDetail["地区"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.originalcountry = importMediaDetail["地区"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("地区为空");
            }
            //语言
            if (importMediaDetail["语言"] && importMediaDetail["语言"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.language = importMediaDetail["语言"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            }
            //年代
            if (importMediaDetail["年代"] && importMediaDetail["年代"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.releaseyear = importMediaDetail["年代"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("年代为空");
            }
            //导演
            if (importMediaDetail["导演"] && importMediaDetail["导演"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.actordisplay = importMediaDetail["导演"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("导演为空");
            }
            //主演
            if (importMediaDetail["主演"] && importMediaDetail["主演"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.writerdisplay = importMediaDetail["主演"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("主演为空");
            }
            //时长
            if (importMediaDetail["时长"] && importMediaDetail["时长"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.duration = importMediaDetail["时长"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            }
            //主持人
            if (importMediaDetail["主持人"] && importMediaDetail["主持人"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.compere = importMediaDetail["主持人"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            }
            //是否有版权
            if (importMediaDetail["是否有版权"] && importMediaDetail["是否有版权"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.hascopyright = importMediaDetail["是否有版权"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("版权为空");
            }
            if (importMediaObj.hascopyright == "有") {
                //版权起始日期
                if (importMediaDetail["版权起始日期"] && importMediaDetail["版权起始日期"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.crbegindate = importMediaDetail["版权起始日期"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
                } else {
                    err.push("版权起始日期为空");
                }
                //版权结束日期
                if (importMediaDetail["版权结束日期"] && importMediaDetail["版权结束日期"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.crenddate = importMediaDetail["版权结束日期"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
                } else {
                    err.push("版权结束日期为空");
                }
            }
            //总集数
            if (importMediaDetail["总集数"] && importMediaDetail["总集数"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.seriesvolumncount = importMediaDetail["总集数"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("总集数为空");
            }
            //更新集数
            if (importMediaDetail["更新集数"] && importMediaDetail["更新集数"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.updatedvolumncount = importMediaDetail["更新集数"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("更新集数为空");
            }
            //当前集数
            if (importMediaDetail["当前集数"] && importMediaDetail["当前集数"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.programvolumncount = importMediaDetail["当前集数"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("当前集数为空");
            }
            //主海报
            if (importMediaDetail["主海报"] && importMediaDetail["主海报"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.pictureurl1 = importMediaDetail["主海报"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("主海报为空");
            }
            //副海报1
            if (importMediaDetail["副海报1"] && importMediaDetail["副海报1"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.pictureurl2 = importMediaDetail["副海报1"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("副海报1为空");
            }
            //副海报2
            if (importMediaDetail["副海报2"] && importMediaDetail["副海报2"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.pictureurl3 = importMediaDetail["副海报2"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("副海报2为空");
            }
            //副海报3
            if (importMediaDetail["副海报3"] && importMediaDetail["副海报3"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.pictureurl4 = importMediaDetail["副海报3"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("副海报3为空");
            }
            //节目集描述
            if (importMediaDetail["节目集描述"] && importMediaDetail["节目集描述"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.seriesdescription = importMediaDetail["节目集描述"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("节目集描述为空");
            }
            //节目描述
            if (importMediaDetail["节目描述"] && importMediaDetail["节目描述"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.programdescription = importMediaDetail["节目描述"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("节目描述为空");
            }
            //原介质地址
            if (importMediaDetail["原介质地址"] && importMediaDetail["原介质地址"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.primarymovieaddr = importMediaDetail["原介质地址"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            }
            //成品地址
            if (importMediaDetail["成品地址"] && importMediaDetail["成品地址"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.endproductmovieaddr = importMediaDetail["成品地址"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            }
            //原介质成品介质二者不能都为空
            if (importMediaObj.primarymovieaddr || importMediaObj.endproductmovieaddr) {

            } else {
                err.push("原介质地址、成品地址不可都为空");
            }
            //入库名称
            if (importMediaDetail["入库名称"] && importMediaDetail["入库名称"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.movefilename = importMediaDetail["入库名称"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("入库名称为空");
            }
            //分辨率
            if (importMediaDetail["分辨率"] && importMediaDetail["分辨率"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.resolution = importMediaDetail["分辨率"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("分辨率为空");
            }
            //编码格式
            if (importMediaDetail["编码格式"] && importMediaDetail["编码格式"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.videoformat = importMediaDetail["编码格式"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("编码格式为空");
            }
            //帧率
            if (importMediaDetail["帧率"] && importMediaDetail["帧率"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.frame = importMediaDetail["帧率"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("帧率为空");
            }
            //音频格式
            if (importMediaDetail["音频格式"] && importMediaDetail["音频格式"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.audioformat = importMediaDetail["音频格式"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("音频格式为空");
            }
            //音频码率
            if (importMediaDetail["音频码率"] && importMediaDetail["音频码率"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.audiobitrate = importMediaDetail["音频码率"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("音频码率为空");
            }
            //混合码率模式
            if (importMediaDetail["混合码率模式"] && importMediaDetail["混合码率模式"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.bitratemode = importMediaDetail["混合码率模式"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("混合码率模式为空");
            }
            //导入规格
            if (importMediaDetail["导入规格"] && importMediaDetail["导入规格"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.movieformat = importMediaDetail["导入规格"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("导入规格为空");
            }
            //扫描方式
            if (importMediaDetail["扫描方式"] && importMediaDetail["扫描方式"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.scantype = importMediaDetail["扫描方式"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("扫描方式为空");
            }
            //文件格式
            if (importMediaDetail["文件格式"] && importMediaDetail["文件格式"].replace(/(^\s*)|(\s*$)/g, "") != "") {
                importMediaObj.fileformat = importMediaDetail["文件格式"].replace(/(^\s*)|(\s*$)/g, "").replace(/[\r\n]/g, "");
            } else {
                err.push("文件格式为空");
            }
            console.error(err);
            if (err.length > 0) {
                importMediaObj.err = err;
            }
            return importMediaObj;
        },
        formatImportDetail: function (excelItem, id, name, cpcode, cpname, priority) {
            var importMediaDetail = this.transImportMediaObj(excelItem);
            if (importMediaDetail.err) {
                return importMediaDetail;
            } else {
                importMediaDetail.importmediaid = id;
                importMediaDetail.importmedianame = name;
                importMediaDetail.cpcode = cpcode;
                importMediaDetail.cpname = cpname;
                importMediaDetail.priority = priority;
                importMediaDetail.status = 0;
                importMediaDetail.statusdesc = "待解析";
                return importMediaDetail;
            }
        },
        //导入信息封装series
        treatSeries: function (importDetail) {
            if (importDetail) {
                var series = {};
                //series cpcontentid
                if (importDetail.seriescpcontentid && importDetail.seriescpcontentid != "") {
                    series.cpcontentid = importDetail.cpcode + "_" + importDetail.seriescpcontentid;
                } else {
                    series.cpcontentid = null;
                }
                series.name = importDetail.seriesname.replace(/\s+/g, " ");
                series.programtype = importDetail.programtype.replace("/", "|").replace(",", "|")
                for (var i in enums.ProgramTypeMapping) {
                    if (enums.ProgramTypeMapping[i].name == series.programtype) {
                        series.programtype = enums.ProgramTypeMapping[i].value;
                    }
                }
                series.programtype2 = importDetail.programtype2.replace("/", "|").replace(",", "|");
                series.originalcountry = importDetail.originalcountry.replace("/", "|").replace(",", "|");
                var originalcountry = series.originalcountry.split("|");
                for (var i = 0; i < originalcountry.length; i++) {
                    for (var j = 0; j < enums.Regions.length; j++) {
                        if (originalcountry[i] == enums.Regions[j].name) {
                            originalcountry[i] = enums.Regions[j].value;
                        }
                    }
                }
                series.originalcountry = originalcountry.join(constants.SEP);
                series.releaseyear = importDetail.releaseyear;
                series.actordisplay = importDetail.actordisplay.replace("/", "|").replace(",", "|");
                series.writerdisplay = importDetail.writerdisplay.replace("/", "|").replace(",", "|");
                if (importDetail.hascopyright == "有") {
                    series.copyrightstatus = enums.CopyrightStatus.AUCHORIZED.name;
                    series.crbegindate = importDetail.crbegindate.replace("/", "|").replace(",", "|");
                    series.orgairdate = importDetail.crbegindate.replace("/", "|").replace(",", "|");
                    series.crenddate = importDetail.crenddate;
                } else {
                    series.copyrightstatus = enums.CopyrightStatus.UNAUTHORIZED.name;
                }
                var volumnCount = Number(importDetail.seriesvolumncount)
                if (isNaN(volumnCount)) {
                    series.volumncount = null;
                } else {
                    series.volumncount = volumnCount;
                }
                var currentNum = Number(importDetail.updatedvolumncount);
                if (isNaN(currentNum)) {
                    series.currentnum = null;
                } else {
                    series.currentnum = currentNum;
                }
                if (series.volumncount && series.currentnum) {
                    if (series.volumncount == series.currentnum) {
                        series.iscompleted = 1;
                    } else {
                        series.iscompleted = 0;
                    }
                }
                if (importDetail.language && importDetail.language != "") {
                    series.language = importDetail.language;
                }
                if (importDetail.compere && importDetail.compere != "") {
                    series.compere = importDetail.compere.replace("/", "|").replace(",", "|");
                }
                series.pictureurl1 = importDetail.pictureurl1;
                series.pictureurl2 = importDetail.pictureurl2;
                series.pictureurl3 = importDetail.pictureurl3;
                series.description = importDetail.seriesdescription;
                series.checkstatus = enums.CheckStatus.NONE.value;
                series.cpcode = importDetail.cpcode;
                series.cpname = importDetail.cpname;
                series.seriestype = 1;
                series.hasvideotype = "正片";//默认正片
                series.ismissing = enums.MediaIsMessing.TRUE.value;//默认缺集
                series.pinyin = tools.getPinyinAll(series.name);
                series.pinyinsuoxie = tools.getPinyinFirst(series.name);
                series.contentprovider = series.cpcode;
                series.cdnstatus = 0;
                return series;
            } else {
                return null;
            }
        },
        treatProgram: function (importDetail, series) {
            if (importDetail) {
                var program = {};
                if (importDetail.duration && importDetail.duration != "") {
                    var tempDuration = moment(importDetail.duration, "HH:mm:ss");
                    program.duration = tempDuration.hour() * 60 * 60 + tempDuration.minute() * 60 + tempDuration.second();
                }
                if (importDetail.programcpcontentid && importDetail.programcpcontentid != "") {
                    program.cpcontentid = series.cpcode + "_" + importDetail.programcpcontentid;
                } else {
                    program.cpcontentid = null;
                }
                program.name = importDetail.programname.replace(/\s+/g, " ");
                program.programtype = series.programtype;
                program.programtype2 = series.programtype2;
                program.originalcountry = series.originalcountry;
                if (series.language && series.language != "") {
                    program.language = series.language;
                }
                program.releaseyear = series.releaseyear;
                program.actordisplay = series.actordisplay;
                program.writerdisplay = series.writerdisplay;
                program.compere = series.compere;
                program.crbegindate = series.crbegindate;
                program.crenddate = series.crenddate;
                var volumnCount = Number(importDetail.programvolumncount);
                if (isNaN(volumnCount)) {
                    program.volumncount = null;
                    program.stage = null;
                } else {
                    program.volumncount = volumnCount;
                    program.stage = volumnCount;
                }
                program.pictureurl1 = series.pictureurl1;
                program.pictureurl2 = series.pictureurl2;
                program.description = importDetail.programdescription
                program.showid = series.cpcontentid;
                program.seriesname = series.name;
                program.checkstatus = enums.CheckStatus.NONE.value;
                program.cpcode = series.cpcode;
                program.contentprovider = program.cpcode;
                program.cpname = series.cpname;
                program.hasreview = 1;
                program.videotype = enums.VideoType.POSITIVE.value;
                program.cdnstatus = series.cdnstatus;
                return program;

            } else {
                return null;
            }
        },
        treatMvoie: function (importDetail, program) {
            var movieList = new Array();
            var movieName = importDetail.programname;
            var cpcontentid = program.cpcontentid;
            var showid = program.showid;
            var checkstatus = enums.CheckStatus.NONE.value;
            var downloadstatus = enums.MovieDownloadStatus.DOWNLOAD_SUCCESS.value;
            var transcodestatus = enums.TranscodeStatus.TRANSCODE_SUCCESS.value;
            var videotype = enums.VideoType.POSITIVE.value;
            var iscompleted = enums.MediaInfoCompleted.NONE.value;
            var cpcode = program.cpcode;
            var cpname = program.cpname;
            var movefilename = importDetail.movefilename;
            if (importDetail.primarymovieaddr && importDetail.primarymovieaddr != "") {
                var primaryMovie = {};
                primaryMovie.name = movieName;
                primaryMovie.type = enums.MovieType.PRIMARY.value;
                primaryMovie.filepath = importDetail.primarymovieaddr;
                primaryMovie.playurl = importDetail.primarymovieaddr;
                primaryMovie.cpcontentid = cpcontentid;
                primaryMovie.showid = showid;
                primaryMovie.checkstatus = checkstatus;
                primaryMovie.downloadstatus = downloadstatus;
                primaryMovie.transcodestatus = transcodestatus;
                primaryMovie.videotype = videotype;
                primaryMovie.iscompleted = iscompleted;
                primaryMovie.cpcode = cpcode;
                primaryMovie.cpname = cpname;
                primaryMovie.movefilename = movefilename;
                movieList.push(primaryMovie);
            }
            if (importDetail.endproductmovieaddr && importDetail.endproductmovieaddr != "") {
                var endProductMovie = {};
                endProductMovie.name = movieName;
                endProductMovie.type = enums.MovieType.END_PRODUCT.value;
                endProductMovie.filepath = importDetail.endproductmovieaddr;
                endProductMovie.playurl = importDetail.endproductmovieaddr;
                endProductMovie.cpcontentid = cpcontentid;
                endProductMovie.showid = showid;
                endProductMovie.checkstatus = checkstatus;
                endProductMovie.downloadstatus = downloadstatus;
                endProductMovie.transcodestatus = transcodestatus;
                endProductMovie.videotype = videotype;
                endProductMovie.iscompleted = iscompleted;
                endProductMovie.cpcode = cpcode;
                endProductMovie.cpname = cpname;
                endProductMovie.movefilename = movefilename;
                endProductMovie.movieformat = importDetail.movieformat;
                endProductMovie.scantype = importDetail.scantype;
                endProductMovie.width = importDetail.resolution.split("*")[0];
                endProductMovie.height = importDetail.resolution.split("*")[1];
                endProductMovie.videoformat = importDetail.videoformat;
                endProductMovie.framerate = importDetail.frame;
                endProductMovie.audioformat = importDetail.audioformat;
                endProductMovie.audiobitrate = importDetail.audiobitrate;
                endProductMovie.bitratemode = importDetail.bitratemode;
                endProductMovie.fileformat = importDetail.fileformat;
                movieList.push(endProductMovie);
            }
            console.log(movieList);
            return movieList;
        },
        checkImportDetail: function (importDetail) {
            if (importDetail) {
                //节目集编码
                var err = [];
                if (importDetail.seriescpcontentid) {
                    if (importDetail.seriescpcontentid.length > constants.CODE_MAX_LENGTH) {
                        err.push("节目集编码（CP） not in rules");
                    }
                }
                //节目编码
                if (importDetail.programcpcontentid) {
                    if (importDetail.programcpcontentid.length > constants.CODE_MAX_LENGTH) {
                        err.push("节目集编码（CP） not in rules");
                    }

                }
                //节目集名称
                if (importDetail.seriesname && importDetail.seriesname.length <= constants.SERIES_NAME_MAX_LENGTH) {

                } else {
                    err.push("节目集名称 not in rules");
                }
                //节目名称
                if (importDetail.programname && importDetail.programname.length <= constants.PROGRAM_NAME_MAX_LENGTH) {

                } else {
                    err.push("节目名称 not in rules");
                }
                //节目集分类
                if (importDetail.programtype && importDetail.programtype.length <= constants.PROGRAM_TYPE_MAX_LENGTH) {

                } else {
                    err.push("节目类型 not in rules");
                }
                //二级分类
                if (importDetail.programtype2 && importDetail.programtype2.length <= constants.PROGRAM_TYPE_MAX_LENGTH) {

                } else {
                    err.push("二级分类 not in rules");
                }
                //地区
                if (importDetail.originalcountry && importDetail.originalcountry.length <= constants.ORIGINAL_COUNTRY_MAX_LENGTH) {

                } else {
                    err.push("地区 not in rules");
                }
                //语言
                if (importDetail.language) {
                    if (importDetail.language.length > constants.LANGUAGE_MAX_LENGTH) {
                        err.push("语言 not in rules");
                    }

                }
                //年代
                if (importDetail.releaseyear && importDetail.releaseyear.length <= constants.RELEASE_YEAR_MAX_LENGTH) {

                } else {
                    err.push("年代 not in rules");
                }
                //导演
                if (importDetail.actordisplay && importDetail.actordisplay.length <= constants.ACTOR_DISPLAY_MAX_LENGTH) {

                } else {
                    err.push("导演 not in rules");
                }
                //主演
                if (importDetail.writerdisplay && importDetail.writerdisplay.length <= constants.WRITER_DISPLAY_MAX_LENGTH) {

                } else {
                    err.push("主演 not in rules");
                }
                //主持人
                if (importDetail.compere) {
                    if (importDetail.compere.length > constants.MOVE_FILE_NAME_MAX_LENGTH) {
                        err.push("主持人 not in rules");
                    }
                }
                //时长
                if (importDetail.duration) {
                    if (importDetail.duration.length > constants.CODE_MAX_LENGTH) {
                        err.push("时长 not in rules");
                    }
                }
                //版权
                if (importDetail.hascopyright == "有") {
                    if (importDetail.crbegindate) {
                        if (importDetail.crbegindate.length <= constants.CR_DATE_MAX_LENGTH) {

                        } else {
                            err.push("版权 not in rules");
                        }
                    }
                    if (importDetail.crenddate) {
                        if (importDetail.crenddate.length <= constants.CR_DATE_MAX_LENGTH) {

                        } else {
                            err.push("版权 not in rules");
                        }
                    }

                }
                //总集数
                if (importDetail.seriesvolumncount && importDetail.seriesvolumncount.length <= constants.VOLUMN_COUNT_MAX_LENGTH) {

                } else {
                    err.push("总集数 not in rules");
                }
                //分集数
                if (importDetail.programvolumncount && importDetail.programvolumncount.length <= constants.VOLUMN_COUNT_MAX_LENGTH) {

                } else {
                    err.push("分集数 not in rules");
                }
                //更新集数
                if (importDetail.updatedvolumncount && importDetail.updatedvolumncount.length <= constants.VOLUMN_COUNT_MAX_LENGTH) {

                } else {
                    err.push("更新集数 not in rules");
                }
                //主海报
                if (importDetail.pictureurl1 && importDetail.pictureurl1.length <= constants.PICTUREURL_MAX_LENGTH) {

                } else {
                    err.push("主海报 not in rules");
                }
                //副海报1
                if (importDetail.pictureurl2 && importDetail.pictureurl2.length <= constants.PICTUREURL_MAX_LENGTH) {

                } else {
                    err.push("副海报1 not in rules");
                }
                //副海报2
                if (importDetail.pictureurl3 && importDetail.pictureurl3.length <= constants.PICTUREURL_MAX_LENGTH) {

                } else {
                    err.push("副海报3 not in rules");
                }
                //副海报3
                if (importDetail.pictureurl4 && importDetail.pictureurl4.length <= constants.PICTUREURL_MAX_LENGTH) {

                } else {
                    err.push("副海报3 not in rules");
                }
                //节目集描述
                if (importDetail.seriesdescription && importDetail.seriesdescription.length <= constants.DESCRIPTION_MAX_LENGTH) {

                } else {
                    err.push("节目集描述 not in rules");
                }
                //节目描述
                if (importDetail.programdescription && importDetail.programdescription.length <= constants.DESCRIPTION_MAX_LENGTH) {

                } else {
                    err.push("节目描述 not in rules")
                }
                //原介质 or 成品介质
                if ((importDetail.primarymovieaddr && importDetail.primarymovieaddr != "") || (importDetail.endproductmovieaddr && importDetail.endproductmovieaddr != "")) {
                    if (importDetail.primarymovieaddr && importDetail.primarymovieaddr != "") {
                        if (importDetail.primarymovieaddr.length > constants.FILE_PATH_MAX_LENGTH) {
                            err.push("primarymovieaddr not in rules");
                        }
                    }
                    if (importDetail.endproductmovieaddr && importDetail.endproductmovieaddr != "") {
                        if (importDetail.endproductmovieaddr.length > constants.FILE_PATH_MAX_LENGTH) {
                            err.push("primarymovieaddr not in rules");
                        }
                    }
                }
                //入库名称
                if (importDetail.movefilename && importDetail.movefilename.length <= constants.MOVE_FILE_NAME_MAX_LENGTH) {

                } else {
                    err.push("入库名称 not in rules")
                }
                //分辨率
                if (importDetail.resolution && importDetail.resolution.length <= constants.RESOLUTION_MAX_LENGTH) {
                    if (importDetail.resolution.indexOf("*") < 0) {
                        err.push("分辨率格式异常");
                    } else {
                        var params = importDetail.resolution.split("*");
                        if (params.length < 2) {
                            err.push("分辨率缺少参数")
                        }
                        if ((/^[0-9]+.?[0-9]*$/.test(params[0]) == true) && (/^[0-9]+.?[0-9]*$/.test(params[0]) == true)) {

                        } else {
                            err.push("分辨率非数字")
                        }
                    }

                } else {
                    err.push("分辨率 not in rules");
                }
                //视频格式
                if (importDetail.videoformat && importDetail.videoformat.length <= constants.RESOLUTION_MAX_LENGTH) {

                } else {
                    err.push("视频格式 not in rules");
                }
                //帧率
                if (importDetail.frame && importDetail.frame.length <= constants.RESOLUTION_MAX_LENGTH) {

                } else {
                    err.push("帧率 not in rules")
                }
                //音频格式
                if (importDetail.audioformat && importDetail.audioformat.length <= constants.RESOLUTION_MAX_LENGTH) {

                } else {
                    err.push("音频格式 not in rules")
                }
                //音频码率
                if (importDetail.audiobitrate && importDetail.audiobitrate.length <= constants.RESOLUTION_MAX_LENGTH) {

                } else {
                    err.push("音频码率 not in rules")
                }
                //码率格式
                if (importDetail.bitratemode && importDetail.bitratemode.length <= constants.RESOLUTION_MAX_LENGTH) {

                } else {
                    err.push("码率格式 not in rules");
                }
                //导入规格
                if (importDetail.movieformat && importDetail.movieformat.length <= constants.MOVIEFORMAT_MAX_LENGTH) {

                } else {
                    err.push("导入规格 not in rules");
                }
                ///文件格式
                if (importDetail.fileformat && importDetail.fileformat.length <= constants.RESOLUTION_MAX_LENGTH) {

                } else {
                    err.push("文件格式 not in rules");
                }
                //扫描方式
                if (importDetail.scantype && importDetail.scantype.length <= constants.SCANTYPE_MAX_LENGTH) {

                } else {
                    err.push("扫描方式 not in rules");
                }
                return {importDetail: importDetail, err: err}

            }
            else {
                return null;
            }
        },
        checkPrimaryMovie: function (movieObj) {
            var err = [];
            if (movieObj.fileformat == null || typeof(movieObj.fileformat) == "undefined" || movieObj.fileformat == "") {
                err.push("文件格式 不能为空");
            }
            if (movieObj.filesize == null || typeof(movieObj.filesize) == "undefined" || movieObj.filesize == "") {
                err.push("文件大小 不能为空");
            }
            if (movieObj.videoformat == null || typeof(movieObj.videoformat) == "undefined" || movieObj.videoformat == "") {
                err.push("视频格式 不能为空");
            }
            if (movieObj.width == null || typeof (movieObj.width) == "undefined" || movieObj.width == "") {
                err.push("视频宽度 不能为空");
            }
            if (movieObj.height == null || typeof(movieObj.height) == "undefined" || movieObj.height == "") {
                err.push("视频高度 不能为空");
            }
            if (movieObj.audioformat == null || typeof(movieObj.audioformat) == "undefined" || movieObj.audioformat == "") {
                err.push("音频格式 不能为空");
            }
            if (err.length > 0) {
                movieObj.err = err;
            }
            return movieObj;
        },
        completeMovie: function (movieObj) {
            console.log("send file_name :" + conf.filepathPrefix + movieObj.filepath);
            return new Promise(function (resolve, reject) {
                var req = unirest.post(encodeURI(conf.mediaInfoUrl))
                    .pool(conf.poolOption)
                    .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                    .send({file_name: conf.filepathPrefix + movieObj.filepath})
                    .end(function (res) {
                        if (res.status != 200) {
                            reject({Error: "get page " + conf.mediaInfoUrl + conf.filepathPrefix + movieObj.filepath + " Error " + res.statusCode + " at " + new Date()});
                        } else {
                            if (res.body.status != 0) {
                                reject({Error: res.body.detail + " at " + new Date()})
                            } else {
                                if (res.body.file_info) {
                                    var xml = res.body.file_info;
                                    parseString(xml, {
                                        explicitArray: false,
                                        normalizeTags: true,
                                        ignoreAttrs: false,
                                        trim: true,
                                        mergeAttrs: true
                                    }, function (err, result) {
                                        if (result.mediainfo) {
                                            if (result.mediainfo.file) {
                                                if (result.mediainfo.file.track) {
                                                    var movie = {};
                                                    var track = result.mediainfo.file.track;
                                                    var flag = true;
                                                    if (track instanceof Array) {
                                                        console.log("track is array at " + new Date());
                                                        for (var item in track) {
                                                            if (track[item].type) {
                                                                if (track[item].type === "General") {
                                                                    movie = ObjectTranform.prototype.treatGeneral(track[item], movie, movieObj.type)
                                                                } else if (track[item].type === "Video") {
                                                                    movie = ObjectTranform.prototype.treatVideo(track[item], movie, movieObj.type)
                                                                } else if (track[item].type === "Audio") {
                                                                    movie = ObjectTranform.prototype.treatAudio(track[item], movie, movieObj.type);
                                                                }

                                                            } else {
                                                                flag = false;
                                                                break;
                                                            }

                                                        }
                                                    } else {
                                                        console.log("track is object at " + new Date())
                                                        if (track.type === "General") {
                                                            movie = ObjectTranform.prototype.treatGeneral(track, movie, movieObj.type)
                                                        } else if (track.type === "Video") {
                                                            movie = ObjectTranform.prototype.treatVideo(track, movie, movieObj.type)
                                                        } else if (track.type === "Audio") {
                                                            movie = ObjectTranform.prototype.treatAudio(track, movie, movieObj.type);
                                                        } else {
                                                            flag = false;
                                                        }
                                                    }
                                                    if (flag == true) {
                                                        if (movieObj.width) {
                                                            movie.width = movieObj.width;
                                                        }
                                                        if (movieObj.height) {
                                                            movie.height = movieObj.height;
                                                        }
                                                        if (movieObj.videoformat) {
                                                            movie.videoformat = movieObj.videoformat;
                                                        }
                                                        if (movieObj.framerate) {
                                                            movie.framerate = movieObj.framerate;
                                                        }
                                                        if (movieObj.audioformat) {
                                                            movie.audioformat = movieObj.audioformat;
                                                        }
                                                        if (movieObj.audiobitrate) {
                                                            movie.audiobitrate = movieObj.audiobitrate;
                                                        }
                                                        if (movieObj.bitratemode) {
                                                            movie.bitratemode = movieObj.bitratemode;
                                                        }
                                                        if (movieObj.fileformat) {
                                                            movie.fileformat = movieObj.fileformat;
                                                        }
                                                        if (movieObj.scantype) {
                                                            movie.scantype = movieObj.scantype;
                                                        }
                                                        movie.updatetime = new Date();
                                                        resolve(movie);

                                                    } else {
                                                        reject({Error: movieObj.filepath + "  file track type is null at " + new Date()})
                                                    }

                                                } else {
                                                    reject({Error: movieObj.filepath + " track is null"});
                                                }
                                            } else {
                                                reject({Error: movieObj.filepath + " file is null"})
                                            }
                                        }
                                        else {
                                            reject({Error: movieObj.filepath + " mediainfo is null"});
                                        }

                                    });
                                }
                                else {
                                    reject({Error: movieObj.filepath + ": file_info is null at " + new Date})
                                }

                            }
                        }

                    });
            })
        },
        transCpsSeries: function (cpsSeriesObj) {
            var seriesObj = {};
            //一二级分类
            if (cpsSeriesObj.filterinfo.category && cpsSeriesObj.filterinfo.category.length > 0) {
                var programType = null;
                for (var i = 0; i < cpsSeriesObj.filterinfo.category.length; i++) {
                    var contentType = enums.ContentType;
                    for (var key in contentType) {
                        if (contentType[key].cname == cpsSeriesObj.filterinfo.category[i]) {
                            programType = cpsSeriesObj.filterinfo.category[i];
                            cpsSeriesObj.filterinfo.category.splice(i, 1);
                            break;
                        }
                    }
                    if (programType) {
                        break;
                    }
                }
                if (!programType) {
                    return null;
                } else {
                    seriesObj.programtype = programType//一级分类
                    seriesObj.programtype2 = cpsSeriesObj.filterinfo.category.join("|");//二级分类
                }
            }
            seriesObj.cpcontentid = enums.DataSources[3] + cpsSeriesObj.vid;//cpcontentid(必须)
            seriesObj.name = cpsSeriesObj.vname;//节目集名称（必须）
            seriesObj.volumncount = cpsSeriesObj.series;//总集数（必须）
            seriesObj.currentnum = cpsSeriesObj.updatenum;//更新至集数（必须）
            if (cpsSeriesObj.pinyin) {
                seriesObj.pinyin = cpsSeriesObj.pinyin;//拼音
            }
            if (cpsSeriesObj.suoxie) {
                seriesObj.pinyinsuoxie = cpsSeriesObj.suoxie;//拼音缩写
            }
            seriesObj.cpcode = cpsSeriesObj.cpid;//暂时将项目id定为cpcode
            seriesObj.cpname = "CPS";//暂定CPS为cpname
            if (cpsSeriesObj.valias) {
                seriesObj.originalname = cpsSeriesObj.valias;//暂定别名为原名
            }
            if (cpsSeriesObj.actorinfo.director && cpsSeriesObj.actorinfo.director.length > 0) {
                //导演遍历
                var directors = cpsSeriesObj.actorinfo.director.map(function (item, index, input) {
                    return item.fullname;//导演姓名
                })
                seriesObj.actordisplay = directors.join("|");//导演
            }
            if (cpsSeriesObj.actorinfo.star && cpsSeriesObj.actorinfo.star.length > 0) {
                var stars = cpsSeriesObj.actorinfo.star.map(function (item, index, input) {
                    return item.fullname;
                })
                seriesObj.writerdisplay = stars.join("|");//主演
            }
            if (cpsSeriesObj.actorinfo.actor && cpsSeriesObj.actorinfo.actor.length > 0) {
                //主演遍历
                var actors = cpsSeriesObj.actorinfo.actor.map(function (item, index, input) {
                    return item.fullname;
                })
                if (!seriesObj.writerdisplay) {
                    seriesObj.writerdisplay = actors.join("|");//主演
                }
                seriesObj.performer = actors.join("|");//表演者
            }
            if (cpsSeriesObj.actorinfo.screenwriter && cpsSeriesObj.actorinfo.screenwriter.length > 0) {
                //编剧遍历
                var screenwriter = cpsSeriesObj.actorinfo.screenwriter.map(function (item, index, input) {
                    return item.fullname;
                });
                seriesObj.screenwriter = screenwriter.join("|");
            }
            if (cpsSeriesObj.actorinfo.showhost && cpsSeriesObj.actorinfo.showhost.length > 0) {
                //主持人遍历
                var showhost = cpsSeriesObj.actorinfo.showhost.map(function (item, index, input) {
                    return item.fullname;
                });
                seriesObj.compere = showhost.join("|");
            }
            if (cpsSeriesObj.actorinfo.showguest && cpsSeriesObj.actorinfo.showguest.length > 0) {
                //嘉宾遍历
                var showguest = cpsSeriesObj.actorinfo.showguest.map(function (item, index, input) {
                    return item.fullname;
                });
                seriesObj.compere = cpsSeriesObj.actorinfo.showguest.join("|");
            }
            if (cpsSeriesObj.actorinfo.dubbing && cpsSeriesObj.actorinfo.dubbing.length > 0) {
                //配音遍历
                var dubbing = cpsSeriesObj.actorinfo.dubbing.map(function (item, index, input) {
                    return item.fullname;
                })
                seriesObj.dub = dubbing.join("|");
            }
            if (cpsSeriesObj.actorinfo.presenter && cpsSeriesObj.actorinfo.presenter.length > 0) {
                //主讲遍历
                var presenter = cpsSeriesObj.actorinfo.presenter.map(function (item, index, input) {
                    return item.fullname;
                })
                seriesObj.mainspeak = presenter.join("|");
            }
            if (cpsSeriesObj.actorinfo.singer && cpsSeriesObj.actorinfo.singer.length > 0) {
                //歌手遍历
                var singer = cpsSeriesObj.actorinfo.singer.map(function (item, index, input) {
                    return item.fullname;
                });
                seriesObj.singer = singer.join("|");
            }
            if (cpsSeriesObj.actorinfo.lyricist && cpsSeriesObj.actorinfo.lyricist.length > 0) {
                //作词遍历
                var lyricist = cpsSeriesObj.actorinfo.lyricist.map(function (item, index, input) {
                    return item.fullname;
                })
                seriesObj.writeword = lyricist.join("|");
            }
            if (cpsSeriesObj.actorinfo.composer && cpsSeriesObj.actorinfo.composer.length > 0) {
                //作曲遍历
                var composer = cpsSeriesObj.actorinfo.composer.map(function (item, index, input) {
                    return item.fullname;
                });
                seriesObj.writemusic = cpsSeriesObj.actorinfo.composer.join("|");
            }
            if (cpsSeriesObj.actorinfo.musicstyle && cpsSeriesObj.actorinfo.musicstyle.length > 0) {
                //风格遍历
                var musicstyle = cpsSeriesObj.actorinfo.musicstyle.map(function (item, index, input) {
                    return item.fullname;
                })
                seriesObj.musicstyle = musicstyle.join("|");
            }
            if (cpsSeriesObj.showdate) {
                seriesObj.orgairdate = cpsSeriesObj.showdate;//首映日期
            }
            if (cpsSeriesObj.storyplot) {
                seriesObj.description = cpsSeriesObj.storyplot;//节目集描述
            }
            seriesObj.contentprovider = cpsSeriesObj.cpid;//暂时将项目id定为cpcode
            if (cpsSeriesObj.taginfo) {
                seriesObj.tags = cpsSeriesObj.taginfo.join("|");//标签
            }
            if (cpsSeriesObj.videopoint) {
                seriesObj.viewpoint = cpsSeriesObj.videopoint;//看点
            }
            if (cpsSeriesObj.award) {
                seriesObj.awards = cpsSeriesObj.award;//所含奖项
            }
            if (cpsSeriesObj.filterinfo.area) {
                seriesObj.originalcountry = cpsSeriesObj.filterinfo.area.join("|");//地区
            }
            if (cpsSeriesObj.filterinfo.language) {
                seriesObj.language = cpsSeriesObj.filterinfo.language.join("|");//语言
            }
            if (cpsSeriesObj.issueyear) {
                seriesObj.releaseyear = cpsSeriesObj.issueyear;//发行年份
            }
            if (cpsSeriesObj.duration) {
                seriesObj.duration = cpsSeriesObj.duration;//时长
            }
            if (cpsSeriesObj.score && cpsSeriesObj.score != "") {
                seriesObj.score = cpsSeriesObj.score;//评分
            }
            if (cpsSeriesObj.studio) {
                seriesObj.distributor = cpsSeriesObj.studio;//发行公司
            }
            if (cpsSeriesObj.maxclarity) {
                seriesObj.definition = cpsSeriesObj.maxclarity//清晰度
            }
            //节目集图片
            if (cpsSeriesObj.refmediaimage) {
                var pictures = cpsSeriesObj.refmediaimage.map(function (item, index, input) {
                    return conf.cps_picture_server_prefix + item.fid + "-" + item.width + "-" + item.height + tools.getSuffixName(item.filename);
                });
                for (var i = 0; i < pictures.length; i++) {
                    seriesObj["pictureurl" + (i + 1)] = pictures[i];
                }
            }
            return seriesObj;
        },
        transCpsProgam: function (cpsProgramObj, seriesObj) {
            var programObj = {};
            programObj.cpcontentid = seriesObj.cpcontentid + "_" + cpsProgramObj.sid;//cpcontentid（必须）
            programObj.name = cpsProgramObj.sname;//节目名称（必须）
            programObj.seriesname = seriesObj.name;//节目集名称
            programObj.volumncount = cpsProgramObj.sid;//当前集数（必须）
            programObj.cpcode = seriesObj.cpcode;//cpcode
            programObj.cpname = seriesObj.cpname;//cpname
            programObj.actordisplay = seriesObj.actordisplay;//导演
            programObj.writerdisplay = seriesObj.writerdisplay;//主演
            programObj.orgairdate = seriesObj.orgairdate;//上映日期
            if (cpsProgramObj.storyplot) {
                programObj.description = cpsProgramObj.storyplot;//节目简介
            }
            programObj.contentprovider = seriesObj.contentprovider;//cpcode
            programObj.tags = seriesObj.tags;//标签
            if (cpsProgramObj.videopoint) {
                programObj.viewpoint = cpsProgramObj.videopoint;//本集看点
            }
            programObj.originalcountry = seriesObj.originalcountry;//国家地区
            programObj.language = seriesObj.language;//语言
            programObj.releaseyear = seriesObj.releaseyear;//发行年份
            if (cpsProgramObj.duration) {
                programObj.duration = cpsProgramObj.duration;//时长
            }
            programObj.programtype = seriesObj.programtype;//一级分类
            programObj.programtype2 = seriesObj.programtype2;//二级分类
            programObj.definition = seriesObj.definition;//清晰度
            programObj.performer = seriesObj.performer;//表演者
            programObj.distributor = seriesObj.distributor;//发行公司
            programObj.screenwriter = seriesObj.screenwriter;//编剧
            if (cpsProgramObj.period) {
                programObj.stage = cpsProgramObj.period;//期号
            }
            if (cpsProgramObj.salias) {
                programObj.originalname = cpsProgramObj.salias;//暂定别名为原名
            }
            programObj.showid = seriesObj.cpcontentid;//节目集id
            return programObj;
        },
        transCpsMovie: function (cpsMovieObj, progamObj) {
            var movieObj = {};
            movieObj.name = progamObj.name;//介质名称*
            movieObj.cpcontentid = progamObj.cpcontentid;//cpcontentid
            movieObj.fileid = cpsMovieObj.srcid;//介质id*
            movieObj.cpcode = progamObj.cpcode;//cpcode
            movieObj.cpname = progamObj.cpname;//cpname
            if (cpsMovieObj.type != null) {
                movieObj.type = 0;//介质类型
                // movieObj.playurl = cpsMovieObj.url;//播放地址*
            }
            // if (cpsMovieObj._source.from) {
            //     movieObj.source = cpsMovieObj._source.from;//介质来源
            // }
            // if (cpsMovieObj._source.id) {
            //     movieObj.sourceid = cpsMovieObj._source.id;//存储源ID
            // }
            movieObj.showid = progamObj.showid;//节目集id
            return movieObj;
        },
        //过滤series字段
        filterSeries: function (series) {
            if (series.checkstatus != null) {
                delete series["checkstatus"];
            }
            if (series.checktime != null) {
                delete series["checktime"];
            }
            if (series.checkcontent != null) {
                delete series["checkcontent"];
            }
            if (series.checkdescription != null) {
                delete series["checkdescription"];
            }
            if (series.cdnstatus != null) {
                delete  series["cdnstatus"];
            }
            if (series.cdndesc != null) {
                delete  series["cdndesc"];
            }
            if (series.createtime != null) {
                delete series["createtime"];
            }
            if (series.updatetime != null) {
                delete  series["updatetime"];
            }
            if (series.ismissing != null) {
                delete series["ismissing"];
            }
            return series;
        },
        filterUnifiedseries: function (series) {
            if (series.checkstatus != null) {
                delete series["checkstatus"];
            }
            if (series.checktime != null) {
                delete series["checktime"];
            }
            if (series.checkcontent != null) {
                delete series["checkcontent"];
            }
            if (series.checkdescription != null) {
                delete series["checkdescription"];
            }
            if (series.cdnstatus != null) {
                delete  series["cdnstatus"];
            }
            if (series.cdndesc != null) {
                delete  series["cdndesc"];
            }
            if (series.createtime != null) {
                delete series["createtime"];
            }
            if (series.updatetime != null) {
                delete  series["updatetime"];
            }
            if (series.ismissing != null) {
                delete series["ismissing"];
            }
            if (series.cpcode != null) {
                delete series["cpcode"];
            }
            if (series.cpname != null) {
                delete series["cpname"]
            }
            if (series.actordisplay != null) {
                series.director = series.actordisplay;
                delete series["actordisplay"];
            }
            if (series.writerdisplay != null) {
                series.kpeople = series.writerdisplay;
                delete series["writerdisplay"];
            }
            if (series.screenwriter != null) {
                series.scriptwriter = series.scriptwriter;
                delete series["scriptwriter"];
            }
            return series;
        },
        //过滤program字段
        filterProgram: function (program) {
            if (program.checkstatus != null) {
                delete program["checkstatus"];
            }
            if (program.checktime != null) {
                delete program["checktime"];
            }
            if (program.checkcontent != null) {
                delete program["checkcontent"];
            }
            if (program.checkdescription != null) {
                delete program["checkdescription"];
            }
            if (program.cdnstatus != null) {
                delete  program["cdnstatus"];
            }
            if (program.cdndesc != null) {
                delete  program["cdndesc"];
            }
            if (program.createtime != null) {
                delete program["createtime"];
            }
            if (program.updatetime != null) {
                delete  program["updatetime"];
            }
            if (program.sourcetype != null) {
                delete program["sourcetype"];
            }
            if (program.seriesflag != null) {
                delete program["seriesflag"];
            }
            if (program.copyrighttype != null) {
                delete program["copyrighttype"];
            }
            if (program.videotype != null) {
                delete program["videotype"];
            }
            if (program.showid != null) {
                delete  program["showid"];
            }
            if (program.cpcontentid != null) {
                delete  program["cpcontentid"];
            }
            if (program.duration != null) {
                program.duration = program.duration.toString();
                console.log("duration :" + program.duration);
            }
            if (program.stage != null) {
                program.stage = program.stage.toString();
                console.log("stage :" + program.stage);
            }
            return program;
        },
        //过滤movie字段
        filterMovie: function (movie) {
            if (movie.showid != null) {
                delete movie["showid"];
            }
            if (movie.checkstatus != null) {
                delete movie["checkstatus"]
            }
            if (movie.checkcontent != null) {
                delete movie["checkcontent"];
            }
            if (movie.source != null) {
                delete movie["source"];
            }
            if (movie.sourceid != null) {
                delete movie["sourceid"];
            }
            if (movie.isunified != null) {
                delete movie["isunified"];
            }
            if (movie.priority != null) {
                delete movie["priority"];
            }
            if (movie.cpcontentid != null) {
                delete movie.cpcontentid;
            }
            if (movie.cdnstatus != null) {
                delete movie["cdnstatus"];
            }
            if (movie.cdndesc != null) {
                delete movie["cdndesc"];
            }
            if (movie.domaincode != null) {
                delete movie["domaincode"];
            }
            if (movie.domainname != null) {
                delete movie["domainname"];
            }
            if (movie.offlinereason != null) {
                delete movie["offlinereason"];
            }
            if (movie.checktime != null) {
                delete movie["checktime"];
            }
            if (movie.createtime != null) {
                delete movie["createtime"];
            }
            if (movie.updatetime != null) {
                delete movie["updatetime"];
            }
            if (movie.transcodeid != null) {
                delete movie["transcodeid"];
            }
            if (movie.iscompleted != null) {
                delete movie["iscompleted"];
            }
            if (movie.completereason != null) {
                delete movie["completereason"];
            }
            if (movie.fileid != null) {
                delete movie["fileid"];
            }
            return movie;
        },
        transImportMedia: function (importMediaArr) {
            var importMediaObj = {};
            var err = [];
            if (importMediaArr instanceof Array && importMediaArr.length == 37) {
                //节目集编号
                if (importMediaArr[0].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.seriescpcontentid = importMediaArr[0].replace(/(^\s*)|(\s*$)/g, "");
                }
                //节目编号
                if (importMediaArr[1].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.programcpcontentid = importMediaArr[1].replace(/(^\s*)|(\s*$)/g, "");
                }
                //节目集名称
                if (importMediaArr[2].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.seriesname = importMediaArr[2].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("节目集名称");
                }
                //节目名称
                if (importMediaArr[3].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.programname = importMediaArr[3].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("节目名称");
                }
                //一级分类
                if (importMediaArr[4].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.programtype = importMediaArr[4].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("一级分类");
                }
                //二级分类
                if (importMediaArr[5].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.programtype2 = importMediaArr[5].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("二级分类");
                }
                //地区
                if (importMediaArr[6].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.originalcountry = importMediaArr[6].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("地区");
                }
                //语言
                if (importMediaArr[7].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.language = importMediaArr[7].replace(/(^\s*)|(\s*$)/g, "");
                }
                //年代
                if (importMediaArr[8].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.releaseyear = importMediaArr[8].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("年代");
                }
                //导演
                if (importMediaArr[9].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.actordisplay = importMediaArr[9].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("导演");
                }
                //主演
                if (importMediaArr[10].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.writerdisplay = importMediaArr[10].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("主演");
                }
                //时长
                if (importMediaArr[11].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.duration = importMediaArr[11].replace(/(^\s*)|(\s*$)/g, "");
                }
                //主持人
                if (importMediaArr[12].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.compere = importMediaArr[12].replace(/(^\s*)|(\s*$)/g, "");
                }
                //版权
                if (importMediaArr[13].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.hascopyright = importMediaArr[13].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("版权");
                }
                if (importMediaObj.hascopyright == "有") {
                    if (importMediaArr[14].replace(/(^\s*)|(\s*$)/g, "") != "") {
                        importMediaObj.crbegindate = importMediaArr[14].replace(/(^\s*)|(\s*$)/g, "");
                    } else {
                        err.push("版权起始日期");
                    }
                    if (importMediaArr[15].replace(/(^\s*)|(\s*$)/g, "") != "") {
                        importMediaObj.crenddate = importMediaArr[15].replace(/(^\s*)|(\s*$)/g, "");
                    } else {
                        err.push("版权结束时间");
                    }
                }
                //总集数
                if (importMediaArr[16].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.seriesvolumncount = importMediaArr[16].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("总集数");
                }
                //更新集数
                if (importMediaArr[17].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.updatedvolumncount = importMediaArr[17].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("更新集数")
                }
                //当前集数
                if (importMediaArr[18].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.programvolumncount = importMediaArr[18].replace(/(^\s*)|(\s*$)/g, "")
                } else {
                    err.push("当前集数")
                }
                //主海报
                if (importMediaArr[19].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.pictureurl1 = importMediaArr[19].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("主海报")
                }
                //副海报1
                if (importMediaArr[20].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.pictureurl2 = importMediaArr[20].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("副海报1");
                }
                //副海报2
                if (importMediaArr[21].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.pictureurl3 = importMediaArr[21].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("副海报2");
                }
                //副海报3
                if (importMediaArr[22].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.pictureurl4 = importMediaArr[22].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("副海报3")
                }
                //节目集描述
                if (importMediaArr[23].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.seriesdescription = importMediaArr[23].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("节目集描述");
                }
                //节目描述
                if (importMediaArr[24].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.programdescription = importMediaArr[24].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("节目描述");
                }
                //源介质
                if (importMediaArr[25].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.primarymovieaddr = importMediaArr[25].replace(/(^\s*)|(\s*$)/g, "");
                }
                //成品介质
                if (importMediaArr[26].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.endproductmovieaddr = importMediaArr[26].replace(/(^\s*)|(\s*$)/g, "")
                }
                if (importMediaObj.endproductmovieaddr || importMediaObj.primarymovieaddr) {

                } else {
                    err.push("原介质或者成品介质");
                }
                //入库名称
                if (importMediaArr[27].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.movefilename = importMediaArr[27].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("入库名称");
                }
                //分辨率
                if (importMediaArr[28].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.resolution = importMediaArr[28].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("分辨率")
                }
                //编码格式
                if (importMediaArr[29].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.videoformat = importMediaArr[29].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("编码格式")
                }
                //帧率
                if (importMediaArr[30].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.frame = importMediaArr[30].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("帧率");
                }
                //音频格式
                if (importMediaArr[31].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.audioformat = importMediaArr[31].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("音频格式")
                }
                //音频码率
                if (importMediaArr[32].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.audiobitrate = importMediaArr[32].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("音频码率")
                }
                //混合码率模式
                if (importMediaArr[33].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.bitratemode = importMediaArr[33].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("混合码率模式")
                }
                //导入规格
                if (importMediaArr[34].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.movieformat = importMediaArr[34].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("导入规格")
                }
                //文件格式
                if (importMediaArr[35].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.fileformat = importMediaArr[35].replace(/(^\s*)|(\s*$)/g, "");
                } else {
                    err.push("文件格式")
                }
                //扫描方式
                if (importMediaArr[36].replace(/(^\s*)|(\s*$)/g, "") != "") {
                    importMediaObj.scantype = importMediaArr[36].replace(/(^\s*)|(\s*$)/g, "")
                } else {
                    err.push("扫描方式")
                }

            } else {
                err.push("不是数组或者数据字段不规范");
            }
            if (err.length <= 0) {
                return importMediaObj;
            } else {
                importMediaObj.err = err;
                return importMediaObj;
            }
        },
        checkAPECNSeries: function (collection) {
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
        },
        checkAPECNProgram: function (singleprogram) {
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
        },
        checkAPECNMovie: function (media) {
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
        },
        treatAPECNSeries: function (collection) {
            var series = {};
            series.cpcontentid = conf.APECN_prefix_cpcode + collection.collectionid;//节目集cpcontentid
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
            var originalcountry = series.originalcountry.split("|");
            for (var i = 0; i < originalcountry.length; i++) {
                for (var j = 0; j < enums.Regions.length; j++) {
                    if (originalcountry[i] == enums.Regions[j].name) {
                        originalcountry[i] = enums.Regions[j].value;
                    }
                }
            }
            series.originalcountry = originalcountry.join(constants.SEP);
            series.language = collection.language;//语言
            series.releaseyear = collection.releasedate;//发行年份
            series.duration = collection.totallength;//时长
            series.programtype = collection.firstclass;//一级分类
            for (var i in enums.ProgramTypeMapping) {
                if (enums.ProgramTypeMapping[i].name == series.programtype) {
                    series.programtype = enums.ProgramTypeMapping[i].value;
                }
            }
            series.programType2 = collection.secondclass;//二级分类
            series.definition = collection.clarity;//清晰度
            series.compere = collection.compere;
            series.guest = collection.guest;//主持人
            series.pictureurl1 = conf.APECN_ftp_prefix + collection.ppbfilepath;//竖版海报（大）
            series.pictureurl2 = conf.APECN_ftp_prefix + collection.ppsfilepath;//竖版海报（小）
            series.pictureurl3 = conf.APECN_ftp_prefix + collection.bpbfilepath;//横板海报（大）
            series.pictureurl4 = conf.APECN_ftp_prefix + collection.bpsfilepath;//横板海报（小）
            series.pictureurl5 = conf.APECN_ftp_prefix + collection.rubyrosefilepath;//海报（大）
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
        },
        treatAPECNProgram: function (singleprogram) {
            var program = {};
            program.cpcontentid = conf.APECN_prefix_cpcode + singleprogram.singleid;//cpcontentid
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
            program.showid = conf.APECN_prefix_cpcode + singleprogram.collectionid;//节目集cpcontentid
            program.description = singleprogram.singleabstract;//节目描述
            program.pictureurl1 = conf.APECN_ftp_prefix + singleprogram.ppbfilepath;//竖版海报（大）
            program.pictureurl2 = conf.APECN_ftp_prefix + singleprogram.ppsfilepath;//竖版海报（小）
            program.pictureurl6 = conf.APECN_ftp_prefix + singleprogram.bpbfilepath;//横版海报（大）
            program.pictureurl7 = conf.APECN_ftp_prefix + singleprogram.bpsfilepath;//横板海报（小）
            program.cpcode = enums.CPInfo.APECN.value;//cpcode
            program.cpname = enums.CPInfo.APECN.name;//cpname
            program.contentprovider = enums.CPInfo.APECN.value;//cpcode
            return program;
        },
        treatAPECNMovie: function (program, media) {
            var movie = {};
            //介质类型
            if (Number(media.type) == 8) {
                movie.type = enums.MovieType.PRIMARY.value;
            } else if (Number(media.type) == 2) {
                movie.type = enums.MovieType.END_PRODUCT.value;
            }
            movie.cpcontentid = conf.APECN_prefix_cpcode + media.singleid;//cpcontentid
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
            movie.playurl = conf.APECN_ftp_prefix + media.videofilepath;//播放地址

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
    }
    return _objectTransform;

})();
module.exports = ObjectTranform;

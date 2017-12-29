/**
 * Created by lichenchen on 2017/4/6.
 */
var Enums = (function () {
    function _enums() {
    };
    _enums.prototype = {
        //媒资类型
        MediaType: {
            SERIES: {name: "Series", value: 1},
            PROGRAM: {name: "Program", value: 2},
            MOVIE: {name: "Movie", value: 3},
            PICTURE: {name: "Picture", value: 4},
            CATEGORY: {name: "Category", value: 5},
            MAPPING: {name: "Mapping", value: 6}
        },
        //操作类型
        ActionType: {
            REGIST: {name: "REGIST", value: 1},
            UPDATE: {name: "UPDATE", value: 2},
            DELETE: {name: "DELETE", value: 3}
        },
        //清晰度
        Definition: {
            SD: {name: "SD", value: 1},
            HD: {name: "HD", value: 2},
            HD2: {name: "HD2", value: 3},
            HD3: {name: "HD4", value: 4},
            HIGHEST: {name: "HIGHEST", value: 4}

        },
        //工单状态
        InjectOrderStatus: {
            INIT: {name: "初始化", value: 0},
            EXECUTING: {name: "执行中", value: 1},
            PARSING_SUCCESS: {name: "解析成功", value: 10},
            PARSING_FAIL: {name: "解析失败", value: 11},
            DOWNLOAD_FAIL: {name: "下载失败", value: 31}
        },
        //审核状态
        CheckStatus: {
            NONE: {name: "待上线", value: 0},
            ONLINE: {name: "已上线", value: 1},
            OFFLINE: {name: "已下线", value: 2},
            ONLINENEEDEDIT: {name: "上线需编辑", value: 3}
        },
        //cp信息
        CPInfo: {
            YOUKU: {name: "优酷（合作伙伴）", value: "YOUKU"},
            FOURKGARDEN: {name: "4k花园", value: "4KGARDEN"},
            HQHY: {name: "环球合一", value: "HQHY"},
            APECN: {name: "亚太", value: "APECN"}
        },
        //是否缺集
        MediaIsMessing: {
            TRUE: {name: "缺集", value: 0},
            FALSE: {name: "不缺集", value: 1}
        },
        //版权信息
        CopyrightStatus: {
            AUCHORIZED: {name: "auchorized", value: "已授权"},
            PUBLIC: {name: "public", value: "公共版权"},
            FALSEAUTH: {name: "falseauth", value: "伪授权"},
            EXPIRED: {name: "expired", value: "版权下线"},
            UNAUTHORIZED: {name: "unauthorized", value: "无版权"}
        },
        //video类型
        VideoType: {
            POSITIVE: {name: "正片", value: 0},
            TRAILER: {name: "预告片", value: 1},
            FOOTAGE: {name: "花絮", value: 2},
            MV: {name: "mv", value: 3},
            INFORMATION: {name: "资讯", value: 4},
            PREMIERE: {name: "首映礼", value: 5},
            EXCLUSIVE: {name: "独家", value: 6},
            OTHER: {name: "其他", value: 7}

        },
        //转码状态
        TranscodeStatus: {
            WAIT: {name: "待转码", value: 0},
            TRANSCODING: {name: "正在转码", value: 10},
            TRANSCODE_SUCCESS: {name: "转码成功", value: 20},
            TRANSCODE_FAIL: {name: "转码失败", value: 21}
        },
        //媒资信息补全
        MediaInfoCompleted: {
            NONE: {name: "未补全", value: 0},
            COMPLETED_SUCCESS: {name: "补全成功", value: 1},
            COMPLETED_FAILED: {name: "补全失败", value: 2}
        },
        //介质下载状态
        MovieDownloadStatus: {
            DOWNLOAD_WAITING: {name: "待下载", value: 0},
            DOWNLOADING: {name: "下载中", value: 1},
            DOWNLOAD_SUCCESS: {name: "下载成功", value: 2},
            DOWNLOAD_FAILED: {name: "下载失败", value: -1},
            DOWNLOAD_ERROR: {name: "下载出错", value: 3}
        },
        //介质类型
        MovieType: {
            PRIMARY: {name: "源介质", value: 0},
            END_PRODUCT: {name: "成品介质", value: 1}
        },
        //各种编码前缀
        Code: {
            SERIES: "1001",
            PROGRAM: "1002",
            MOVIE: "1003",
            PICTURE: "0004",
            CATEGORY: "0005",
            FILEID: "0006",
            IMPORT_SERIES: "0007",
            IMPORT_PROGRAM: "0008",
            RECOMMEND: "0017",
            CP: "0032",
            DOMAIN: "0042",
            USERINFO: "0301",
            PRODUCT: "0097",
            Package: "0202",
            DOMAIN_INJECTION: "0215"
        },
        //系统编码前缀
        Project: {
            OMS: {name: "OMS", value: "110"},
            BMS: {name: "BMS", value: "120"},
            UMS: {name: "UMS", value: "130"},
            TMS: {name: "TMS", value: "140"},
            VOD: {name: "VOD", value: "210"},
            LIVE: {name: "LIVE", value: "220"},
            CMS: {name: "CMS", value: "230"}
        },
        //下载类型
        DownloadSourceType: {
            JOB: {name: "自动下载", value: 0},
            MANUAL: {name: "手工下载", value: 1}
        },
        //聚合状态
        UnifiedStatus: {
            SUCCESS_UNIFIED: {name: "聚合成功", value: 1},
            WAITING_UNIFIED: {name: "待聚合", value: 0},
            FAILED_UNIFIED: {name: "数据流向操作出错，聚合失败", value: 2},
            SENSITIVE_UNIFIED: {name: "包含敏感词,聚合失败", value: 3},
            SENSITIVE_PROGRAM_UNIFIED: {name: "节目中包含敏感词，聚合成功", value: 1}

        },
        //数据来源
        DataSources: ["YOUKU_", "YOUKU_", "YOUKU_", "CPS_", "YOUKU_", "YOUKU_"],
        ProgramType: {
            GAME: {cname: "游戏", ename: "game", value: 99},
            TV: {cname: "电视剧", ename: "tv", value: 97},
            MOVIE: {cname: "电影", ename: "movie", value: 96},
            VARIETY: {cname: "综艺", ename: "variety", value: 85},
            ANIME: {cname: "动漫", ename: "anime", value: 100},
            CHILD: {cname: "少儿", ename: "child", value: 177},
            MUSIC: {cname: "音乐", ename: "music", value: 95},
            EDU: {cname: "教育", ename: "edu", value: 87},
            DOC: {cname: "纪录片", ename: "doc", value: 84},
            NEWS: {cname: "资讯", ename: "news", value: 91},
            ENT: {cname: "娱乐", ename: "ent", value: 86},
            SPORTS: {cname: "体育", ename: "sports", value: 98},
            AUTO: {cname: "汽车", ename: "auto", value: 104},
            TECH: {cname: "科技", ename: "tech", value: 105},
            LIFE: {cname: "生活", ename: "life", value: 103},
            BABY: {cname: "亲子", ename: "baby", value: 90},
            FUN: {cname: "搞笑", ename: "fun", value: 94},
            MICRO: {cname: "微电影", ename: "micro", value: 171},
            WANGJU: {cname: "网剧", ename: "wangju", value: 172},
            PAIKE: {cname: "拍客", ename: "paike", value: 174},
            CHUANGYI: {cname: "创意视频", ename: "chuangyi", value: 175},
            DV: {cname: "自拍", ename: "dv", value: 176},
            ADS: {cname: "广告", ename: "ads", value: 102},
            FASHION: {cname: "时尚", ename: "fashion", value: 89},
            TRIP: {cname: "旅游", ename: "trip", value: 88},
            VR: {cname: "VR", ename: "vr", value: "vr"}
        },
        ContentType: {
            TV: {cname: "电视剧", ename: "tv", value: 97},
            MOVIE: {cname: "电影", ename: "movie", value: 96},
            VARIETY: {cname: "综艺", ename: "variety", value: 85},
            ANIME: {cname: "动漫", ename: "anime", value: 100},
            DOC: {cname: "纪录片", ename: "doc", value: 84},
            EDU: {cname: "教育", ename: "edu", value: 87}
        },
        CPSType: {
            1: "ts",
            2: "m3u8",
            20: "flv",
            30: "mp4"
        },
        DefinitionCPS: {
            1: "高清",
            2: "流畅",
            4: "超清"
        },
        RabbitMqMedia: {
            "series.insert": {contentType: 1, actionType: 1},
            "series.update": {contentType: 1, actionType: 2},
            "series.delete": {contentType: 1, actionType: 3},
            "series.offline": {contentType: 1, actionType: 4},
            "series.online": {contentType: 1, actionType: 5},
            "program.insert": {contentType: 2, actionType: 1},
            "program.update": {contentType: 2, actionType: 2},
            "program.delete": {contentType: 2, actionType: 3},
            "program.offline": {contentType: 2, actionType: 4},
            "program.online": {contentType: 2, actionType: 5},
            "movie.insert": {contentType: 3, actioinType: 1},
            "movie.udpate": {contentType: 3, actionType: 2},
            "movie.delete": {contentType: 3, actioinType: 3},
            "movie.offline": {contentType: 3, actionType: 4},
            "movie.online": {contentType: 3, actionType: 5}
        },
        Regions: [
            {name: "大陆", value: "中国大陆"},
            {name: "中国", value: "中国大陆"},
            {name: "中国内地", value: "中国大陆"},
            {name: "内地", value: "中国大陆"},
            {name: "China", value: "中国大陆"},
            {name: "中国大陆", value: "中国大陆"},
            {name: "中国香港", value: "中国香港"},
            {name: "香港", value: "中国香港"},
            {name: "Hong Kong", value: "中国香港"},
            {name: "港台", value: "中国台湾"},
            {name: "中华台北", value: "中国台湾"},
            {name: "中国台湾", value: "中国台湾"},
            {name: "美国", value: "美国"},
            {name: "USA", value: "美国"}

        ],
        ProgramTypeMapping: [
            {name: "剧集", value: "电视剧"},
            {name: "影视", value: "电视剧"},
            {name: "国产电影", value: "电影"},
            {name: "国语电影", value: "电影"},
            {name: "华语电影", value: "电影"},
            {name: "网络大电影", value: "电影"},
            {name: "国外电影", value: "电影"},
            {name: "动漫电影", value: "电影"},
            {name: "好莱坞电影", value: "电影"},
            {name: "动画片", value: "动漫"},
            {name: "动画", value: "动漫"},
            {name: "少儿教育", vlaue: "教育"},
            {name: "纪录专题", value: "纪录片"},
            {name: "纪实", value: "纪录片"},
            {name: "栏目", value: "健康"},
            {name: "养生", value: "健康"},
            {name: "健身", value: "健康"},
            {name: "广场舞", value: "健康"},
            {name: "演唱会", value: "健康"}
        ]
    }
    return _enums;
})();
module.exports = Enums;
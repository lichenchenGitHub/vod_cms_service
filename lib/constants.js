/**
 * Created by lichenchen on 2017/4/6.
 */
var Constants = (function () {
    function _constants() {
    };
    _constants.prototype = {
        YOUKU_SERIES_CDNSTATUS: 0,
        YOUKU_SERIES_PRICE: 0,
        SEP: "|",
        DIRECTOR: "director",
        STARRIN: "starring",
        PERFORMER: "performer",
        HOST: "host",
        VOICE: "voice",
        LYRICSWRITER: "lyricswriter",
        COMPOSER: "composer",
        SCREENWRITER: "screenwriter",
        TV_STATION: "tv_station",
        SINGER: "singer",
        TEACHER: "teacher",
        OFFLINETIME: "offlinetime",
        /**
         * 媒资导入数据长度限制
         */
        SERIES_NAME_MAX_LENGTH: 120,
        PROGRAM_NAME_MAX_LENGTH: 250,
        PROGRAM_TYPE_MAX_LENGTH: 60,
        ORIGINAL_COUNTRY_MAX_LENGTH: 60,
        RELEASE_YEAR_MAX_LENGTH: 60,
        ACTOR_DISPLAY_MAX_LENGTH: 500,
        WRITER_DISPLAY_MAX_LENGTH: 500,
        CR_DATE_MAX_LENGTH: 60,
        VOLUMN_COUNT_MAX_LENGTH: 11,//待拓展
        PICTUREURL_MAX_LENGTH: 250,
        DESCRIPTION_MAX_LENGTH: 1024,
        FILE_PATH_MAX_LENGTH: 1024,
        MOVE_FILE_NAME_MAX_LENGTH: 120,
        RESOLUTION_MAX_LENGTH: 32,
        OVERALL_BITRATE_MAX_LENGTH: 32,
        MOVIEFORMAT_MAX_LENGTH: 255,
        CODE_MAX_LENGTH: 64,
        LANGUAGE_MAX_LENGTH: 64,
        SCANTYPE_MAX_LENGTH: 32
    }
    return _constants;

})();
module.exports = Constants;

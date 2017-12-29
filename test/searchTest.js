/**
 * Created by lichenchen on 2017/10/17.
 */
var chai = require("chai");
var chaiAsPromise = require("chai-as-promised");
chai.use(chaiAsPromise);
var expect = chai.expect;
chai.should();
var conf = require("../conf/config.json");
var SearchDatabase = require("../lib/searchDatabase");
var searchDatabase = new SearchDatabase();
describe("search series metheods", function () {
    it("get series", function () {
        return searchDatabase.getSeries("YOUKU_518127c0b08d11e68fae").should.eventually.be.fulfilled;
    })
    it("get series by filters", function () {
        return searchDatabase.getSeriesByFilter({where: {cpcontentid: "YOUKU_518127c0b08d11e68fae"}}).should.eventually.be.fulfilled;
    })
})
describe("search program metheods", function () {
    it("get programs by series", function () {
        return searchDatabase.getProgramsBySeries("YOUKU_518127c0b08d11e68fae").should.eventually.be.fulfilled;
    })
    it("get program by filter",function(){
        return searchDatabase.getProgramByFilter({where:{cpcontentid:"YOUKU_XMzEzNDE2NjY1Ng=="}})
    })
})
describe("search movies metheods", function () {
    it("get movies by program", function () {
        return searchDatabase.getMovieByProgram({
            where: {
                cpcontentid: "YOUKU_XMjk0MDIzMzY4MA==",
                iscompleted: 1,
                isunified: {neq: 1}
            }
        }).should.eventually.be.fulfilled;
    })
    it("get movies by filter", function () {
        return searchDatabase.getMovieByFilter({where: {cpcode: "YOUKU"}}).should.eventually.be.fulfilled;
    })
})
describe("search sensitive words", function () {
    it("get sensitive by keywords", function () {
        return searchDatabase.getSensitivewords(["人生"]).should.eventually.be.fulfilled;
    })
    it("get sensitivewordsseries by filter", function () {
        return searchDatabase.getSensitivewordsseriesByFilter({where: {sensitivewords: "人生"}}).should.eventually.be.fulfilled;
    })
    it("get sensitivewordsprogram by filter", function () {
        return searchDatabase.getSensitivewordsprogramByFilter({where: {sensitivewords: "同志"}}).should.eventually.be.fulfilled;
    })
})
describe("search contentProvider", function () {
    it("get contentProvider", function () {
        return searchDatabase.getContentProvider("YOUKU").should.eventually.be.fulfilled;
    })
});
describe("search unifiedSeries", function () {
    it("match unifiedSeries", function () {
        return searchDatabase.matchUnifiedSeries({
            name: "反转人生",
            programtype: "电视剧",
            releaseyear: "2008"
        }).should.eventually.be.fulfilled;
    })
    it("get unifiedSeries", function () {
        return searchDatabase.getUnifiedseries("23010012017101620120100365").should.eventually.be.fulfilled;
    })
    it("get us by code", function () {
        return searchDatabase.getUsByCode("23010012017101620120100365").should.eventually.be.fulfilled;
    })
})
describe("search unifiedProgram", function () {
    it("get unified program by unifiedSeries code and volumn", function () {
        return searchDatabase.getUnifiedprogram("23010012017101119504600358", 40).should.eventually.be.fulfilled;
    })
    it("get unified program by code", function () {
        return searchDatabase.getUnifiedprogramByCode("23010022017101119561209891").should.eventually.be.fulfilled;
    })
    it("get unified program by cpcontentid", function () {
        return searchDatabase.getUnifiedProgramprogram("YOUKU_XMTQwODczMDI4OA==").should.eventually.be.fulfilled;
    })
    it("get up by code", function () {
        return searchDatabase.getUpByCode("23010022017101119561209891").should.eventually.be.fulfilled;
    })
});
describe("search unifiedMovie", function () {
    it("get um by code", function () {
        return searchDatabase.getUmByCode("23000032017090611330100021").should.eventually.be.fulfilled;
    })
})
describe("search unifiedseries series", function () {
    it("get unifiedseries series by filter", function () {
        return searchDatabase.getUnifiedseriesseriesByFilter({code: "23010022017101119561209891"}).should.eventually.be.fulfilled;
    })
})
describe("search unifieprogram program", function () {
    it("get unifiedprogram program", function () {
        return searchDatabase.getUnifiedProgramprogram("YOUKU_XMTQwODczMDI4OA==").should.eventually.be.fulfilled;
    })
    it("get unifiedprogram program", function () {
        return searchDatabase.getUnifiedProgramprogramByFilter({where: {cpcontentid: "YOUKU_XMTQwODczMDI4OA=="}}).should.eventually.be.fulfilled;
    })
})
describe("search importMediaDetail", function () {
    it("get importMediaDetail", function () {
        return searchDatabase.getImportDetail(4251).should.eventually.be.rejected;
    })
    it("get importMediaDetail count", function () {
        return searchDatabase.getImportMediaDetailCount({importmediaid: 305}).should.eventually.be.fulfilled;
    })
})
describe("search bitRate", function () {
    it("get bitRate", function () {
        return searchDatabase.getBitRate("800_600_AVC_16_Iterlace_AAC_70000_VBR_16M_MP4").should.eventually.be.fulfilled;
    })
})
describe("search programType", function () {
    it("get programType by filter", function () {
        return searchDatabase.getProgramTypeByFilter({where: {name: "人文"}}).should.eventually.be.fulfilled;
    })
})
describe("search package domain", function () {
    it("get package domain", function () {
        return searchDatabase.getPackageDomain("23000012017090611302300148").should.eventually.be.fulfilled;
    })
    it("get SPMCode list", function () {
        return searchDatabase.getSPMCodeList("23000012017090611302300148").should.eventually.be.fulfilled;
    })
    it("get domain", function () {
        return searchDatabase.getDomain({where: {name: "爱上测试"}}).should.eventually.be.fulfilled;
    })
    it("get SPMCode list by packageId", function () {
        return searchDatabase.getSPMCodeListByPackageId(61, "23000422016092615590600000").should.eventually.be.fulfilled;
    })
    it("send domainTask", function () {
        return searchDatabase.sendDomainTask("http://47.93.85.185:9191/fdn-api/api/v1/task", {
            domaincode: "23000422016081716370800001",
            fileurl: "http://10.3.1.7:7001/api/getDomainTaskInfo/23000422017012015065535929/1/23000012017090611302300148/23000022017090611302808147/23000032017090611330100021",
            platform: "cms",
            priority: 10,
            correlateID: "56689" + new Date().getTime().toString()
        }).should.eventually.be.fulfilled;
    })
})
describe("search ununifiedmedia by filter", function () {
    it("get ununifiedmedia by filter", function () {
        return searchDatabase.getUnunifiedmediaByFilter({where: {cpcontentid: "HANYA_23000072017092911443200134"}}).should.eventually.be.fulfilled;
    })
})
describe("search cps", function () {
    it("get cps medialist", function () {
        return searchDatabase.getCpsMediaList("token=a4512928fac4e81cb9272c7e570ea079&appId=" + conf.appId).should.eventually.be.fulfilled;
    })
    it("get cps media list series", function () {
        return searchDatabase.getCpsMediaListSeries("252113", "a4512928fac4e81cb9272c7e570ea079").should.eventually.be.fulfilled;
    })
    it("get cps mediaInfo",function(){
        return searchDatabase.getCpsMediaInfo("252113",9,"a4512928fac4e81cb9272c7e570ea079").should.eventually.be.fulfilled;
    })
})
describe("search SPMAlertRecord", function () {
    it("get SPMAlertRecord by query",function(){
        return searchDatabase.getSPMAlertRecordByFilter({
            where: {status: 0},
            limit: conf.rabbitMq.selectLimit,
            raw: true
        }).should.eventually.be.fulfilled;
    })
})
describe("search cpInfo",function(){
    it("get cp by query",function(){
        return searchDatabase.getCpInfo({where:{code:"YOUKU"}}).should.eventually.be.fulfilled;
    })
})










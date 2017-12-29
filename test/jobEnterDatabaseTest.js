/**
 * Created by lichenchen on 2017/10/17.
 */
var chai = require("chai");
var chaiAsPromise = require("chai-as-promised");
chai.use(chaiAsPromise);
var expect = chai.expect;
chai.should();
var conf = require("../conf/config.json");
var JobEnterDatabase = require("../lib/jobEnterDatabase");
var jobEnterDatabase = new JobEnterDatabase();
// describe("jobEnterDatabase series", function () {
//     it("upsertSeries", function () {
//         return jobEnterDatabase.upsertSeries({
//             cpcontentid: "YOUKU_23000072017101716215100250",
//             iscompleted: 0,
//             priority: 10,
//             flag: true
//         }).should.eventually.be.fulfilled;
//     })
//     it("updateOrInsertSeries", function () {
//         return jobEnterDatabase.updateOrInsertSeries("YOUKU", {
//             cpcontentid: "2eeeafb21dc311df97c0",
//             score: 9
//         }).should.eventually.be.fulfilled;
//     })
//     it("importSeries", function () {
//         return jobEnterDatabase.importSeries({
//             cpcode: "YOUKU",
//             name: "女人的村庄",
//             programtype: "电视剧",
//             releaseyear: "2008"
//         }).should.eventually.be.fulfilled;
//     })
//     it("upsertCpsSeries", function () {
//         return jobEnterDatabase.upsertCpsSeries({
//             cpcontentid: "YOUKU_2eeeafb21dc311df97c0",
//             score: 9
//         }).should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase program", function () {
//     it("upsertProgram", function () {
//         return jobEnterDatabase.upsertProgram({
//             cpcontentid: "YOUKU_XMTU4Nzg3MDMy",
//             flag: false,
//             checkstatus: 0
//         }).should.eventually.be.fulfilled;
//     })
//     it("importProgram", function () {
//         return jobEnterDatabase.importProgram({
//             cpcode: "YOUKU",
//             seriesname: "神偷奶爸3",
//             volumncount: 1,
//             programtype: "电影",
//             releaseyear: "2017",
//             checkstatus: 0
//         }).should.eventually.be.fulfilled;
//     })
//     it("upsertCpsProgram", function () {
//         return jobEnterDatabase.upsertCpsProgram({
//             cpcontentid: "YOUKU_XMzA1NzU5MDY0OA==",
//             language: "英语"
//         }).should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase movie", function () {
//     it("upsertMovie", function () {
//         return jobEnterDatabase.upsertMovie({
//             cpcontentid: "YOUKU_XMTQyMzE2NTc4MA==",
//             flag: true
//         }).should.eventually.be.fulfilled;
//     })
//     it("insertMovie", function () {
//         return jobEnterDatabase.insertMovie({fileid: "23000062017101812231715258"}).should.eventually.be.rejected;
//     })
//     it("updateMovieByCpcontentid", function () {
//         return jobEnterDatabase.updateMovieByCpcontentid({cpcontentid: "YP3D_23000082017101814492901203"}, {iscompleted: 0}).should.eventually.be.fulfilled;
//     })
//     it("updateMovie", function () {
//         return jobEnterDatabase.updateMovie("2300006201710181501301526", {iscompleted: 0}).should.eventually.be.fulfilled;
//     })
//     it("importMovie", function () {
//         return jobEnterDatabase.importMovie({
//             cpcontentid: "YOUKU_23000082017101620115001192",
//             type: 1
//         }, {movieformat: "1366_768_HEVC_25_Iterlace_AAC_72000_CBR_25M_TS"}, {}).should.eventually.be.fulfilled;
//     })
//     it("upsertCpsMovie", function () {
//         return jobEnterDatabase.upsertCpsMovie({
//             fileid: "23000062017101815082815262",
//             iscompleted: -1
//         }).should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase injectOrder", function () {
//     it("upsertInjectOrder", function () {
//         return jobEnterDatabase.upsertInjectOrder([{
//             showid: "d10bed3bc2a911e6bdbb",
//             vid: "XMzA1NzU5MDY0OA==",
//             priority: 5
//         }]).should.eventually.be.fulfilled;
//     })
//     it("updateInject", function () {
//         return jobEnterDatabase.updateInject(141129, 0, "神偷奶爸3", "神偷奶爸3", "d10bed3bc2a911e6bdbb").should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase sensitiveseries", function () {
//     it("upsertSensitiveseries", function () {
//         return jobEnterDatabase.upsertSensitiveseries({
//             cpcontentid: "4KGARDEN_23000072017100917124400172",
//             status: -1
//         }).should.eventually.be.fulfilled;
//     })
//     it("insertSensitiveseries", function () {
//         return jobEnterDatabase.insertSensitiveseries({
//             cpcontentid: "CMS_23000072017101717075100253",
//             status: -1
//         }).should.eventually.be.rejected;
//     })
// })
// describe("jobEnterDatabase unifiedseries", function () {
//     it("upsertUnifiedseries", function () {
//         return jobEnterDatabase.upsertUnifiedseries({
//             cpcontentid: "YOUKU_19c9a09ea22c11e0a046",
//             director: "刘二威"
//         }).should.eventually.be.fulfilled;
//     })
//     it("updateUnifiedseries", function () {
//         return jobEnterDatabase.updateUnifiedseries({
//             cpcontentid: "YOUKU_19c9a09ea22c11e0a046",
//             director: "刘二威"
//         }).should.eventually.be.fulfilled;
//     })
//     it("findAndUpdateUnifiedseries", function () {
//         return jobEnterDatabase.findAndUpdateUnifiedseries({
//             cpcontentid: "YOUKU_d10bed3bc2a911e6bdbb",
//             programtype: "电影"
//         }, {code: "23010012017101815082900384"}).should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase unifiedseriesseries", function () {
//     it("upsertUnifiedseriesseries", function () {
//         return jobEnterDatabase.upsertUnifiedseriesseries({
//             unifiedseriescode: "23010012017101815082900384",
//             cpcontentid: "YOUKU_d10bed3bc2a911e6bdbb",
//             isunified: 1,
//             status: 1,
//             cpcode: "YOUKU"
//         }).should.eventually.be.fulfilled;
//     })
//     it("updateUnifiedseriesseries", function () {
//         return jobEnterDatabase.updateUnifiedseriesseries({unifiedseriescode: "23010012017101815082900384"}, {isunified: 0}).should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase ununifiedmedia", function () {
//     it("upsertUnunifiedmedia", function () {
//         return jobEnterDatabase.upsertUnunifiedmedia({
//             cpcontentid: "CMS_23000072017101815013000256",
//             contenttype: 1,
//             status: -1
//         }).should.eventually.be.fulfilled;
//     })
//     it("insertUnunifiedmedia", function () {
//         return jobEnterDatabase.insertUnunifiedmedia({
//             cpcontentid: "CMS_23000072017101815013000256",
//             contenttype: 1,
//             status: -1
//         }).should.eventually.be.rejected;
//     })
// })
// describe("jobEnterDatabase waitunified", function () {
//     it("upsertWaitunified", function () {
//         return jobEnterDatabase.upsertWaitunified({
//             cpcontentid: "CMS_23000072017101815013000256",
//             status: 1
//         }).should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase sensitiveprogram", function () {
//     it("upsertSensitiveprogram", function () {
//         return jobEnterDatabase.upsertSensitiveprogram({
//             cpcontentid: "CMS_23000082017101815013001204",
//             sensitivewords: "赵程阳",
//             status: 1
//         }).should.eventually.be.fulfilled;
//     })
//     it("insertSensitiveprogram", function () {
//         return jobEnterDatabase.insertSensitiveprogram({
//             cpcontentid: "CMS_23000082017101815013001204",
//             sensitivewords: "赵程阳",
//             status: 1
//         }).should.eventually.be.rejected;
//     })
// })
// describe("jobEnterDatabase unifiedprogramprogram", function () {
//     it("upsertUnifiedprogramprogram", function () {
//         return jobEnterDatabase.upsertUnifiedprogramprogram({
//             unifiedprogramcode: "23010022017101815083010041",
//             cpcontentid: "YOUKU_XMzA1NzU5MDY0OA=="
//         }).should.eventually.be.fulfilled;
//     })
//     it("updateUnifiedprogram", function () {
//         return jobEnterDatabase.updateUnifiedprogram({
//             cpcontentid: "YOUKU_XMTQwODczMDI4OA==",
//             cdnstatus: 0
//         }).should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase unifiedprogram", function () {
//     it("upsertUnifiedprogram", function () {
//         return jobEnterDatabase.upsertUnifiedprogram({cpcontentid: "YOUKU_XMzA1NzU5MDY0OA=="}).should.eventually.be.fulfilled;
//     })
//     it("upsertUnifiedprogramByFilter", function () {
//         return jobEnterDatabase.upsertUnifiedprogramByFilter({
//             ismain: true,
//             name: "神偷奶爸3"
//         }, {where: {cpcontentid: "YOUKU_XMzA1NzU5MDY0OA=="}}).should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase unifiedmovie", function () {
//     it("upserUnifiedmovie", function () {
//         return jobEnterDatabase.upserUnifiedmovie({fileid: "23000062017090611315312681"}).should.eventually.be.fulfilled;
//     })
//     it("updateUnifiedmovieById", function () {
//         return jobEnterDatabase.updateUnifiedmovieById({id: 3587, status: 0}).should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase importMediaDetail", function () {
//     it("upsertImportMediaDetail", function () {
//         return jobEnterDatabase.upsertImportMediaDetail({
//             cpcode: "cms",
//             seriesname: "来吧 冠军2017",
//             programvolumncount: "20160403",
//             programname: "20160403《来吧 冠军》：第一次项目挑战——排球2017",
//             importmediaid: 758,
//             status: 31
//         }).should.eventually.be.fulfilled;
//     })
//     it("updateImportDetail", function () {
//         return jobEnterDatabase.updateImportDetail(4265, {status: 31}).should.eventually.be.fulfilled;
//     })
// })
// describe("jobEnterDatabase importMedia", function () {
//     it("updateImportMedia", function () {
//         return jobEnterDatabase.updateImportMedia(758, {status: 21}).should.eventually.be.fulfilled;
//     })
// })
describe("jobEnterDatabase SPMAlertRecords", function () {
    it("update SPMAlertRecords", function () {
        return jobEnterDatabase.updateSPMAlertRecords({where:{id:723}}, {status: -1}).should.eventually.be.fulfilled;
    })
})



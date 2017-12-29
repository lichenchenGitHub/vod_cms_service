/**
 * Created by lichenchen on 2017/12/18.
 */
const unirest = require("unirest");
const Promise = require("bluebird");
const conf = require("../conf/config");
var getItem = function () {
    return new Promise(function (resolve, reject) {
        var filter = {where: {cpcontentid: "APECN_21BED678DA4F4C20A37C3C6C84C86CC7", type: 0}};
        unirest.get(conf.strongLoopApi + "Movies/findOne?filter=" + JSON.stringify(filter)).pool(conf.poolOption)
            .end(function (resp) {
                var movie = resp.body;
                resolve(movie);
            })
    })
}
getItem().then(function (movie) {
    var obj = {};
    obj.src = 2;
    if (movie.priority == null || typeof(movie.priority) == "undefined") {
        obj.priority = 5;
    } else {
        obj.priority = movie.priority;
    }
    obj.catid = 84;
    obj.showid = movie.showid;
    obj.vid = movie.cpcontentid;
    obj.cpcode = movie.cpcode;
    obj.uri = movie.filepath;
    obj.fcode = movie.fileid;
    obj.md5 = movie.md5;
    obj.pname = escape(movie.name);
    obj.sname = escape(movie.seriesname);
    console.log(obj);
    unirest.post(conf.downloadAPECNMovie).pool(conf.poolOption)
        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
        .send(obj)
        .end(function (resp) {
            console.log(resp.body);
            var updateFields = {};
            if (resp.status != 200) {
                console.error(obj.fcode + " http status is :" + resp.status + " at" + new Date());
                updateFields.fileid = obj.fcode;
                updateFields.downloadstatus = -1;
            } else {
                if (resp.body.errCode == 0) {
                    updateFields.fileid = resp.body.data.fcode;
                    if (resp.body.data.dstat > 1) {
                        updateFields.downloadstatus = resp.body.data.dstat;
                        updateFields.filepath = resp.body.data.fpath;
                        updateFields.filesize = resp.body.data.fsize;
                        updateFields.md5 = resp.body.data.fhash;
                    } else {
                        updateFields.downloadstatus = 1;
                    }
                } else if (resp.body.errCode == 301) {
                    updateFields.fileid = resp.body.data.fcode;
                    if (resp.body.data.dstat > 1) {
                        updateFields.downloadstatus = resp.body.data.dstat;
                        updateFields.filepath = resp.body.data.fpath;
                        updateFields.filesize = resp.body.data.fsize;
                        updateFields.md5 = resp.body.data.fhash;
                    } else {
                        updateFields.downloadstatus = 1;
                    }
                } else {
                    if (resp.body.data.fcode != null && typeof(resp.body.data.fcode) != "undefined") {
                        updateFields.fileid = resp.body.data.fcode;
                    } else {
                        updateFields.fileid = obj.fcode;
                    }
                    updateFields.downloadstatus = -1;
                    console.error(obj.fcode + " errCode is :" + resp.body.errCode + ",errMsg is :" + resp.body.errMsg + " at " + new Date())
                }
                updateFields.updatetime = new Date();
                if (updateFields.fileid == null || typeof(updateFields.fileid) == "undefined") {
                    console.error("fileId is null  at " + new Date())
                } else {
                    unirest.post(conf.strongLoopApi + "Movies/update?where=" + JSON.stringify({fileid: updateFields.fileid})).pool(conf.poolOption)
                        .headers({'Accept': 'application/json', 'Content-Type': 'application/json'})
                        .send({downloadstatus: updateFields.downloadstatus, updatetime: updateFields.updatetime})
                        .end(function (updateResp) {
                            console.log(updateResp.body);
                        })
                }
            }
        })
})
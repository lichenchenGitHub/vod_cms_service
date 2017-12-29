/**
 * Created by lichenchen on 2017/8/7.
 */
// var mongoose = require('mongoose');
// var Schema = mongoose.Schema;
// var DomainTaskSchema = new Schema({
//     id: {type: String},
//     packageId: {type: Number},
//     domainCode: {type: String},
//     actionType: {type: Number},//操作  1:'REGIST',2:'UPDATE',3:'DELETE'
//     uscode: {type: String},
//     upcode: {type: String},
//     umcode: {type: String},
//     status: {type: Number, default: 0},
//     priority: {type: Number, default: 3},
//     serialNumber: {type: String, defualt: ""}
// }, {
//     autoIndex: true,
//     collection: 'domainTask',
//     versionKey: false
// });
// DomainTaskSchema.index({packageId: 1, domainCode: 1, uscode: 1, upcode: 1, umcode: 1});
// module.exports = DomainTaskSchema;
// var sequelize = require("../lib/sequelize");
// sequelize.define
/**
 * Created by lichenchen on 2017/8/4.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var SPMCodeSchema = new Schema({
    id: {type: String},
    seriescode: {type: String},
    programcode: {type: String},
    moviecode: {type: String},
    status: {type: Number, default: 0}
}, {
    autoIndex: true,
    collection: 'SPMCode',
    versionKey: false
});
SPMCodeSchema.index({uscode: 1, upcode: 1, umcode: 1});
module.exports = SPMCodeSchema;

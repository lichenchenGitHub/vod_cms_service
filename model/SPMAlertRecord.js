/**
 * Created by lichenchen on 2017/11/13.
 */
module.exports = function (sequelize, DataTypes) {
    return sequelize.define("SPMAlertRecord", {
        id: {
            type: DataTypes.INTEGER, primaryKey: true
        },
        unifiedSeriesCode: DataTypes.STRING,
        unifiedProgramCode: DataTypes.STRING,
        unifiedMovieCode: DataTypes.STRING,
        actionType: DataTypes.INTEGER,
        fileUrl: DataTypes.STRING,
        contentType: DataTypes.INTEGER,
        category: DataTypes.STRING,
        seriesName: DataTypes.STRING,
        programName: DataTypes.STRING,
        status: DataTypes.INTEGER,
        statusDesc: DataTypes.STRING,
        createTime: DataTypes.DATE,
        updateTime: DataTypes.DATE
    }, {
        timestamps: false,
        freezeTableName: true
    })
}
/**
 * Created by Nayak on 2015-07-28.
 */
var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var async = require('async');
var db_config = require('./db_config');
var logger = require('../logger');
var pool = mysql.createPool(db_config);


/*************
 * Surfers Random
 *************/
exports.surfers = function(data, done){
    async.waterfall([
            function(callback){
                if(data.length == 0){
                    var sql =
                        "SELECT user_no, user_nickname, user_comment, user_img, user_point, user_status "+
                        "FROM wave_user "+
                        "ORDER BY RAND() LIMIT 1 ";
                }else{
                    var sql =
                        "SELECT user_no, user_nickname, user_comment, user_img, user_point, user_status "+
                        "FROM wave_user "+
                        "WHERE user_no NOT IN(?) ORDER BY RAND() LIMIT 1 ";
                }
                pool.query(sql, data, function (err, rows) {
                    if (err) {
                        logger.error("Surfers DB error");
                        callback(err);
                    } else {
                        logger.info('rows[0]', rows[0]);
                        if (rows[0]) callback(null, rows[0]);
                        else done(false, "Surfers DB error");  // error 없이 콜백
                    }
                });
            },
            function (user_info, callback) {
                var sql = "SELECT first_thumb_url, first_title, first_video FROM wave_song_first WHERE user_no=?";
                pool.query(sql, user_info.user_no, function(err, rows){
                    if (err) {
                        logger.error("Surfers DB error");
                        callback(err);
                    } else {
                        logger.info('first_rows[0]', rows[0]);
                        if (rows[0]) callback(null, user_info, rows[0]);
                        else done(false, "Surfers DB error");  // error 없이 콜백
                    }
                });
            },
            function (user_info, song1, callback) {
                var sql = "SELECT second_thumb_url, second_title, second_video FROM wave_song_second WHERE user_no=?";
                pool.query(sql, user_info.user_no, function(err, rows){
                    if (err) {
                        logger.error("Surfers DB error");
                        callback(err);
                    } else {
                        logger.info('second_rows[0]', rows[0]);
                        if (rows[0]) callback(null, user_info, song1, rows[0]);
                        else callback(null, user_info, song1, "NOT");
                    }
                });
            },
            function (user_info, song1, song2, callback) {
                var sql = "SELECT third_thumb_url, third_title, third_video FROM wave_song_third WHERE user_no=?";
                pool.query(sql, user_info.user_no, function (err, rows) {
                    if (err) {
                        logger.error("Surfers DB error");
                        callback(err);
                    } else {
                        logger.info('third_rows[0]', rows[0]);
                        if (rows[0]) callback(null, user_info, song1, song2, rows[0]);
                        else callback(null, user_info, song1, song2, "NOT");
                    }
                });
            }
        ],
        function(err, user, song1, song2, song3){
            if (err) done(false, "Surfers DB error");
            else{
                logger.info("result:", user, song1, song2, song3);
                done(true, "success", user, song1, song2, song3);
            }
        }
    ); // waterfall
};

/*************
 * Surfing Request
 *************/
exports.req = function(data, done){
    pool.getConnection(function(err, conn) {
        if(err) {
            logger.error("Surfing_Request_getConnection error");
            done(false, "Surfing_Request DB error");
            conn.release();
        }else {
            conn.beginTransaction(function (err) {
                if (err) {
                    logger.error("Surfing_Request_beginTransaction error");
                    done(false, "Surfing_Request DB error");
                    conn.release();
                } else {
                    async.waterfall([
                            function (callback) {
                                var sql = "UPDATE wave_user SET user_status = 1, user_surfing_no = ? WHERE user_no = ?";  // user_status=1 -> 신청한 사람의 표시
                                conn.query(sql, data, function(err, rows){
                                    if(err){
                                        logger.info("Request DB waterfall_1");
                                        callback(err);
                                    }else{
                                        if(rows.affectedRows == 1) callback(null);
                                        else{
                                            logger.info("Request DB waterfall_2");
                                            done(false, "Request DB error");  // error 없이 콜백
                                            conn.release();
                                        }
                                    }
                                });
                            },
                            function (callback) {
                                var sql = "UPDATE wave_user SET user_status = 2, user_surfing_no = ? WHERE user_no = ?";  // user_status=2 -> 신청 받은 사람의 표시
                                conn.query(sql, [data[1], data[0]], function(err, rows){  // SWAP
                                    if(err){
                                        logger.info("Request DB waterfall_3");
                                        callback(err);
                                    }else{
                                        if(rows.affectedRows == 1) callback(null);
                                        else{
                                            logger.info("Request DB waterfall_4");
                                            done(false, "Request DB error");  // error 없이 콜백
                                            conn.release();
                                        }
                                    }
                                });
                            }
                        ],
                        function (err) {
                            if (err) {
                                conn.rollback(function () {
                                    done(false, "Request DB error");  // error
                                    conn.release();
                                });
                            } else {
                                conn.commit(function (err) {
                                    if (err) {
                                        logger.error("Request DB Commit error");
                                        done(false, "Request DB error");
                                        conn.release();
                                    } else {
                                        done(true, "success");  // success
                                        conn.release();
                                    }
                                });
                            }
                        }
                    );  // waterfall
                }
            });  // beginTransaction
        }
    });
};

exports.req_info = function(data, done){
    var sql = "SELECT user_phone, user_regid FROM wave_user WHERE user_no = ?";
    pool.query(sql, data, function(err, rows){
        if(err) done(false, "Req_info DB error");
        else done(true, "success", rows[0]);
    });
};

/*************
 * Surfing Response
 *************/
exports.res_ok = function(data, done){  // 수락
    // TODO surfing 테이블에 들어가야함
    pool.getConnection(function(err, conn) {
        if(err) {
            logger.error("Surfing_Response_ok_getConnection error");
            done(false, "Surfing_Response_ok DB error");
            conn.release();
        }else {
            conn.beginTransaction(function (err) {
                if (err) {
                    logger.error("Surfing_Response_ok_beginTransaction error");
                    done(false, "Surfing_Response_ok DB error");
                    conn.release();
                } else {
                    async.waterfall([
                            function (callback) {
                                var sql = "UPDATE wave_user SET user_status = 3 WHERE user_no = ?";  // user_status=3 -> 거절로 둘다 case 0
                                conn.query(sql, data[0], function(err, rows){
                                    if(err){
                                        logger.info("Response_ok DB waterfall_1");
                                        callback(err);
                                    }else{
                                        if(rows.affectedRows == 1) callback(null);
                                        else{
                                            logger.info("Response_ok DB waterfall_2");
                                            done(false, "Response_ok DB error");  // error 없이 콜백
                                            conn.release();
                                        }
                                    }
                                });
                            },
                            function (callback) {
                                var sql = "UPDATE wave_user SET user_status = 0, user_surfing_no = 0 WHERE user_no = ?";  // user_status=2, user_surfing_no=0 -> 거절로 둘다 case 0
                                conn.query(sql, data[1], function(err, rows){  // SWAP
                                    if(err){
                                        logger.info("Response_ok DB waterfall_3");
                                        callback(err);
                                    }else{
                                        if(rows.affectedRows == 1) callback(null);
                                        else{
                                            logger.info("Response_ok DB waterfall_4");
                                            done(false, "Response_ok DB error");  // error 없이 콜백
                                            conn.release();
                                        }
                                    }
                                });
                            }
                        ],
                        function (err) {
                            if (err) {
                                conn.rollback(function () {
                                    done(false, "Response_ok DB error");  // error
                                    conn.release();
                                });
                            } else {
                                conn.commit(function (err) {
                                    if (err) {
                                        logger.error("Response_ok DB Commit error");
                                        done(false, "Response_ok DB error");
                                        conn.release();
                                    } else {
                                        done(true, "success");  // success
                                        conn.release();
                                    }
                                });
                            }
                        }
                    );  // waterfall
                }
            });  // beginTransaction
        }
    });
};

exports.res_no = function(data, done){  // 거절
    pool.getConnection(function(err, conn) {
        if(err) {
            logger.error("Surfing_Response_no_getConnection error");
            done(false, "Surfing_Response_no DB error");
            conn.release();
        }else {
            conn.beginTransaction(function (err) {
                if (err) {
                    logger.error("Surfing_Response_no_beginTransaction error");
                    done(false, "Surfing_Response_no DB error");
                    conn.release();
                } else {
                    async.waterfall([
                            function (callback) {
                                var sql = "UPDATE wave_user SET user_status = 0, user_surfing_no = 0 WHERE user_no = ?";  // user_status=0, user_surfing_no=0 -> 거절로 둘다 case 0
                                conn.query(sql, data[0], function(err, rows){
                                    if(err){
                                        logger.info("Response_no DB waterfall_1");
                                        callback(err);
                                    }else{
                                        if(rows.affectedRows == 1) callback(null);
                                        else{
                                            logger.info("Response_no DB waterfall_2");
                                            done(false, "Response_no DB error");  // error 없이 콜백
                                            conn.release();
                                        }
                                    }
                                });
                            },
                            function (callback) {
                                var sql = "UPDATE wave_user SET user_status = 0, user_surfing_no = 0 WHERE user_no = ?";  // user_status=2, user_surfing_no=0 -> 거절로 둘다 case 0
                                conn.query(sql, data[1], function(err, rows){  // SWAP
                                    if(err){
                                        logger.info("Response_no DB waterfall_3");
                                        callback(err);
                                    }else{
                                        if(rows.affectedRows == 1) callback(null);
                                        else{
                                            logger.info("Response_no DB waterfall_4");
                                            done(false, "Response_no DB error");  // error 없이 콜백
                                            conn.release();
                                        }
                                    }
                                });
                            }
                        ],
                        function (err) {
                            if (err) {
                                conn.rollback(function () {
                                    done(false, "Response_no DB error");  // error
                                    conn.release();
                                });
                            } else {
                                conn.commit(function (err) {
                                    if (err) {
                                        logger.error("Response_no DB Commit error");
                                        done(false, "Response_no DB error");
                                        conn.release();
                                    } else {
                                        done(true, "success");  // success
                                        conn.release();
                                    }
                                });
                            }
                        }
                    );  // waterfall
                }
            });  // beginTransaction
        }
    });
};

/*************
 * Surfers Random
 *************/
/*
 exports.surfers = function(data, done){
 var sql =
 "SELECT user_no, user_nickname, user_comment, user_img, user_point, user_song_1, user_song_2, user_song_3 "+
 "FROM wave_user "+
 "WHERE user_no NOT IN(?) ORDER BY RAND() LIMIT 5 ";
 pool.query(sql, data, function(err, rows){
 if(err){
 logger.error("Surfers DB error");
 done(false, "Surfers DB error");
 }else{
 logger.info('rows', rows);
 if(rows[0]) done(true, "success", rows);
 else done(false, "Surfers DB error");
 }
 });
 };
 */
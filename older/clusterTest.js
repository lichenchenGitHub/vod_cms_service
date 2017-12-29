/**
 * Created by lichenchen on 2017/9/8.
 */
var Redis = require('ioredis');
var redis_cluster = new Redis.Cluster([{
    port: 6379,
    host: '10.3.1.7'
}, {
    port: 6380,
    host: '10.3.1.7'
}]);
redis_cluster.set("test","bar");
redis_cluster.set("test2","bar2");
redis_cluster.set("test3","bar3");
redis_cluster.set("test4","bar4");
redis_cluster.set("test5","bar5");
redis_cluster.set("test6","bar6");
redis_cluster.get("test",function(err,res){
    console.log("test is :"+res );
})
cluster.del("test");
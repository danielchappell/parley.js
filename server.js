
/*  NODE SERVER FOR PARLEY.JS */
var app, express, io, logged_on, redis, redisClient, rtg, sockets;

express = require('express');

redis = require('redis');

app = express();

io = require('socket.io').listen(app.listen(process.env.PORT || 5000));

logged_on = [];

sockets = {};

if (process.env.REDISTOGO_URL) {
  rtg = require('url').parse(process.env.REDISTOGO_URL);
  redisClient = redis.createClient(rtg.port, rtg.hostname);
  redisClient.auth(rtg.auth.split(":")[1]);
} else {
  redisClient = redis.createClient();
}

redisClient.on('error', function(err) {
  return console.log("Error " + err);
});

app.use(express["static"]("" + __dirname + "/"));

app.get('/', function(req, res) {
  return res.sendfile("" + __dirname + "/test.html");
});


/*    SOCKET.IO CALLBACKS */

io.sockets.on('connection', function(client) {
  return client.on('join', function(display_name, image_url) {
    var logged_in, user, _i, _len;
    logged_in = false;
    for (_i = 0, _len = logged_on.length; _i < _len; _i++) {
      user = logged_on[_i];
      if (image_url === user['image_url']) {
        logged_in = true;
      }
    }
    if (!logged_in) {
      sockets[image_url] = {
        display_name: display_name,
        client: [client]
      };
      logged_on.push({
        display_name: display_name,
        image_url: image_url
      });
      client.broadcast.emit('user_logged_on', display_name, image_url);
      redisClient.hmset(image_url, "display_name", display_name, "image_url", image_url);
    } else {
      sockets[image_url]['client'] = sockets[image_url]['client'].concat(client);
    }
    client.emit('current_users', logged_on);
    redisClient.smembers("convo_" + image_url, function(err, persist_convos) {
      var convo_id, convo_members_ids, convo_partners, id, _j, _k, _len1, _len2, _results;
      if (err) {
        return console.log("ERROR 1: " + err);
      } else {
        console.log(persist_convos);
        _results = [];
        for (_j = 0, _len1 = persist_convos.length; _j < _len1; _j++) {
          convo_id = persist_convos[_j];
          convo_members_ids = convo_id.split(',');
          convo_partners = [];
          for (_k = 0, _len2 = convo_members_ids.length; _k < _len2; _k++) {
            id = convo_members_ids[_k];
            if (id !== image_url) {
              redisClient.hgetall(id, function(err, user) {
                if (err) {
                  return console.log("ERROR 2: " + err);
                } else {
                  return convo_partners.push(user);
                }
              });
            }
          }
          _results.push(redisClient.lrange(convo_id, 0, -1, function(err, messages) {
            if (err) {
              return console.log("ERROR 3: " + err);
            } else {
              return client.emit('persistent_convo', convo_partners, messages);
            }
          }));
        }
        return _results;
      }
    });
    client.on('user_typing', function(rIDs, sObj, bool) {
      var convo_members, id, socket, _j, _len1, _results;
      convo_members = rIDs.concat(sObj.image_url);
      _results = [];
      for (_j = 0, _len1 = rIDs.length; _j < _len1; _j++) {
        id = rIDs[_j];
        if (sockets.hasOwnProperty(id)) {
          _results.push((function() {
            var _k, _len2, _ref, _results1;
            _ref = sockets[id]['client'];
            _results1 = [];
            for (_k = 0, _len2 = _ref.length; _k < _len2; _k++) {
              socket = _ref[_k];
              if (bool) {
                _results1.push(socket.emit('incoming_mesage', convo_members, sObj, true));
              } else {
                _results1.push(socket.emit('incoming_mesage', convo_members, sObj, false));
              }
            }
            return _results1;
          })());
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    });
    client.on('message', function(message) {
      var convo_key, id, json_message, member_array, recipent, socket, _j, _k, _len1, _len2, _ref, _results;
      json_message = JSON.stringify(message);
      member_array = message.convo_id.split(',');
      console.log(member_array);
      for (_j = 0, _len1 = member_array.length; _j < _len1; _j++) {
        id = member_array[_j];
        convo_key = "convo_" + id;
        redisClient.multi([['sadd', convo_key, message.convo_id], ['expire', convo_key, 16070400]]).exec(function(err, replies) {
          if (err) {
            return console.log("ERROR 8:" + err);
          } else {
            return console.log(replies);
          }
        });
      }
      redisClient.multi([['rpush', message.convo_id, json_message], ['ltrim', message.convo_id, -199, -1], ['expire', message.convo_id, 604800]]).exec(function(err, replies) {
        if (err) {
          return console.log("ERROR 5:" + err);
        } else {
          return console.log(replies);
        }
      });
      _ref = message.recipients;
      _results = [];
      for (_k = 0, _len2 = _ref.length; _k < _len2; _k++) {
        recipent = _ref[_k];
        if (sockets.hasOwnProperty(recipent.image_url)) {
          _results.push((function() {
            var _l, _len3, _ref1, _results1;
            _ref1 = sockets[recipent.image_url]['client'];
            _results1 = [];
            for (_l = 0, _len3 = _ref1.length; _l < _len3; _l++) {
              socket = _ref1[_l];
              _results1.push(socket.emit('message', message));
            }
            return _results1;
          })());
        } else {
          _results.push(client.emit('user_offline'));
        }
      }
      return _results;
    });
    return client.on('disconnect', function() {
      var i, socket, _j, _k, _len1, _len2, _ref;
      if (sockets[image_url]['client'].length < 2) {
        client.broadcast.emit('user_logged_off', display_name, image_url);
        console.log(logged_on);
        for (i = _j = 0, _len1 = logged_on.length; _j < _len1; i = ++_j) {
          user = logged_on[i];
          if (user.image_url === image_url) {
            logged_on.splice(i, 1);
          }
        }
      }
      _ref = sockets[image_url]['client'];
      for (i = _k = 0, _len2 = _ref.length; _k < _len2; i = ++_k) {
        socket = _ref[i];
        if (socket === client) {
          sockets[image_url]['client'].splice(i, 1);
        }
      }
      if (sockets[image_url]['client'].length === 0) {
        delete sockets[image_url];
      }
      return console.log(logged_on);
    });
  });
});

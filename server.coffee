
###################################
###  NODE SERVER FOR PARLEY.JS  ###
###################################


express = require 'express'
redis = require 'redis'
app = express()
io = require('socket.io').listen(app.listen(process.env.PORT || 5000))
# stream = require 'socket.io-stream'
logged_on = []
sockets = {}

## REDISTOGO HEROKU plugin authentication
if process.env.REDISTOGO_URL
  rtg = require('url').parse(process.env.REDISTOGO_URL)
  redisClient = redis.createClient(rtg.port, rtg.hostname)
  redisClient.auth(rtg.auth.split(":")[1])
else
  redisClient = redis.createClient()

## REDIS ERROR LOGGING

redisClient.on 'error', (err) ->
  console.log "Error #{err}"

##########################################################
#####   TEMPORARY HTTP SERVER FOR LIBRARY TESTING    #####
##########################################################

## serve assets
app.use(express.static("#{__dirname}/"))

## single route to test html page
app.get '/', (req, res) ->
  res.sendfile "#{__dirname}/test.html"


################################
###    SOCKET.IO CALLBACKS   ###
################################

io.sockets.on 'connection', (client) ->
  client.on 'join', (display_name, image_url) ->
    ## make sure the user isn't already logged in
    logged_in = false
    for user in logged_on
      if image_url is user['image_url']
        logged_in = true

    ## if not previously logged in push to array of online users
    ## and add to sockets object to keep track of client's socket
    if not logged_in
      sockets[image_url] = { display_name: display_name, client: [client] }
      logged_on.push({ display_name: display_name, image_url: image_url })

    ## let all clients know a new user is logged on and send client info
      client.broadcast.emit 'user_logged_on', display_name, image_url
      redisClient.hmset(image_url, "display_name", display_name, "image_url", image_url)

    else
      ## if client is already logged on for instance opening a new window or tab
      sockets[image_url]['client'] = sockets[image_url]['client'].concat(client)


    ##regardless send online user list to client
    client.emit 'current_users', logged_on

    ## Query REDIS for all persistent messages belonging to user
    redisClient.smembers "convo_#{image_url}", (err, persist_convos) ->
      if err
        console.log "ERROR 1: #{err}"
      else
        console.log(persist_convos)
        for convo_id in persist_convos
          convo_members_ids = convo_id.split(',')
          convo_partners = []
          for id in convo_members_ids
            if id isnt image_url
              redisClient.hgetall id, (err, user) ->
                if err
                  console.log "ERROR 2: #{err}"
                else
                  convo_partners.push(user)

          redisClient.lrange convo_id, 0, -1, (err, messages) ->
            if err
              console.log "ERROR 3: #{err}"
            else
              client.emit 'persistent_convo', convo_partners, messages


    ## listen for type_notifications
    client.on 'user_typing', (rIDs, sObj, bool)->
      convo_id = rIDs.concat(sObj.image_url).sort().join()
      for id in rIDs
        if sockets.hasOwnProperty(id)
          for socket in sockets[id]['client']
            if bool
              socket.emit 'typing_notification', convo_id, sObj, true
            else
              socket.emit 'typing_notification', convo_id, sObj, false

    ## listen for messages from clients
    client.on 'message', (message)->
      ## stringifies message object from sender for storage in redis
      json_message = JSON.stringify(message)
      member_array = message.convo_id.split(',')
      console.log(member_array)
      ## create and execute redis task that refreshes the user/conversation set and the conversation list
      for id in member_array
        convo_key = "convo_#{id}"
        redisClient.multi([
          ['sadd', convo_key, message.convo_id],
          ['expire', convo_key, 16070400]
          ]).exec (err, replies) ->
            if err then console.log "ERROR 8:#{err}" else console.log replies

      redisClient.multi([
        ['rpush', message.convo_id, json_message],
        ['ltrim', message.convo_id, -199, -1],
        ['expire', message.convo_id, 604800]
        ]).exec (err, replies) ->
          if err then console.log "ERROR 5:#{err}" else console.log replies
      for recipent in message.recipients
        if sockets.hasOwnProperty(recipent.image_url)
          for socket in sockets[recipent.image_url]['client']
            socket.emit 'message', message
        else
          client.emit 'user_offline'

    ## listen for disconnection from socket i.e. close browser or tab
    client.on 'disconnect', ->
      if sockets[image_url]['client'].length < 2
        client.broadcast.emit 'user_logged_off', display_name, image_url

        ## remove user from logged on since all windows and tabs are closed
        console.log(logged_on)
        for user, i in logged_on
          if user.image_url is image_url
            logged_on.splice(i,1)
      for socket, i in sockets[image_url]['client']
        if socket is client
          sockets[image_url]['client'].splice(i,1)
      ## if there are no remaining sockets/tabs/windows open for a user
      ## delete their property object in the sockets object
      if sockets[image_url]['client'].length is 0
        delete sockets[image_url]
      console.log(logged_on)





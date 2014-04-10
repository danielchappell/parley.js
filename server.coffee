
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
    loggedIN = false
    for user in logged_on
      if image_url is user['image_url']
        loggedIN = true

    ## if not previously logged in push to array of online users
    ## and add to sockets object to keep track of client's socket
    if not loggedIN
      sockets[image_url] = { display_name: display_name, client: [client] }
      logged_on.push({ display_name: display_name, image_url: image_url })

    ## let all clients know a new user is logged on and send client info
      client.broadcast.emit 'user_logged_on', display_name, image_url

    else
      ## if client is already logged on for instance opening a new window or tab
      sockets[image_url]['client'] = sockets[image_url]['client'].concat(client)


    ##regardless send online user list to client
    client.emit 'current_users', logged_on

    ## Query REDIS for all persistent messages belonging to user
    redisClient.smembers image_url, (err, persist_convos) ->
      if err
        console.log "ERROR: #{err}"
      else
        for member_group in persist_convos
          group = JSON.parse(member_group)
          id_array = []
          for user in group
            id_array.push(user.image_url)
          convo_key = id_array.sort().join()
          redisClient.lrange convo_key, 0, -1, (err, messages) ->
            if err
              console.log "ERROR: #{err}"
            else
              console.log(messages)
              parsed_array = []
              for message in messages
                parsed_array.push(JSON.parse(message))
              console.log(parsed_array)
              client.emit 'persistent_convo', group, parsed_array


    ## listen for type_notifications
    client.on 'user_typing', (rIDs, sObj, bool)->
      convo_members = rIDs.concat(sObj.image_url)
      for id in rIDs
        if sockets.hasOwnProperty(id)
          for socket in sockets[id]['client']
            if bool
              socket.emit 'incoming_mesage', convo_members, sObj, true
            else
              socket.emit 'incoming_mesage', convo_members, sObj, false

    ## listen for messages from clients
    client.on 'message', (message)->
      ## stringifies message object from sender for storage in redis
      json_message = JSON.stringify(message)
      member_array = message.recipients.concat(message.sender)
      console.log("this is the member_array", member_array)
      ## create and execute redis task that refreshes the user/conversation set and the conversation list
      redisClient.multi([
        ['sadd', message.sender.image_url, JSON.stringify(member_array)],
        ['expire', message.sender.image_url, 16070400],
        ['rpush', message.convo_key, json_message],
        ['ltrim', message.convo_key, -199, -1],
        ['expire', message.convo_key, 604800]
        ]).exec (err, replies) ->
          if err then console.log err else console.log replies
      for recipent in message.recipients
        if sockets.hasOwnProperty(recipent.image_url)
          for socket in sockets[recipent.image_url]['client']
            socket.emit 'message', message
        else
          client.emit 'user_offline'

    ## listen for disconnection from socket i.e. close browser or tab
    client.on 'disconnect', ->
      if sockets[image_url]['client'].length < 2
        client.broadcast.emit 'user.logged_off', display_name, image_url

        ## remove user from logged on since all windows and tabs are closed
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





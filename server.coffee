
###################################
###  NODE SERVER FOR PARLEY.JS  ###
###################################


express = require 'express'
redis = require 'redis'
app = express()
io = require('socket.io').listen(app.listen(process.env.PORT || 5000))
stream = require 'socket.io-stream'
loggedON = []
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
app.use(express.static("#{__dirname}/src"))

## single route to test html page
app.get '/', (req, res) ->
  res.sendfile "#{__dirname}/test.html"


################################
###    SOCKET.IO CALLBACKS   ###
################################



open_chat_callback = (rIDs, sID) ->
  conversation_key = rIDs.concat(sID).sort().join('')
  redisClient.lrange conversation_key, 0, -1, (err, messages) ->
    if err then console.log "ERROR: #{err}" else client.emit 'previous_chat', messages

user_typing_callback = (rIDs, sObj, bool) ->
  convo_members = rIDs.concat(sObj.image_url)
  for id in rIDs
    if sockets.hasOwnProperty(id)
      for socket in sockets[id]['client']
        if bool
          socket.emit 'incoming_mesage', convo_members, sObj, true
        else
          socket.emit 'incoming_mesage', convo_members, sObj, false

message_callback = (msg, rIDs, sID) ->
  convo_members = rIDs.concat(sID)
  convo_key = convo_members.sort().join('')
  value_string = "#{sID}***#{msg}"
  redisClient.multi([
    ['rpush', convo_key, value_string],
    ['ltrim', convo_key, -199, -1],
    ['expire', convo_key, 604800]
    ]).exec (err, replies) ->
      if err then console.log err else console.log replies
  for id in rIDs
    if sockets.hasOwnProperty(id)
      for socket in socket[id]['client']
        socket.emit 'message', {msg: msg, sender: sID}
    else
      client.emit 'user_offline'

disconnect_callback = ->
  if sockets[image_url]['client'].length < 2
    client.broadcast.emit 'user.logged_off', display_name, image_url

    ## remove user from logged on since all windows and tabs are closed
    for user in loggedON
      if user.image_url is image_url
        loggedON.splice(i,1)
  for socket in sockets[image_url]['client']
    if socket is client
      sockets[image_url]['client'].splice(i,1)
  ## if there are no remaining sockets/tabs/windows open for a user
  ## delete their property object in the sockets object
  if sockets[image_url]['client'].length is 0
    delete sockets[image_url]

join_callback = (display_name, image_url) ->
  ## make sure the user isn't already logged in
  loggedIN = false
  for user in loggedON
    if image_url is user['image_url']
      loggedIN = true

  ## if not previously logged in push to array of online users
  ## and add to sockets object to keep track of client's socket
  if not loggedIN
    sockets[image_url] = { display_name: display_name, client: [client] }
    loggedON.push({ display_name: display_name, image_url: image_url })
    client.broadcast.emit 'user_logged_on', display_name, image_url
  else
    ## if client is already logged on for instance opening a new window or tab
    sockets[image_url]['client'] = sockets[image_url]['client'].concat(client)

  ## let all clients know a new user is logged on and send client info
  client.emit 'current_users', loggedON

  ## listen for open chat windows
  client.on 'open_chat', open_chat_callback

  ## listen for type_notifications
  client.on 'user_typing', user_typing_callback

  ## listen for messages from clients
  client.on 'message', message_callback

  ## listen for disconnection from socket i.e. close browser or tab
  client.on 'disconnect', disconnect_callback

connection_callback = (client) ->
  client.on 'join', join_callback




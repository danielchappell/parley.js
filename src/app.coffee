object = {}
module.exports = object
Conversation = require('./conversation_model.coffee')
User = require('./user_model.coffee')


###############################################
###   PARLEY.JS CHAT LIBRARY EXTRODINAIRE   ###
###############################################


## this is the contructor for the global object that when initialized
## executes all neccesary operations to get this train moving.
class App

  constructor: ->
    @current_users = []
    @open_conversations = []
    @conversations = []

    ## insert script for socket.io connections
    do ->
      script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = true
      script.src = "/socket.io/socket.io.js"
      s = document.getElementsByTagName('script')[0]
      s.parentNode.insertBefore(script, s)

    ## insert script for google plus signin
    do ->
      po = document.createElement('script')
      po.type = 'text/javascript'
      po.async = true
      po.src = 'https://apis.google.com/js/client:plusone.js'
      s = document.getElementsByTagName('script')[0]
      s.parentNode.insertBefore(po, s)

    ## listen for persistent conversations from the server on load.
    ## will be sent in one at a time from redis on load.
    @server.on 'persistent_convo', @load_persistent_convo

    ## listens for current users array from server
    @server.on 'current_users', @load_current_users
    @server.on 'user_logged_on', @user_logged_on
    @server.on 'user_logged_off', @user_logged_off

  server: io.connect('wss://' + window.location.hostname)


  load_persistent_convo: (convo_key, messages) ->
    ## takes convo_key and converts to convo_partners for conversation creation
    convo_members = convo_key.split(',')
    for id in convo_members
      if id isnt @app.me.image_url
        convo_partners += id

    ## create new conversation object from persistent conversation info
    convo = new Conversation(convo_partners, messages)
    @conversations.push(convo)



  load_current_users: (logged_on) ->
    ## recieves current users from server on login
    @current_users = logged_on
    for user in @current_users
      if user.image_url is @me.image_url
        @current_users.splice(i,1)

  user_logged_on: (display_name, image_url) ->
    user = new User(display_name, image_url)
    @current_users.push(user)

  user_logged_off: (display_name, image_url) ->
    for user in @current_users
      if image_url is user.image_url
        @current_users.splice( i, 1)


## SATISFIES CIRCULAR DEPENDANCY FOR BROWSERIFY BUNDLING
parley = new App()

module.exports = parley

## LOAD COMMANDCENTER AND OAUTH TO START APP
oauth = require('./oauth.coffee')
command_center = require('./command_center_view.coffee')
App.prototype.command_center = command_center
App.prototype.oauth = oauth

console.log(parley)





object = {}
module.exports = object


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

    ## dummy object used for pub/sub
    @pub_sub = $({})

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

    ## for setting and clearing browser tab alerts
    @title_notification =
                      notified: false
                      page_title: $('html title').html()
    ## listen for persistent conversations from the server on load.
    ## will be sent in one at a time from redis on load.
    @server.on 'persistent_convo', @load_persistent_convo.bind(this)
    ## listens for messages send to closed conversations or new conversations
    @server.on 'message', @update_persistent_convos.bind(this)

    ## listens for current users array from server
    @server.on 'current_users', @load_current_users.bind(this)
    @server.on 'user_logged_on', @user_logged_on.bind(this)
    @server.on 'user_logged_off', @user_logged_off.bind(this)

  server: io.connect('wss://' + window.location.hostname)


  load_persistent_convo: (convo_partners, messages) ->
    parsed_messages = []
    parsed_convo_partners = []
    for partner in convo_partners
      new_partner = new User(partner.display_name, partner.image_url)
      parsed_convo_partners.push(new_partner)
    for message in messages
      parsed = JSON.parse(message)
      new_message = new Message(parsed.recipients, parsed.sender, parsed.content, parsed.image, parsed.time_stamp)
      parsed_messages.push(new_message)

    ## create new conversation object from persistent conversation info
    convo = new Conversation(parsed_convo_partners, parsed_messages)
    @conversations.push(convo)

  update_persistent_convos: (message) ->
    console.log("i hear you click")
    ## only update if convo doesn't exist or is not currently open
    for open_convo in @open_conversations
      if message.convo_id is open_convo
        return
    console.log('i know the convo isnt open')
    ## find if convo exists
    for convo in @conversations
      if convo.message_filter is message.convo_id
        corres_convo = convo

    new_message = new Message(message.recipients, message.sender, message.content, message.image, message.time_stamp)
    ## if convo exists
    if corres_convo
      corres_convo.add_message(new_message)
    else
      ## logic to extract info from message to create new convo
      convo_members_ids = new_message.convo_id.split(',')
      convo_partner_ids = []
      ## remove self from array to construct convo partners
      for user_id in convo_members_ids
        if user_id isnt @me.image_url
          convo_partner_ids.push(user_id)

      ## use ids to grab full objects for convo partners
      convo_partners = []
      for user_id in convo_partner_ids
        for online_user in @current_users
          if user_id is online_user.image_url
            convo_partners.push(online_user)

      ## create new convo and add message
      new_convo = new Conversation(convo_partners)
      @conversations.push(new_convo)
      new_convo.add_message(new_message)
      @pub_sub.trigger('new_convo', new_convo)

  load_current_users: (logged_on) ->
    ## recieves current users from server on login
    for user in logged_on
      new_user = new User(user.display_name, user.image_url)
      @current_users.push(new_user)
    users_sans_me = []
    for user in @current_users
      if user.image_url isnt @me.image_url
        users_sans_me.push(user)
    @current_users = users_sans_me

  user_logged_on: (display_name, image_url) ->
    user = new User(display_name, image_url)
    @current_users.push(user)
    @pub_sub.trigger('user_logged_on', user)
  user_logged_off: (display_name, image_url) ->
    new_online_users = []
    for user in @current_users
      if image_url isnt user.image_url
        new_online_users.push(user)
      else
        @pub_sub.trigger('user_logged_off', user)
    @current_users = new_online_users


## SATISFIES CIRCULAR DEPENDANCY FOR BROWSERIFY BUNDLING
parley = new App()

module.exports = parley

## LOAD COMMANDCENTER AND OAUTH TO START APP
oauth = require('./oauth.coffee')
command_center = require('./command_center_view.coffee')
Conversation = require('./conversation_model.coffee')
User = require('./user_model.coffee')
Message = require('./message_model.coffee')
App.prototype.command_center = command_center
App.prototype.oauth = oauth





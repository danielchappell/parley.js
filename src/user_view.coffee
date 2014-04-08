# $ = require('jquery')
app = require('./app.coffee')
ChatRoom = require('./chat_room_view.coffee')
Conversation = require('./conversation_model.coffee')
current_user_template = require('./templates/current_user.hbs')

## This is the constructor for each list itemcorresponding to logged
## on users displayed in the logged on users list on both
## command center and chat window views.
class UserView

  constructor: (@current_user, @chat_room) ->
    @$element.on 'click', @user_interact_callback

  render: ->
    @$element = $(current_user_template(@current_user))

  user_interact_callback: ->
    ## if interaction is in the command center open a new convo
    if @$element.parent()[0].hasClass('controller-view')
      @open_conversation()
    else
      ## add user to current convo/ make group convo
      @chat_room.add_member(@current_user)

  open_conversation: ->
    ## check to make sure convo isn't already open
    convo_key = [app.me.image_url, @current_user.image_url].sort().join()
    for convo in app.open_conversations
      if convo_key is convo.message_filter
        return
    ## check to see if persistent convo exists with the user
    convo_exists = false
    for convo in app.conversations
      if convo.message_filter is convo_key
        convo_exists = true
    if convo_exists
      chat_window = new ChatRoom(convo)
      app.open_conversations.push(convo_key)
    else
      conversation = new Conversation([@current_user])
      chat_window = new ChatRoom(conversation)
      app.conversations.push(conversation)
      app.open_conversations.push(convo_key)

module.exports = UserView
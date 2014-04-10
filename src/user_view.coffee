
app = require('./app.coffee')
ChatRoom = require('./chat_room_view.coffee')
Conversation = require('./conversation_model.coffee')
current_user_template = require('./templates/current_user.hbs')

## This is the constructor for each list itemcorresponding to logged
## on users displayed in the logged on users list on both
## command center and chat window views.
class UserView

  constructor: (@current_user, @chat_room) ->
    @$element = $("<li class='user'></li>")
    @$element.on 'click', @user_interact_callback.bind(this)

  render: ->
    @$element.html(current_user_template(@current_user))

  user_interact_callback: ->
    console.log('got the click')
    ## if interaction is in the command center open a new convo
    if @$element.parent().hasClass('controller-view')
      console.log('Im here!')
      @open_conversation()
    else
      console.log('what is happening?')
      ## add user to current convo/ make group convo
      @chat_room.add_member(@current_user)

  open_conversation: ->
    console.log(app.open_conversations)
    ## check to make sure convo isn't already open
    convo_id = [app.me.image_url, @current_user.image_url].sort().join()
    for convo in app.open_conversations
      if convo_id is convo.message_filter
        return
    ## check to see if persistent convo exists with the user
    convo_exists = false
    for convo in app.conversations
      if convo.message_filter is convo_id
        convo_exists = true
        convo = convo
    if convo_exists
      chat_window = new ChatRoom(convo)
      app.open_conversations.push(convo_id)
    else
      conversation = new Conversation([@current_user])
      chat_window = new ChatRoom(conversation)
      app.conversations.push(conversation)
      app.open_conversations.push(convo_id)

module.exports = UserView
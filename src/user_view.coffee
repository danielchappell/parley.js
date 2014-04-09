
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
    console.log(@$element)
    @$element.on 'click', @user_interact_callback.bind(this)

  render: ->
    @$element.html(current_user_template(@current_user))
    console.log(@$element)

  user_interact_callback: ->
    console.log(@$element)
    console.log(this)
    ## if interaction is in the command center open a new convo
    console.log(@$element.parent())
    if @$element.parent().hasClass('controller-view')
      @open_conversation()
    else
      console.log('chatwindowview!!!')
      ## add user to current convo/ make group convo
      @chat_room.add_member(@current_user)

  open_conversation: ->
    console.log(app)
    console.log(@current_user)
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
        convo = convo
    if convo_exists
      chat_window = new ChatRoom(convo)
      app.open_conversations.push(convo_key)
    else
      conversation = new Conversation([@current_user])
      chat_window = new ChatRoom(conversation)
      app.conversations.push(conversation)
      app.open_conversations.push(convo_key)
      console.log("here!!!")

module.exports = UserView
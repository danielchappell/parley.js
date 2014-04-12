
app = require('./app.coffee')
ChatRoom = require('./chat_room_view.coffee')
Conversation = require('./conversation_model.coffee')
current_user_template = require('./templates/current_user.hbs')

## This is the constructor for each list itemcorresponding to logged
## on users displayed in the logged on users list on both
## command center and chat window views.
class UserView

  constructor: (@current_user, @current_view) ->
    @$element = $("<li class='user'></li>")
    @$element.on 'click', @user_interact_callback.bind(this)

  render: ->
    @$element.html(current_user_template(@current_user))

  user_interact_callback: ->
    ## add/remove user in new convo build params located in both cmd center and chat windows.
      if @$element.hasClass('user-selected')
        new_params = []
        for user in @current_view.new_convo_params
          if user.image_url isnt @current_user.image_url
            new_params.push(user)
        @current_view.new_convo_params = new_params
        @$element.removeClass('user-selected')
      else
        @current_view.new_convo_params.push(@current_user)
        @$element.addClass('user-selected')
      ## handle confirm button DOM class stying and adding/removing listener
      console.log(@current_view.new_convo_params)

      if @current_view.new_convo_params.length > 0
        @current_view.$element.find('.confirm').removeClass('disabled')
        .on 'click', @current_view.confirm_new_convo_params.bind(@current_view)
      else
        @current_view.$element.find('.confirm').addClass('disabled').off()

  # open_conversation: ->
  #   ## check to make sure convo isn't already open
  #   convo_key_array = [app.me.image_url].concat(@current_user.image_url)
  #   convo_id = convo_key_array.sort().join()
  #   for convo in app.open_conversations
  #     if convo_id is convo
  #       return
  #   ## check to see if persistent convo exists with the user
  #   convo_exists = false
  #   for convo in app.conversations
  #     if convo.message_filter is convo_id
  #       convo_exists = true
  #       convo = convo
  #   if convo_exists
  #     chat_window = new ChatRoom(convo)
  #     app.open_conversations.push(convo_id)
  #   else
  #     conversation = new Conversation([@current_user])
  #     chat_window = new ChatRoom(conversation)
  #     app.conversations.push(conversation)
  #     app.open_conversations.push(convo_id)

module.exports = UserView
app = require('./app.coffee')
Message = require('./message_model.coffee')
MessageView = require('./message_view.coffee')
Conversation = require('./conversation_model.coffee')
chat_room_template = require('./templates/chat_room.hbs')
Handlebars = require('hbsfy/runtime')
Handlebars.registerHelper 'title_bar_function', ->
  if @convo_partners.length < 2
    return @convo_partners[0].display_name
  else
  return @first_name_list



## constructor for object containing template and user
## interaction logic for each open chat window.
## watches a conversation model.
class ChatRoom

  constructor: (@convo) ->
    @render()
    $('body').append(@$element)
    ## create and append hidden div for message input resizing
    @$mirror_div = $("<div class='mirrordiv'></div>")
    @$element.find('section.conversation').append @$mirror_div
    @hidden_div_height = @$element.find('.mirrordiv').css('height')

    ## create variable for fileupload to add and remove
    @$file_upload = @$element.find('label.img_upload')

    @loadPersistentMessages()
    ## WEBSOCKET LISTENERS FOR MESSAGE AND TYPING NOTIFICATIONS
    app.server.on 'message', @message_callback.bind(this)
    app.server.on 'user_offline', @user_offline_callback.bind(this)
    app.server.on 'typing_notification', @typing_notification_callback.bind(this)

    ## LISTENERS FOR USER INTERACTION WITH CHAT WINDOW
    @$element.find('.chat-close').on 'click', @closeWindow.bind(this)
    @$element.find('.send').on 'keypress', @sendOnEnter.bind(this)
    @$element.find('.send').on 'keyup', @emitTypingNotification.bind(this)
    @$element.find('.send').on 'keyup', @grow_message_field.bind(this)
    @$element.find('.send').on 'keyup', @toggle_file_upload_button.bind(this)
    @$element.find('.top-bar, minify ').on 'click', @toggleChat.bind(this)
    @$element.on 'click', @removeNotifications.bind(this)
    @$file_upload.on 'change', @file_upload.bind(this)
    app.title_notification =
                        notified: false
                        page_title: $('html title').html()
  message_callback: (message) ->
    if @convo.message_filter is message.convo_id
      new_message = new Message(message.recipients, message.sender, message.content, message.image, message.time_stamp)
      @convo.add_message(new_message)
      @renderDiscussion()
      @$element.find('.top-bar').addClass('new-message')
      @titleAlert()

  user_offline_callback: ->
    message = new Message( app.me, {image_url:'http://storage.googleapis.com/parley-assets/server_network.png'}, "This user is no longer online", false, new Date() )
    @convo.add_message(message)
    @renderDiscussion()

  typing_notification_callback: (convo_id, typist, bool) ->
    if convo_id is @convo.message_filter
      if bool
        if @$discussion.find('.incoming').length is 0
          typing_notification = "<li class='incoming'><div class='avatar'><img src='#{typist.image_url}'/></div><div class='messages'><p>#{typist.display_name} is typing...</p></div></li>"
          @$discussion.append(typing_notification)
          @scrollToLastMessage()
      else
        @$discussion.find('.incoming').remove()
        @scrollToLastMessage()


  add_member: (new_user) ->
    ## create a conversation consisting of current plus added members
    new_convo_partners = @convo.convo_partners.concat(new_user)
    new_convo_group = new Conversation(new_convo_partners)
    app.conversations.push(new_convo_group)

    ## remove current convo_key from app.open_conversations
    for open_convo in app.open_conversations
      if open_convo is @convo.message_filter
        app.open_conversations.splice(i,1)

    ## push new convo to open conversations, change @convo and re-render
    app.open_conversations.push(new_convo_group.message_filter)
    @convo = new_convo_group
    @render()

  render: ->
    @$element = $(chat_room_template(@convo))
    @$discussion = @$element.find('.discussion')

  renderDiscussion: ->
    new_message = @convo.messages.slice(-1)[0]
    @appendMessage(new_message)
    @scrollToLastMessage()

  appendMessage: (message)->
    message_view = new MessageView(message)
    message_view.render()
    @$discussion.append(message_view.$element)

  scrollToLastMessage: ->
    @$discussion.scrollTop( @$discussion.find('li:last-child').offset().top + @$discussion.scrollTop() )

  loadPersistentMessages: ->
    for message in @convo.messages
      @appendMessage(message)
    if @convo.messages.length > 0
      @scrollToLastMessage()

  sendOnEnter: (e)->
    if e.keyCode is 13
      @sendMessage()
      @removeNotifications()

  sendMessage: ->
    message = new Message @convo.convo_partners, app.me, @$element.find('.send').val()
    @convo.add_message(message)
    @renderDiscussion()
    app.server.emit 'message', message
    @$element.find('.send').val('')
    @emitTypingNotification()

  toggleChat: (e) ->
    e.preventDefault()
    @$discussion.toggle()
    if @$discussion.attr('display') is not "none"
      @scrollToLastMessage

  closeWindow: (e) ->
    e.preventDefault()
    e.stopPropagation()
    ## remove from open convos
    for open_convo, i in app.open_conversations
      if open_convo is @convo.message_filter
        app.open_conversations.splice(i,1)

    ## remove all websocket listeners for garbage collection
    ## remove chat from DOM
    app.server.removeListener 'message', @message_callback.bind(this)
    app.server.removeListener 'user_offline', @user_offline_callback.bind(this)
    app.server.removeListener 'typing_notification', @typing_notification_callback.bind(this)
    @$element.find('.chat-close').off()
    @$element.find('.send').off()
    @$element.find('.send').off()
    @$element.find('.top-bar').off()
    @$element.off()
    @$discussion.off()
    @$element.remove()
    delete this

  removeNotifications: (e) ->
    @$element.find('.top-bar').removeClass('new-message')
    if app.title_notification.notified
      @clearTitleNotification()

  emitTypingNotification: (e) ->
    if @$element.find('.send').val() isnt ""
      app.server.emit 'user_typing', @convo.convo_partners_image_urls, app.me, true
    else
      app.server.emit 'user_typing', @convo.convo_partners_image_urls, app.me, false

  clearTitleNotification: ->
    app.clearAlert()
    $('html title').html( app.title_notification.page_title )
    app.title_notification.notified = false

  titleAlert: ->
    if not app.title_notification.notified
      sender_name = @convo.messages[@convo.messages.length - 1].sender.display_name
      alert = "Pending ** #{sender_name}"

      setAlert = ->
        if $('html title').html() is app.title_notification.page_title
          $('html title').html(alert)
        else
          $('html title').html( app.title_notification.page_title)

      title_alert = setInterval(setAlert, 2200)

      app.clear_alert = ->
        clearInterval(title_alert)

      app.title_notification.notified = true

  file_upload: ->
    file = @$element.find('.parley_file_upload').get(0).files[0]
    app.oauth.file_upload file, @convo.convo_partners, @convo.message_filter

  grow_message_field: ->
    $txt = @$element.find('textarea.send')
    content = $txt.val()
    adjusted_content = content.replace(/\n/g, "<br>")
    @$mirror_div.html(adjusted_content)
    @hidden_div_height = @$mirror_div.css('height')
    if @hidden_div_height isnt $txt.css('height')
      $txt.css('height', @hidden_div_height)


  toggle_file_upload_button: ->
    ## remove icon for file upload
    if @$element.find('textarea.send').val() isnt ""
      if @$element.find('label.img_upload').length is 1
        @$element.find('label.img_upload').remove()
    else
      if @$element.find('label.img_upload').length is 0
        @$element.find('section.conversation').append(@$file_upload)
        @$file_upload.on 'change', @file_upload.bind(this)




module.exports = ChatRoom

$ = require('jquery')
app = require('./app.coffee')
Message = require('./message_model.coffee')
MessageView = require('./message_view.coffee')
Conversation = require('./conversation_model.coffee')




## constructor for object containing template and user
## interaction logic for each open chat window.
## watches a conversation model.
class ChatRoom

  constructor: (@convo) ->
    @render()
    $('body').append(@$element)

    ## WEBSOCKET LISTENERS FOR MESSAGE AND TYPING NOTIFICATIONS
    app.server.on 'message', @message_callback
    app.server.on 'user_offline', @user_offline_callback
    app.server.on 'typing_notification', @typing_notification_callback

    ## LISTENERS FOR USER INTERACTION WITH CHAT WINDOW
    @$element.find('.chat-close').on 'click', @closeWindow
    @$element.find('.send').on 'keypress', @sendOnEnter
    @$element.find('.send').on 'keyup', @emitTypingNotification
    @$element.find('.top-bar').on 'click', @toggleChat
    @$element.on 'click', @removeNotifications
    @$discussion.find('.parley_file_upload').on 'change', @file_upload


  chat_room_template: Handlebars.compile('
    <div class="parley">
      <section class="conversation">
        <div class="top-bar">
          <a>{{first_name}}</a>
          <ul class="message-alt">
            <li class="entypo-minus"></li>
            <li class="entypo-resize-full"></li>
            <li class="entypo-cancel"></li>
          </ul>
        </div>
        <div class="message-bar">
          <ul class="additional">
            <li><a class="entypo-user-add"></a></li>
            <li><a class="fontawesome-facetime-video"></a></li>
          </ul>
          <ul class="existing">
            <li><a class="entypo-chat"></a></li>
          </ul>
        </div>
        <ol class="discussion"></ol>
        <textarea class="grw" placeholder="Enter Message..."></textarea>
        <span class="entypo-camera img_upload"></span>
      </section>
    </div>
    ')

  message_callback: (message) ->
      @convo.add_message(message)
      @renderDiscussion()
      @$element.find('.top-bar').addClass('new-message')
      @titleAlert()

  user_offline_callback: ->
    message = new Message( app.me, 'http://storage.googleapis.com/parley-assets/server_network.png', "This user is no longer online", new Date() )
    @convo.add_message(message)
    @renderDiscussion()

  typing_notification_callback: (convo_key, typist, bool) ->
    if convo_key is @convo.message_filter
      if bool
        if @$discussion.find('.incoming').length is 0
          typing_notification = "<li class='incoming'><div class='avatar'><img src='#{typist.image_url}'/></div><div class='messages'><p>#{typist.display_name} is typing...</p></div></li>"
          that.$('.discussion').append(typingNotification);
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
    for convo in app.open_conversations
      if convo is @convo.message_filter
        app.open_conversations.splice(i,1)

    ## push new convo to open conversations, change @convo and re-render
    app.open_conversations.push(new_convo_group.message_filter)
    @convo = new_convo_group
    @render()

  render: ->
    @$element = $(@chat_room_template(@convo))
    @$discussion = @$element.find('.discussion')

  renderDiscussion: ->
    new_message = @convo.messages.slice(-1)[0]
    @appendMessage(new_message)
    @scrollToLastMessage()

  appendMessage: (message)->
    message_view = new MesssageView(message)
    message_view.render()
    @$discussion.append(message_view.$element)

  scrollToLastMessage: ->
    @$discussion.scrollTop( @$discussion.find('li:last-child').offset().top + @$discussion.scrollTop() )

  loadPersistentMessages: ->
    for message in @convo.messages
      @appendMessage(message)
    if @messages.length > 0
      @scrollToLastMessage()

  sendOnEnter: (e)->
    if e.keyCode is 13
      @sendMessage()
      @removeNotifications()

  sendMessage: ->
    message = new Message @convo.convo_partners, app.me, @$element.find('.send').val()
    @messages.add(send)
    @renderDiscussion()
    app.server.emit 'mesage', message
    @$discussion.find('.send').val('')
    this.emitTypingNotification()

  toggle_convo: (e) ->
    e.preventDefault()
    @$discussion.toggle()
    if @$discussion.attr('display') is not "none"
      @scrollToLastMessage

  closeWindow: (e) ->
    e.preventDefault()
    e.stopPropagation()
    app.server.removeAllListeners()
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
      sender_name = @convo.messages[-1].sender.display_name
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
    file = @$discussion.find('.picture_upload').get(0).files[0]
    app.oauth.file_upload file, @convo.convo_partners_image_urls, app.me.image_url


module.exports = ChatRoom

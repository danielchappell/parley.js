## constructor for object containing template and user
## interaction logic for each open chat window.
## watches a conversation model.

class ChatRoom

  constructor: (@convo) ->
    @render()
    $('body').append(@$element)
    @app.server.on 'message', @message_callback
    @app.server.on 'user_offline', @user_offline_callback
    @app.server.on 'typing_notification', @typing_notification_callback



  chat_room_template: Handlebars.compile('
    <div class="parley">
      <section class="conversation">
        <div class="top-bar">
          <a>{{first_name}}</a>
          <span class="fontawesome-reorder"></span>
        </div>
        <ul class="messsage-bar">
          <li>
            <a class="messages" href="#">
              <span class="fontawesome-facetime-video"></span>
            </a>
          </li>
          <li>
            <a class="active-users" href="#">
              <a class="entypo-user-add"></a>
            </a>
          </li>
        </ul>
        <ol class="discussion"></ol>
        <div class="message-input">
          <textarea class="field test" placeholder="Enter Message...">
          </textarea>
          <button class="item entypo-camera" id="bye"></button>
        </div>
      </section>
    </div>
    ')

  message_callback: (message) ->
      @convo.add_message(message)
      @renderDiscussion()
      @$element.find('.top-bar').addClass('new-message')
      @titleAlert()

  user_offline_callback: ->
    message = new Message(@app.me, 'images/server_network.png', "This user is no longer online", new Date() )
    @convo.add_message(message)
    @renderDiscussion()

  typing_notification_callback: (convo_key, typist, bool) ->
    if convo_key is @convo.message_filter
      if bool
        if @$discussion.find('.incoming').length is 0
          ##typing_notification = TYPING NOTIFICATION LAYOUT GOES HERE!!
          @$discussion.append(typing_notification)
          @scrollToLastMessage()
      else
        @$discussion.find('.incoming').remove()
        @scrollToLastMessage()




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
    message = new Message @convo.convo_partners, @app.me, @$element.find('.send').val()
    @messages.add(send)
    @renderDiscussion()
    @app.server.emit 'mesage', message
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
    @app.server.removeAllListeners()
    @$element.remove()
    delete @

  removeNotifications: (e) ->
    @$element.find('.top-bar').removeClass('new-message')
    if @app.title_notification.notified
      @clearTitleNotification()

  emitTypingNotification: (e) ->
    if @$element.find('.send').val() isnt ""
      @app.server.emit 'user_typing', @convo.convo_partners_image_urls, @app.me, true
    else
      @app.server.emit 'user_typing', @convo.convo_partners_image_urls, @app.me, false

  clearTitleNotification: ->
    @app.clearAlert()
    $('html title').html( @app.title_notification.page_title )
    @app.title_notification.notified = false

  titleAlert: ->
    if not @app.title_notification.notified
      sender_name = @convo.messages[-1].sender.display_name
      alert = "Pending ** #{sender_name}"

      setAlert = ->
        if $('html title').html() is @app.title_notification.page_title
          $('html title').html(alert)
        else
          $('html title').html( @app.title_notification.page_title)

      title_alert = setInterval(setAlert, 2200)

      @app.clear_alert = ->
        clearInterval(title_alert)

      @app.title_notification.notified = true

  file_upload: ->
    file = @$discussion.find('.picture_upload').get(0).files[0]
    @app.oauth.file_upload file, @convo.convo_partners_image_urls, @app.me.image_url



Parley.onInit( (app)->
  ChatRoom.prototype.app = app
)




app = require('./app.coffee')
Handlebars = require('handlebars')
persistent_convo_template = require('./templates/persistent_convo_reg.hbs')
Handlebars = require('hbsfy/runtime')

## HANDLEBARS HELPER FUNCTIONS FOR PERSISTENT MESSAGE TEMPLATE
Handlebars.registerHelper 'format_image', ->
  if @convo_partners.length < 2
   new Handlebars.SafeString("<img src='" + @convo_partners_image_urls[0] + "'>")
  else
    image_urls = ""
    for image in @convo_partners_image_urls
      image_urls = image_urls.concat("<img src='" + image + "'>")
    new Handlebars.SafeString(image_urls)

Handlebars.registerHelper 'format_display_name', ->
  if @convo_partners.length < 2
    @convo_partners[0].display_name
  else
    @first_name_list

Handlebars.registerHelper 'retrieve_last_message', ->
  last_message = @messages[@messages.length - 1]
  if last_message.image
    file_name = last_message.content.replace(/^(https\:\/\/storage\.cloud\.google\.com\/parley-images\/)(.+)/, "$2")
    return "IMAGE MESSAGE: #{file_name}"
  else
    trunc_message = last_message.content.slice(0, 25)
    return "#{trunc_message}... "

Handlebars.registerHelper 'calculate_last_message_time', ->
  this.messages[this.messages.length - 1].calculate_time()

## This is the constructor for each persistent message in the list view
## it contains the template andlogic for rendering the list that appears in
## both the chat window and command center views and the corresponding user interaction logic.
class PersistentConversationView

  constructor: (@convo, @current_view) ->
    @$element = $('<div class="message existing"></div>')
    if @convo.notify
      console.log('notified!!')
      @$element.addClass('notify')

    ##pub/sub bindings for dynamic DOM updating
    @convo.pub_sub.on "convo_new_message", @sync_convo_new_message.bind(this)


  render: ->
    @$element.html(persistent_convo_template(@convo))
    @$element.on 'click', @load_convo.bind(this)

  remove: ->
    @convo.pub_sub.off()


  load_convo: ->
    ## if convo isn't open load new chat window with convo
    convo_status = 'closed'
    for open_convo in app.open_conversations
      if @convo.message_filter is open_convo
        convo_status = 'open'

    if @current_view instanceof ChatRoom

      if convo_status isnt 'open' or @convo.message_filter is @current_view.convo.message_filter

        ## remove current conversation from open conversation
        if @convo.notify
          @convo.notify = false
          @$element.removeClass('notify')
        new_open_convos = []
        for open_convo in app.open_conversations
          if open_convo isnt @current_view.convo.message_filter
            new_open_convos.push(convo)
        app.open_conversations = new_open_convos

        @current_view.convo = @convo
        app.open_conversations.push(@convo.message_filter)
        @current_view.render()
        @current_view.loadPersistentMessages()
        @current_view.switchmode = false

    else
      if convo_status isnt 'open'
        # if convo_status isnt 'open'
        chat_window = new ChatRoom(@convo)
        app.open_conversations.push(@convo.message_filter)

  sync_convo_new_message: ->
    console.log("sync new message")

    @$element.remove()
    @render()
    if @current_view instanceof ChatRoom
      @current_view.$discussion.prepend(@$element)
    else
      $('.parley div.controller-view').prepend(@$element)

module.exports = PersistentConversationView

ChatRoom = require('./chat_room_view.coffee')
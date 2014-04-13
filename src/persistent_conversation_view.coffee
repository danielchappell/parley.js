app = require('./app.coffee')
Handlebars = require('handlebars')
persistent_convo_reg = require('./templates/persistent_convo_reg.hbs')
Handlebars = require('hbsfy/runtime')

## HANDLEBARS HELPER FUNCTIONS FOR PERSISTENT MESSAGE TEMPLATE
Handlebars.registerHelper 'retrieve_image', ->
  @convo_partners_image_urls[0]
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
    @$element.on 'click', @load_convo.bind(this)

  render: ->
    @$element.html(persistent_convo_reg(@convo))


  load_convo: ->
    ## if convo isn't open load new chat window with convo
    convo_status = 'closed'
    for open_convo in app.open_conversations
      if @convo.message_filter is open_convo
        convo_status = 'open'

    if convo_status isnt 'open' or @convo.message_filter is @current_view.convo.message_filter

      if @current_view instanceof ChatRoom

        ## remove current conversation from open conversation
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
        # if convo_status isnt 'open'
          chat_window = new ChatRoom(@convo)
          app.open_conversations.push(@convo.message_filter)

module.exports = PersistentConversationView

ChatRoom = require('./chat_room_view.coffee')
app = require('./app.coffee')
ChatRoom = require('./chat_room_view.coffee')
Handlebars = require('handlebars')
persistent_convo_reg = require('./templates/persistent_convo_reg.hbs')
Handlebars = require('hbsfy/runtime')

## HANDLEBARS HELPER FUNCTIONS FOR PERSISTENT MESSAGE TEMPLATE
Handlebars.registerHelper 'retrieve_image', ->
  console.log(@convo_partners_image_urls)
  @convo_partners_image_urls[0]
Handlebars.registerHelper 'retrieve_last_message', ->
  this.messages[this.messages.length - 1].content
Handlebars.registerHelper 'calculate_last_message_time', ->
  this.messages[this.messages.length - 1].calculate_time()

## This is the constructor for each persistent message in the list view
## it contains the template andlogic for rendering the list that appears in
## both the chat window and command center views and the corresponding user interaction logic.
class PersistentConversationView

  constructor: (@convo) ->
    @$element = $('<div class="message existing"></div>')
    @$element.on 'click', @load_convo.bind(this)

  render: ->
    @$element.html(persistent_convo_reg(@convo))


  load_convo: ->
    ## if convo isn't open load new chat window with convo
    convo_status = 'closed'
    for convo in app.open_conversations
      if @convo.message_filter is convo.message_filter
        convo_status = 'open'

    if convo_status isnt 'open'
      chat_window = new ChatRoom(@convo)
      app.open_conversations.push(@convo.message_filter)

      ## check and see if action is in command center or chat window
      if not @$element.parent()[0].hasClass('controller-view')
        @$element.parents('div.parley').remove()

module.exports = PersistentConversationView
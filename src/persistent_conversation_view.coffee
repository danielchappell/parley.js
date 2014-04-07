$ = require('jquery')
app = require('./app.coffee')
ChatRoom = require('./chat_room_view.coffee')

## This is the constructor for each persistent message in the list view
## it contains the template andlogic for rendering the list that appears in
## both the chat window and command center views and the corresponding user interaction logic.
class PersistentConversationView

  constructor: (@convo) ->
    @$element.on 'click', @load_convo

    persistent_convo_template_reg: Handlebars.compile('
      <div class="message existing">
        <div class="avatar">
          <img src={{convo_partners[0].image_url}} />
        </div>
        <div class="content status entypo-right-open-big">
          <h2>{{convo_partner.display_name}}</h2>
          <p>{{messages[-1].content}}</p>
          <a class="time">
            <span class="entypo-clock"> {{messages[-1].time_elapsed()}}</span>
          </a>
        </div>
      </div>
      ')

    render: ->
      @$element = @persistent_convo_template_reg(@convo)


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
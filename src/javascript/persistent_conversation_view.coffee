## This is the constructor for each persistent message in the list view
## it contains the template andlogic for rendering the list that appears in
## both the chat window and command center views and the corresponding user interaction logic.

class PersistentConversationView

  constructor: (@convo) ->


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
      @persistent_message_template_reg(@convo)


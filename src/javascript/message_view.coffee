## constructor for object that contains template data
## and interaction logic for individual message models

class MessageView

  constructor: (@message) ->


  message_template: Handlebars.compile('

      <div class="avatar">
        <img src="{{sender.image_url}}"/>
      <div class="message status">
        <h2>{{sender.display_name}}</h2>
        <p>{{content}}</p>
        <a class="time">
          <span class="entypo-clock">{{time_elapsed()}}</span>
        </a>
      </div>
    ')

  render: ->
    ## renders template differently if user is sending or recieving the message
    if @message.sender.image_url is @app.me.image_url
      @$element = $('<li class="self"></li>').append(message_template(@message))
    else
      @$element = $('<li class="other"></li>').append(message_template(@message))

Parley.onInit( (app) ->
  MessageView.prototype.app = app
  )
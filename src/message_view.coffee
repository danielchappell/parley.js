
app = require('./app.coffee')
message_template = require('./templates/message.hbs')
Handlebars = require('hbsfy/runtime')
## HANDLEBAR HELPER FUNCTION FOR CALCULATING TIME SINCE MESSAGE CREATION
# Handlebars.registerHelper 'calculate_time', ->
#   this.time_elapsed()

## constructor for object that contains template data
## and interaction logic for individual message models
class MessageView

  constructor: (@message) ->


  render: ->
    ## renders template differently if user is sending or recieving the message
    if @message.sender.image_url is app.me.image_url
      @$element = $('<li class="self"></li>').append(message_template(@message))
    else
      @$element = $('<li class="other"></li>').append(message_template(@message))

module.exports = MessageView
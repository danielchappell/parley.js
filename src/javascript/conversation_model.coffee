## constructor for conversations objects that represent all relevant
## data and logic pertaining to managing a conversation
## including a collection of message objects.

class ConversationModel

  constructor: (@convo_partners) ->
    @messages = []
    @message_filter = @generate_message_filter()


  add_message: (message) ->
    @messages.push message

  generate_message_filter: ->
    message_filter = [@app.me.image_url]
    for partner in @convo_partners
      message_filter.push partner.image_url
    message_filter.join('').sort()


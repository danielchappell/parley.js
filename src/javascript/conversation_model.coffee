## constructor for conversations objects that represent all relevant
## data and logic pertaining to managing a conversation
## including a collection of message objects.

class Conversation

  constructor: (@convo_partners) ->
    @messages = []
    @message_filter = @generate_message_filter()
    @first_name_list = ""
    for user in @convo_partners
      first_name = user.display_name.match(/\A.+\s/)[0]
      if i is not @convo_partners.length
        @first_name_list += "#{first_name}, "
      else
        @first_name_list += "#{first_name}"



  add_message: (message) ->
    @messages.push message

  generate_message_filter: ->
    message_filter = [@app.me.image_url]
    for partner in @convo_partners
      message_filter.push partner.image_url
    message_filter.join('').sort()


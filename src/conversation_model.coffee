app = require('./app.coffee')



## constructor for conversations objects that represent all relevant
## data and logic pertaining to managing a conversation
## including a collection of message objects.
class Conversation

  constructor: (@convo_partners, @messages=[]) ->
    @generate_message_filter()
    @first_name_list = ""
    @convo_partners_image_urls = []

    for user in @convo_partners
      first_name = user.display_name.match(/\A.+\s/)[0]
      if i isnt @convo_partners.length
        @first_name_list += "#{first_name}, "
        @convo_partners_image_urls += user.image_url
      else
        @first_name_list += "#{first_name}"
        @convo_partners_image_urls += user.image_url

  add_message: (message) ->
    @messages.push message

  generate_message_filter: ->
    @message_filter = [app.me.image_url]
    for partner in @convo_partners
      @message_filter.push partner.image_url
    @message_filter.sort().join()


module.exports = Conversation

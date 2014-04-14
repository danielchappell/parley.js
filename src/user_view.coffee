
app = require('./app.coffee')
Conversation = require('./conversation_model.coffee')
current_user_template = require('./templates/current_user.hbs')

## This is the constructor for each list itemcorresponding to logged
## on users displayed in the logged on users list on both
## command center and chat window views.
class UserView

  constructor: (@current_user, @current_view) ->
    @$element = $("<li class='user'></li>")
    @$element.on 'click', @user_interact_callback.bind(this)

    ## checks if user is already in current conversation so that user cannot be added twice.
    if @current_view.constructor.name is "ChatRoom"
      for member in @current_view.convo.convo_partners
        if member.image_url is @current_user.image_url
          @$element.addClass('disabled')
          @$element.off()


  render: ->
    @$element.html(current_user_template(@current_user))


  user_interact_callback: ->
    ## add/remove user in new convo build params located in both cmd center and chat windows.
      if @$element.hasClass('selected')
        new_params = []
        for user in @current_view.new_convo_params
          if user.image_url isnt @current_user.image_url
            new_params.push(user)
        @current_view.new_convo_params = new_params
        @$element.removeClass('selected')
      else
        @current_view.new_convo_params.push(@current_user)
        @$element.addClass('selected')
      ## handle confirm button DOM class stying and adding/removing listener

      if @current_view.new_convo_params.length > 0

        @current_view.$element.find('.confirm').removeClass('disabled').off()
        .on 'click', @current_view.confirm_new_convo_params.bind(@current_view)
      else
        @current_view.$element.find('.confirm').addClass('disabled').off()


module.exports = UserView
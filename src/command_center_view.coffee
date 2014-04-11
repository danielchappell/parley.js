app = require('./app.coffee')
UserView = require('./user_view.coffee')
PersistentConversationView = require('./persistent_conversation_view.coffee')
logged_out_template = require('./templates/logged_out.hbs')
logged_in_template = require('./templates/logged_in.hbs')
profile_template = require('./templates/profile.hbs')



# Control Panel for Parley.js
# This is the only view that cannot be removed.
# It is the hub for all interaction.
class CommandCenter
  constructor: ->
    @menu = "default"
    $('body').append logged_out_template()
    $("ul.login-bar").hide()
    $('.parley .persistent-bar.logged-out').on 'click', (e) -> $('ul.login-bar').toggle()

  log_in: ->
    @logged_in = true
    $(".parley .persistent-bar.logged_out").off()
    @$element = $(logged_in_template(app.me))
    $('.parley section.controller').html(@$element)
    $('.persistent-bar').on 'click', @toggle_command_center.bind(this)
    $('.parley div.controller-bar a.messages').on 'click', @toggle_persistent_convos.bind(this)
    $('.parley div.controller-bar a.active-users').on 'click', @toggle_current_users.bind(this)
    $('.parley div.controller-bar a.user-settings').on 'click', @toggle_user_settings.bind(this)

  toggle_command_center: (e)->
    e.preventDefault()
    $('.controller-view').toggle()
    if $('div.persistent-bar span').hasClass('entypo-down-open-mini')
      $('div.persistent-bar span').removeClass('entypo-down-open-mini')
      $('div.persistent-bar span').addClass('entypo-up-open-mini')
    else
      $('div.persistent-bar span').removeClass('entypo-up-open-mini')
      $('div.persistent-bar span').addClass('entypo-down-open-mini')



  toggle_current_users: (e)->
    e.preventDefault()
    $('.parley div.controller-view').children().remove()
    if @menu isnt "current_users"
      for user in app.current_users
        view = new UserView(user)
        view.render()
        $('.parley div.controller-view').append(view.$element)
      @menu = "current_users"
    else
      @menu = null

  toggle_persistent_convos: (e)->
    e.preventDefault()
    console.log(app.conversations)
    $(".parley div.controller-view").children().remove()
    if @menu isnt "persistent_convos"
      for convo in app.conversations
        if convo.messages.length > 0
          view = new PersistentConversationView(convo)
          view.render()
          $('.parley div.controller-view').append(view.$element)
      @menu = "persistent_convos"
    else
      @menu = null



  toggle_user_settings: (e)->
    e.preventDefault
    $('.parley div.controller-view').children().remove()
    if @menu isnt "user_settings"
      $('.parley div.controller-view').html(profile_template(app.me))
      @menu = "user_settings"
    else
      @menu = null

module.exports = new CommandCenter()


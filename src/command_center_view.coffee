app = require('./app.coffee')
UserView = require('./user_view.coffee')
PersistentConversationView = require('./persistent_conversation_view.coffee')
logged_out_template = require('./templates/logged_out.hbs')
logged_in_template = require('./templates/logged_in.hbs')




# Control Panel for Parley.js
# This is the only view that cannot be removed.
# It is the hub for all interaction.
class CommandCenter
  constructor: ->
    @menu = null
    $('body').append logged_out_template()
    $("ul.login-bar").hide()
    $('.parley .persistent-bar.logged-out').on 'click', (e) -> $('ul.login-bar').toggle()

  log_in: ->
    $(".parley .persistent-bar.logged_out").off()
    @$element = $(logged_in_template(app.me))
    $('.parley section.controller').html(@$element)
    $('.parley div.controller-bar a.messages').on('click', @toggle_persistent_convos)
    $('.parley div.controller-bar a.active_users').on('click', @toggle_current_users)
    $('.parley div.controller-bar a.user-settings').on('click', @toggle_user_settings)

  toggle_command_center: ->
    ## If a user is logged in they get a default profile view
    ## otherwise a login with google appears.
    if logged_out
      $( ".persistent-bar.logged-out" ).on "click", ->
        $( "#log-click" ).toggle()
        $( "ul.login-bar" ).slideToggle()
    else
      $ ->
        $('.persistent-bar').on 'click', ->
          $('.controller-view').toggle()

  toggle_current_users: ->
    if @menu isnt "current_users"
      $('.parley div.controller-view').children().remove()
      for user in app.current_users
        view = new UserView(user)
        $('.parley div.controller-view').append(view.render())
      @menu = "current_users"
    else
      $('.parley div.controller-view').children().remove()
      $('.parley div.controller-view').html(logged_in_template(app.me))


  toggle_persistent_convos: ->
    if @menu isnt "persistent_convos"
      $(".parley div.controller-view").children().remove()
      for convo in app.conversations
        view = new PersistentConversationView(convo)
        $('.parley div.controller-view').append(view.render())
      @menu = "persistent_convos"
    else
      $('.parley div.controller-view').children().remove()
      $('.parley div.controller-view').html(logged_in_template(app.me))


  toggle_user_settings: ->



module.exports = new CommandCenter()


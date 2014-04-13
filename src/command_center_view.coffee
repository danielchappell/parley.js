app = require('./app.coffee')
UserView = require('./user_view.coffee')
PersistentConversationView = require('./persistent_conversation_view.coffee')
logged_out_template = require('./templates/logged_out.hbs')
logged_in_template = require('./templates/logged_in.hbs')
profile_template = require('./templates/profile.hbs')
Conversation = require('./conversation_model.coffee')
ChatRoom = require('./chat_room_view.coffee')



# Control Panel for Parley.js
# This is the only view that cannot be removed.
# It is the hub for all interaction.
class CommandCenter
  constructor: ->

    ## GET THINGS GOING
    $('body').append logged_out_template()
    @menu = "default"
    @add_user_bar = '<div class="add-user-bar"><a class="cancel">Cancel</a><a class="confirm disabled">Add People</a></div>'


  log_in: ->
    @$element = $(logged_in_template(app.me))
    $('.parley section.controller').html(@$element)
    $('.controller-view').hide()
    $('.persistent-bar').on 'click', @toggle_command_center.bind(this)
    $('.parley div.controller-bar a.messages').on 'click', @toggle_persistent_convos.bind(this)
    $('.parley div.controller-bar a.active-users').on 'click', @toggle_current_users.bind(this)
    $('.parley div.controller-bar a.user-settings').on 'click', @toggle_user_settings.bind(this)

  toggle_command_center: (e)->
    e.preventDefault()
    e.stopPropagation()
    if $('div.persistent-bar span').hasClass('entypo-up-open-mini')
      @refresh_convo_creation()
      $('div.persistent-bar span').removeClass('entypo-up-open-mini')
      .addClass('entypo-down-open-mini')
    else
      $('div.persistent-bar span').removeClass('entypo-down-open-mini')
      .addClass('entypo-up-open-mini')
    $('.controller-view').toggle()



  toggle_current_users: (e)->
    e.preventDefault()
    e.stopPropagation()
    if @menu isnt "current_users"
      $('.parley div.controller-view').children().remove()
      $('.parley div.controller-view').append('<input class="search" placeholder="Start  Chat">')
      for user in app.current_users
        view = new UserView(user, this)
        view.render()
        $('.parley div.controller-view').append(view.$element)
      $('.parley div.controller-view').append(@add_user_bar)
      @$element.find('.cancel').on 'click', @refresh_convo_creation.bind(this)
      @menu = "current_users"
      @new_convo_params = []
    else
      @menu = null
      @new_convo_params = []
    $('.controller-view').show()
    if $('div.persistent-bar span').hasClass('entypo-up-open-mini')
      $('div.persistent-bar span').removeClass('entypo-up-open-mini')
      .addClass('entypo-down-open-mini')


  toggle_persistent_convos: (e)->
    e.preventDefault()
    e.stopPropagation()
    if @menu isnt "persistent_convos"
      $(".parley div.controller-view").children().remove()
      for convo in app.conversations
        if convo.messages.length > 0
          view = new PersistentConversationView(convo)
          view.render()
          $('.parley div.controller-view').append(view.$element)
      @menu = "persistent_convos"
    else
      @menu = null
    $('.controller-view').show()
    if $('div.persistent-bar span').hasClass('entypo-up-open-mini')
      $('div.persistent-bar span').removeClass('entypo-up-open-mini')
      .addClass('entypo-down-open-mini')




  toggle_user_settings: (e)->
    e.preventDefault()
    e.stopPropagation()
    if @menu isnt "user_settings"
      $('.parley div.controller-view').children().remove()
      $('.parley div.controller-view').html(profile_template(app.me))
      @menu = "user_settings"
    else
      @menu = null
    $('.controller-view').show()
    if $('div.persistent-bar span').hasClass('entypo-up-open-mini')
      $('div.persistent-bar span').removeClass('entypo-up-open-mini')
      .addClass('entypo-down-open-mini')

  confirm_new_convo_params: (e) ->
    e.preventDefault()
    e.stopPropagation()
    ## builds convo based on new convo params property
    convo_partners_image_urls = []
    for user in @new_convo_params
      convo_partners_image_urls.push(user.image_url)
    convo_id = convo_partners_image_urls.concat(app.me.image_url).sort().join()
    ## check to make sure convo isn't already open
    for convo in app.open_conversations
      if convo_id is convo
        return
    ## check to see if persistent convo exists with the group
    convo_exists = false
    for convo in app.conversations
      if convo.message_filter is convo_id
        convo_exists = true
        persistent_convo = convo
    if convo_exists
      chat_window = new ChatRoom(persistent_convo)
      app.open_conversations.push(convo_id)
      @refresh_convo_creation()
    else
      ## create new conversation with selected group members
      conversation = new Conversation(@new_convo_params)
      chat_window = new ChatRoom(conversation)
      app.conversations.push(conversation)
      app.open_conversations.push(convo_id)
      @refresh_convo_creation()

  refresh_convo_creation: (e) ->
    if e
      e.stopPropagation()
    @new_convo_params = []
    $('.parley div.controller-view').children().remove()
    $('.parley div.controller-view').append('<input class="search" placeholder="Start  Chat">')
    for user in app.current_users
      view = new UserView(user, this)
      view.render()
      $('.parley div.controller-view').append(view.$element)
    $('.parley div.controller-view').append(@add_user_bar)
    @$element.find('.cancel').on 'click', @refresh_convo_creation.bind(this)


module.exports = new CommandCenter()


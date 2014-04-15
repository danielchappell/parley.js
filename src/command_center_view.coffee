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
    @add_user_bar = '<div class="add-user-bar"><a class="cancel">Cancel</a><a class="confirm disabled">Add People</a></div>'

    ## pub_sub for command center sync
    app.pub_sub.on 'user_logged_on', @sync_user_logged_on.bind(this)
    app.pub_sub.on 'user_logged_off', @sync_user_logged_off.bind(this)
    app.pub_sub.on 'new_convo', @sync_new_convo.bind(this)

    ## variables for keeping track of views to remove listeners
    @persist_view_array = []
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
      if @menu is "persistent_convos"
        @remove_persist_convo_views()
      $('div.persistent-bar span').removeClass('entypo-down-open-mini')
      .addClass('entypo-up-open-mini')
    $('.controller-view').toggle()



  toggle_current_users: (e)->
    e.preventDefault()
    e.stopPropagation()
    if @menu isnt "current_users"
      if @menu is "persistent_convos"
        @remove_persist_convo_views()
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
          @persist_view_array.push(view)
          view.render()
          $('.parley div.controller-view').append(view.$element)
      @menu = "persistent_convos"
    $('.controller-view').show()
    if $('div.persistent-bar span').hasClass('entypo-up-open-mini')
      $('div.persistent-bar span').removeClass('entypo-up-open-mini')
      .addClass('entypo-down-open-mini')




  toggle_user_settings: (e)->
    e.preventDefault()
    e.stopPropagation()
    if @menu isnt "user_settings"
      if @menu is "persistent_convos"
        @remove_persist_convo_views()
      $('.parley div.controller-view').children().remove()
      $('.parley div.controller-view').html(profile_template(app.me))
      @menu = "user_settings"
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
    if @menu = "persistent_convos"
      @remove_persist_convo_views()
    @menu = "current_users"
    @new_convo_params = []
    $('.parley div.controller-view').children().remove()
    $('.parley div.controller-view').append('<input class="search" placeholder="Start  Chat">')
    for user in app.current_users
      view = new UserView(user, this)
      view.render()
      $('.parley div.controller-view').append(view.$element)
    $('.parley div.controller-view').append(@add_user_bar)
    @$element.find('.cancel').on 'click', @refresh_convo_creation.bind(this)

  sync_user_logged_on: (e, user, index, location) ->
    if @menu is "current_users"
      view = new UserView(user, this)
      view.render()
      if location is "first" or location is "last"
        $('.parley div.controller-view').children().eq(-1).before(view.$element)
      else
        $('.parley div.controller-view').find('li.user').eq(index).before(view.$element)

  sync_user_logged_off: (e, user, index) ->
    if @menu is "current_users"
      $('.parley div.controller-view').find('li.user').eq(index).remove()
      return

  sync_new_convo: (e, new_convo, index, location) ->
    console.log('sync new convo')
    $('.parley div.controller-bar a.messages').addClass('notify')
    if @menu is "persistent_convos"
      view = new PersistentConversationView(new_convo, this)
      view.render()
      $('.parley div.controller-view').prepend(view.$element)

  remove_persist_convo_views: ->
    for view in @persist_view_array
      view.remove()
    @persist_view_array.length = 0




module.exports = new CommandCenter()


-# Control Panel for Parley.js
# This is the only view that cannot be removed.
# It is the hub for all interaction.
class CommandCenterView
  constructor: ->
    @menu = null
    $('body').append logged_out_view()
    $("ul.login-bar").hide()


  logged_out_view: Handlebars.compile('
    <div class="parley">
      <section class="controller">
      <div class="controller-view"></div>
      <ul class="login-bar g-signin"
        data-callback="sign_in_callback"
        data-clientid=
        data-cookiepolicy="single_host_origin"
        data-theme="none"
        data-scope="https://www.googleapis.com/auth/plus.login https://www.googleapis.com/auth/devstorage.read_write">
        <li class="btn">
          <a class="entypo-gplus"></a>
        </li>
        <li class="aside">
          <a>| Sign in with google</a>
        </li>
        <div class="persistent-bar parley-logged-out">
          <a id="log-click"> click here to login!</a>
          <span class="fontawesome-reorder"></span>
        </div>
      </ul>
      </section>
    </div>
    ')

  logged_in_view: Handlebars.compile('
    <div class="controller-view">
      <div class="default-view">
        <figure>
          <img src={{image_url}}/>
          <h2>{{me.display_name}}</h2>
        </figure>
      </div>
    </div>
    <div class="controller-bar">
      <ul class="utility-bar horizontal-list">
        <li>
          <a class="messages" href="#">
            <span class="entypo-chat"></span>
          </a>
        </li>
        <li>
          <a class="active-users" href="#">
            <span class="entypo-users"></span>
          </a>
        </li>
        <li>
          <a class="user-settings" href="#">
            <span class="fontawesome-cog"></span>
          </a>
        </li>
      </ul>
      <div class="persistent-bar">
        <a>{{display_name}}</a>
        <span class="fontawesome-reorder"></span>
      </div>
    </div>
    ')

  log_in: ->
    $(".parley .persistent-bar.logged_out").off()
    @$element = logged_in_view(@app.me)
    $('.parley section.controller').html(@$element)
    $('.parley div.controller-bar a.messages').on('click', @toggle_persistent_convos)
    $('.parley div.controller-bar a.active_users').on('click', @toggle_current_users)
    $('.parley div.controller-bar a.user-settings').on('click', @toggle_user_settings)

  toggle_command_center: ->
    ## If a user is logged in they get a default profile view
    ## otherwise a login with google appears.
    if logged_out
      $( ".parley .persistent-bar.logged-out" ).on "click", ->
        $( "#log-click" ).toggle()
        $( "ul.login-bar" ).slideToggle()
    else
      $ ->
        $('.persistent-bar').on 'click', ->
          $('.controller-view').toggle()

  toggle_current_users: ->
    if @menu is not "current_users"
      $('.parley div.controller-view').html('')
      for user in @app.users.currently_online
        view = new @app.UserView(user)
        $('.parley div.controller-view').append(view.render())
    else
      $('.parley div.controller-view').html(logged_in_view(@app.me))


  toggle_persistent_convos: ->
    if @menu is not "persistent_convos"
      $(".parley div.controller-view").html('')
      for convo in @app.conversations
        view = new @app.PersistentConversationView(convo)
        $('.parley div.controller-view').append(view.render())
    else
      $('.parley div.controller-view').html(logged_in_view(@app.me))


  toggle_user_settings: ->



Parley.onInit( (app) ->
  CommandCenterView.prototype.app = app
  app.command_center = new CommandCenterView()
  )


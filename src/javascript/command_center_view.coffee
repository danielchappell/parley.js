# Control Panel for Parley.js
# This is the only view that cannot be removed.
# It is the hub for all interaction.
class CommandCenterView
  constructor: ->
    $('body').append logged_out_view()
    $("ul.login-bar").hide()



  logged_out_view: Handlebars.compile('
    <div class="parley">
      <section class="controller">
      <div class="controller-view"></div>
      <ul class="login-bar">
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
          <img src={{User.image_url}}/>
          <h2>{{User.display_name}}</h2>
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
        <a>{{User.display_name}}</a>
        <span class="fontawesome-reorder"></span>
      </div>
    </div>
    ')

  log_in: ->
    # @app.oauth_logic

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


  toggle_persistent_messages: ->

  toggle_user_settings: ->






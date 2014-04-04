## constructor that creates object that represents collection
## of user objects currently online with related logic and templates

class Users

  constructor: ->
    @online_users = []
    @app.server.on 'current_users', @receive_current_users
    @app.server.on 'user_logged_on', @user_logged_on
    @app.server.on 'user_logged_off', @user_logged_off


  add: (user)->
    @online_users.push(user)

  receive_current_users: (currently_online) ->
    for user in currently_online
      @add(user)

  user_logged_on: (display_name, image_url) ->
    user = new User(display_name, image_url)
    @add(user)

  user_logged_off: (display_name, image_url) ->
    for user in @online_users
      if image_url is user.image_url
        @online_users.splice( i, 1)



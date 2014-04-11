
app = require('./app.coffee')
User = require('./user_model.coffee')
Message = require('./message_model.coffee')


## All logic relating to loging in through Google Plus Oauth
## and any logic used for retrieving information requiring an access token.
class Oauth

  constructor: ->

  window.sign_in_callback = (authResult) =>
    if authResult.status.signed_in
      ## update the app to reflect the user is signed in.
      gapi.client.load 'plus', 'v1', =>
        request = gapi.client.plus.people.get({'userId': 'me'})
        request.execute (profile) =>
          display_name = profile.displayName
          image_url = profile.image.url
          app.me = new User display_name, image_url
          app.server.emit('join', display_name, image_url)
          app.command_center.log_in()
      Oauth.prototype.file_upload = (file, convo_partners, convo_id) ->
        $.ajax({
          url: "https://www.googleapis.com/upload/storage/v1beta2/b/parley-images/o?uploadType=media&name=#{file.name}"
          type: "POST"
          data: file
          contentType: file.type
          processData: false
          headers:
            Authorization: "Bearer #{authResult.access_token}"
          success: (res) =>
            content= "https://storage.googleapis.com/parley-images/#{res.name}"
            new_message = new Message convo_partners, app.me, content, true
            app.server.emit 'message', new_message
            for convo in app.conversations
              if convo.message_filter is convo_id
                convo.add_message(new_message)
        })
    else
      ## login unsuccessful log error to the console
      ##Possible error values:
      ##"user_signed_out" - User is signed-out
      ##"access_denied" - User denied access to your app
      ##"immediate_failed" - Could not automatically log in the user
      console.log("Sign-in state: #{authResult.error}")

module.exports = new Oauth()
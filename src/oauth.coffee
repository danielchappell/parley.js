
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
      @file_upload = (file, rIDs, sID) ->
        $.ajax({
          url: "https://www.googleapis.com/upload/storage/v1beta2/b/parley-images/o?uploadType=media&name=#{file.name}"
          type: "POST"
          data: file
          contentType: file.type
          processData: false
          headers:
            Authorization: "Bearer #{authResult.access_token}"
          success: (res) =>
            image_src= "https://storage.cloud.google.com/parley-images/#{res.name}"
            msg = "<img src=#{image_src} />"
            app.server.emit('message', msg, rIDs, sID)
            message = new Message rIDs, sID, msg
            @convo.messages.add_message(message)
            @render()
        })
    else
      ## login unsuccessful log error to the console
      ##Possible error values:
      ##"user_signed_out" - User is signed-out
      ##"access_denied" - User denied access to your app
      ##"immediate_failed" - Could not automatically log in the user
      console.log("Sign-in state: #{authResult.error}")

module.exports = new Oauth()
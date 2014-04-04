## This is the constructor for each list itemcorresponding to logged
## on users displayed in the logged on users list on both
## command center and chat window views.

class CurrentUserView

  constructor: (@current_user) ->


  current_user_template: Handlebars.compile('
      <div class="current users">
        <div class="avatar"
          <img src={{image_url}} />
        </div>
        <div class="content">
          <h2>{{display_name}}</h2>
        </div>
      </div>
        ')

  render: ->
    this.$element = @current_user_template(@current_user)


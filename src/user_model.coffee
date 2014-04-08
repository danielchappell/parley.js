
app = require('./app.coffee')

##constructor for object that holds all
##data and logic related to each user

class User

  constructor: (@display_name, @image_url) ->
    ## active, idle, away, or DND
    @status = "active"


module.exports = User
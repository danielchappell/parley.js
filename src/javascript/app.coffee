## this is the contructor for the global object that when initialized
## executes all neccesary operations to get this train moving.
initializers = []

class ParleyApp

  constructor: ->
    @current_users = []
    @open_conversations = []
    @conversations = []
    ## insert script for google plus signin
    do ->
      var po = document.createElement('script'); po.type = 'text/javascript'; po.async = true
      po.src = 'https://apis.google.com/js/client:plusone.js'
      var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(po, s)

    ## runs each init function
    init(this) for init in initializers


onInit: (func) ->
  initializers.push(func)
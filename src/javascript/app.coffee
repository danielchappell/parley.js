## this is the contructor for the global object that when initialized
## executes all neccesary operations to get this train moving.
initializers = []

class ParleyApp

  constructor: ->
    @current_users = []
    @open_conversations = []
    @conversations = []
    ## runs each init function
    init(this) for init in initializers


onInit: (func) ->
  initializers.push(func)
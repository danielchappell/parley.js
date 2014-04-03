## constructor for object containing template and user
## interaction logic for each open chat window.
## watches a conversation model.

class ChatRoom

  constructor: (@conversation) ->


  chat_room_template: Handlebars.compile('
    <div class="parley">
      <section class="conversation">
        <div class="top-bar">
          <a>{{first_name}}</a>
          <span class="fontawesome-reorder"></span>
        </div>
        <ul class="messsage-bar">
          <li>
            <a class="messages" href="#">
              <span class="fontawesome-facetime-video"></span>
            </a>
          </li>
          <li>
            <a class="active-users" href="#">
              <a class="entypo-user-add"></a>
            </a>
          </li>
        </ul>
        <ol class="discussion"></ol>
        <div class="message-input">
          <textarea class="field test" placeholder="Enter Message...">
          </textarea>
          <button class="item entypo-camera" id="bye"></button>
        </div>
      </section>
    </div>
    ')
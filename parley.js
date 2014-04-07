(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var $, App, ChatRoom, CommandCenter, Conversation, Oauth, User, io;

$ = require('jquery');

io = 'socket.io';

ChatRoom = require('./chat_room_view.coffee');

CommandCenter = require('./command_center_view.coffee');

Conversation = require('./conversation_model.coffee');

User = require('./user_model.coffee');

Oauth = require('./oauth.coffee');


/*   PARLEY.JS CHAT LIBRARY EXTRODINAIRE */

App = (function() {
  function App() {
    this.current_users = [];
    this.open_conversations = [];
    this.conversations = [];
    this.server.on('persistent_convo', this.load_persistent_convo);
    this.server.on('current_users', this.load_current_users);
    this.server.on('user_logged_on', this.user_logged_on);
    this.server.on('user_logged_off', this.user_logged_off);
    (function() {
      var po, s;
      po = document.createElement('script');
      po.type = 'text/javascript';
      po.async = true;
      po.src = 'https://apis.google.com/js/client:plusone.js';
      s = document.getElementsByTagName('script')[0];
      return s.parentNode.insertBefore(po, s);
    })();
    this.command_center = new CommandCenter();
    this.oauth = new Oauth();
  }

  App.prototype.server = io.connect('wss://' + window.location.hostname);

  App.prototype.load_persistent_convo = function(convo_key, messages) {
    var convo, convo_members, id, _i, _len;
    convo_members = convo_key.split(',');
    for (_i = 0, _len = convo_members.length; _i < _len; _i++) {
      id = convo_members[_i];
      if (id !== this.app.me.image_url) {
        convo_partners += id;
      }
    }
    convo = new Conversation(convo_partners, messages);
    return this.conversations.push(convo);
  };

  App.prototype.load_current_users = function(logged_on) {
    var user, _i, _len, _ref, _results;
    this.current_users = logged_on;
    _ref = this.current_users;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      if (user.image_url === this.me.image_url) {
        _results.push(this.current_users.splice(i, 1));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  App.prototype.user_logged_on = function(display_name, image_url) {
    var user;
    user = new User(display_name, image_url);
    return this.current_users.push(user);
  };

  App.prototype.user_logged_off = function(display_name, image_url) {
    var user, _i, _len, _ref, _results;
    _ref = this.current_users;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      if (image_url === user.image_url) {
        _results.push(this.current_users.splice(i, 1));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  return App;

})();

module.exports = new App();


},{"./chat_room_view.coffee":2,"./command_center_view.coffee":3,"./conversation_model.coffee":4,"./oauth.coffee":7,"./user_model.coffee":9,"jquery":"HlZQrA"}],2:[function(require,module,exports){
var $, ChatRoom, Conversation, Message, MessageView, app;

$ = require('jquery');

app = require('./app.coffee');

Message = require('./message_model.coffee');

MessageView = require('./message_view.coffee');

Conversation = require('./conversation_model.coffee');

ChatRoom = (function() {
  function ChatRoom(convo) {
    this.convo = convo;
    this.render();
    $('body').append(this.$element);
    app.server.on('message', this.message_callback);
    app.server.on('user_offline', this.user_offline_callback);
    app.server.on('typing_notification', this.typing_notification_callback);
    this.$element.find('.chat-close').on('click', this.closeWindow);
    this.$element.find('.send').on('keypress', this.sendOnEnter);
    this.$element.find('.send').on('keyup', this.emitTypingNotification);
    this.$element.find('.top-bar, minify ').on('click', this.toggleChat);
    this.$element.on('click', this.removeNotifications);
    this.$discussion.find('.parley_file_upload').on('change', this.file_upload);
  }

  ChatRoom.prototype.chat_room_template = Handlebars.compile('<div class="parley"> <section class="conversation"> <div class="top-bar"> <a>{{first_name}}</a> <ul class="message-alt"> <li class="entypo-minus minify"></li> <li class="entypo-resize-full"></li> <li class="entypo-cancel chat-close"></li> </ul> </div> <div class="message-bar"> <ul class="additional"> <li><a class="entypo-user-add"></a></li> <li><a class="fontawesome-facetime-video"></a></li> </ul> <ul class="existing"> <li><a class="entypo-chat"></a></li> </ul> </div> <ol class="discussion"></ol> <textarea class="grw" placeholder="Enter Message..."></textarea> <label class="img_upload entypo-camera"> <span> <input class="parley_file_upload" name="img_upload" type="file" /></label> </span> </section> </div>');

  ChatRoom.prototype.message_callback = function(message) {
    this.convo.add_message(message);
    this.renderDiscussion();
    this.$element.find('.top-bar').addClass('new-message');
    return this.titleAlert();
  };

  ChatRoom.prototype.user_offline_callback = function() {
    var message;
    message = new Message(app.me, 'http://storage.googleapis.com/parley-assets/server_network.png', "This user is no longer online", new Date());
    this.convo.add_message(message);
    return this.renderDiscussion();
  };

  ChatRoom.prototype.typing_notification_callback = function(convo_key, typist, bool) {
    var typing_notification;
    if (convo_key === this.convo.message_filter) {
      if (bool) {
        if (this.$discussion.find('.incoming').length === 0) {
          typing_notification = "<li class='incoming'><div class='avatar'><img src='" + typist.image_url + "'/></div><div class='messages'><p>" + typist.display_name + " is typing...</p></div></li>";
          that.$('.discussion').append(typingNotification);
          this.$discussion.append(typing_notification);
          return this.scrollToLastMessage();
        }
      } else {
        this.$discussion.find('.incoming').remove();
        return this.scrollToLastMessage();
      }
    }
  };

  ChatRoom.prototype.add_member = function(new_user) {
    var convo, new_convo_group, new_convo_partners, _i, _len, _ref;
    new_convo_partners = this.convo.convo_partners.concat(new_user);
    new_convo_group = new Conversation(new_convo_partners);
    app.conversations.push(new_convo_group);
    _ref = app.open_conversations;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      convo = _ref[_i];
      if (convo === this.convo.message_filter) {
        app.open_conversations.splice(i, 1);
      }
    }
    app.open_conversations.push(new_convo_group.message_filter);
    this.convo = new_convo_group;
    return this.render();
  };

  ChatRoom.prototype.render = function() {
    this.$element = $(this.chat_room_template(this.convo));
    return this.$discussion = this.$element.find('.discussion');
  };

  ChatRoom.prototype.renderDiscussion = function() {
    var new_message;
    new_message = this.convo.messages.slice(-1)[0];
    this.appendMessage(new_message);
    return this.scrollToLastMessage();
  };

  ChatRoom.prototype.appendMessage = function(message) {
    var message_view;
    message_view = new MesssageView(message);
    message_view.render();
    return this.$discussion.append(message_view.$element);
  };

  ChatRoom.prototype.scrollToLastMessage = function() {
    return this.$discussion.scrollTop(this.$discussion.find('li:last-child').offset().top + this.$discussion.scrollTop());
  };

  ChatRoom.prototype.loadPersistentMessages = function() {
    var message, _i, _len, _ref;
    _ref = this.convo.messages;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      message = _ref[_i];
      this.appendMessage(message);
    }
    if (this.messages.length > 0) {
      return this.scrollToLastMessage();
    }
  };

  ChatRoom.prototype.sendOnEnter = function(e) {
    if (e.keyCode === 13) {
      this.sendMessage();
      return this.removeNotifications();
    }
  };

  ChatRoom.prototype.sendMessage = function() {
    var message;
    message = new Message(this.convo.convo_partners, app.me, this.$element.find('.send').val());
    this.messages.add(send);
    this.renderDiscussion();
    app.server.emit('mesage', message);
    this.$discussion.find('.send').val('');
    return this.emitTypingNotification();
  };

  ChatRoom.prototype.toggle_convo = function(e) {
    e.preventDefault();
    this.$discussion.toggle();
    if (this.$discussion.attr('display') === !"none") {
      return this.scrollToLastMessage;
    }
  };

  ChatRoom.prototype.closeWindow = function(e) {
    e.preventDefault();
    e.stopPropagation();
    app.server.removeAllListeners();
    this.$element.find('.chat-close').off();
    this.$element.find('.send').off();
    this.$element.find('.send').off();
    this.$element.find('.top-bar').off();
    this.$element.off();
    this.$discussion.off();
    this.$element.remove();
    return delete this;
  };

  ChatRoom.prototype.removeNotifications = function(e) {
    this.$element.find('.top-bar').removeClass('new-message');
    if (app.title_notification.notified) {
      return this.clearTitleNotification();
    }
  };

  ChatRoom.prototype.emitTypingNotification = function(e) {
    if (this.$element.find('.send').val() !== "") {
      return app.server.emit('user_typing', this.convo.convo_partners_image_urls, app.me, true);
    } else {
      return app.server.emit('user_typing', this.convo.convo_partners_image_urls, app.me, false);
    }
  };

  ChatRoom.prototype.clearTitleNotification = function() {
    app.clearAlert();
    $('html title').html(app.title_notification.page_title);
    return app.title_notification.notified = false;
  };

  ChatRoom.prototype.titleAlert = function() {
    var alert, sender_name, setAlert, title_alert;
    if (!app.title_notification.notified) {
      sender_name = this.convo.messages[-1].sender.display_name;
      alert = "Pending ** " + sender_name;
      setAlert = function() {
        if ($('html title').html() === app.title_notification.page_title) {
          return $('html title').html(alert);
        } else {
          return $('html title').html(app.title_notification.page_title);
        }
      };
      title_alert = setInterval(setAlert, 2200);
      app.clear_alert = function() {
        return clearInterval(title_alert);
      };
      return app.title_notification.notified = true;
    }
  };

  ChatRoom.prototype.file_upload = function() {
    var file;
    file = this.$discussion.find('.picture_upload').get(0).files[0];
    return app.oauth.file_upload(file, this.convo.convo_partners_image_urls, app.me.image_url);
  };

  return ChatRoom;

})();

module.exports = ChatRoom;


},{"./app.coffee":1,"./conversation_model.coffee":4,"./message_model.coffee":5,"./message_view.coffee":6,"jquery":"HlZQrA"}],3:[function(require,module,exports){
var $, CommandCenter, PersistentConversationView, UserView, app;

$ = require('jquery');

app = require('./app.coffee');

UserView = require('./user_view.coffee');

PersistentConversationView = require('./persistent_conversation_view.coffee');

CommandCenter = (function() {
  function CommandCenter() {
    this.menu = null;
    $('body').append(logged_out_view());
    $("ul.login-bar").hide();
    $('.parley .persistent-bar.logged-out').on('click', function(e) {
      return $('ul.login-bar').toggle();
    });
  }

  CommandCenter.prototype.logged_out_view = Handlebars.compile('<div class="parley"> <section class="controller"> <div class="controller-view"></div> <ul class="login-bar g-signin" data-callback="sign_in_callback" data-clientid= data-cookiepolicy="single_host_origin" data-theme="none" data-scope="https://www.googleapis.com/auth/plus.login https://www.googleapis.com/auth/devstorage.read_write"> <li class="btn"> <a class="entypo-gplus"></a> </li> <li class="aside"> <a>| Sign in with google</a> </li> <div class="persistent-bar parley-logged-out"> <a id="log-click"> click here to login!</a> <span class="fontawesome-reorder"></span> </div> </ul> </section> </div>');

  CommandCenter.prototype.logged_in_view = Handlebars.compile('<div class="controller-view"> <div class="default-view"> <figure> <img src={{image_url}}/> <h2>{{me.display_name}}</h2> </figure> </div> </div> <div class="controller-bar"> <ul class="utility-bar horizontal-list"> <li> <a class="messages" href="#"> <span class="entypo-chat"></span> </a> </li> <li> <a class="active-users" href="#"> <span class="entypo-users"></span> </a> </li> <li> <a class="user-settings" href="#"> <span class="fontawesome-cog"></span> </a> </li> </ul> <div class="persistent-bar"> <a>{{display_name}}</a> <span class="fontawesome-reorder"></span> </div> </div>');

  CommandCenter.prototype.log_in = function() {
    $(".parley .persistent-bar.logged_out").off();
    this.$element = logged_in_view(app.me);
    $('.parley section.controller').html(this.$element);
    $('.parley div.controller-bar a.messages').on('click', this.toggle_persistent_convos);
    $('.parley div.controller-bar a.active_users').on('click', this.toggle_current_users);
    return $('.parley div.controller-bar a.user-settings').on('click', this.toggle_user_settings);
  };

  CommandCenter.prototype.toggle_command_center = function() {
    if (logged_out) {
      return $(".parley .persistent-bar.logged-out").on("click", function() {
        $("#log-click").toggle();
        return $("ul.login-bar").slideToggle();
      });
    } else {
      return $(function() {
        return $('.persistent-bar').on('click', function() {
          return $('.controller-view').toggle();
        });
      });
    }
  };

  CommandCenter.prototype.toggle_current_users = function() {
    var user, view, _i, _len, _ref, _results;
    if (this.menu === !"current_users") {
      $('.parley div.controller-view').children().remove();
      _ref = app.current_users;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        user = _ref[_i];
        view = new UserView(user);
        _results.push($('.parley div.controller-view').append(view.render()));
      }
      return _results;
    } else {
      $('.parley div.controller-view').children().remove();
      return $('.parley div.controller-view').html(logged_in_view(app.me));
    }
  };

  CommandCenter.prototype.toggle_persistent_convos = function() {
    var convo, view, _i, _len, _ref, _results;
    if (this.menu === !"persistent_convos") {
      $(".parley div.controller-view").children().remove();
      _ref = app.conversations;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        convo = _ref[_i];
        view = new PersistentConversationView(convo);
        _results.push($('.parley div.controller-view').append(view.render()));
      }
      return _results;
    } else {
      $('.parley div.controller-view').children().remove();
      return $('.parley div.controller-view').html(logged_in_view(app.me));
    }
  };

  CommandCenter.prototype.toggle_user_settings = function() {};

  return CommandCenter;

})();

module.exports = CommandCenter;


},{"./app.coffee":1,"./persistent_conversation_view.coffee":8,"./user_view.coffee":10,"jquery":"HlZQrA"}],4:[function(require,module,exports){
var $, Conversation, app;

$ = require('jquery');

app = require('./app.coffee');

Conversation = (function() {
  function Conversation(convo_partners, messages) {
    var first_name, user, _i, _len, _ref;
    this.convo_partners = convo_partners;
    this.messages = messages != null ? messages : [];
    this.generate_message_filter();
    this.first_name_list = "";
    this.convo_partners_image_urls = [];
    _ref = this.convo_partners;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      first_name = user.display_name.match(/\A.+\s/)[0];
      if (i !== this.convo_partners.length) {
        this.first_name_list += "" + first_name + ", ";
        this.convo_partners_image_urls += user.image_url;
      } else {
        this.first_name_list += "" + first_name;
        this.convo_partners_image_urls += user.image_url;
      }
    }
  }

  Conversation.prototype.add_message = function(message) {
    return this.messages.push(message);
  };

  Conversation.prototype.generate_message_filter = function() {
    var partner, _i, _len, _ref;
    this.message_filter = [app.me.image_url];
    _ref = this.convo_partners;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      partner = _ref[_i];
      this.message_filter.push(partner.image_url);
    }
    return this.message_filter.sort().join();
  };

  return Conversation;

})();

module.exports = Conversation;


},{"./app.coffee":1,"jquery":"HlZQrA"}],5:[function(require,module,exports){
var $, Message, app;

$ = require('jquery');

app = require('./app.coffee');

Message = (function() {
  function Message(recipients, sender, content, time_stamp) {
    this.recipients = recipients;
    this.sender = sender;
    this.content = content;
    this.time_stamp = time_stamp;
    if (!this.time_stamp) {
      this.time_stamp = new Date().toUTCString();
    }
    this.convo_id = this.recipients.concat(this.sender).sort().join();
    this.time_created = new Date(this.time_stamp);
  }

  Message.prototype.time_elapsed = function() {
    var f_date, hours, minute_remainder, minutes, today;
    this.current_time = new Date();
    minutes = Math.floor((current_time - time_created) / 60000);
    if (current_time.getDate() === time_created.getDate() && minutes < 1440) {
      today = true;
    }
    hours = Math.floor(minutes / 60);
    minute_remainder = Math.floor(minutes % 60);
    if (minutes < 60) {
      return "" + minutes + " mins ago";
    }
    if (hours < 4) {
      if (minute_remainder === 0) {
        return "" + hours + " hours ago";
      } else {
        return "" + hours + " hour " + minute_remainder + " min ago";
      }
    } else {
      f_date = this.date_formatter();
      if (today) {
        return "" + f_date.hour + ":" + f_date.minutes + " " + f_date.suffix;
      } else {
        return "" + f_date.month + " " + f_date.day + " | " + f_date.hour + ":" + f_date.minutes + " " + f_date.suffix;
      }
    }
  };

  Message.prototype.date_formatter = function() {
    var formated, hours, minutes, new_hour, new_minutes, new_month, suffix;
    switch (this.time_created.getMonth()) {
      case 0:
        new_month = "Jan";
        break;
      case 1:
        new_month = "Feb";
        break;
      case 2:
        new_month = "Mar";
        break;
      case 3:
        new_month = "Apr";
        break;
      case 4:
        new_month = "May";
        break;
      case 5:
        new_month = "Jun";
        break;
      case 6:
        new_month = "Jul";
        break;
      case 7:
        new_month = "Aug";
        break;
      case 8:
        new_month = "Sep";
        break;
      case 9:
        new_month = "Oct";
        break;
      case 10:
        new_month = "Nov";
        break;
      case 11:
        new_month = "Dec";
    }
    hours = this.time_created.getHours();
    if (hours > 12) {
      suffix = "PM";
      new_hour = hours - 12;
    } else {
      suffix = "AM";
      new_hour = hours;
    }
    minutes = this.time_created.getMinutes();
    if (minutes < 10) {
      new_minutes = "0" + minutes;
    } else {
      new_minutes = "" + minutes;
    }
    return formated = {
      month: new_month,
      day: this.time_created.getDate(),
      hour: new_hour,
      minutes: new_minutes,
      suffix: suffix
    };
  };

  return Message;

})();

module.exports = Message;


},{"./app.coffee":1,"jquery":"HlZQrA"}],6:[function(require,module,exports){
var $, MessageView, app;

$ = require('jquery');

app = require('./app.coffee');

MessageView = (function() {
  function MessageView(message) {
    this.message = message;
  }

  MessageView.prototype.message_template = Handlebars.compile('<div class="avatar"> <img src="{{sender.image_url}}"/> <div class="message status"> <h2>{{sender.display_name}}</h2> <p>{{content}}</p> <a class="time"> <span class="entypo-clock">{{time_elapsed()}}</span> </a> </div>');

  MessageView.prototype.render = function() {
    if (this.message.sender.image_url === app.me.image_url) {
      return this.$element = $('<li class="self"></li>').append(message_template(this.message));
    } else {
      return this.$element = $('<li class="other"></li>').append(message_template(this.message));
    }
  };

  return MessageView;

})();

module.exports = MessageView;


},{"./app.coffee":1,"jquery":"HlZQrA"}],7:[function(require,module,exports){
var $, Oauth, app;

$ = require('jquery');

app = require('./app.coffee');

Oauth = (function() {
  function Oauth() {}

  window.sign_in_callback = function(authResult) {
    if (authResult.status.signed_in) {
      gapi.client.load('plus', 'v1', function() {
        var request;
        request = gapi.client.plus.people.get({
          'userId': 'me'
        });
        return request.execute(function(profile) {
          var display_name, image_url;
          display_name = profile.displayName;
          image_url = profile.image.url;
          app.me = new User(display_name, image_url);
          app.server.emit('join', display_name, image_url);
          return app.command_center.log_in();
        });
      });
      return Oauth.file_upload = function(file, rIDs, sID) {
        return $.ajax({
          url: "https://www.googleapis.com/upload/storage/v1beta2/b/parley-images/o?uploadType=media&name=" + file.name,
          type: "POST",
          data: file,
          contentType: file.type,
          processData: false,
          headers: {
            Authorization: "Bearer " + authResult.access_token
          },
          success: (function(_this) {
            return function(res) {
              var image_src, message, msg;
              image_src = "https://storage.cloud.google.com/parley-images/" + res.name;
              msg = "<img src=" + image_src + " />";
              app.server.emit('message', msg, rIDs, sID);
              message = new Message(rIDs, sID, msg);
              _this.convo.messages.add_message(message);
              return _this.render();
            };
          })(this)
        });
      };
    } else {
      return console.log("Sign-in state: " + authResult.error);
    }
  };

  return Oauth;

})();

module.exports = Oauth;


},{"./app.coffee":1,"jquery":"HlZQrA"}],8:[function(require,module,exports){
var $, ChatRoom, PersistentConversationView, app;

$ = require('jquery');

app = require('./app.coffee');

ChatRoom = require('./chat_room_view.coffee');

PersistentConversationView = (function() {
  function PersistentConversationView(convo) {
    this.convo = convo;
    this.$element.on('click', this.load_convo);
    ({
      persistent_convo_template_reg: Handlebars.compile('<div class="message existing"> <div class="avatar"> <img src={{convo_partners[0].image_url}} /> </div> <div class="content status entypo-right-open-big"> <h2>{{convo_partner.display_name}}</h2> <p>{{messages[-1].content}}</p> <a class="time"> <span class="entypo-clock"> {{messages[-1].time_elapsed()}}</span> </a> </div> </div>'),
      render: function() {
        return this.$element = this.persistent_convo_template_reg(this.convo);
      },
      load_convo: function() {
        var chat_window, convo_status, _i, _len, _ref;
        convo_status = 'closed';
        _ref = app.open_conversations;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          convo = _ref[_i];
          if (this.convo.message_filter === convo.message_filter) {
            convo_status = 'open';
          }
        }
        if (convo_status !== 'open') {
          chat_window = new ChatRoom(this.convo);
          app.open_conversations.push(this.convo.message_filter);
          if (!this.$element.parent()[0].hasClass('controller-view')) {
            return this.$element.parents('div.parley').remove();
          }
        }
      }
    });
  }

  return PersistentConversationView;

})();

module.exports = PersistentConversationView;


},{"./app.coffee":1,"./chat_room_view.coffee":2,"jquery":"HlZQrA"}],9:[function(require,module,exports){
var $, User, app;

$ = require('jquery');

app = require('./app.coffee');

User = (function() {
  function User(display_name, image_url) {
    this.display_name = display_name;
    this.image_url = image_url;
    this.status = "active";
  }

  return User;

})();

module.exports = User;


},{"./app.coffee":1,"jquery":"HlZQrA"}],10:[function(require,module,exports){
var $, ChatRoom, Conversation, UserView, app;

$ = require('jquery');

app = require('./app.coffee');

ChatRoom = require('./chat_room_view.coffee');

Conversation = require('./conversation_model.coffee');

UserView = (function() {
  function UserView(current_user, chat_room) {
    this.current_user = current_user;
    this.chat_room = chat_room;
    this.$element.on('click', this.user_interact_callback);
  }

  UserView.prototype.current_user_template = Handlebars.compile('<li class="user"> <div class="avatar"> <img src={{image_url}} /> </div> <div class="content"> <h2>{{display_name}}</h2> </div> </li>');

  UserView.prototype.render = function() {
    return this.$element = this.current_user_template(this.current_user);
  };

  UserView.prototype.user_interact_callback = function() {
    if (this.$element.parent()[0].hasClass('controller-view')) {
      return this.open_conversation();
    } else {
      return this.chat_room.add_member(this.current_user);
    }
  };

  UserView.prototype.open_conversation = function() {
    var chat_window, conversation, convo, convo_exists, convo_key, _i, _j, _len, _len1, _ref, _ref1;
    convo_key = [app.me.image_url, this.current_user.image_url].sort().join();
    _ref = app.open_conversations;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      convo = _ref[_i];
      if (convo_key === convo.message_filter) {
        return;
      }
    }
    convo_exists = false;
    _ref1 = app.conversations;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      convo = _ref1[_j];
      if (convo.message_filter === convo_key) {
        convo_exists = true;
      }
    }
    if (convo_exists) {
      chat_window = new ChatRoom(convo);
      return app.open_conversations.push(convo_key);
    } else {
      conversation = new Conversation([this.current_user]);
      chat_window = new ChatRoom(conversation);
      app.conversations.push(conversation);
      return app.open_conversations.push(convo_key);
    }
  };

  return UserView;

})();

module.exports = UserView;


},{"./app.coffee":1,"./chat_room_view.coffee":2,"./conversation_model.coffee":4,"jquery":"HlZQrA"}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvc2xvd3JlYWRlci9jYXJlZXJkYXkvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvc2xvd3JlYWRlci9jYXJlZXJkYXkvcGFybGV5LmpzL3NyYy9hcHAuY29mZmVlIiwiL1VzZXJzL3Nsb3dyZWFkZXIvY2FyZWVyZGF5L3BhcmxleS5qcy9zcmMvY2hhdF9yb29tX3ZpZXcuY29mZmVlIiwiL1VzZXJzL3Nsb3dyZWFkZXIvY2FyZWVyZGF5L3BhcmxleS5qcy9zcmMvY29tbWFuZF9jZW50ZXJfdmlldy5jb2ZmZWUiLCIvVXNlcnMvc2xvd3JlYWRlci9jYXJlZXJkYXkvcGFybGV5LmpzL3NyYy9jb252ZXJzYXRpb25fbW9kZWwuY29mZmVlIiwiL1VzZXJzL3Nsb3dyZWFkZXIvY2FyZWVyZGF5L3BhcmxleS5qcy9zcmMvbWVzc2FnZV9tb2RlbC5jb2ZmZWUiLCIvVXNlcnMvc2xvd3JlYWRlci9jYXJlZXJkYXkvcGFybGV5LmpzL3NyYy9tZXNzYWdlX3ZpZXcuY29mZmVlIiwiL1VzZXJzL3Nsb3dyZWFkZXIvY2FyZWVyZGF5L3BhcmxleS5qcy9zcmMvb2F1dGguY29mZmVlIiwiL1VzZXJzL3Nsb3dyZWFkZXIvY2FyZWVyZGF5L3BhcmxleS5qcy9zcmMvcGVyc2lzdGVudF9jb252ZXJzYXRpb25fdmlldy5jb2ZmZWUiLCIvVXNlcnMvc2xvd3JlYWRlci9jYXJlZXJkYXkvcGFybGV5LmpzL3NyYy91c2VyX21vZGVsLmNvZmZlZSIsIi9Vc2Vycy9zbG93cmVhZGVyL2NhcmVlcmRheS9wYXJsZXkuanMvc3JjL3VzZXJfdmlldy5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNDQSxJQUFBLDhEQUFBOztBQUFBLENBQUEsR0FBSSxPQUFBLENBQVEsUUFBUixDQUFKLENBQUE7O0FBQUEsRUFDQSxHQUFN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R0FBZSxJQUFmLENBREY7T0FERjtBQUFBLEtBTkE7QUFTQSxJQUFBLElBQUcsWUFBSDtBQUNFLE1BQUEsV0FBQSxHQUFrQixJQUFBLFFBQUEsQ0FBUyxLQUFULENBQWxCLENBQUE7YUFDQSxHQUFHLENBQUMsa0JBQWtCLENBQUMsSUFBdkIsQ0FBNEIsU0FBNUIsRUFGRjtLQUFBLE1BQUE7QUFJRSxNQUFBLFlBQUEsR0FBbUIsSUFBQSxZQUFBLENBQWEsQ0FBQyxJQUFDLENBQUEsWUFBRixDQUFiLENBQW5CLENBQUE7QUFBQSxNQUNBLFdBQUEsR0FBa0IsSUFBQSxRQUFBLENBQVMsWUFBVCxDQURsQixDQUFBO0FBQUEsTUFFQSxHQUFHLENBQUMsYUFBYSxDQUFDLElBQWxCLENBQXVCLFlBQXZCLENBRkEsQ0FBQTthQUdBLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxJQUF2QixDQUE0QixTQUE1QixFQVBGO0tBWGlCO0VBQUEsQ0EzQm5CLENBQUE7O2tCQUFBOztJQVZGLENBQUE7O0FBQUEsTUF5RE0sQ0FBQyxPQUFQLEdBQWlCLFFBekRqQixDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbiQgPSByZXF1aXJlKCdqcXVlcnknKVxuaW8gPSAoJ3NvY2tldC5pbycpXG5DaGF0Um9vbSA9IHJlcXVpcmUoJy4vY2hhdF9yb29tX3ZpZXcuY29mZmVlJylcbkNvbW1hbmRDZW50ZXIgPSByZXF1aXJlKCcuL2NvbW1hbmRfY2VudGVyX3ZpZXcuY29mZmVlJylcbkNvbnZlcnNhdGlvbiA9IHJlcXVpcmUoJy4vY29udmVyc2F0aW9uX21vZGVsLmNvZmZlZScpXG5Vc2VyID0gcmVxdWlyZSgnLi91c2VyX21vZGVsLmNvZmZlZScpXG5PYXV0aCA9IHJlcXVpcmUoJy4vb2F1dGguY29mZmVlJylcblxuXG5cbiMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjXG4jIyMgICBQQVJMRVkuSlMgQ0hBVCBMSUJSQVJZIEVYVFJPRElOQUlSRSAgICMjI1xuIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyNcblxuXG4jIyB0aGlzIGlzIHRoZSBjb250cnVjdG9yIGZvciB0aGUgZ2xvYmFsIG9iamVjdCB0aGF0IHdoZW4gaW5pdGlhbGl6ZWRcbiMjIGV4ZWN1dGVzIGFsbCBuZWNjZXNhcnkgb3BlcmF0aW9ucyB0byBnZXQgdGhpcyB0cmFpbiBtb3ZpbmcuXG5jbGFzcyBBcHBcblxuICBjb25zdHJ1Y3RvcjogLT5cbiAgICBAY3VycmVudF91c2VycyA9IFtdXG4gICAgQG9wZW5fY29udmVyc2F0aW9ucyA9IFtdXG4gICAgQGNvbnZlcnNhdGlvbnMgPSBbXVxuXG4gICAgIyMgbGlzdGVuIGZvciBwZXJzaXN0ZW50IGNvbnZlcnNhdGlvbnMgZnJvbSB0aGUgc2VydmVyIG9uIGxvYWQuXG4gICAgIyMgd2lsbCBiZSBzZW50IGluIG9uZSBhdCBhIHRpbWUgZnJvbSByZWRpcyBvbiBsb2FkLlxuICAgIEBzZXJ2ZXIub24gJ3BlcnNpc3RlbnRfY29udm8nLCBAbG9hZF9wZXJzaXN0ZW50X2NvbnZvXG5cbiAgICAjIyBsaXN0ZW5zIGZvciBjdXJyZW50IHVzZXJzIGFycmF5IGZyb20gc2VydmVyXG4gICAgQHNlcnZlci5vbiAnY3VycmVudF91c2VycycsIEBsb2FkX2N1cnJlbnRfdXNlcnNcbiAgICBAc2VydmVyLm9uICd1c2VyX2xvZ2dlZF9vbicsIEB1c2VyX2xvZ2dlZF9vblxuICAgIEBzZXJ2ZXIub24gJ3VzZXJfbG9nZ2VkX29mZicsIEB1c2VyX2xvZ2dlZF9vZmZcblxuICAgICMjIGluc2VydCBzY3JpcHQgZm9yIGdvb2dsZSBwbHVzIHNpZ25pblxuICAgIGRvIC0+XG4gICAgICBwbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpOyBwby50eXBlID0gJ3RleHQvamF2YXNjcmlwdCc7IHBvLmFzeW5jID0gdHJ1ZVxuICAgICAgcG8uc3JjID0gJ2h0dHBzOi8vYXBpcy5nb29nbGUuY29tL2pzL2NsaWVudDpwbHVzb25lLmpzJ1xuICAgICAgcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKVswXTsgcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShwbywgcylcblxuICAgICMjIExPQUQgQ09NTUFORENFTlRFUiBBTkQgT0FVVEggVE8gU1RBUlQgQVBQXG4gICAgQGNvbW1hbmRfY2VudGVyID0gbmV3IENvbW1hbmRDZW50ZXIoKVxuICAgIEBvYXV0aCA9IG5ldyBPYXV0aCgpXG5cblxuICBzZXJ2ZXI6IGlvLmNvbm5lY3QoJ3dzczovLycgKyB3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUpXG5cblxuICBsb2FkX3BlcnNpc3RlbnRfY29udm86IChjb252b19rZXksIG1lc3NhZ2VzKSAtPlxuICAgICMjIHRha2VzIGNvbnZvX2tleSBhbmQgY29udmVydHMgdG8gY29udm9fcGFydG5lcnMgZm9yIGNvbnZlcnNhdGlvbiBjcmVhdGlvblxuICAgIGNvbnZvX21lbWJlcnMgPSBjb252b19rZXkuc3BsaXQoJywnKVxuICAgIGZvciBpZCBpbiBjb252b19tZW1iZXJzXG4gICAgICBpZiBpZCBpc250IEBhcHAubWUuaW1hZ2VfdXJsXG4gICAgICAgIGNvbnZvX3BhcnRuZXJzICs9IGlkXG5cbiAgICAjIyBjcmVhdGUgbmV3IGNvbnZlcnNhdGlvbiBvYmplY3QgZnJvbSBwZXJzaXN0ZW50IGNvbnZlcnNhdGlvbiBpbmZvXG4gICAgY29udm8gPSBuZXcgQ29udmVyc2F0aW9uKGNvbnZvX3BhcnRuZXJzLCBtZXNzYWdlcylcbiAgICBAY29udmVyc2F0aW9ucy5wdXNoKGNvbnZvKVxuXG5cblxuICBsb2FkX2N1cnJlbnRfdXNlcnM6IChsb2dnZWRfb24pIC0+XG4gICAgIyMgcmVjaWV2ZXMgY3VycmVudCB1c2VycyBmcm9tIHNlcnZlciBvbiBsb2dpblxuICAgIEBjdXJyZW50X3VzZXJzID0gbG9nZ2VkX29uXG4gICAgZm9yIHVzZXIgaW4gQGN1cnJlbnRfdXNlcnNcbiAgICAgIGlmIHVzZXIuaW1hZ2VfdXJsIGlzIEBtZS5pbWFnZV91cmxcbiAgICAgICAgQGN1cnJlbnRfdXNlcnMuc3BsaWNlKGksMSlcblxuICB1c2VyX2xvZ2dlZF9vbjogKGRpc3BsYXlfbmFtZSwgaW1hZ2VfdXJsKSAtPlxuICAgIHVzZXIgPSBuZXcgVXNlcihkaXNwbGF5X25hbWUsIGltYWdlX3VybClcbiAgICBAY3VycmVudF91c2Vycy5wdXNoKHVzZXIpXG5cbiAgdXNlcl9sb2dnZWRfb2ZmOiAoZGlzcGxheV9uYW1lLCBpbWFnZV91cmwpIC0+XG4gICAgZm9yIHVzZXIgaW4gQGN1cnJlbnRfdXNlcnNcbiAgICAgIGlmIGltYWdlX3VybCBpcyB1c2VyLmltYWdlX3VybFxuICAgICAgICBAY3VycmVudF91c2Vycy5zcGxpY2UoIGksIDEpXG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IEFwcCgpIiwiJCA9IHJlcXVpcmUoJ2pxdWVyeScpXG5hcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuTWVzc2FnZSA9IHJlcXVpcmUoJy4vbWVzc2FnZV9tb2RlbC5jb2ZmZWUnKVxuTWVzc2FnZVZpZXcgPSByZXF1aXJlKCcuL21lc3NhZ2Vfdmlldy5jb2ZmZWUnKVxuQ29udmVyc2F0aW9uID0gcmVxdWlyZSgnLi9jb252ZXJzYXRpb25fbW9kZWwuY29mZmVlJylcblxuXG5cblxuIyMgY29uc3RydWN0b3IgZm9yIG9iamVjdCBjb250YWluaW5nIHRlbXBsYXRlIGFuZCB1c2VyXG4jIyBpbnRlcmFjdGlvbiBsb2dpYyBmb3IgZWFjaCBvcGVuIGNoYXQgd2luZG93LlxuIyMgd2F0Y2hlcyBhIGNvbnZlcnNhdGlvbiBtb2RlbC5cbmNsYXNzIENoYXRSb29tXG5cbiAgY29uc3RydWN0b3I6IChAY29udm8pIC0+XG4gICAgQHJlbmRlcigpXG4gICAgJCgnYm9keScpLmFwcGVuZChAJGVsZW1lbnQpXG5cbiAgICAjIyBXRUJTT0NLRVQgTElTVEVORVJTIEZPUiBNRVNTQUdFIEFORCBUWVBJTkcgTk9USUZJQ0FUSU9OU1xuICAgIGFwcC5zZXJ2ZXIub24gJ21lc3NhZ2UnLCBAbWVzc2FnZV9jYWxsYmFja1xuICAgIGFwcC5zZXJ2ZXIub24gJ3VzZXJfb2ZmbGluZScsIEB1c2VyX29mZmxpbmVfY2FsbGJhY2tcbiAgICBhcHAuc2VydmVyLm9uICd0eXBpbmdfbm90aWZpY2F0aW9uJywgQHR5cGluZ19ub3RpZmljYXRpb25fY2FsbGJhY2tcblxuICAgICMjIExJU1RFTkVSUyBGT1IgVVNFUiBJTlRFUkFDVElPTiBXSVRIIENIQVQgV0lORE9XXG4gICAgQCRlbGVtZW50LmZpbmQoJy5jaGF0LWNsb3NlJykub24gJ2NsaWNrJywgQGNsb3NlV2luZG93XG4gICAgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykub24gJ2tleXByZXNzJywgQHNlbmRPbkVudGVyXG4gICAgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykub24gJ2tleXVwJywgQGVtaXRUeXBpbmdOb3RpZmljYXRpb25cbiAgICBAJGVsZW1lbnQuZmluZCgnLnRvcC1iYXIsIG1pbmlmeSAnKS5vbiAnY2xpY2snLCBAdG9nZ2xlQ2hhdFxuICAgIEAkZWxlbWVudC5vbiAnY2xpY2snLCBAcmVtb3ZlTm90aWZpY2F0aW9uc1xuICAgIEAkZGlzY3Vzc2lvbi5maW5kKCcucGFybGV5X2ZpbGVfdXBsb2FkJykub24gJ2NoYW5nZScsIEBmaWxlX3VwbG9hZFxuXG5cbiAgY2hhdF9yb29tX3RlbXBsYXRlOiBIYW5kbGViYXJzLmNvbXBpbGUoJ1xuICAgIDxkaXYgY2xhc3M9XCJwYXJsZXlcIj5cbiAgICAgIDxzZWN0aW9uIGNsYXNzPVwiY29udmVyc2F0aW9uXCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0b3AtYmFyXCI+XG4gICAgICAgICAgPGE+e3tmaXJzdF9uYW1lfX08L2E+XG4gICAgICAgICAgPHVsIGNsYXNzPVwibWVzc2FnZS1hbHRcIj5cbiAgICAgICAgICAgIDxsaSBjbGFzcz1cImVudHlwby1taW51cyBtaW5pZnlcIj48L2xpPlxuICAgICAgICAgICAgPGxpIGNsYXNzPVwiZW50eXBvLXJlc2l6ZS1mdWxsXCI+PC9saT5cbiAgICAgICAgICAgIDxsaSBjbGFzcz1cImVudHlwby1jYW5jZWwgY2hhdC1jbG9zZVwiPjwvbGk+XG4gICAgICAgICAgPC91bD5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlLWJhclwiPlxuICAgICAgICAgIDx1bCBjbGFzcz1cImFkZGl0aW9uYWxcIj5cbiAgICAgICAgICAgIDxsaT48YSBjbGFzcz1cImVudHlwby11c2VyLWFkZFwiPjwvYT48L2xpPlxuICAgICAgICAgICAgPGxpPjxhIGNsYXNzPVwiZm9udGF3ZXNvbWUtZmFjZXRpbWUtdmlkZW9cIj48L2E+PC9saT5cbiAgICAgICAgICA8L3VsPlxuICAgICAgICAgIDx1bCBjbGFzcz1cImV4aXN0aW5nXCI+XG4gICAgICAgICAgICA8bGk+PGEgY2xhc3M9XCJlbnR5cG8tY2hhdFwiPjwvYT48L2xpPlxuICAgICAgICAgIDwvdWw+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8b2wgY2xhc3M9XCJkaXNjdXNzaW9uXCI+PC9vbD5cbiAgICAgICAgPHRleHRhcmVhIGNsYXNzPVwiZ3J3XCIgcGxhY2Vob2xkZXI9XCJFbnRlciBNZXNzYWdlLi4uXCI+PC90ZXh0YXJlYT5cbiAgICAgICAgPGxhYmVsIGNsYXNzPVwiaW1nX3VwbG9hZCBlbnR5cG8tY2FtZXJhXCI+XG4gICAgICAgICAgPHNwYW4+XG4gICAgICAgICAgICA8aW5wdXQgY2xhc3M9XCJwYXJsZXlfZmlsZV91cGxvYWRcIiBuYW1lPVwiaW1nX3VwbG9hZFwiIHR5cGU9XCJmaWxlXCIgLz48L2xhYmVsPlxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgIDwvc2VjdGlvbj5cbiAgICA8L2Rpdj5cbiAgICAnKVxuXG4gIG1lc3NhZ2VfY2FsbGJhY2s6IChtZXNzYWdlKSAtPlxuICAgICAgQGNvbnZvLmFkZF9tZXNzYWdlKG1lc3NhZ2UpXG4gICAgICBAcmVuZGVyRGlzY3Vzc2lvbigpXG4gICAgICBAJGVsZW1lbnQuZmluZCgnLnRvcC1iYXInKS5hZGRDbGFzcygnbmV3LW1lc3NhZ2UnKVxuICAgICAgQHRpdGxlQWxlcnQoKVxuXG4gIHVzZXJfb2ZmbGluZV9jYWxsYmFjazogLT5cbiAgICBtZXNzYWdlID0gbmV3IE1lc3NhZ2UoIGFwcC5tZSwgJ2h0dHA6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3BhcmxleS1hc3NldHMvc2VydmVyX25ldHdvcmsucG5nJywgXCJUaGlzIHVzZXIgaXMgbm8gbG9uZ2VyIG9ubGluZVwiLCBuZXcgRGF0ZSgpIClcbiAgICBAY29udm8uYWRkX21lc3NhZ2UobWVzc2FnZSlcbiAgICBAcmVuZGVyRGlzY3Vzc2lvbigpXG5cbiAgdHlwaW5nX25vdGlmaWNhdGlvbl9jYWxsYmFjazogKGNvbnZvX2tleSwgdHlwaXN0LCBib29sKSAtPlxuICAgIGlmIGNvbnZvX2tleSBpcyBAY29udm8ubWVzc2FnZV9maWx0ZXJcbiAgICAgIGlmIGJvb2xcbiAgICAgICAgaWYgQCRkaXNjdXNzaW9uLmZpbmQoJy5pbmNvbWluZycpLmxlbmd0aCBpcyAwXG4gICAgICAgICAgdHlwaW5nX25vdGlmaWNhdGlvbiA9IFwiPGxpIGNsYXNzPSdpbmNvbWluZyc+PGRpdiBjbGFzcz0nYXZhdGFyJz48aW1nIHNyYz0nI3t0eXBpc3QuaW1hZ2VfdXJsfScvPjwvZGl2PjxkaXYgY2xhc3M9J21lc3NhZ2VzJz48cD4je3R5cGlzdC5kaXNwbGF5X25hbWV9IGlzIHR5cGluZy4uLjwvcD48L2Rpdj48L2xpPlwiXG4gICAgICAgICAgdGhhdC4kKCcuZGlzY3Vzc2lvbicpLmFwcGVuZCh0eXBpbmdOb3RpZmljYXRpb24pO1xuICAgICAgICAgIEAkZGlzY3Vzc2lvbi5hcHBlbmQodHlwaW5nX25vdGlmaWNhdGlvbilcbiAgICAgICAgICBAc2Nyb2xsVG9MYXN0TWVzc2FnZSgpXG4gICAgICBlbHNlXG4gICAgICAgIEAkZGlzY3Vzc2lvbi5maW5kKCcuaW5jb21pbmcnKS5yZW1vdmUoKVxuICAgICAgICBAc2Nyb2xsVG9MYXN0TWVzc2FnZSgpXG5cblxuICBhZGRfbWVtYmVyOiAobmV3X3VzZXIpIC0+XG4gICAgIyMgY3JlYXRlIGEgY29udmVyc2F0aW9uIGNvbnNpc3Rpbmcgb2YgY3VycmVudCBwbHVzIGFkZGVkIG1lbWJlcnNcbiAgICBuZXdfY29udm9fcGFydG5lcnMgPSBAY29udm8uY29udm9fcGFydG5lcnMuY29uY2F0KG5ld191c2VyKVxuICAgIG5ld19jb252b19ncm91cCA9IG5ldyBDb252ZXJzYXRpb24obmV3X2NvbnZvX3BhcnRuZXJzKVxuICAgIGFwcC5jb252ZXJzYXRpb25zLnB1c2gobmV3X2NvbnZvX2dyb3VwKVxuXG4gICAgIyMgcmVtb3ZlIGN1cnJlbnQgY29udm9fa2V5IGZyb20gYXBwLm9wZW5fY29udmVyc2F0aW9uc1xuICAgIGZvciBjb252byBpbiBhcHAub3Blbl9jb252ZXJzYXRpb25zXG4gICAgICBpZiBjb252byBpcyBAY29udm8ubWVzc2FnZV9maWx0ZXJcbiAgICAgICAgYXBwLm9wZW5fY29udmVyc2F0aW9ucy5zcGxpY2UoaSwxKVxuXG4gICAgIyMgcHVzaCBuZXcgY29udm8gdG8gb3BlbiBjb252ZXJzYXRpb25zLCBjaGFuZ2UgQGNvbnZvIGFuZCByZS1yZW5kZXJcbiAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2gobmV3X2NvbnZvX2dyb3VwLm1lc3NhZ2VfZmlsdGVyKVxuICAgIEBjb252byA9IG5ld19jb252b19ncm91cFxuICAgIEByZW5kZXIoKVxuXG4gIHJlbmRlcjogLT5cbiAgICBAJGVsZW1lbnQgPSAkKEBjaGF0X3Jvb21fdGVtcGxhdGUoQGNvbnZvKSlcbiAgICBAJGRpc2N1c3Npb24gPSBAJGVsZW1lbnQuZmluZCgnLmRpc2N1c3Npb24nKVxuXG4gIHJlbmRlckRpc2N1c3Npb246IC0+XG4gICAgbmV3X21lc3NhZ2UgPSBAY29udm8ubWVzc2FnZXMuc2xpY2UoLTEpWzBdXG4gICAgQGFwcGVuZE1lc3NhZ2UobmV3X21lc3NhZ2UpXG4gICAgQHNjcm9sbFRvTGFzdE1lc3NhZ2UoKVxuXG4gIGFwcGVuZE1lc3NhZ2U6IChtZXNzYWdlKS0+XG4gICAgbWVzc2FnZV92aWV3ID0gbmV3IE1lc3NzYWdlVmlldyhtZXNzYWdlKVxuICAgIG1lc3NhZ2Vfdmlldy5yZW5kZXIoKVxuICAgIEAkZGlzY3Vzc2lvbi5hcHBlbmQobWVzc2FnZV92aWV3LiRlbGVtZW50KVxuXG4gIHNjcm9sbFRvTGFzdE1lc3NhZ2U6IC0+XG4gICAgQCRkaXNjdXNzaW9uLnNjcm9sbFRvcCggQCRkaXNjdXNzaW9uLmZpbmQoJ2xpOmxhc3QtY2hpbGQnKS5vZmZzZXQoKS50b3AgKyBAJGRpc2N1c3Npb24uc2Nyb2xsVG9wKCkgKVxuXG4gIGxvYWRQZXJzaXN0ZW50TWVzc2FnZXM6IC0+XG4gICAgZm9yIG1lc3NhZ2UgaW4gQGNvbnZvLm1lc3NhZ2VzXG4gICAgICBAYXBwZW5kTWVzc2FnZShtZXNzYWdlKVxuICAgIGlmIEBtZXNzYWdlcy5sZW5ndGggPiAwXG4gICAgICBAc2Nyb2xsVG9MYXN0TWVzc2FnZSgpXG5cbiAgc2VuZE9uRW50ZXI6IChlKS0+XG4gICAgaWYgZS5rZXlDb2RlIGlzIDEzXG4gICAgICBAc2VuZE1lc3NhZ2UoKVxuICAgICAgQHJlbW92ZU5vdGlmaWNhdGlvbnMoKVxuXG4gIHNlbmRNZXNzYWdlOiAtPlxuICAgIG1lc3NhZ2UgPSBuZXcgTWVzc2FnZSBAY29udm8uY29udm9fcGFydG5lcnMsIGFwcC5tZSwgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykudmFsKClcbiAgICBAbWVzc2FnZXMuYWRkKHNlbmQpXG4gICAgQHJlbmRlckRpc2N1c3Npb24oKVxuICAgIGFwcC5zZXJ2ZXIuZW1pdCAnbWVzYWdlJywgbWVzc2FnZVxuICAgIEAkZGlzY3Vzc2lvbi5maW5kKCcuc2VuZCcpLnZhbCgnJylcbiAgICB0aGlzLmVtaXRUeXBpbmdOb3RpZmljYXRpb24oKVxuXG4gIHRvZ2dsZV9jb252bzogKGUpIC0+XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgQCRkaXNjdXNzaW9uLnRvZ2dsZSgpXG4gICAgaWYgQCRkaXNjdXNzaW9uLmF0dHIoJ2Rpc3BsYXknKSBpcyBub3QgXCJub25lXCJcbiAgICAgIEBzY3JvbGxUb0xhc3RNZXNzYWdlXG5cbiAgY2xvc2VXaW5kb3c6IChlKSAtPlxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICBhcHAuc2VydmVyLnJlbW92ZUFsbExpc3RlbmVycygpXG4gICAgQCRlbGVtZW50LmZpbmQoJy5jaGF0LWNsb3NlJykub2ZmKClcbiAgICBAJGVsZW1lbnQuZmluZCgnLnNlbmQnKS5vZmYoKVxuICAgIEAkZWxlbWVudC5maW5kKCcuc2VuZCcpLm9mZigpXG4gICAgQCRlbGVtZW50LmZpbmQoJy50b3AtYmFyJykub2ZmKClcbiAgICBAJGVsZW1lbnQub2ZmKClcbiAgICBAJGRpc2N1c3Npb24ub2ZmKClcbiAgICBAJGVsZW1lbnQucmVtb3ZlKClcbiAgICBkZWxldGUgdGhpc1xuXG4gIHJlbW92ZU5vdGlmaWNhdGlvbnM6IChlKSAtPlxuICAgIEAkZWxlbWVudC5maW5kKCcudG9wLWJhcicpLnJlbW92ZUNsYXNzKCduZXctbWVzc2FnZScpXG4gICAgaWYgYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5ub3RpZmllZFxuICAgICAgQGNsZWFyVGl0bGVOb3RpZmljYXRpb24oKVxuXG4gIGVtaXRUeXBpbmdOb3RpZmljYXRpb246IChlKSAtPlxuICAgIGlmIEAkZWxlbWVudC5maW5kKCcuc2VuZCcpLnZhbCgpIGlzbnQgXCJcIlxuICAgICAgYXBwLnNlcnZlci5lbWl0ICd1c2VyX3R5cGluZycsIEBjb252by5jb252b19wYXJ0bmVyc19pbWFnZV91cmxzLCBhcHAubWUsIHRydWVcbiAgICBlbHNlXG4gICAgICBhcHAuc2VydmVyLmVtaXQgJ3VzZXJfdHlwaW5nJywgQGNvbnZvLmNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMsIGFwcC5tZSwgZmFsc2VcblxuICBjbGVhclRpdGxlTm90aWZpY2F0aW9uOiAtPlxuICAgIGFwcC5jbGVhckFsZXJ0KClcbiAgICAkKCdodG1sIHRpdGxlJykuaHRtbCggYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5wYWdlX3RpdGxlIClcbiAgICBhcHAudGl0bGVfbm90aWZpY2F0aW9uLm5vdGlmaWVkID0gZmFsc2VcblxuICB0aXRsZUFsZXJ0OiAtPlxuICAgIGlmIG5vdCBhcHAudGl0bGVfbm90aWZpY2F0aW9uLm5vdGlmaWVkXG4gICAgICBzZW5kZXJfbmFtZSA9IEBjb252by5tZXNzYWdlc1stMV0uc2VuZGVyLmRpc3BsYXlfbmFtZVxuICAgICAgYWxlcnQgPSBcIlBlbmRpbmcgKiogI3tzZW5kZXJfbmFtZX1cIlxuXG4gICAgICBzZXRBbGVydCA9IC0+XG4gICAgICAgIGlmICQoJ2h0bWwgdGl0bGUnKS5odG1sKCkgaXMgYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5wYWdlX3RpdGxlXG4gICAgICAgICAgJCgnaHRtbCB0aXRsZScpLmh0bWwoYWxlcnQpXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAkKCdodG1sIHRpdGxlJykuaHRtbCggYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5wYWdlX3RpdGxlKVxuXG4gICAgICB0aXRsZV9hbGVydCA9IHNldEludGVydmFsKHNldEFsZXJ0LCAyMjAwKVxuXG4gICAgICBhcHAuY2xlYXJfYWxlcnQgPSAtPlxuICAgICAgICBjbGVhckludGVydmFsKHRpdGxlX2FsZXJ0KVxuXG4gICAgICBhcHAudGl0bGVfbm90aWZpY2F0aW9uLm5vdGlmaWVkID0gdHJ1ZVxuXG4gIGZpbGVfdXBsb2FkOiAtPlxuICAgIGZpbGUgPSBAJGRpc2N1c3Npb24uZmluZCgnLnBpY3R1cmVfdXBsb2FkJykuZ2V0KDApLmZpbGVzWzBdXG4gICAgYXBwLm9hdXRoLmZpbGVfdXBsb2FkIGZpbGUsIEBjb252by5jb252b19wYXJ0bmVyc19pbWFnZV91cmxzLCBhcHAubWUuaW1hZ2VfdXJsXG5cblxubW9kdWxlLmV4cG9ydHMgPSBDaGF0Um9vbVxuIiwiJCA9IHJlcXVpcmUoJ2pxdWVyeScpXG5hcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuVXNlclZpZXcgPSByZXF1aXJlKCcuL3VzZXJfdmlldy5jb2ZmZWUnKVxuUGVyc2lzdGVudENvbnZlcnNhdGlvblZpZXcgPSByZXF1aXJlKCcuL3BlcnNpc3RlbnRfY29udmVyc2F0aW9uX3ZpZXcuY29mZmVlJylcblxuXG5cblxuXG4jIENvbnRyb2wgUGFuZWwgZm9yIFBhcmxleS5qc1xuIyBUaGlzIGlzIHRoZSBvbmx5IHZpZXcgdGhhdCBjYW5ub3QgYmUgcmVtb3ZlZC5cbiMgSXQgaXMgdGhlIGh1YiBmb3IgYWxsIGludGVyYWN0aW9uLlxuY2xhc3MgQ29tbWFuZENlbnRlclxuICBjb25zdHJ1Y3RvcjogLT5cbiAgICBAbWVudSA9IG51bGxcbiAgICAkKCdib2R5JykuYXBwZW5kIGxvZ2dlZF9vdXRfdmlldygpXG4gICAgJChcInVsLmxvZ2luLWJhclwiKS5oaWRlKClcbiAgICAkKCcucGFybGV5IC5wZXJzaXN0ZW50LWJhci5sb2dnZWQtb3V0Jykub24gJ2NsaWNrJywgKGUpIC0+ICQoJ3VsLmxvZ2luLWJhcicpLnRvZ2dsZSgpXG5cblxuICBsb2dnZWRfb3V0X3ZpZXc6IEhhbmRsZWJhcnMuY29tcGlsZSgnXG4gICAgPGRpdiBjbGFzcz1cInBhcmxleVwiPlxuICAgICAgPHNlY3Rpb24gY2xhc3M9XCJjb250cm9sbGVyXCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiY29udHJvbGxlci12aWV3XCI+PC9kaXY+XG4gICAgICA8dWwgY2xhc3M9XCJsb2dpbi1iYXIgZy1zaWduaW5cIlxuICAgICAgICBkYXRhLWNhbGxiYWNrPVwic2lnbl9pbl9jYWxsYmFja1wiXG4gICAgICAgIGRhdGEtY2xpZW50aWQ9XG4gICAgICAgIGRhdGEtY29va2llcG9saWN5PVwic2luZ2xlX2hvc3Rfb3JpZ2luXCJcbiAgICAgICAgZGF0YS10aGVtZT1cIm5vbmVcIlxuICAgICAgICBkYXRhLXNjb3BlPVwiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC9wbHVzLmxvZ2luIGh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL2F1dGgvZGV2c3RvcmFnZS5yZWFkX3dyaXRlXCI+XG4gICAgICAgIDxsaSBjbGFzcz1cImJ0blwiPlxuICAgICAgICAgIDxhIGNsYXNzPVwiZW50eXBvLWdwbHVzXCI+PC9hPlxuICAgICAgICA8L2xpPlxuICAgICAgICA8bGkgY2xhc3M9XCJhc2lkZVwiPlxuICAgICAgICAgIDxhPnwgU2lnbiBpbiB3aXRoIGdvb2dsZTwvYT5cbiAgICAgICAgPC9saT5cbiAgICAgICAgPGRpdiBjbGFzcz1cInBlcnNpc3RlbnQtYmFyIHBhcmxleS1sb2dnZWQtb3V0XCI+XG4gICAgICAgICAgPGEgaWQ9XCJsb2ctY2xpY2tcIj4gY2xpY2sgaGVyZSB0byBsb2dpbiE8L2E+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJmb250YXdlc29tZS1yZW9yZGVyXCI+PC9zcGFuPlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvdWw+XG4gICAgICA8L3NlY3Rpb24+XG4gICAgPC9kaXY+XG4gICAgJylcblxuICBsb2dnZWRfaW5fdmlldzogSGFuZGxlYmFycy5jb21waWxlKCdcbiAgICA8ZGl2IGNsYXNzPVwiY29udHJvbGxlci12aWV3XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZGVmYXVsdC12aWV3XCI+XG4gICAgICAgIDxmaWd1cmU+XG4gICAgICAgICAgPGltZyBzcmM9e3tpbWFnZV91cmx9fS8+XG4gICAgICAgICAgPGgyPnt7bWUuZGlzcGxheV9uYW1lfX08L2gyPlxuICAgICAgICA8L2ZpZ3VyZT5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJjb250cm9sbGVyLWJhclwiPlxuICAgICAgPHVsIGNsYXNzPVwidXRpbGl0eS1iYXIgaG9yaXpvbnRhbC1saXN0XCI+XG4gICAgICAgIDxsaT5cbiAgICAgICAgICA8YSBjbGFzcz1cIm1lc3NhZ2VzXCIgaHJlZj1cIiNcIj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZW50eXBvLWNoYXRcIj48L3NwYW4+XG4gICAgICAgICAgPC9hPlxuICAgICAgICA8L2xpPlxuICAgICAgICA8bGk+XG4gICAgICAgICAgPGEgY2xhc3M9XCJhY3RpdmUtdXNlcnNcIiBocmVmPVwiI1wiPlxuICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJlbnR5cG8tdXNlcnNcIj48L3NwYW4+XG4gICAgICAgICAgPC9hPlxuICAgICAgICA8L2xpPlxuICAgICAgICA8bGk+XG4gICAgICAgICAgPGEgY2xhc3M9XCJ1c2VyLXNldHRpbmdzXCIgaHJlZj1cIiNcIj5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZm9udGF3ZXNvbWUtY29nXCI+PC9zcGFuPlxuICAgICAgICAgIDwvYT5cbiAgICAgICAgPC9saT5cbiAgICAgIDwvdWw+XG4gICAgICA8ZGl2IGNsYXNzPVwicGVyc2lzdGVudC1iYXJcIj5cbiAgICAgICAgPGE+e3tkaXNwbGF5X25hbWV9fTwvYT5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJmb250YXdlc29tZS1yZW9yZGVyXCI+PC9zcGFuPlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICAgJylcblxuICBsb2dfaW46IC0+XG4gICAgJChcIi5wYXJsZXkgLnBlcnNpc3RlbnQtYmFyLmxvZ2dlZF9vdXRcIikub2ZmKClcbiAgICBAJGVsZW1lbnQgPSBsb2dnZWRfaW5fdmlldyhhcHAubWUpXG4gICAgJCgnLnBhcmxleSBzZWN0aW9uLmNvbnRyb2xsZXInKS5odG1sKEAkZWxlbWVudClcbiAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLWJhciBhLm1lc3NhZ2VzJykub24oJ2NsaWNrJywgQHRvZ2dsZV9wZXJzaXN0ZW50X2NvbnZvcylcbiAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLWJhciBhLmFjdGl2ZV91c2VycycpLm9uKCdjbGljaycsIEB0b2dnbGVfY3VycmVudF91c2VycylcbiAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLWJhciBhLnVzZXItc2V0dGluZ3MnKS5vbignY2xpY2snLCBAdG9nZ2xlX3VzZXJfc2V0dGluZ3MpXG5cbiAgdG9nZ2xlX2NvbW1hbmRfY2VudGVyOiAtPlxuICAgICMjIElmIGEgdXNlciBpcyBsb2dnZWQgaW4gdGhleSBnZXQgYSBkZWZhdWx0IHByb2ZpbGUgdmlld1xuICAgICMjIG90aGVyd2lzZSBhIGxvZ2luIHdpdGggZ29vZ2xlIGFwcGVhcnMuXG4gICAgaWYgbG9nZ2VkX291dFxuICAgICAgJCggXCIucGFybGV5IC5wZXJzaXN0ZW50LWJhci5sb2dnZWQtb3V0XCIgKS5vbiBcImNsaWNrXCIsIC0+XG4gICAgICAgICQoIFwiI2xvZy1jbGlja1wiICkudG9nZ2xlKClcbiAgICAgICAgJCggXCJ1bC5sb2dpbi1iYXJcIiApLnNsaWRlVG9nZ2xlKClcbiAgICBlbHNlXG4gICAgICAkIC0+XG4gICAgICAgICQoJy5wZXJzaXN0ZW50LWJhcicpLm9uICdjbGljaycsIC0+XG4gICAgICAgICAgJCgnLmNvbnRyb2xsZXItdmlldycpLnRvZ2dsZSgpXG5cbiAgdG9nZ2xlX2N1cnJlbnRfdXNlcnM6IC0+XG4gICAgaWYgQG1lbnUgaXMgbm90IFwiY3VycmVudF91c2Vyc1wiXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5jaGlsZHJlbigpLnJlbW92ZSgpXG4gICAgICBmb3IgdXNlciBpbiBhcHAuY3VycmVudF91c2Vyc1xuICAgICAgICB2aWV3ID0gbmV3IFVzZXJWaWV3KHVzZXIpXG4gICAgICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLmFwcGVuZCh2aWV3LnJlbmRlcigpKVxuICAgIGVsc2VcbiAgICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLmNoaWxkcmVuKCkucmVtb3ZlKClcbiAgICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLmh0bWwobG9nZ2VkX2luX3ZpZXcoYXBwLm1lKSlcblxuXG4gIHRvZ2dsZV9wZXJzaXN0ZW50X2NvbnZvczogLT5cbiAgICBpZiBAbWVudSBpcyBub3QgXCJwZXJzaXN0ZW50X2NvbnZvc1wiXG4gICAgICAkKFwiLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3XCIpLmNoaWxkcmVuKCkucmVtb3ZlKClcbiAgICAgIGZvciBjb252byBpbiBhcHAuY29udmVyc2F0aW9uc1xuICAgICAgICB2aWV3ID0gbmV3IFBlcnNpc3RlbnRDb252ZXJzYXRpb25WaWV3KGNvbnZvKVxuICAgICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5hcHBlbmQodmlldy5yZW5kZXIoKSlcbiAgICBlbHNlXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5jaGlsZHJlbigpLnJlbW92ZSgpXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5odG1sKGxvZ2dlZF9pbl92aWV3KGFwcC5tZSkpXG5cblxuICB0b2dnbGVfdXNlcl9zZXR0aW5nczogLT5cblxuXG5cbm1vZHVsZS5leHBvcnRzID0gQ29tbWFuZENlbnRlclxuXG4iLCIkID0gcmVxdWlyZSgnanF1ZXJ5JylcbmFwcCA9IHJlcXVpcmUoJy4vYXBwLmNvZmZlZScpXG5cblxuXG4jIyBjb25zdHJ1Y3RvciBmb3IgY29udmVyc2F0aW9ucyBvYmplY3RzIHRoYXQgcmVwcmVzZW50IGFsbCByZWxldmFudFxuIyMgZGF0YSBhbmQgbG9naWMgcGVydGFpbmluZyB0byBtYW5hZ2luZyBhIGNvbnZlcnNhdGlvblxuIyMgaW5jbHVkaW5nIGEgY29sbGVjdGlvbiBvZiBtZXNzYWdlIG9iamVjdHMuXG5jbGFzcyBDb252ZXJzYXRpb25cblxuICBjb25zdHJ1Y3RvcjogKEBjb252b19wYXJ0bmVycywgQG1lc3NhZ2VzPVtdKSAtPlxuICAgIEBnZW5lcmF0ZV9tZXNzYWdlX2ZpbHRlcigpXG4gICAgQGZpcnN0X25hbWVfbGlzdCA9IFwiXCJcbiAgICBAY29udm9fcGFydG5lcnNfaW1hZ2VfdXJscyA9IFtdXG5cbiAgICBmb3IgdXNlciBpbiBAY29udm9fcGFydG5lcnNcbiAgICAgIGZpcnN0X25hbWUgPSB1c2VyLmRpc3BsYXlfbmFtZS5tYXRjaCgvXFxBLitcXHMvKVswXVxuICAgICAgaWYgaSBpc250IEBjb252b19wYXJ0bmVycy5sZW5ndGhcbiAgICAgICAgQGZpcnN0X25hbWVfbGlzdCArPSBcIiN7Zmlyc3RfbmFtZX0sIFwiXG4gICAgICAgIEBjb252b19wYXJ0bmVyc19pbWFnZV91cmxzICs9IHVzZXIuaW1hZ2VfdXJsXG4gICAgICBlbHNlXG4gICAgICAgIEBmaXJzdF9uYW1lX2xpc3QgKz0gXCIje2ZpcnN0X25hbWV9XCJcbiAgICAgICAgQGNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMgKz0gdXNlci5pbWFnZV91cmxcblxuICBhZGRfbWVzc2FnZTogKG1lc3NhZ2UpIC0+XG4gICAgQG1lc3NhZ2VzLnB1c2ggbWVzc2FnZVxuXG4gIGdlbmVyYXRlX21lc3NhZ2VfZmlsdGVyOiAtPlxuICAgIEBtZXNzYWdlX2ZpbHRlciA9IFthcHAubWUuaW1hZ2VfdXJsXVxuICAgIGZvciBwYXJ0bmVyIGluIEBjb252b19wYXJ0bmVyc1xuICAgICAgQG1lc3NhZ2VfZmlsdGVyLnB1c2ggcGFydG5lci5pbWFnZV91cmxcbiAgICBAbWVzc2FnZV9maWx0ZXIuc29ydCgpLmpvaW4oKVxuXG5cbm1vZHVsZS5leHBvcnRzID0gQ29udmVyc2F0aW9uXG4iLCIkID0gcmVxdWlyZSgnanF1ZXJ5JylcbmFwcCA9IHJlcXVpcmUoJy4vYXBwLmNvZmZlZScpXG5cbiMjIGNvbnN0cnVjdG9yIGZvciBvYmplY3QgdGhhdCBjb250YWlucyBhbGwgbG9naWMgYW5kIGRhdGFcbiMjIGFzc29jaWF0ZWQgd2l0aCBpbmRpdmlkdWFsIG1lc3NhZ2VzXG5cbmNsYXNzIE1lc3NhZ2VcblxuICBjb25zdHJ1Y3RvcjogKEByZWNpcGllbnRzLCBAc2VuZGVyLCBAY29udGVudCwgQHRpbWVfc3RhbXApIC0+XG4gICAgaWYgbm90IEB0aW1lX3N0YW1wXG4gICAgICBAdGltZV9zdGFtcCA9IG5ldyBEYXRlKCkudG9VVENTdHJpbmcoKVxuICAgIEBjb252b19pZCA9IEByZWNpcGllbnRzLmNvbmNhdChAc2VuZGVyKS5zb3J0KCkuam9pbigpXG4gICAgQHRpbWVfY3JlYXRlZCA9IG5ldyBEYXRlKEB0aW1lX3N0YW1wKVxuXG4gIHRpbWVfZWxhcHNlZDogLT5cbiAgICBAY3VycmVudF90aW1lID0gbmV3IERhdGUoKVxuICAgICMjIENvbnZlcnQgdG8gbWludXRlc1xuICAgIG1pbnV0ZXMgPSBNYXRoLmZsb29yKCggY3VycmVudF90aW1lIC0gdGltZV9jcmVhdGVkKSAvIDYwMDAwIClcbiAgICAjIyBkZXRlcm1pbmUgaWYgdG9kYXlcbiAgICBpZiBjdXJyZW50X3RpbWUuZ2V0RGF0ZSgpIGlzIHRpbWVfY3JlYXRlZC5nZXREYXRlKCkgYW5kIG1pbnV0ZXMgPCAxNDQwXG4gICAgICB0b2RheSA9IHRydWVcbiAgICAjIyBDb252ZXJ0IHRvIGhvdXJzXG4gICAgaG91cnMgPSBNYXRoLmZsb29yKChtaW51dGVzIC8gNjAgKSlcbiAgICBtaW51dGVfcmVtYWluZGVyID0gTWF0aC5mbG9vcigobWludXRlcyAlIDYwICkpXG4gICAgIyMgZm9ybWF0IG1lc3NhZ2VcbiAgICBpZiBtaW51dGVzIDwgNjBcbiAgICAgIHJldHVybiBcIiN7bWludXRlc30gbWlucyBhZ29cIlxuICAgIGlmIGhvdXJzIDwgNFxuICAgICAgaWYgbWludXRlX3JlbWFpbmRlciBpcyAwXG4gICAgICAgIHJldHVybiBcIiN7aG91cnN9IGhvdXJzIGFnb1wiXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBcIiN7aG91cnN9IGhvdXIgI3ttaW51dGVfcmVtYWluZGVyfSBtaW4gYWdvXCJcbiAgICBlbHNlXG4gICAgICAjIyBsb25nIHRlcm0gbWVzc2FnZSBmb3JtYXRcbiAgICAgIGZfZGF0ZSA9IEBkYXRlX2Zvcm1hdHRlcigpXG4gICAgICBpZiB0b2RheVxuICAgICAgICByZXR1cm4gXCIje2ZfZGF0ZS5ob3VyfToje2ZfZGF0ZS5taW51dGVzfSAje2ZfZGF0ZS5zdWZmaXh9XCJcbiAgICAgIGVsc2VcbiAgICAgICAgcmV0dXJuIFwiI3tmX2RhdGUubW9udGh9ICN7Zl9kYXRlLmRheX0gfCAje2ZfZGF0ZS5ob3VyfToje2ZfZGF0ZS5taW51dGVzfSAje2ZfZGF0ZS5zdWZmaXh9XCJcblxuICBkYXRlX2Zvcm1hdHRlcjogLT5cbiAgICAjIyBmb3JtYXRzIGRhdGUgZm9yIEB0aW1lX2VsYXBzZWQgZnVuY3Rpb25cblxuICAgIHN3aXRjaCBAdGltZV9jcmVhdGVkLmdldE1vbnRoKClcbiAgICAgIHdoZW4gMCB0aGVuIG5ld19tb250aCA9IFwiSmFuXCJcbiAgICAgIHdoZW4gMSB0aGVuIG5ld19tb250aCA9IFwiRmViXCJcbiAgICAgIHdoZW4gMiB0aGVuIG5ld19tb250aCA9IFwiTWFyXCJcbiAgICAgIHdoZW4gMyB0aGVuIG5ld19tb250aCA9IFwiQXByXCJcbiAgICAgIHdoZW4gNCB0aGVuIG5ld19tb250aCA9IFwiTWF5XCJcbiAgICAgIHdoZW4gNSB0aGVuIG5ld19tb250aCA9IFwiSnVuXCJcbiAgICAgIHdoZW4gNiB0aGVuIG5ld19tb250aCA9IFwiSnVsXCJcbiAgICAgIHdoZW4gNyB0aGVuIG5ld19tb250aCA9IFwiQXVnXCJcbiAgICAgIHdoZW4gOCB0aGVuIG5ld19tb250aCA9IFwiU2VwXCJcbiAgICAgIHdoZW4gOSB0aGVuIG5ld19tb250aCA9IFwiT2N0XCJcbiAgICAgIHdoZW4gMTAgdGhlbiBuZXdfbW9udGggPSBcIk5vdlwiXG4gICAgICB3aGVuIDExIHRoZW4gbmV3X21vbnRoID0gXCJEZWNcIlxuXG4gICAgaG91cnMgPSBAdGltZV9jcmVhdGVkLmdldEhvdXJzKClcbiAgICBpZiBob3VycyA+IDEyXG4gICAgICBzdWZmaXggPSBcIlBNXCJcbiAgICAgIG5ld19ob3VyID0gaG91cnMgLSAxMlxuICAgIGVsc2VcbiAgICAgIHN1ZmZpeCA9IFwiQU1cIlxuICAgICAgbmV3X2hvdXIgPSBob3Vyc1xuXG4gICAgbWludXRlcyA9IEB0aW1lX2NyZWF0ZWQuZ2V0TWludXRlcygpXG4gICAgaWYgbWludXRlcyA8IDEwXG4gICAgICBuZXdfbWludXRlcyA9IFwiMCN7bWludXRlc31cIlxuICAgIGVsc2VcbiAgICAgIG5ld19taW51dGVzID0gXCIje21pbnV0ZXN9XCJcblxuICAgIGZvcm1hdGVkID1cbiAgICAgIG1vbnRoOiBuZXdfbW9udGhcbiAgICAgIGRheTogQHRpbWVfY3JlYXRlZC5nZXREYXRlKClcbiAgICAgIGhvdXI6IG5ld19ob3VyXG4gICAgICBtaW51dGVzOiBuZXdfbWludXRlc1xuICAgICAgc3VmZml4OiBzdWZmaXhcblxubW9kdWxlLmV4cG9ydHMgPSBNZXNzYWdlXG5cblxuIiwiJCA9IHJlcXVpcmUoJ2pxdWVyeScpXG5hcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuXG5cbiMjIGNvbnN0cnVjdG9yIGZvciBvYmplY3QgdGhhdCBjb250YWlucyB0ZW1wbGF0ZSBkYXRhXG4jIyBhbmQgaW50ZXJhY3Rpb24gbG9naWMgZm9yIGluZGl2aWR1YWwgbWVzc2FnZSBtb2RlbHNcbmNsYXNzIE1lc3NhZ2VWaWV3XG5cbiAgY29uc3RydWN0b3I6IChAbWVzc2FnZSkgLT5cblxuXG4gIG1lc3NhZ2VfdGVtcGxhdGU6IEhhbmRsZWJhcnMuY29tcGlsZSgnXG5cbiAgICAgIDxkaXYgY2xhc3M9XCJhdmF0YXJcIj5cbiAgICAgICAgPGltZyBzcmM9XCJ7e3NlbmRlci5pbWFnZV91cmx9fVwiLz5cbiAgICAgIDxkaXYgY2xhc3M9XCJtZXNzYWdlIHN0YXR1c1wiPlxuICAgICAgICA8aDI+e3tzZW5kZXIuZGlzcGxheV9uYW1lfX08L2gyPlxuICAgICAgICA8cD57e2NvbnRlbnR9fTwvcD5cbiAgICAgICAgPGEgY2xhc3M9XCJ0aW1lXCI+XG4gICAgICAgICAgPHNwYW4gY2xhc3M9XCJlbnR5cG8tY2xvY2tcIj57e3RpbWVfZWxhcHNlZCgpfX08L3NwYW4+XG4gICAgICAgIDwvYT5cbiAgICAgIDwvZGl2PlxuICAgICcpXG5cbiAgcmVuZGVyOiAtPlxuICAgICMjIHJlbmRlcnMgdGVtcGxhdGUgZGlmZmVyZW50bHkgaWYgdXNlciBpcyBzZW5kaW5nIG9yIHJlY2lldmluZyB0aGUgbWVzc2FnZVxuICAgIGlmIEBtZXNzYWdlLnNlbmRlci5pbWFnZV91cmwgaXMgYXBwLm1lLmltYWdlX3VybFxuICAgICAgQCRlbGVtZW50ID0gJCgnPGxpIGNsYXNzPVwic2VsZlwiPjwvbGk+JykuYXBwZW5kKG1lc3NhZ2VfdGVtcGxhdGUoQG1lc3NhZ2UpKVxuICAgIGVsc2VcbiAgICAgIEAkZWxlbWVudCA9ICQoJzxsaSBjbGFzcz1cIm90aGVyXCI+PC9saT4nKS5hcHBlbmQobWVzc2FnZV90ZW1wbGF0ZShAbWVzc2FnZSkpXG5cbm1vZHVsZS5leHBvcnRzID0gTWVzc2FnZVZpZXciLCIkID0gcmVxdWlyZSgnanF1ZXJ5JylcbmFwcCA9IHJlcXVpcmUoJy4vYXBwLmNvZmZlZScpXG5cblxuIyMgQWxsIGxvZ2ljIHJlbGF0aW5nIHRvIGxvZ2luZyBpbiB0aHJvdWdoIEdvb2dsZSBQbHVzIE9hdXRoXG4jIyBhbmQgYW55IGxvZ2ljIHVzZWQgZm9yIHJldHJpZXZpbmcgaW5mb3JtYXRpb24gcmVxdWlyaW5nIGFuIGFjY2VzcyB0b2tlbi5cbmNsYXNzIE9hdXRoXG5cbiAgY29uc3RydWN0b3I6IC0+XG5cbiAgd2luZG93LnNpZ25faW5fY2FsbGJhY2sgPSAoYXV0aFJlc3VsdCkgPT5cbiAgICBpZiBhdXRoUmVzdWx0LnN0YXR1cy5zaWduZWRfaW5cbiAgICAgICMjIHVwZGF0ZSB0aGUgYXBwIHRvIHJlZmxlY3QgdGhlIHVzZXIgaXMgc2lnbmVkIGluLlxuICAgICAgZ2FwaS5jbGllbnQubG9hZCAncGx1cycsICd2MScsID0+XG4gICAgICAgIHJlcXVlc3QgPSBnYXBpLmNsaWVudC5wbHVzLnBlb3BsZS5nZXQoeyd1c2VySWQnOiAnbWUnfSlcbiAgICAgICAgcmVxdWVzdC5leGVjdXRlIChwcm9maWxlKSA9PlxuICAgICAgICAgIGRpc3BsYXlfbmFtZSA9IHByb2ZpbGUuZGlzcGxheU5hbWVcbiAgICAgICAgICBpbWFnZV91cmwgPSBwcm9maWxlLmltYWdlLnVybFxuICAgICAgICAgIGFwcC5tZSA9IG5ldyBVc2VyIGRpc3BsYXlfbmFtZSwgaW1hZ2VfdXJsXG4gICAgICAgICAgYXBwLnNlcnZlci5lbWl0KCdqb2luJywgZGlzcGxheV9uYW1lLCBpbWFnZV91cmwpXG4gICAgICAgICAgYXBwLmNvbW1hbmRfY2VudGVyLmxvZ19pbigpXG4gICAgICBAZmlsZV91cGxvYWQgPSAoZmlsZSwgcklEcywgc0lEKSAtPlxuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgIHVybDogXCJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS91cGxvYWQvc3RvcmFnZS92MWJldGEyL2IvcGFybGV5LWltYWdlcy9vP3VwbG9hZFR5cGU9bWVkaWEmbmFtZT0je2ZpbGUubmFtZX1cIlxuICAgICAgICAgIHR5cGU6IFwiUE9TVFwiXG4gICAgICAgICAgZGF0YTogZmlsZVxuICAgICAgICAgIGNvbnRlbnRUeXBlOiBmaWxlLnR5cGVcbiAgICAgICAgICBwcm9jZXNzRGF0YTogZmFsc2VcbiAgICAgICAgICBoZWFkZXJzOlxuICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogXCJCZWFyZXIgI3thdXRoUmVzdWx0LmFjY2Vzc190b2tlbn1cIlxuICAgICAgICAgIHN1Y2Nlc3M6IChyZXMpID0+XG4gICAgICAgICAgICBpbWFnZV9zcmM9IFwiaHR0cHM6Ly9zdG9yYWdlLmNsb3VkLmdvb2dsZS5jb20vcGFybGV5LWltYWdlcy8je3Jlcy5uYW1lfVwiXG4gICAgICAgICAgICBtc2cgPSBcIjxpbWcgc3JjPSN7aW1hZ2Vfc3JjfSAvPlwiXG4gICAgICAgICAgICBhcHAuc2VydmVyLmVtaXQoJ21lc3NhZ2UnLCBtc2csIHJJRHMsIHNJRClcbiAgICAgICAgICAgIG1lc3NhZ2UgPSBuZXcgTWVzc2FnZSBySURzLCBzSUQsIG1zZ1xuICAgICAgICAgICAgQGNvbnZvLm1lc3NhZ2VzLmFkZF9tZXNzYWdlKG1lc3NhZ2UpXG4gICAgICAgICAgICBAcmVuZGVyKClcbiAgICAgICAgfSlcbiAgICBlbHNlXG4gICAgICAjIyBsb2dpbiB1bnN1Y2Nlc3NmdWwgbG9nIGVycm9yIHRvIHRoZSBjb25zb2xlXG4gICAgICAjI1Bvc3NpYmxlIGVycm9yIHZhbHVlczpcbiAgICAgICMjXCJ1c2VyX3NpZ25lZF9vdXRcIiAtIFVzZXIgaXMgc2lnbmVkLW91dFxuICAgICAgIyNcImFjY2Vzc19kZW5pZWRcIiAtIFVzZXIgZGVuaWVkIGFjY2VzcyB0byB5b3VyIGFwcFxuICAgICAgIyNcImltbWVkaWF0ZV9mYWlsZWRcIiAtIENvdWxkIG5vdCBhdXRvbWF0aWNhbGx5IGxvZyBpbiB0aGUgdXNlclxuICAgICAgY29uc29sZS5sb2coXCJTaWduLWluIHN0YXRlOiAje2F1dGhSZXN1bHQuZXJyb3J9XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gT2F1dGgiLCIkID0gcmVxdWlyZSgnanF1ZXJ5JylcbmFwcCA9IHJlcXVpcmUoJy4vYXBwLmNvZmZlZScpXG5DaGF0Um9vbSA9IHJlcXVpcmUoJy4vY2hhdF9yb29tX3ZpZXcuY29mZmVlJylcblxuIyMgVGhpcyBpcyB0aGUgY29uc3RydWN0b3IgZm9yIGVhY2ggcGVyc2lzdGVudCBtZXNzYWdlIGluIHRoZSBsaXN0IHZpZXdcbiMjIGl0IGNvbnRhaW5zIHRoZSB0ZW1wbGF0ZSBhbmRsb2dpYyBmb3IgcmVuZGVyaW5nIHRoZSBsaXN0IHRoYXQgYXBwZWFycyBpblxuIyMgYm90aCB0aGUgY2hhdCB3aW5kb3cgYW5kIGNvbW1hbmQgY2VudGVyIHZpZXdzIGFuZCB0aGUgY29ycmVzcG9uZGluZyB1c2VyIGludGVyYWN0aW9uIGxvZ2ljLlxuY2xhc3MgUGVyc2lzdGVudENvbnZlcnNhdGlvblZpZXdcblxuICBjb25zdHJ1Y3RvcjogKEBjb252bykgLT5cbiAgICBAJGVsZW1lbnQub24gJ2NsaWNrJywgQGxvYWRfY29udm9cblxuICAgIHBlcnNpc3RlbnRfY29udm9fdGVtcGxhdGVfcmVnOiBIYW5kbGViYXJzLmNvbXBpbGUoJ1xuICAgICAgPGRpdiBjbGFzcz1cIm1lc3NhZ2UgZXhpc3RpbmdcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImF2YXRhclwiPlxuICAgICAgICAgIDxpbWcgc3JjPXt7Y29udm9fcGFydG5lcnNbMF0uaW1hZ2VfdXJsfX0gLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb250ZW50IHN0YXR1cyBlbnR5cG8tcmlnaHQtb3Blbi1iaWdcIj5cbiAgICAgICAgICA8aDI+e3tjb252b19wYXJ0bmVyLmRpc3BsYXlfbmFtZX19PC9oMj5cbiAgICAgICAgICA8cD57e21lc3NhZ2VzWy0xXS5jb250ZW50fX08L3A+XG4gICAgICAgICAgPGEgY2xhc3M9XCJ0aW1lXCI+XG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cImVudHlwby1jbG9ja1wiPiB7e21lc3NhZ2VzWy0xXS50aW1lX2VsYXBzZWQoKX19PC9zcGFuPlxuICAgICAgICAgIDwvYT5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgICcpXG5cbiAgICByZW5kZXI6IC0+XG4gICAgICBAJGVsZW1lbnQgPSBAcGVyc2lzdGVudF9jb252b190ZW1wbGF0ZV9yZWcoQGNvbnZvKVxuXG5cbiAgICBsb2FkX2NvbnZvOiAtPlxuICAgICAgIyMgaWYgY29udm8gaXNuJ3Qgb3BlbiBsb2FkIG5ldyBjaGF0IHdpbmRvdyB3aXRoIGNvbnZvXG4gICAgICBjb252b19zdGF0dXMgPSAnY2xvc2VkJ1xuICAgICAgZm9yIGNvbnZvIGluIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnNcbiAgICAgICAgaWYgQGNvbnZvLm1lc3NhZ2VfZmlsdGVyIGlzIGNvbnZvLm1lc3NhZ2VfZmlsdGVyXG4gICAgICAgICAgY29udm9fc3RhdHVzID0gJ29wZW4nXG5cbiAgICAgIGlmIGNvbnZvX3N0YXR1cyBpc250ICdvcGVuJ1xuICAgICAgICBjaGF0X3dpbmRvdyA9IG5ldyBDaGF0Um9vbShAY29udm8pXG4gICAgICAgIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnMucHVzaChAY29udm8ubWVzc2FnZV9maWx0ZXIpXG5cbiAgICAgICAgIyMgY2hlY2sgYW5kIHNlZSBpZiBhY3Rpb24gaXMgaW4gY29tbWFuZCBjZW50ZXIgb3IgY2hhdCB3aW5kb3dcbiAgICAgICAgaWYgbm90IEAkZWxlbWVudC5wYXJlbnQoKVswXS5oYXNDbGFzcygnY29udHJvbGxlci12aWV3JylcbiAgICAgICAgICBAJGVsZW1lbnQucGFyZW50cygnZGl2LnBhcmxleScpLnJlbW92ZSgpXG5cbm1vZHVsZS5leHBvcnRzID0gUGVyc2lzdGVudENvbnZlcnNhdGlvblZpZXciLCIkID0gcmVxdWlyZSgnanF1ZXJ5JylcbmFwcCA9IHJlcXVpcmUoJy4vYXBwLmNvZmZlZScpXG5cbiMjY29uc3RydWN0b3IgZm9yIG9iamVjdCB0aGF0IGhvbGRzIGFsbFxuIyNkYXRhIGFuZCBsb2dpYyByZWxhdGVkIHRvIGVhY2ggdXNlclxuXG5jbGFzcyBVc2VyXG5cbiAgY29uc3RydWN0b3I6IChAZGlzcGxheV9uYW1lLCBAaW1hZ2VfdXJsKSAtPlxuICAgICMjIGFjdGl2ZSwgaWRsZSwgYXdheSwgb3IgRE5EXG4gICAgQHN0YXR1cyA9IFwiYWN0aXZlXCJcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFVzZXIiLCIkID0gcmVxdWlyZSgnanF1ZXJ5JylcbmFwcCA9IHJlcXVpcmUoJy4vYXBwLmNvZmZlZScpXG5DaGF0Um9vbSA9IHJlcXVpcmUoJy4vY2hhdF9yb29tX3ZpZXcuY29mZmVlJylcbkNvbnZlcnNhdGlvbiA9IHJlcXVpcmUoJy4vY29udmVyc2F0aW9uX21vZGVsLmNvZmZlZScpXG5cbiMjIFRoaXMgaXMgdGhlIGNvbnN0cnVjdG9yIGZvciBlYWNoIGxpc3QgaXRlbWNvcnJlc3BvbmRpbmcgdG8gbG9nZ2VkXG4jIyBvbiB1c2VycyBkaXNwbGF5ZWQgaW4gdGhlIGxvZ2dlZCBvbiB1c2VycyBsaXN0IG9uIGJvdGhcbiMjIGNvbW1hbmQgY2VudGVyIGFuZCBjaGF0IHdpbmRvdyB2aWV3cy5cbmNsYXNzIFVzZXJWaWV3XG5cbiAgY29uc3RydWN0b3I6IChAY3VycmVudF91c2VyLCBAY2hhdF9yb29tKSAtPlxuICAgIEAkZWxlbWVudC5vbiAnY2xpY2snLCBAdXNlcl9pbnRlcmFjdF9jYWxsYmFja1xuXG4gIGN1cnJlbnRfdXNlcl90ZW1wbGF0ZTogSGFuZGxlYmFycy5jb21waWxlKCdcbiAgICAgIDxsaSBjbGFzcz1cInVzZXJcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cImF2YXRhclwiPlxuICAgICAgICAgIDxpbWcgc3JjPXt7aW1hZ2VfdXJsfX0gLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJjb250ZW50XCI+XG4gICAgICAgICAgICA8aDI+e3tkaXNwbGF5X25hbWV9fTwvaDI+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9saT5cbiAgICAgICAgJylcblxuICByZW5kZXI6IC0+XG4gICAgQCRlbGVtZW50ID0gQGN1cnJlbnRfdXNlcl90ZW1wbGF0ZShAY3VycmVudF91c2VyKVxuXG5cblxuICB1c2VyX2ludGVyYWN0X2NhbGxiYWNrOiAtPlxuICAgICMjIGlmIGludGVyYWN0aW9uIGlzIGluIHRoZSBjb21tYW5kIGNlbnRlciBvcGVuIGEgbmV3IGNvbnZvXG4gICAgaWYgQCRlbGVtZW50LnBhcmVudCgpWzBdLmhhc0NsYXNzKCdjb250cm9sbGVyLXZpZXcnKVxuICAgICAgQG9wZW5fY29udmVyc2F0aW9uKClcbiAgICBlbHNlXG4gICAgICAjIyBhZGQgdXNlciB0byBjdXJyZW50IGNvbnZvLyBtYWtlIGdyb3VwIGNvbnZvXG4gICAgICBAY2hhdF9yb29tLmFkZF9tZW1iZXIoQGN1cnJlbnRfdXNlcilcblxuICBvcGVuX2NvbnZlcnNhdGlvbjogLT5cbiAgICAjIyBjaGVjayB0byBtYWtlIHN1cmUgY29udm8gaXNuJ3QgYWxyZWFkeSBvcGVuXG4gICAgY29udm9fa2V5ID0gW2FwcC5tZS5pbWFnZV91cmwsIEBjdXJyZW50X3VzZXIuaW1hZ2VfdXJsXS5zb3J0KCkuam9pbigpXG4gICAgZm9yIGNvbnZvIGluIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnNcbiAgICAgIGlmIGNvbnZvX2tleSBpcyBjb252by5tZXNzYWdlX2ZpbHRlclxuICAgICAgICByZXR1cm5cbiAgICAjIyBjaGVjayB0byBzZWUgaWYgcGVyc2lzdGVudCBjb252byBleGlzdHMgd2l0aCB0aGUgdXNlclxuICAgIGNvbnZvX2V4aXN0cyA9IGZhbHNlXG4gICAgZm9yIGNvbnZvIGluIGFwcC5jb252ZXJzYXRpb25zXG4gICAgICBpZiBjb252by5tZXNzYWdlX2ZpbHRlciBpcyBjb252b19rZXlcbiAgICAgICAgY29udm9fZXhpc3RzID0gdHJ1ZVxuICAgIGlmIGNvbnZvX2V4aXN0c1xuICAgICAgY2hhdF93aW5kb3cgPSBuZXcgQ2hhdFJvb20oY29udm8pXG4gICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2goY29udm9fa2V5KVxuICAgIGVsc2VcbiAgICAgIGNvbnZlcnNhdGlvbiA9IG5ldyBDb252ZXJzYXRpb24oW0BjdXJyZW50X3VzZXJdKVxuICAgICAgY2hhdF93aW5kb3cgPSBuZXcgQ2hhdFJvb20oY29udmVyc2F0aW9uKVxuICAgICAgYXBwLmNvbnZlcnNhdGlvbnMucHVzaChjb252ZXJzYXRpb24pXG4gICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2goY29udm9fa2V5KVxuXG5tb2R1bGUuZXhwb3J0cyA9IFVzZXJWaWV3Il19

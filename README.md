#Parley.js
An open source real-time communication library supporting individual and group converations powered by [Socket.io](http://github.com/LearnBoost/socket.io)

###Dependencies
 - jQuery
 - Socket.io(loaded dynamically)
 - Deployed Node.js server downloaded from this repo(Easy!)

###Features
 - Dynamic Group Conversations
 - Conversation Persistence
 - Typing and Message Notifications
 - Picture Messages
 - Window Management

###PARLEY.JS IS CURRENTLY IN DEVELOPMENT AND NOT RECOMMENDED FOR PRODUCTION--FOLLOW REPO FOR UPDATES ON UPCOMING ALPHA RELEASE.

##Setup
To contribute to Parley.js you must install the development and build dependencies.

To run the gulp task in Gulpfile you must install Gulp globally.
After cloning or forking repo..
```bash
npm install gulp -g
```
then install all dependencies
```bash
npm install
```
To compile all Coffee and Sass
```bash
gulp build
```
Server is ready for heroku deployment but can be changed to fit other hosting enviorments.

Production files are bundled with Handlebars runtime.


##License

parley.js is Copyright © 2014 parley. It is free software, and may be redistributed under the terms specified in the LICENSE file.

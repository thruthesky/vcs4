"use strict";
/// <reference path="typings/globals/node/index.d.ts" />
/// <reference path="typings/globals/socket.io/index.d.ts" />
/// <reference path="typings/globals/extend/index.d.ts" />
/// import fs = require('fs');
/// import oo = require('socket.io');
var extend = require("extend");
var admin_type = 'Admin';
var participant_type = 'Participant';
var lobbyRoomName = 'Lobby';
var EmptyRoomname = '';
var VideoCenterServer = (function () {
    function VideoCenterServer() {
        this.users = {};
        this.whiteboard_settings = {}; // @display:boolean @image_url:string
        console.log("VideoCenterServer::constructor() ...");
        //initialize whiteboard
        this.whiteboard_line_history = new Array();
    }
    /*-----Listener---*/
    VideoCenterServer.prototype.listen = function (socket, io) {
        var _this = this;
        console.log('Someone Connected.');
        this.io = io;
        this.addUser(socket);
        socket.on('disconnect', function () {
            _this.disconnect(socket);
        });
        socket.on('join-room', function (roomname, callback) {
            _this.joinRoom(socket, roomname, callback);
        });
        socket.on('update-username', function (username, callback) {
            _this.updateUsername(socket, username, callback);
        });
        socket.on('sign-as-admin', function (username, callback) {
            _this.sign_as_admin(socket, username, callback);
        });
        socket.on('create-room', function (roomname, callback) {
            _this.createRoom(socket, roomname, callback);
        });
        socket.on('chat-message', function (message, callback) {
            _this.chatMessage(socket, message, callback);
        });
        socket.on('chat-private-message', function (data, callback) {
            _this.chat_private_message(socket, data, callback);
        });
        socket.on('leave-room', function (callback) {
            _this.leaveRoom(socket, callback);
        });
        socket.on('log-out', function (callback) {
            _this.logout(socket, callback);
        });
        socket.on('user-list', function (roomname, callback) {
            _this.userList(socket, roomname, callback);
        });
        socket.on('room-list', function (callback) {
            _this.roomList(socket, callback);
        });
        socket.on('whiteboard', function (data, callback) {
            _this.whiteboard(socket, data, callback);
        });
        socket.on('room-cast', function (data) {
            socket.broadcast.to(data.roomname).emit('room-cast', data);
        });
        socket.on('get-my-info', function (callback) {
            var user = _this.getUser(socket);
            callback(user);
        });
    };
    VideoCenterServer.prototype.whiteboard = function (socket, data, callback) {
        if (data.command == 'draw')
            this.whiteboardDraw(socket, data);
        else if (data.command == 'whiteboard-textarea')
            this.whiteboardTextArea(socket, data);
        else if (data.command == 'clear')
            this.whiteboardClear(socket, data);
        else if (data.command == 'history')
            this.whiteboardHistory(socket, data, callback);
        else if (data.command == 'settings')
            this.whiteboardSettings(socket, data, callback);
        else if (data.command == 'show-whiteboard')
            this.settingsWhiteboardShow(socket, data, callback);
        else if (data.command == 'hide-whiteboard')
            this.settingsWhiteboardHide(socket, data);
        else if (data.command == 'canvas-size')
            this.settingsWhiteboardSize(socket, data);
        else if (data.command == 'change-image')
            this.settingsWhiteboardImageUrl(socket, data);
        else {
            var user = this.getUser(socket);
            socket.broadcast.to(user.room).emit('whiteboard', data);
        }
        if (this.excludedWhiteboardCallback(data))
            callback(data);
    };
    VideoCenterServer.prototype.excludedWhiteboardCallback = function (data) {
        return data.command != 'settings' || data.command != 'show-whiteboard';
    };
    VideoCenterServer.prototype.whiteboardDraw = function (socket, data) {
        try {
            // add received line to history     
            if (typeof this.whiteboard_line_history[data.room_name] == "undefined")
                this.whiteboard_line_history[data.room_name] = [data];
            else
                this.whiteboard_line_history[data.room_name].push(data);
            // send line to all clients
            socket.broadcast.to(data.room_name).emit('whiteboard', data);
        }
        catch (e) {
            //send error message
            socket.emit('error', 'socket.on("whiteboard") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.whiteboardTextArea = function (socket, data) {
        try {
            // add received line to history     
            if (typeof this.whiteboard_line_history[data.room_name] == "undefined")
                this.whiteboard_line_history[data.room_name] = [data];
            else
                this.whiteboard_line_history[data.room_name].push(data);
            // send line to all clients
            socket.broadcast.to(data.room_name).emit('whiteboard', data);
        }
        catch (e) {
            //send error message
            socket.emit('error', 'socket.on("whiteboard") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.whiteboardClear = function (socket, data) {
        var roomname = data.room_name;
        this.io["in"](roomname).emit('whiteboard', data);
        try {
            delete this.whiteboard_line_history[roomname];
        }
        catch (e) {
            socket.emit('error', 'socket.on("whiteboard-clear") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.whiteboardDeleteSettings = function (socket, data) {
        var roomname = data.room_name;
        try {
            delete this.whiteboard_settings[roomname];
        }
        catch (e) {
            socket.emit('error', 'socket.on("whiteboardDeleteSettings") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.whiteboardHistory = function (socket, data, callback) {
        console.log("get-whiteboard-draw-line-history");
        try {
            var lines = this.whiteboard_line_history[data.room_name];
            for (var i in lines) {
                if (!lines.hasOwnProperty(i))
                    continue;
                var data_1 = lines[i];
                socket.emit('whiteboard', data_1);
            }
        }
        catch (e) {
            socket.emit('error', 'socket.on("get-whiteboard-draw-line-history") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.whiteboardSettings = function (socket, data, callback) {
        console.log("whiteboardSettings");
        try {
            if (typeof this.whiteboard_settings[data.room_name] == "undefined") {
                this.whiteboard_settings[data.room_name] = {};
                this.whiteboard_settings[data.room_name].display = false;
                this.whiteboard_settings[data.room_name].size = 'small';
                this.whiteboard_settings[data.room_name].image_url = '../../assets/img/default.png';
            }
            callback(this.whiteboard_settings[data.room_name]);
            var user = this.getUser(socket);
            socket.broadcast.to(user.room).emit('whiteboard', data);
        }
        catch (e) {
            socket.emit('error', 'socket.on("whiteboardSettings") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.settingsWhiteboardSize = function (socket, data) {
        console.log("settingsWhiteboardSize");
        try {
            if (typeof this.whiteboard_settings[data.room_name] == "undefined")
                this.whiteboard_settings[data.room_name] = {};
            this.whiteboard_settings[data.room_name].size = data.size;
            var user = this.getUser(socket);
            socket.broadcast.to(user.room).emit('whiteboard', data);
        }
        catch (e) {
            socket.emit('error', 'socket.on("settingsWhiteboardSize") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.settingsWhiteboardImageUrl = function (socket, data) {
        console.log("settingsWhiteboardImageUrl");
        try {
            if (typeof this.whiteboard_settings[data.room_name] == "undefined")
                this.whiteboard_settings[data.room_name] = {};
            this.whiteboard_settings[data.room_name].image_url = data.image_url;
            var user = this.getUser(socket);
            socket.broadcast.to(user.room).emit('whiteboard', data);
        }
        catch (e) {
            socket.emit('error', 'socket.on("settingsWhiteboardImageUrl") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.settingsWhiteboardShow = function (socket, data, callback) {
        console.log("settingsWhiteboardShow");
        try {
            if (typeof this.whiteboard_settings[data.room_name] == "undefined")
                this.whiteboard_settings[data.room_name] = {};
            if (typeof this.whiteboard_settings[data.room_name] == "undefined") {
                this.whiteboard_settings[data.room_name] = {};
                this.whiteboard_settings[data.room_name].display = false;
                this.whiteboard_settings[data.room_name].size = 'small';
                this.whiteboard_settings[data.room_name].image_url = '../../assets/img/default.png';
            }
            callback(this.whiteboard_settings[data.room_name]);
            this.whiteboard_settings[data.room_name].display = true;
            var user = this.getUser(socket);
            data.image_url = this.whiteboard_settings[data.room_name].image_url;
            socket.broadcast.to(user.room).emit('whiteboard', data);
        }
        catch (e) {
            socket.emit('error', 'socket.on("settingsWhiteboardShow") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.settingsWhiteboardHide = function (socket, data) {
        console.log("settingsWhiteboardHide");
        try {
            if (typeof this.whiteboard_settings[data.room_name] == "undefined")
                this.whiteboard_settings[data.room_name] = {};
            this.whiteboard_settings[data.room_name].display = false;
            var user = this.getUser(socket);
            socket.broadcast.to(user.room).emit('whiteboard', data);
        }
        catch (e) {
            socket.emit('error', 'socket.on("settingsWhiteboardHide") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.get_error_message = function (e) {
        var message = 'Unknown';
        if (typeof e.message != 'undefined')
            message = e.message;
        return message;
    };
    VideoCenterServer.prototype.pong = function (callback) {
        console.log("I got ping. pong it.");
        callback('pong');
    };
    VideoCenterServer.prototype.disconnect = function (socket) {
        var user = this.getUser(socket);
        if (user.room != lobbyRoomName)
            this.io["in"](lobbyRoomName).emit('disconnect', user);
        this.io["in"](user.room).emit('disconnect', user);
        this.io.sockets.emit('disconnect-private-message', user);
        this.leaveRoom(socket, function () { return console.log("You left and disconnect"); });
        this.removeUser(socket.id);
        socket.leave(user.room);
        console.log("Someone Disconnected.");
    };
    VideoCenterServer.prototype.logout = function (socket, callback) {
        var user = this.getUser(socket);
        socket.leave(user.room);
        this.io.sockets.emit('log-out', user);
        user.room = EmptyRoomname;
        this.setUser(user);
        this.removeUser(socket);
        console.log(user.name + ' has logged out.');
        callback();
    };
    VideoCenterServer.prototype.addUser = function (socket) {
        var user = {};
        user.name = 'Anonymous';
        user.room = EmptyRoomname;
        user.socket = socket.id;
        user.type = participant_type;
        this.users[socket.id] = user;
        return this.users[socket.id];
    };
    VideoCenterServer.prototype.setUser = function (user) {
        this.users[user.socket] = user;
        return this.users[user.socket];
    };
    //
    VideoCenterServer.prototype.getUser = function (socket) {
        return this.users[socket.id];
    };
    VideoCenterServer.prototype.setUsername = function (socket, username) {
        var user = this.getUser(socket);
        user.name = username;
        return this.setUser(user);
    };
    VideoCenterServer.prototype.setAdmin = function (socket) {
        var user = this.getUser(socket);
        user.type = admin_type;
        return this.setUser(user);
    };
    VideoCenterServer.prototype.setParticipant = function (socket) {
        var user = this.getUser(socket);
        user.type = participant_type;
        return this.setUser(user);
    };
    VideoCenterServer.prototype.updateUsername = function (socket, username, callback) {
        var user = this.getUser(socket);
        var oldusername = user.name;
        user = this.setUsername(socket, username);
        this.setUser(socket);
        console.log(oldusername + " change it's name to " + username);
        console.log(user);
        callback(user);
        this.io.sockets.emit('update-username', user);
    };
    VideoCenterServer.prototype.sign_as_admin = function (socket, username, callback) {
        var user = this.getUser(socket);
        var oldusername = user.name;
        user = this.setUsername(socket, username);
        this.setAdmin(socket);
        console.log(oldusername + " change it's name to " + username);
        console.log(user);
        callback(user);
        // this.io.sockets.emit('update-username', user );
    };
    /**
     *
     * @attention This does not create a room. There is no such thing like creating a room in socket.io
     * @note but we do here to check every thing is okay to create a room.
     *      for instance, if a room is already created with the same roomname, we will send a failure message to user.
     */
    VideoCenterServer.prototype.createRoom = function (socket, roomname, callback) {
        var user = this.getUser(socket);
        console.log(user.name + ' created and joined :' + roomname);
        callback(roomname);
    };
    VideoCenterServer.prototype.leaveRoom = function (socket, callback) {
        var user = this.getUser(socket);
        console.log(user.name + ' leave the room: ' + user.room);
        socket.leave(user.room);
        this.io["in"](user.room).emit('remove-user', user);
        if (this.is_room_exist(user.room)) {
            // room exist...
            console.log("room exists. don't broadcast for room delete");
            callback();
        }
        else if (this.get_room_users(user.room)) {
            // room exists...
            console.log("user exists. don't broadcast for room delete");
            callback();
        }
        else {
            this.io.sockets.emit('leave-room', user.room);
            var data = { room_name: user.room };
            data.command = "clear";
            this.whiteboardClear(socket, data);
            this.whiteboardDeleteSettings(socket, data);
            callback();
        }
    };
    VideoCenterServer.prototype.chat_private_message = function (socket, data, callback) {
        var user = this.getUser(socket);
        //for sender
        socket.broadcast.to.socket(socket.id).emit('chat-private-message', { message: data.message, name: data.name, pmsocket: data.pmsocket });
        //for receiver
        socket.broadcast.to(data.pmsocket).emit('chat-private-message', { message: data.message, name: data.name, pmsocket: socket.id });
        callback(user);
    };
    VideoCenterServer.prototype.chatMessage = function (socket, message, callback) {
        var user = this.getUser(socket);
        this.io["in"](user.room).emit('chatMessage', { message: message, name: user.name, room: user.room });
        callback(user);
    };
    VideoCenterServer.prototype.removeUser = function (id) {
        delete this.users[id];
    };
    VideoCenterServer.prototype.joinRoom = function (socket, newRoomname, callback) {
        var user = this.getUser(socket);
        var prevRoom = user.room;
        /**
         * @attention who first visits the chat page, even though he has old room, His prev room is empty because whoever creates socket, the default is empty.
         */
        if (prevRoom) {
            socket.leave(prevRoom); // prev room           
        }
        user.room = newRoomname; // new room
        this.setUser(user); // update new room on user
        //Test if room exist
        if (this.is_room_exist(user.room)) {
            // room exist...
            console.log("Room exists. Join the room");
        }
        else {
            console.log("Room doesn't exists. Create the room:" + user.room);
            if (user.room != lobbyRoomName) {
                console.log("Creating new room:", newRoomname);
            }
        }
        socket.join(newRoomname);
        if (callback)
            callback(user);
        var move_room = !!prevRoom; // He has prev room name. Meaning he was in room or lobby. He is moving into another room. he is not refreshing the browser.
        var move_into_lobby = prevRoom == lobbyRoomName; // He was in another room and he joins 'lobby'. He is not refreshing browser, nor re-connected.
        var visit = !prevRoom; // He access(visits) the chat page. He is not moving into room from other room. He may refresh browser, disconnected, or whatever.. he access the site again.
        var my_room = !!prevRoom || newRoomname == lobbyRoomName ? lobbyRoomName : newRoomname;
        var room = '';
        // @todo Case Z.
        this.io["in"](lobbyRoomName).emit('join-room', user); // all the cases.
        if (move_room) {
            if (move_into_lobby) {
                room = newRoomname; // Case 4.
            }
            else {
                room = prevRoom; // Case 3. ( Case 2. comes here. and it's okay. )
            }
        }
        else if (visit) {
            if (my_room != lobbyRoomName) {
                room = newRoomname; // Case 1.6
            }
        }
        if (room)
            this.io["in"](room).emit('join-room', user);
    };
    VideoCenterServer.prototype.userList = function (socket, roomname, callback) {
        var users;
        if (roomname) {
            users = this.get_room_users(roomname);
        }
        else {
            users = this.users;
        }
        /**
         * @Warning this is a bug. Don't why this.users contains 'undefined': Socket
         */
        delete (users['undefined']);
        callback(users);
    };
    VideoCenterServer.prototype.roomList = function (socket, callback) {
        callback(this.get_room_list());
    };
    /**
     * @warning there is a bug in this method.
     *
     *  when room='Lobby' and user=true,
     *  it should return room 'Lobby' information together with Users of 'Lobby' room.
     *
     *  But it returns all the room with the users of the room.
     *
     *      - if room='Talk' and users=false, then returns 'Talk' as string.
     *      - if room=undefined and users=true, then returns all the room with its users.
     *      - if room='Talk' and users=true,  then returns all the room with its users.
     *
     * @note if you want to get users of a room, use get_room_users()
     */
    VideoCenterServer.prototype.get_room_list = function (opts) {
        var defaults = {
            room: false,
            user: false
        };
        var o = extend(defaults, opts);
        var rooms = this.io.sockets.adapter.rooms;
        var roomList = [];
        var room;
        var re;
        for (var roomname in rooms) {
            if (!rooms.hasOwnProperty(roomname))
                continue;
            if (roomname == '')
                continue;
            roomname = roomname.replace(/^\//, '');
            re = false;
            if (o.user) {
                re = {
                    roomname: roomname,
                    users: this.get_room_users(roomname)
                };
            }
            else {
                if (o.room == false)
                    re = roomname;
                else if (o.room == roomname)
                    re = roomname;
            }
            if (re)
                roomList.push(re);
        }
        return roomList;
    };
    VideoCenterServer.prototype.get_room_users = function (roomname) {
        if (this.is_room_exist(roomname)) {
            var room = this.get_room(roomname);
            if (room) {
                var users = [];
                for (var socket_id in room) {
                    if (!room.hasOwnProperty(socket_id))
                        continue;
                    var id = room[socket_id];
                    users.push(this.getUser({ id: id }));
                }
                return users;
            }
        }
        return 0;
    };
    VideoCenterServer.prototype.is_room_exist = function (roomname) {
        var re = this.get_room_list({ room: roomname });
        return re.length;
    };
    VideoCenterServer.prototype.get_room = function (roomname) {
        var rooms = this.io.sockets.adapter.rooms;
        roomname = '/' + roomname;
        return rooms[roomname];
    };
    return VideoCenterServer;
}());
exports = module.exports = VideoCenterServer;
//# sourceMappingURL=video-center-library.js.map
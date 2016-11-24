"use strict";
/// <reference path="typings/globals/node/index.d.ts" />
/// <reference path="typings/globals/socket.io/index.d.ts" />
/// <reference path="typings/globals/extend/index.d.ts" />
/// import fs = require('fs');
/// import oo = require('socket.io');
var extend = require('extend');
var admin_type = 'Admin';
var participant_type = 'Participant';
var lobbyRoomName = 'Lobby';
var EmptyRoomname = '';
var VideoCenterServer = (function () {
    function VideoCenterServer() {
        this.users = {};
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
        socket.on('whiteboard', function (data) {
            _this.whiteboard(socket, data);
        });
        socket.on('room-cast', function (data) {
            socket.broadcast.to(data.roomname).emit('room-cast', data);
        });
        socket.on('get-my-info', function (callback) {
            var user = _this.getUser(socket);
            callback(user);
        });
    };
    VideoCenterServer.prototype.whiteboard = function (socket, data) {
        if (data.command == 'draw')
            this.whiteboardDraw(socket, data);
        else if (data.command == 'clear')
            this.whiteboardClear(socket, data);
        else if (data.command == 'history')
            this.whiteboardHistory(socket, data);
        else {
            var user = this.getUser(socket);
            socket.broadcast.to(user.room).emit('whiteboard', data);
        }
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
    VideoCenterServer.prototype.whiteboardClear = function (socket, data) {
        var roomname = data.room_name;
        this.io.in(roomname).emit('whiteboard', data);
        try {
            delete this.whiteboard_line_history[roomname];
        }
        catch (e) {
            socket.emit('error', 'socket.on("whiteboard-clear") Cause: ' + this.get_error_message(e));
        }
    };
    VideoCenterServer.prototype.whiteboardHistory = function (socket, data) {
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
            this.io.in(lobbyRoomName).emit('disconnect', user);
        this.io.in(user.room).emit('disconnect', user);
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
        this.io.in(user.room).emit('remove-user', user);
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
        this.io.in(user.room).emit('chatMessage', { message: message, name: user.name, room: user.room });
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
        this.io.in(lobbyRoomName).emit('join-room', user); // all the cases.
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
            this.io.in(room).emit('join-room', user);
    };
    VideoCenterServer.prototype.userList = function (socket, roomname, callback) {
        var users;
        if (roomname) {
            /**
             * @attention I can use 'this.user' but i did it for experimental.
             *
             */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlkZW8tY2VudGVyLWxpYnJhcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2aWRlby1jZW50ZXItbGlicmFyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsd0RBQXdEO0FBQ3hELDZEQUE2RDtBQUM3RCwwREFBMEQ7QUFDMUQsOEJBQThCO0FBQzlCLHFDQUFxQztBQUNyQyxJQUFPLE1BQU0sV0FBVSxRQUFRLENBQUMsQ0FBQztBQVVqQyxJQUFNLFVBQVUsR0FBVSxPQUFPLENBQUM7QUFDbEMsSUFBTSxnQkFBZ0IsR0FBVSxhQUFhLENBQUM7QUFDOUMsSUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDO0FBQzlCLElBQU0sYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUV6QjtJQUtJO1FBRk8sVUFBSyxHQUFHLEVBQUUsQ0FBQztRQUdkLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0NBQXNDLENBQUMsQ0FBQztRQUNwRCx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLHVCQUF1QixHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7SUFDL0MsQ0FBQztJQUNELG9CQUFvQjtJQUNwQixrQ0FBTSxHQUFOLFVBQU8sTUFBTSxFQUFFLEVBQUU7UUFBakIsaUJBa0RDO1FBakRHLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUViLElBQUksQ0FBQyxPQUFPLENBQUUsTUFBTSxDQUFFLENBQUM7UUFDdkIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUU7WUFDcEIsS0FBSSxDQUFDLFVBQVUsQ0FBRSxNQUFNLENBQUUsQ0FBQztRQUM5QixDQUFDLENBQUUsQ0FBQztRQUNKLE1BQU0sQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLFVBQUUsUUFBZSxFQUFFLFFBQVk7WUFDbEQsS0FBSSxDQUFDLFFBQVEsQ0FBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBRSxDQUFDO1FBQ2hE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
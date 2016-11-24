// Muaz Khan      - www.MuazKhan.com
// MIT License    - www.WebRTC-Experiment.com/licence
// Documentation  - github.com/muaz-khan/RTCMultiConnection

// Please use HTTPs on non-localhost domains.
var isUseHTTPs = false && !(!!process.env.PORT || !!process.env.IP);

// user-guide: change port via "config.json"
var port = process.env.PORT || 9001;

var server = require(isUseHTTPs ? 'https' : 'http'),
    url = require('url'),
    path = require('path'),
    fs = require('fs');

function serverHandler(request, response) {
    try {
        var uri = url.parse(request.url).pathname,
            filename = path.join(process.cwd(), uri);

        fs.readFile(filename, 'utf8', function(err, file) {
            if (err) {
                response.writeHead(500, {
                    'Content-Type': 'text/plain'
                });
                response.write('404 Not Found: ' + path.join('/', uri) + '\n');
                response.end();
                return;
            }
            response.writeHead(200);
            response.write(file, 'utf8');
            response.end();
        });
    } catch (e) {
        response.writeHead(404, {
            'Content-Type': 'text/plain'
        });
        response.write('<h1>Unexpected error:</h1><br><br>' + e.stack || e.message || JSON.stringify(e));
        response.end();
    }
}

var app;

if (isUseHTTPs) {
    var options = {
        //key: fs.readFileSync(path.join(__dirname, 'fake-keys/privatekey.pem')),
        //cert: fs.readFileSync(path.join(__dirname, 'fake-keys/certificate.pem'))
        key: fs.readFileSync('ssl/videocenter/videocenter_co_kr.key'),
        cert: fs.readFileSync('ssl/videocenter/videocenter_co_kr.crt-ca-bundle')
    };
    app = server.createServer(options, serverHandler);
} else app = server.createServer(serverHandler);


var _vc = require('./video-center-library.js');
var  vc = new _vc();

function runServer() {
    app = app.listen(port, process.env.IP || '0.0.0.0', function() {
        var addr = app.address();

        if (addr.address === '0.0.0.0') {
            addr.address = 'localhost';
        }

        console.log('Server listening at ' + (isUseHTTPs ? 'https' : 'http') + '://' + addr.address + ':' + addr.port);
    });

    require('./Signaling-Server.js')(app, function(socket, io) {
        try {
            var params = socket.handshake.query;

            // "socket" object is totally in your own hands!
            // do whatever you want!

            // in your HTML page, you can access socket as following:
            // connection.socketCustomEvent = 'custom-message';
            // var socket = connection.getSocket();
            // socket.emit(connection.socketCustomEvent, { test: true });

            if (!params.socketCustomEvent) {
                params.socketCustomEvent = 'custom-message';
            }

            socket.on(params.socketCustomEvent, function(message) {
                try {
                    socket.broadcast.emit(params.socketCustomEvent, message);
                } catch (e) {}
            });
        } catch (e) {}
        vc.listen( socket, io );
    });
}

runServer();

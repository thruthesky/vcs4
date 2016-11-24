# vcs4
Video Center Server Version 4

# Installation

* get files from Muaz Khan's Work : https://github.com/muaz-khan/RTCMultiConnection
    * copy /dist
    * copy SignalingServer.js
    * copy config.json
    * package.json
    * server.js
    * npm install --verbose

* Install modules & typings
    npm install extend util --save
    typings init
    typings install dt~node --global --save
    typings install dt~extend --global --save
    typings install dt~socket.io --global --save

* Compile video-center-library.ts
    tsc video-center-library.ts
* Copy server.js into center-4-server.js and Edit
* Edit SignalingServer.js to fit 'Video Center Server 4'


# RUN

* node center-4-server.js



# DEBUG

* tsc video-center-library.ts --watch --inlineSourceMap
* node center-4-server.js
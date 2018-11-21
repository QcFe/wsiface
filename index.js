const express = require('express');
const expressWs = require('express-ws');

/**
 * @class
 * WsIface Main class - can be found in `module.WsIfaceServer`
 */
class WsIfaceServer {

    /**
     * Instantiate WsIfaceServer
     */
    constructor (winstonLogger) {
        this.app = express();
        this.ews = expressWs(this.app);
        this.logger = winstonLogger || console;
        this.channels = {};
    }

    /**
     * Create new WebSocket channel
     * @param {string} name 
     */
    createChannel(name) {
        return new Channel(this, name);
    }
    
    /**
     * Start WsIfaceServer on port p
     * @param {number} p 
     */
    start (p) {
        this.port = p;

        this.bindStatic('/wsiface', __dirname + '/assets');

        this.createChannel('/');

        this.app.get('/check', (req, res) => {
            res.sendStatus(200);
        });

        return this.app.listen(this.port, () => {
            this.logger.log('info', 'WsIfaceServer started on port \x1b[32m' 
                                        + this.port + '\x1b[0m');
        });
    }

    /**
     * Bind __action__ to received __message__ for every client
     * @param {string} message - Received message
     * @param {function} action - Desired action
     * @param {string} [channel='/'] - Optional, defaults to '/', 
     *                                  desired channel
     */
    on(message, action, channel) {
        channel = channel || '/';
        this.channels[channel].on(message, action);
    }

    /**
     * UNBind any action to received __message__ for every client
     * @param {string} message - Received message
     * @param {string} [channel='/'] - Optional, defaults to '/', 
     *                                  desired channel
     */
    off(message, channel) {
        channel = channel || '/';
        this.channels[channel].off(message);
    }

    /**
     * Broadcast packet to every client in a channel
     * @param {object} data  - Data object to be sent
     * @param {string} [channel='/'] - Optional, defaults to '/', 
     *                                  desired channel
     */
    broadcast (data, channel) {
        channel = channel || '/';
        this.channels[channel].broadcast(data);
    }

    /**
     * Set and push status to channel
     * @param {Object} status - Desired status
     * @param {string} [channel='/'] - Optional, defaults to '/', 
     *                                  desired channel
     */
    setStatus(status, channel) {
        channel = channel || '/';
        this.channels[channel].setStatus(status);
    }

    /**
     * Bind static __folder__ to __endpoint__
     * @param {string} endpoint - Server endpoint
     * @param {string} folder - Local folder
     */
    bindStatic (endpoint, folder) {
        this.logger.log('info', 
            'Binding folder <' + folder + '> to ' + endpoint);
        return this.app.use(endpoint, express.static(folder));
    }

    
}

/**
 * @class
 * Channel class - can be found in `module.WsIfaceChannel`
 */
class Channel {
    /**
     * Create new channel
     * @param {Express} app - Express app 
     *                      (required express-ws binding)
     * @param {*} name - Channel name
     */
    constructor(wsifacesrv, name) {
        this.name = name;
        this.wsi = wsifacesrv;
        this.clients = {};
        this.status = {};
        this.listeners = {};
        this.wsi.app.ws(name, (ws) => {
            var id = genStr();
            while (this.clients[id]) { id = genStr(); }
            ws.wsiId = id;
            this.addClient(ws);
        });
        this.wsi.channels[name] = this;
        this.on('*', data => {
            this.wsi.logger.log('silly', data)
        })
    }

    /**
     * Add a new client to the channel
     * @param {WebSocket} wsc 
     */
    addClient(wsc) {
        this.clients[wsc.wsiId] = wsc;
        this.wsi.logger.log('debug', 'Client connected on '
                             + this.name + ': ' + wsc.wsiId);
        fEach(this.listeners, (msg, listener) => wsc.on(msg, listener));
        wsc.send(JSON.stringify({status: this.status}));
    }

    /**
     * Set and send status to every client in this channel
     * @param {Object} status 
     */
    setStatus(status) {
        this.status = status;
        this.pushStatus();
    }

    /**
     * Send status to every client in this channel
     */
    pushStatus() {
        this.broadcast({status: this.status});
    }

    /**
     * Broadcast packet to every client in the channel
     * @param {object} data  - Data object to be sent
     */
    broadcast (data) {
        if (typeof data == 'object') data = JSON.stringify(data);
        this.eachClient((wsid, client) => client.send(data));
    }

    /**
     * Bind specified __action__ to received __message__ 
     *                              for every client
     * @param {string} message - Received message
     * @param {function} action - Desider action
     */
    on(message, action) {
        this.listeners[message] = action;
        this.eachClient((wsid, client) => client.on(message, action));
    }

    /**
     * UNBind any action to received __message__ 
     *                              for every client
     * @param {string} message - Received message
     */
    off(message) {
        delete this.listeners[message];
        this.eachClient((wsid, client) => client.off(message));
    }

    /**
     * Run action on each online client and cleans list 
     *                                  from offline clients
     * @param {function} action - Desired action 
     */
    eachClient(action) {
        fEach(this.clients, (wsid, client) => {
            if (client.readyState !== 1) {
                delete this.clients[wsid];
            } else {
                action(wsid, client);
            }
        });
    }
}

/**
 * @private
 * Generates random 16char string
 * @returns {string}
 */
function genStr() {
    var _sym = 'abcdefghijklmnopqrstuvwxyz1234567890', 
        str = '', len = _sym.length;

    for(var i = 0; i < 16; i++)
        str += _sym[Math.floor(Math.random() * len)];

    return str;
}

/**
 * @private
 * Easy foreach for maps
 * @param {*} map 
 * @param {mapConsumer} action 
 */
function fEach(map, action) {
    Object.keys(map).forEach(key => {
        if (map.hasOwnProperty(key)) action(key, map[key]);
    });
}

module.exports.WsIfaceServer = WsIfaceServer;
module.exports.WsIfaceChannel = Channel;

/**
 * Module require funcions
 * @external require('wsiface')
 */

/**
 * Create new WsIfaceServer
 * @memberof require('wsiface')
 * @param {Winston|console} [logger] - Optional Winston or other logger, `logger.log` will be used
 */
module.exports.newServer = (logger) => new WsIfaceServer(logger);
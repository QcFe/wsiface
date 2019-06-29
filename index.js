const express = require('express');
const expressWs = require('express-ws');

/**
 * @class
 * WsIface Main class - can be found in `module.WsIfaceServer`
 */
class WsIfaceServer {

    /**
     * Instantiate WsIfaceServer
     * @param {Winston|Console} [logger]
     */
    constructor (logger) {
        this.app = express();
        this.app.use(express.json());
        this.ews = expressWs(this.app);
        this.logger = logger || console;
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
    start (p, cb) {
        this.port = p;

        this.bindStatic('/wsiface', __dirname + '/assets');

        this.createChannel('/');

        this.app.get('/check', (req, res) => {
            res.sendStatus(200);
        });

        return this.server = this.app.listen(this.port, () => {
            this.logger.log('info', 'WsIfaceServer started on port \x1b[32m' 
                                        + this.port + '\x1b[0m');
            typeof cb == 'function' && cb(this);
        });
    }

    /**
     * Bind __action__ to received __message__ for every client
     * @param {String} topic - Topic of the message
     * @param {WsIfaceServer} listener - Desired action
     * @param {string} [channel='/'] - Optional, defaults to '/', 
     *                                  desired channel
     * @returns {WsIfaceServer} - For chaining
     */
    on(topic, action, channel) {
        channel = channel || '/';
        this.channels[channel].on(topic, action);
        return this;
    }

    /**
     * UNBind any action to received __message__ for every client
     * @param {String} topic - Topic of the message
     * @param {string} [channel='/'] - Optional, defaults to '/',
     *                                  desired channel
     * @param {WsIfaceTopiclistener} [listener] - Optional callback, remove all if omitted
     * @returns {WsIfaceServer} - For chaining
     */
    off(topic, channel, listener) {
        channel = channel || '/';
        this.channels[channel].off(topic, listener);
        return this;
    }
    
    /**
     * Broadcast packet to every client in a channel
     * @param {object} data  - Data object to be sent
     * @param {string} [channel='/'] - Optional, defaults to '/', 
     *                                  desired channel
     * @returns {WsIfaceServer} - For chaining
     */
    broadcast (data, channel) {
        channel = channel || '/';
        this.channels[channel].broadcast(data);
        return this;
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
     * @param {WsIfaceServer} wsi - Express app
     *                      (required express-ws binding)
     * @param {String} name - Channel name
     */
    constructor(wsi, name) {
        this.name = name;
        this.wsi = wsi;
        this.clients = {};
        this.topics = {};
        this.wsi.channels[name] = this;

        this.wsi.app.ws(name, (ws) => {
            var id = genStr();
            while (this.clients[id]) id = genStr();
            ws.wsiId = id;
            this.clients[ws.wsiId] = ws;
            ws.on('message', msg => this.msgHandler(msg, ws));
            ws.on('close', () => {
                this.msgHandler(JSON.stringify({topic: 'disconnect', wsid: id}), ws);
                delete this.clients[ws.wsiId];
            });
            this.msgHandler(JSON.stringify({topic: 'connect', wsid: id}));
        });
    }

    msgHandler(msg, ws) {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            this.wsi.logger.log('error', 'Messages MUST BE valid JSON objects', e, msg);
            return false;
        }
        if (!msg.topic) {
            this.wsi.logger.log('error', 'Messages MUST include a topic', msg);
            return false;
        }
        if (this.topics['#']) 
            this.topics['#'].listeners.forEach(l => l(msg, ws));

        if (this.topics[msg.topic])
            this.topics[msg.topic].listeners.forEach(l => l(msg, ws));
        else
            this.wsi.logger.log('debug', 'Unhandled topic', msg);
    }

    /**
     * Broadcast packet to every client in the channel
     * @param {Object} data  - Data object to be sent
     * @returns {Channel} - For chaining
     */
    broadcast (data) {
        if (!data.topic) {
            this.wsi.logger.log('error', 'Messages MUST include a topic');
            return this;
        }
        this.eachClient(ws => ws.readyState === 1 && ws.send(JSON.stringify(data)));
        return this;
    }

    /**
     * Bind specified __action__ to received __message__ 
     *                              for every client
     * @param {String} topic - Topic of the message
     * @param {WsIfaceTopiclistener} listener - Topic handler
     * @returns {Channel} - For chaining
     */
    on(topic, listener) {
        if (!this.topics[topic]) {
            this.topics[topic] = {
                listeners: []
            };
        }
        if (this.topics[topic].listeners.includes(listener)) return this;
        this.topics[topic].listeners.push(listener);
        return this;
    }

    /**
     * UNBind any action to received __message__ 
     *                              for every client
     * @param {String} topic - Topic of the message
     * @param {WsIfaceTopiclistener} [listener] - Callback, remove all if omitted
     * @returns {Channel} - For chaining
     */
    off(topic, listener) {
        if (!this.topics[topic]) return this;
        if (!listener) {
            delete this.topics[topic];
        } else {
            this.topics[topic].listeners = 
                this.topics[topic].listeners.filter(h => h!= listener);
        }
        return this;
    }

    /**
     * Run action on each online client and cleans list 
     *                                  from offline clients
     * @param {function} action - Desired action 
     * @returns {Channel} - For chaining
     */
    eachClient(action) {
        Object.values(this.clients).forEach(client => {
            action(client);
        });
        return this;
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

module.exports.WsIfaceServer = WsIfaceServer;
module.exports.WsIfaceChannel = Channel;
module.exports.WsIfaceClient = require('./assets/wsiface').WsIfaceClient;

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

/**
 * WebSocket topic handler
 * @callback WsIfaceTopiclistener
 * @param {Object} data - Object containing received data 
 * @param {WebSocket} - Source websocket
 */


/**
 * Node module providing a logger, see docs on <a href="https://www.npmjs.com/package/winston" target="_blank">npmjs.com</a>
 * @external Winston
 */

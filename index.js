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
        this.topics = {};
        this.wsi.channels[name] = this;

        this.wsi.app.ws(name, (ws) => {
            var id = genStr();
            while (this.clients[id]) id = genStr();
            ws.wsiId = id;
            this.clients[ws.wsiId] = ws;
            ws.on('message', msg => this.msgHandler(msg));
            ws.on('close', () => {
                this.msgHandler(JSON.stringify({topic: 'disconnect', wsid: id}));
                delete this.clients[ws.wsiId];
            });
            this.msgHandler(JSON.stringify({topic: 'connect', wsid: id}));
        });
    }

    msgHandler(msg) {
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
            this.topics['#'].listeners.forEach(l => l(msg));

        if (this.topics[msg.topic])
            this.topics[msg.topic].listeners.forEach(l => l(msg));
        else
            this.wsi.logger.log('debug', 'Unhandled topic', msg);
    }

    /**
     * Broadcast packet to every client in the channel
     * @param {Object} data  - Data object to be sent
     */
    broadcast (data) {
        if (!data.topic) {
            this.wsi.logger.log('error', 'Messages MUST include a topic');
            return false;
        }
        this.eachClient(ws => ws.readyState === 1 && ws.send(JSON.stringify(data)));
    }

    /**
     * Bind specified __action__ to received __message__ 
     *                              for every client
     * @param {string} message - Received message
     * @param {function} action - Desider action
     */
    on(topic, listener) {
        if (!this.topics[topic]) {
            this.topics[topic] = {
                listeners: []
            };
        }
        if (this.topics[topic].listeners.includes(listener)) return false;
        this.topics[topic].listeners.push(listener);
        return true;
    }

    /**
     * UNBind any action to received __message__ 
     *                              for every client
     * @param {string} topic - Received message
     */
    off(topic, listener) {
        if (!this.topics[topic]) return;
        if (!listener) {
            delete this.topics[topic];
        } else {
            this.topics[topic].listeners = 
                this.topics[topic].listeners.filter(h => h!= listener);
        }
    }

    /**
     * Run action on each online client and cleans list 
     *                                  from offline clients
     * @param {function} action - Desired action 
     */
    eachClient(action) {
        Object.values(this.clients).forEach(client => {
            action(client);
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
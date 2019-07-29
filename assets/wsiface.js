/**
 * [FRONTEND] Connect to WsIface server
 */
class WsIfaceClient {
    /**
     * Connect to specified channel
     * @param {String} channel 
     */
    constructor (channel) {
        channel = channel || '/';
        this.channel = channel;
        this.topics = {};
        this.reconnectHandler = () => location.reload();

        const _this = this;

        function createWs() {
            _this.webSocket = new WebSocket('ws://' + location.host + channel);

            _this.webSocket.onmessage = e => {
                _this.msgHandler(e.data);
            };

            _this.webSocket.onopen = () => {
                _this.msgHandler(JSON.stringify({ topic: 'connect' }));
            };

            if (_this.channel == '/') _this.webSocket.onclose = () => {
                _this.msgHandler(JSON.stringify({ topic: 'disconnect' }));
                tryReconnect();
            };
        }

        function tryReconnect() {
            setTimeout(() => {
                hostReachable(success => {
                    if (success) {
                        _this.reconnectHandler();
                        createWs();
                    }
                    else tryReconnect();
                });
            }, 2000);
        }

        createWs();
    }

    /**
     * Bind topic handler
     * @param {String} topic - Topic to which subscribe
     * @param {WsIfaceTopiclistener} listener - Topic handler
     * @returns {WsIfaceClient} - for chaining
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
     * Specify what to do on reconnection
     * @param {Function} handler 
     */
    onReconnect(handler) {
        this.reconnectHandler = handler;
    }

    /**
     * Unbind topic handler
     * @param {String} topic - Desired topic
     * @param {WsIfaceTopiclistener} [listener] - Callback, remove all if omitted
     * @returns {WsIfaceClient} - for chaining
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
     * Handles message reception
     * @private
     */
    msgHandler(msg) {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            console.error('Messages MUST BE valid JSON objects', e, msg);
            return false;
        }
        if (!msg.topic) {
            console.error('Messages MUST include a topic', msg);
            return false;
        }
        if (this.topics['#']) {
            this.topics['#'].listeners.forEach(l => l(msg));
        }
        if (this.topics[msg.topic]) {
            this.topics[msg.topic].listeners.forEach(l => l(msg));
        } else {
            console.warn('Unhandled topic: ', msg.topic, msg);
        }
    }

    /**
     * Send message to server with given `message.topic`
     * @param {String} topic - Desired topic
     * @param {Object} message - Must be a valid Object
     * @returns {WsIfaceClient} - for chaining
     */
    send(topic, data) {
        data = data || {};
        data.topic = topic;
        this.webSocket.send(JSON.stringify(data));
        return this;
    }

}

/**
 * @private
 */
function hostReachable (cb) {
    var xhr = new XMLHttpRequest();
    xhr.onload = () => cb(true);
    xhr.ontimeout = xhr.onerror = () => cb(false);
    xhr.open('HEAD', '//' + location.host + '/check');
    xhr.timeout = 2000;
    xhr.send();
}
 
/**
 * WebSocket topic callback
 * @callback WsIfaceTopiclistener
 * @param {Object} data - Data object from server
 */

try {
    module.exports.WsIfaceClient = WsIfaceClient;
} catch (e) { e; }

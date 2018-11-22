/**
 * [FRONTEND] Connect to WsIface server
 */
class WsIfaceClient {
    /**
     * Connect to specified channel
     * @param {String} channel 
     */
    constructor (channel) {
        channel || '/';
        this.channel = channel;
        this.webSocket = new WebSocket('ws://' + location.host + channel);
        this.topics = {};

        this.webSocket.onmessage = e => {
            this.msgHandler(e.data);
        };

        this.webSocket.onopen = () => {
            this.msgHandler(JSON.stringify({topic: 'connect'}));
        };

        this.webSocket.onclose = () => {
            this.msgHandler(JSON.stringify({topic: 'disconnect'}));
        };

        if (this.channel == '/') this.webSocket.onclose = () => {
            setTimeout(() => {
                hostReachable(success => {
                    if (success) location.reload();
                    else this.webSocket.onclose();
                });
            }, 2000);
        };
    }

    /**
     * @param {String} topic - Topic to which subscribe
     * @param {WsIfaceTopiclistener} listener - Topic listener
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

    off(topic, listener) {
        if (!this.topics[topic]) return;
        this.topics[topic].listeners = this.topics[topic].listeners.filter(h => h!= listener);
    }

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
            this.topics[msg.target].listeners.forEach(l => l(msg));
        } else {
            console.warn('Unhandled topic: ', msg.topic, msg);
        }
    }
    send (data) {
        if (!data.topic) {
            console.error('Messages MUST include a topic');
            return false;
        }
        this.webSocket.send(JSON.stringify(data));
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
 * Root channel is automatically issued
 */
window.WsIfaceRootChannel = new WsIfaceClient('/');

/**
 * WebSocket topic callback
 * @callback WsIfaceTopiclistener
 * @param {Object} data - Data object from server
 */
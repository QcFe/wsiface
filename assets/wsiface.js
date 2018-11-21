var pips = new WsIfaceClient("/");
var belushi = new WsIfaceClient("/belushi");

function WsIfaceClient(channel) {
    channel = channel || "/";
    var thisWs = new WebSocket("ws://" + location.host + channel);
    this.channel = channel;
    this.webSocket = thisWs;

    thisWs.onmessage = function (e) {
        var msg = e.data;
        if (msg.indexOf("{") === 0 && msg.lastIndexOf("}") === (msg.length-1)) {
            msg = JSON.parse(msg);
        }
        console.log(channel, msg);
    }

    thisWs.onopen = function () {
        thisWs.send("hello!");
        console.log("Websocket connection established for channel " + channel);
    }

    thisWs.onclose = function () {
        setTimeout(function () {
            hostReachable(function (success) {
                if (success) location.reload();
                else thisWs.onclose();
            });
        }, 2000);
    }
}

hostReachable = function (cb) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () { cb(true); };
    xhr.onerror = function () { cb(false); }
    xhr.open( "HEAD", "//" + location.host + "/check?rand=" 
                            + Math.floor((Math.random()) * 10000));
    xhr.send();
}
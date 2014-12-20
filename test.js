var mraa = require('mraa');

var RELAY_1_PIN = 6,
    RELAY_2_PIN = 7,
    RELAY_3_PIN = 8,
    RELAY_4_PIN = 9;


function Relay(pin) {
    this.relay = new mraa.Gpio(pin);
    this.relay.dir(mraa.DIR_OUT);
    this.open();
}

Relay.prototype = {
    open: function () {
        this.state = 0;
        this.relay.write( this.state );
    },
    close: function() {
        this.state = 1;
        this.relay.write( this.state );
    }
};

var relay1 = new Relay(RELAY_1_PIN);
var relay2 = new Relay(RELAY_2_PIN);
var relay3 = new Relay(RELAY_3_PIN);
var relay4 = new Relay(RELAY_4_PIN);

relay1.open();
relay2.open();
relay3.open();
relay4.open();


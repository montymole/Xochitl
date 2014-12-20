/*--------------------------------------*/
/*  LED AND RELAYs controlled with this    */
/*--------------------------------------*/
var mraa = require('mraa');

function OutPin(pin, state) {

    this.pin = new mraa.Gpio(pin);
    this.pin.dir(mraa.DIR_OUT);
    this.state = state ? 1 : 0;
    this.pin.write(this.state);

}

OutPin.prototype = {

    set: function(state) {
        this.state = state;
        this.pin.write(this.state);
        return this.state;
    },

    off: function() {
        this.state = 0;
        this.pin.write(this.state);
    },


    on: function() {
        this.state = 1;
        this.pin.write(this.state);
    },

    blink: function(n, d) {

        var b = this,
            t = 0,
            i = setInterval(function() {
                b.pin.write(b.state ^= 1);
                t++;
                if (t >= n)
                    clearInterval(i);
            }, d);

    }

};

module.exports = OutPin;
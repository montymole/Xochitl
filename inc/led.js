/*--------------------------------------*/
/*  LED Blinker    */
/*--------------------------------------*/
var mraa = require('mraa');

function Led(pin) {

    this.led = new mraa.Gpio(pin);
    this.led.dir(mraa.DIR_OUT);
    this.off();

}

Led.prototype = {

    off: function() {
        this.state = 0;
        this.led.write(this.state);
    },


    on: function() {
        this.state = 1;
        this.led.write(this.state);
    },

    blink: function(n, d) {

        var b = this,
            t = 0,
            i = setInterval(function() {
                b.led.write(b.state ^= 1);
                t++;
                if (t >= n)
                    clearInterval(i);
            }, d);

    }

};

module.exports = Led;
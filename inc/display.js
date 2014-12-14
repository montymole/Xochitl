/*--------------------------------------*/
/*  Cleaned up and expanded 
/*--------------------------------------*/

var util = require('util'),
    EventEmitter = require("events").EventEmitter,
    I2C = require("i2c"),
    MCP23017_IOCON_BANK0 = 0x0A,
    MCP23017_IOCON_BANK1 = 0x15,
    MCP23017_GPIOA = 0x09,
    MCP23017_IODIRB = 0x10,
    MCP23017_GPIOB = 0x19,
    LCD_CLEARDISPLAY = 0x01,
    LCD_RETURNHOME = 0x02,
    LCD_ENTRYMODESET = 0x04,
    LCD_DISPLAYCONTROL = 0x08,
    LCD_CURSORSHIFT = 0x10,
    LCD_FUNCTIONSET = 0x20,
    LCD_SETCGRAMADDR = 0x40,
    LCD_SETDDRAMADDR = 0x80,
    LCD_DISPLAYON = 0x04,
    LCD_DISPLAYOFF = 0x00,
    LCD_CURSORON = 0x02,
    LCD_CURSOROFF = 0x00,
    LCD_BLINKON = 0x01,
    LCD_BLINKOFF = 0x00,
    LCD_ENTRYRIGHT = 0x00,
    LCD_ENTRYLEFT = 0x02,
    LCD_ENTRYSHIFTINCREMENT = 0x01,
    LCD_ENTRYSHIFTDECREMENT = 0x00,
    LCD_DISPLAYMOVE = 0x08,
    LCD_CURSORMOVE = 0x00,
    LCD_MOVERIGHT = 0x04,
    LCD_MOVELEFT = 0x00,
    flip = [0x00, 0x10, 0x08, 0x18, 0x04, 0x14, 0x0C, 0x1C, 0x02, 0x12, 0x0A, 0x1A, 0x06, 0x16, 0x0E, 0x1E],
    pollables = [LCD_CLEARDISPLAY, LCD_RETURNHOME];

function RGBLCD(device, address, pollInterval) {
    EventEmitter.call(this);

    this.ADDRESS = address;
    this.PORTA = 0;
    this.PORTB = 0;
    this.DDRB = 0x10;
    this.WIRE = new I2C(this.ADDRESS, {
        device: device
    });
    if (!pollInterval) {
        pollInterval = 1000;
    }
    this.init();
    this.BSTATE = 0;

    _this = this;

    if (pollInterval > 0) {

        this.poll = setInterval(function() {

            var cur, key;
            cur = _this.buttonState();
            if (cur !== _this.BSTATE) {
                key = _this.BSTATE ^ cur;
                _this.emit('button_change', key);
                if (cur < _this.BSTATE) {
                    _this.emit('button_up', key);
                    _this.emit(_this.buttonName(key), 0);
                } else {
                    _this.emit('button_down', key);
                    _this.emit(_this.buttonName(key), 1);
                }
                _this.BSTATE = cur;
            }
        }, pollInterval);
    }
}

util.inherits(RGBLCD, EventEmitter);

RGBLCD.prototype.colors = {
    OFF: 0x00,
    RED: 0x01,
    GREEN: 0x02,
    BLUE: 0x04,
    YELLOW: 0x03,
    TEAL: 0x06,
    VIOLET: 0x05,
    WHITE: 0x07,
    ON: 0x07
};

RGBLCD.prototype.buttons = {
    SELECT: 0x01,
    RIGHT: 0x02,
    DOWN: 0x04,
    UP: 0x08,
    LEFT: 0x10
};

RGBLCD.prototype.clear = function() {
    return this.writeByte(LCD_CLEARDISPLAY);
};

RGBLCD.prototype.home = function() {
    return this.writeByte(LCD_RETURNHOME);
};

RGBLCD.prototype.close = function() {
    if (this.poll !== null) {
        return clearInterval(this.poll);
    }
};

RGBLCD.prototype.backlight = function(color) {
    var c;
    c = ~color;
    this.PORTA = (this.PORTA & 0x3F) | ((c & 0x3) << 6);
    this.PORTB = (this.PORTB & 0xFE) | ((c & 0x4) >> 2);
    this.sendBytes(MCP23017_GPIOA, this.PORTA);
    return this.sendBytes(MCP23017_GPIOB, this.PORTB);
};

RGBLCD.prototype.message = function(text) {
    var i, line, lines, _i, _len, _results;
    lines = text.split('\n');
    _results = [];
    for (i = _i = 0, _len = lines.length; _i < _len; i = ++_i) {
        line = lines[i];
        if (i === 1) {
            this.writeByte(0xC0);
        }
        if (i < 2) {
            _results.push(this.writeByte(line, true));
        } else {
            _results.push(void 0);
        }
    }
    return _results;
};

RGBLCD.prototype.buttonState = function() {
    var ret;
    ret = this.WIRE.readBytes(MCP23017_GPIOA, 1);
    ret = ret[0] & 0x1F;
    return ret;
};

RGBLCD.prototype.buttonName = function(val) {
    switch (val) {
        case this.buttons.SELECT:
            return "SELECT";
        case this.buttons.RIGHT:
            return "RIGHT";
        case this.buttons.UP:
            return "UP";
        case this.buttons.DOWN:
            return "DOWN";
        case this.buttons.LEFT:
            return "LEFT";
        default:
            return void 0;
    }
};

RGBLCD.prototype.init = function() {
    this.sendBytes(MCP23017_IOCON_BANK1, 0);
    this.sendBytes(0, [0x3F, this.DDRB, 0x3F, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x3F, 0x0, 0x0, 0x0, 0x0, 0x0, this.PORTA, this.PORTB, this.PORTA, this.PORTB]);
    this.sendBytes(MCP23017_IOCON_BANK0, 0xA0);
    this.displayshift = LCD_CURSORMOVE | LCD_MOVERIGHT;
    this.displaymode = LCD_ENTRYLEFT | LCD_ENTRYSHIFTDECREMENT;
    this.displaycontrol = LCD_DISPLAYON | LCD_CURSOROFF | LCD_BLINKOFF;
    this.writeByte(0x33);
    this.writeByte(0x32);
    this.writeByte(0x28);
    this.writeByte(LCD_CLEARDISPLAY);
    this.writeByte(LCD_CURSORSHIFT | this.displayshift);
    this.writeByte(LCD_ENTRYMODESET | this.displaymode);
    this.writeByte(LCD_DISPLAYCONTROL | this.displaycontrol);
    this.writeByte(LCD_RETURNHOME);
    this.clear();
    this.emit('INIT');
    return this.backlight(0x0);
};

RGBLCD.prototype.sendBytes = function(cmd, values) {
    var data, reg;
    reg = cmd;
    if (typeof values === 'number') {
        data = [];
        data.push(values);
        values = data;
    }
    return this.WIRE.writeBytes(cmd, values);
};

RGBLCD.prototype.sendByte = function(value) {
    return this.WIRE.writeByte(value);
};

RGBLCD.prototype.maskOut = function(bitmask, value) {
    var hi, lo;
    hi = bitmask | flip[value >> 4];
    lo = bitmask | flip[value & 0x0F];
    return [hi | 0x20, hi, lo | 0x20, lo];
};

RGBLCD.prototype.setCursor = function(col, row) {
    var row_offsets = [0x00, 0x40, 0x14, 0x54];
    if (row > 1) {
        row = 1;
    }
    return this.writeByte(LCD_SETDDRAMADDR | (col + row_offsets[row]));
};

RGBLCD.prototype.autoscroll = function() {
    this.displaymode = this.displaymode | LCD_ENTRYSHIFTINCREMENT;
    return this.writeByte(LCD_ENTRYMODESET | this.displaymode);
};

RGBLCD.prototype.noautoscroll = function() {
    this.displaymode = this.displaymode & ~LCD_ENTRYSHIFTINCREMENT;
    return this.writeByte(LCD_ENTRYMODESET | this.displaymode);
};

RGBLCD.prototype.scrollDisplayLeft = function(steps) {
    if (!steps || steps < 0) steps = 1;
    while (steps-- > 0) {
        this.writeByte(LCD_CURSORSHIFT | LCD_DISPLAYMOVE | LCD_MOVELEFT);
    }
};

RGBLCD.prototype.scrollDisplayRight = function(steps) {
    if (!steps || steps < 0) steps = 1;
    while (steps-- > 0) {
        this.writeByte(LCD_CURSORSHIFT | LCD_DISPLAYMOVE | LCD_MOVERIGHT);
    }
};

RGBLCD.prototype.cursor = function() {
    this.displaycontrol = this.displaycontrol | LCD_CURSORON;
    return this.writeByte(LCD_DISPLAYCONTROL | this.displaycontrol);
};

RGBLCD.prototype.noCursor = function() {
    this.displaycontrol = this.displaycontrol & ~LCD_CURSORON;
    return this.writeByte(LCD_DISPLAYCONTROL | this.displaycontrol);
};

RGBLCD.prototype.blink = function() {
    this.displaycontrol = this.displaycontrol | LCD_BLINKON;
    return this.writeByte(LCD_DISPLAYCONTROL | this.displaycontrol);
};

RGBLCD.prototype.noBlink = function() {
    this.displaycontrol = this.displaycontrol & ~LCD_BLINKON;
    return this.writeByte(LCD_DISPLAYCONTROL | this.displaycontrol);
};


RGBLCD.prototype.writeByte = function(value, char_mode) {
    var bitmask, bits, data, hi, k, last, lo, _i;
    char_mode = char_mode || false;
    if (this.DDRB & 0x10) {
        lo = (this.PORTB & 0x01) | 0x40;
        hi = lo | 0x20;
        this.sendBytes(MCP23017_GPIOB, lo);
        while (true) {
            this.sendByte(hi);
            bits = this.readByte();
            this.sendBytes(MCP23017_GPIOB, [lo, hi, lo]);
            if ((bits & 0x2) === 0) {
                break;
            }
        }
        this.PORTB = lo;
        this.DDRB &= 0xEF;
        this.sendBytes(MCP23017_IODIRB, this.DDRB);
    }
    bitmask = this.PORTB & 0x01;
    if (char_mode) {
        bitmask |= 0x80;
    }
    if (typeof value === "string") {
        last = value.length - 1;
        data = [];
        for (k = _i = 0; 0 <= last ? _i <= last : _i >= last; k = 0 <= last ? ++_i : --_i) {
            if (value[k] !== null) {
                data = data.concat(this.maskOut(bitmask, value[k].charCodeAt(0)));
                if (data.length >= 32 || k === last) {
                    this.sendBytes(MCP23017_GPIOB, data);
                    this.PORTB = data[data.length - 1];
                    data = [];
                }
            }
        }
    } else {
        data = this.maskOut(bitmask, value);
        this.sendBytes(MCP23017_GPIOB, data);
        this.PORTB = data[data.length - 1];
    }
    if (!char_mode && pollables.indexOf(value) !== -1) {
        this.DDRB |= 0x10;
        return this.sendBytes(MCP23017_IODIRB, this.DDRB);
    }
};

RGBLCD.prototype.readByte = function() {
    return this.WIRE.readByte();
};

RGBLCD.prototype.createChar = function(location, charmap) {
    location = location & 0x7; // we only have 8 locations 0-7
    this.writeByte(LCD_SETCGRAMADDR | (location << 3));
    for (var i = 0; i < 8; i++) {
        this.writeByte(charmap[i]);
    }
    this.writeByte(LCD_SETCGRAMADDR);
};

module.exports = RGBLCD;

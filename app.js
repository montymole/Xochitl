var express = require('express'),
    noble = require('noble'), //blue tooth

    OutPin = require('./inc/outpin'),
    RGBlcd = require('./inc/display'), //Adafruit RGBlcd
    SensorTag = require('./inc/sensortag'),
    sensorTags = [],

    I2C_DEVICE = '/dev/i2c-6', //on edison
    MCP23017_ADDRESS = 0x20;

var onboardLed = new OutPin(13),
    lcd = new RGBlcd(I2C_DEVICE, MCP23017_ADDRESS, 200);

var relay = [
    new OutPin(6, true),
    new OutPin(7, true),
    new OutPin(8, true),
    new OutPin(9, true)
];

var pages = [],
    pageColors = ['WHITE', 'YELLOW', 'GREEN', 'BLUE', 'TEAL', 'VIOLET'],
    curPage = 0,
    curLine = 0,
    scrollBusy;

var INDEX_PAGE = 0,
    BLUETOOTH_PAGE = 1,
    RELAYS_PAGE = 2,
    SENSOR_READINGS_PAGE = 3;

function scrollPage(d) {
    if (scrollBusy) return;

    scrollBusy = true;

    var scrollCmd = (d < 0) ? 'scrollDisplayRight' : 'scrollDisplayLeft',
        step = 0,
        interval = setInterval(function() {
            lcd[scrollCmd]();
            step++;
            if (step >= 16) {
                clearInterval(interval);
                scrollBusy = false;
            }
        }, 100);
}

function output(msg, page, line) {
    if (!pages[page])
        pages[page] = [];

    if (line === null) {
        line = pages[page].length;
    }

    var l = msg;
    while (l.length < 16) {
        l += ' ';
    }

    pages[page][line] = l;

    console.log(pages);
    drawLcd();

}

function drawLcd() {
    lcd.backlight(lcd.colors[pageColors[curPage]]);
    //lcd.clear();
    var line1 = pages[curPage][curLine],
        line2 = pages[curPage][curLine + 1];

    if (!line1) line1 = '---------------';
    if (!line2) line2 = '---------------';

    lcd.setCursor(0, 0);

    lcd.message(line1);

    lcd.setCursor(0, 1);

    lcd.message(line2);

    lcd.setCursor(15, 0);
}

lcd.on('LEFT', function(a) {
    var p = curPage;
    if (a) {
        p--;
        if (p < 0) p = pages.length - 1;
        if (p != curPage) {
            curLine = 0;
            curPage = p;
            drawLcd();
        }
    }
});

lcd.on('RIGHT', function(a) {
    var p = curPage;
    if (a) {
        p++;
        if (p >= pages.length) p = 0;
        if (p != curPage) {
            curPage = p;
            drawLcd();
        }
    }
});

lcd.on('UP', function(a) {
    var l = curLine;
    if (a) {
        l--;
        if (l < 0) l = 0;
        if (l != curLine) {
            curLine = 0;
            curLine = l;
            drawLcd();
        }
    }
});

lcd.on('DOWN', function(a) {
    var l = curLine;
    if (a) {
        l++;
        if (l >= pages[curPage].length - 1) l = pages[curPage].length - 1;
        if (l != curLine) {
            curLine = l;
            drawLcd();
        }
    }
});


noble.on('discover', function(P) {

    if (P) {
        output('discover...', BLUETOOTH_PAGE, 1);
        var sensorTag = new SensorTag(P, startProbing, function(msg) {
            output(msg, BLUETOOTH_PAGE, 1);
        });
        sensorTag.idx = sensorTags.length;
        sensorTags.push(sensorTag);
        //blink on discover
        onboardLed.blink(5, 100);
    }
});


function startProbing(st) {
    var onBit = new Buffer([0x01]),
        offBit = new Buffer([0x00]),
        probingDelay = 5000;

    st.getSystemId(function(st, cname, err, v) {
        output(cname, 1, 2);
        output(v, BLUETOOTH_PAGE, 3);
    });
    st.getModelNumberString(function(st, cname, err, v) {
        output(cname, BLUETOOTH_PAGE, 4);
        output(v, BLUETOOTH_PAGE, 5);
    });
    st.getSerialNumberString(function(st, cname, err, v) {
        output(cname, BLUETOOTH_PAGE, 6);
        output(v, BLUETOOTH_PAGE, 7);
    });

    st.getFirmwareRevisionString(function(st, cname, err, v) {
        output(cname, BLUETOOTH_PAGE, 8);
        output(v, BLUETOOTH_PAGE, 9);
    });

    st.startIRTemperature(function() {
        st.getIRTemperatureConfig(function(st, cname, err, v) {
            output(cname, BLUETOOTH_PAGE, 10);
            output(v, BLUETOOTH_PAGE, 11);
        });
    });

    st.startHumidity(function() {
        st.getHumidityConfig(function(st, cname, err, v) {
            output(cname, BLUETOOTH_PAGE, 12);
            output(v, BLUETOOTH_PAGE, 13);
        });
    });


    lcd.noBlink();

    probe();

    var IR_TEMP = 1,
        HUMIDITY = 2;

    function probeDone(par) {
        measured = measured | par;
        if (measured == 3) {
            lcd.noBlink();
            setTimeout(probe, probingDelay);
        }
    }

    function probe() {
        lcd.blink();
        measured = 0;

        st.getIRTemperatureData(function(st, cname, err, v) {
            output('ObjTemp:' + Math.round(100 * v.objectTemperature) / 100 + ' C', SENSOR_READINGS_PAGE, 1);
            output('AmbTemp:' + Math.round(100 * v.ambientTemperature) / 100 + ' C', SENSOR_READINGS_PAGE, 2);
            probeDone(IR_TEMP);
        });

        st.getHumidityData(function(st, cname, err, v) {
            output("Temp:" + Math.round(100 * v.temperature) / 100 + ' C', SENSOR_READINGS_PAGE, 3);
            output("Hum: " + Math.round(100 * v.humidity) / 100, SENSOR_READINGS_PAGE, 4);
            probeDone(HUMIDITY);
        });

    }

}

/*--------------------------------------*/
/*  API SERVER    */
/*--------------------------------------*/
function serveJSON(res, obj) {
    res.set({
        'Content-Type': 'text/plain'
    });
    res.send(JSON.stringify(obj, null, "\t"));
}

var app = express(),
    searchingSensorTag = false,
    relaysInitialized = false;

app.get('/', function(req, res) {

    if (!searchingSensorTag) {
        output('scanning...', BLUETOOTH_PAGE, 1);
        searchingSensorTag = true;
        lcd.blink();
        noble.startScanning();
    }

    if (!relaysInitialized) {
        for(var i = 0; i < relay.length; i++) {
            //START HIGH
            relay[i].set(1);
            output('Relay ' +i+ ' OPEN', RELAYS_PAGE, i+1);
        }
        relaysInitialized = true;
    }

    serveJSON(res, pages);
});

app.get('/relay/:idx/:state', function(req, res) {

    //marshall
    var idx = parseInt(req.params.idx);
    if (idx < 0 || isNaN(idx)) idx = 0;
    if (idx >= relay.length) idx = relay.length;

    var state = parseInt(req.params.state);
    if (isNaN(state)) state = 0;
    if (state > 0) state = 1;

    output('Relay ' + idx + ' ' + (state ? 'OPEN' : 'CONTACT'), RELAYS_PAGE, idx+1);

    serveJSON(res, {
        relay: idx,
        state: relay[idx].set(state)
    });

});




app.listen(80, function() {
    //blink on start
    onboardLed.blink(1, 1000);
    output('Xochitl v1.0', INDEX_PAGE, 0);
    output('Bluetooth', BLUETOOTH_PAGE, 0);
    output('Relays', RELAYS_PAGE, 0);
    output('Sensors', SENSOR_READINGS_PAGE, 0);


    output('api on port 80', INDEX_PAGE, 1);
    console.log('api on port 80');
    console.log('--------------------');
});

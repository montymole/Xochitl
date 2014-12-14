var http = require('http'),
    noble = require('noble'), //blue tooth
    mraa = require('mraa'), //edison hardware access

    Led = require('./inc/led'),
    RGBlcd = require('./inc/display'), //Adafruit RGBlcd
    SensorTag = require('./inc/sensortag'),
    sensorTags = [],

    I2C_DEVICE = '/dev/i2c-6', //on edison
    MCP23017_ADDRESS = 0x20;

var onboardLed = new Led(13),
    lcd = new RGBlcd(I2C_DEVICE, MCP23017_ADDRESS, 200);

var pages = [],
    pageColors = ['WHITE', 'YELLOW', 'GREEN', 'BLUE', 'TEAL', 'VIOLET'],
    curPage = 0,
    curLine = 0,
    scrollBusy;

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


//blink on start
onboardLed.blink(1, 1000);

output('Xochitl v1.0', 0, 0);

noble.on('discover', function(P) {

    if (P) {
        output('discover...', 0, 1);
        var sensorTag = new SensorTag(P, startProbing, function(msg) {
            output(msg, 0, 1);
        });
        sensorTag.idx = sensorTags.length;
        sensorTags.push(sensorTag);
        //blink on discover
        onboardLed.blink(5, 100);
    }
});
output('scanning...', 0, 1);
lcd.blink();
noble.startScanning();


function startProbing(st) {
    var onBit = new Buffer([0x01]),
        offBit = new Buffer([0x00]),
        probingDelay = 5000;

    st.getSystemId(function(st, cname, err, v) {
        output(cname, 1, 0);
        output(v, 1, 1);
    });
    st.getModelNumberString(function(st, cname, err, v) {
        output(cname, 1, 2);
        output(v, 1, 3);
    });
    st.getSerialNumberString(function(st, cname, err, v) {
        output(cname, 1, 4);
        output(v, 1, 5);
    });

    st.getFirmwareRevisionString(function(st, cname, err, v) {
        output(cname, 1, 6);
        output(v, 1, 7);
    });

    st.startIRTemperature(function() {
        st.getIRTemperatureConfig(function(st, cname, err, v) {
            output(cname, 1, 8);
            output(v, 1, 9);
        });
    });

    st.startHumidity(function() {
        st.getHumidityConfig(function(st, cname, err, v) {
            output(cname, 1, 10);
            output(v, 1, 11);
        });
    });

    
    lcd.noBlink();

    probe();

    var IR_TEMP = 1, HUMIDITY = 2;

    function probeDone(par) {
        measured = measured | par;
        if (measured == 3) {
            lcd.noBlink();
            output('results->',0, 1);
            setTimeout(probe, probingDelay);
        }
    }

    function probe() {
        lcd.blink();
        output('Probing...', 0, 1);
        measured = 0;

        st.getIRTemperatureData(function(st, cname, err, v) {
            output('ObjTemp:' + Math.round(100 * v.objectTemperature) / 100 + ' C', 2, 0);
            output('AmbTemp:' + Math.round(100 * v.ambientTemperature) / 100 + ' C', 2, 1);
            probeDone(IR_TEMP);
        });

        st.getHumidityData(function(st, cname, err, v) {
            output("Temp:" + Math.round(100 * v.temperature) / 100 + ' C', 2, 2);
            output("Hum: " + Math.round(100 * v.humidity) / 100, 2, 3);
            probeDone(HUMIDITY);
        });
        /*
        st.getBarometerData(function(st, cname, err, v) {
            output(cname, 2, 4);
            output(v, 2, 5);
            probeDone();
        });
*/
    }

}


var server = http.createServer(function(req, res) {

    var str = '<!DOCTYPE "html"><html><body><pre>';
    for (var p in pages) {
        for (var l in pages[p]) {
            str += pages[p][l] + '<br/>';
        }
    }
    str += '</pre></body></html>';

    res.writeHead(200, {
        "Content-Type": "text/html"
    });
    res.write(str);
    res.end();
});

server.listen(80);

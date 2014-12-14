var noble = require('noble'),
    mraa = require('mraa'), //edison hardware access
    SensorTag = require('./sensortag.js').SensorTag,
    sensorTags = [],

    //onboard led write access
    onboardLedState = true,
    blinkedTimes = 0,
    toBlink,
    blinkDelay = 100,
    onboardLed = new mraa.Gpio(13);

onboardLed.dir(mraa.DIR_OUT); //output
onboardLed.write(0); //start off

function blinkLed(n, d) {

    if (n) {
        toBlink = n;
    }

    if (d) {
        blinkDelay = d;
    }

    blinkedTimes++;

    if (blinkedTimes < toBlink) {
        onboardLedState = !onboardLedState;
        onboardLed.write(onboardLedState ? 1 : 0);
        setTimeout(blinkLed, blinkDelay);
    } else {
        blinkedTimes = 0;
        onboardLed.write(0);
    }


}


function outputValue(st, cname, err, v) {
    var t = new Date();
    console.log(t.getTime(), cname, v);
    blinkLed(1, 100);
}


function startProbing(st) {

    var onBit = new Buffer([0x01]),
        offBit = new Buffer([0x00]);

    st.getSystemId(outputValue);

    st.getModelNumberString(outputValue);

    st.getSerialNumberString(outputValue);

    st.getFirmwareRevisionString(outputValue);

    st.startIRTemperature(function() {
        st.getIRTemperatureConfig(outputValue);
    });

    st.startHumidity(function() {
        st.getHumidityConfig(outputValue);
    });

    st.getBarometerCalibration(function(st, cname, err, v) {
        outputValue(st, cname, err, v);
        st.startBarometer(function() {
            st.getBarometerConfig(outputValue);
        });
    });


    function probe() {
        blinkLed(5, 500);
        st.getIRTemperatureData(outputValue);
        st.getHumidityData(outputValue);
        st.getBarometerData(outputValue);
    }

    setInterval(probe, 5000);

}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

noble.on('discover', function(P) {

    if (P) {
        var sensorTag = new SensorTag(P, startProbing);
        sensorTag.idx = sensorTags.length;
        sensorTags.push(sensorTag);
        //blink on discover
        blinkLed(10, 100);
    }

});

console.log('SCANNING....');
blinkLed(1, 1000);
noble.startScanning();

var util = require('util'),
    EventEmitter = require("events").EventEmitter,
    TIBase = ['f000', '04514000b000000000000000'],

    //based on http://processors.wiki.ti.com/images/a/a8/BLE_SensorTag_GATT_Server.pdf
    sensorTagAttributeTable = {

        //TYPE(hex string): [TYPE(text), DESCRIPTION]
        "2A00": ['DeviceName', 'TI BLE Sensor Tag'],
        "2A01": ['Appearance'],
        "2A02": ['Peripheral PrivacyFlag'],
        "2A03": ['Reconnection Address'],
        "2A04": ['Peripheral Preferred Connection Parameters'],
        "2A05": ['Service Changed'],
        "2A23": ['System ID'],
        "2A24": ['Model Number String', '4E:2E:41:2E:00'],
        "2A25": ['Serial Number String', '4E:2E:41:2E:00 '],
        "2A26": ['Firmware Revision String'],
        "2A27": ['Hardware Revision String'],
        "2A28": ['Software Revision String'],
        "2A29": ['Manufacturer Name String'],
        "2A2A": ['IEEE11073-20601 Regulatory '],
        "2A50": ['PnP ID'],

        AA00: ['IR Temperature Service'],
        AA01: ['IR Temperature Data', 'ObjectLSB : ObjectMSB : AmbientLSB : AmbientMSB'],
        AA02: ['IR Temperature Config', 'Write "01" to start Sensor and Measurements,"00" to put to sleep'],
        AA03: ['IR Temperature Period', 'Period = [Input*10]ms, (lowerlimit 300 ms), default 1000 ms'],

        AA10: ['Accelerometer Service'],
        AA11: ['Accelerometer Data', 'X: Y: Z Coordinates'],
        AA12: ['Accelerometer Config', 'Write "01" to select range 2G, "02" for 4G, "03" for 8G, "00" disable sensor'],
        AA13: ['Accelerometer Period', 'Period = [Input*10]ms, (lowerlimit 100ms), default1000ms'],

        AA20: ['Humidity Service'],
        AA21: ['Humidity Data', 'TempLSB:TempMSB:HumidityLSB:HumidityMSB'],
        AA22: ['Humidity Config', 'Write"01"to startmeasurements, "00"tostop'],
        AA23: ['Humidity Period', 'Period =[Input*10]ms,(lowerlimit 100 ms),default1000 ms'],

        AA30: ['Magnetometer Service'],
        AA31: ['Magnetometer Data', 'XLSB:XMSB:YLSB:YMSB:ZLSB:ZMSBCoordinates'],
        AA32: ['Magnetometer Config', 'Write "01" to start Sensor and Measurements, "00" to put to sleep'],
        AA33: ['Magnetometer Period', 'Period =[Input*10]ms (lower limit100ms) ,default 2000ms'],

        AA40: ['Barometer Service'],
        AA41: ['Barometer Data', 'TempLSB:TempMSB:PressureLSB:PressureMSB'],
        AA42: ['Barometer Config', 'Write "01" to start Sensor and Measurements , "00" to put to sleep, "02" to read calibration values from sensor'],
        AA44: ['Barometer Period', 'Period =[Input*10]ms,(lowerlimit 100 ms),default1000 ms'],
        AA43: ['Barometer Calibration', 'When write "02" to Barometer conf. ha sbeen issued,the calibration values is found here.'],

        AA50: ['Gyroscope Service'],
        AA51: ['Gyroscope Data', 'XLSB:XMSB:YLSB:YMSB:ZLSB:ZMSB'],
        AA52: ['Gyroscope Config', 'Write 0 to turn off gyroscope,1 to enable X-axis only, 2t o enable Y-axis only, 3=X and Y,4 = Zo nly, 5 = X and Z, 6 = Y'],
        AA53: ['Gyroscope Period', 'Period =[Input*10]ms(lower limit100ms),default 1000ms'],

        AA61: ['TestData', 'Self-test results (highbitindicatesPASSED):Bit 0:IRtemp,1:Humidity,2:Magnetometer,3:accelerometer,4:Barometer,5:Gyroscope'],

        AA62: ['Test Config', 'bit 7: enable testmode; bit 0-1LED bit mask'],

        CCC1: ['Connection Parameters', 'ConnInterval,SlaveLatency,SupervisionTimeout(2 byteseach)'],

        CCC2: ['Request Connection Parameters', 'MinConnInterval,MaxConnInterval,SlaveLatency,SupervisionTimeout(2 byteseach)'],

        CCC3: ['Disconnect request', 'Change thevaluetodisconnect'],

        FFC1: ['OADImage Identify', 'Write "0" to identify image type "A", "1" to identify "B". Data in notification 8 bytes: imagetype(2), size/4(2),userdata(4).'],

        FFC2: ['OADImage Block', 'Imageblock(18bytes).Blockno. (2 bytes),OADimage block (16 bytes)'],

        FFE0: ['Keypress service'],

        FFE1: ['Keypress Data'],

        "2902": ['Keypress Notification']

    };


function getTiAttribute(uuid) {
    var id = uuid.replace(TIBase[0], '').replace(TIBase[1], '').toUpperCase();
    return [uuid, id].concat(sensorTagAttributeTable[id]);
}

function MSBLSBtoWORD(msb, lsb) {
    return (((msb << 8) | lsb) << 16) >> 16;
}

function SensorTag(p, cb, logger) {
    if (!logger) {
        this.logger = this.default_logger;
    }
    this.p = p;
    this.rssi = 0;
    this.logger = logger;
    this.init(p, cb);
}


SensorTag.prototype = {

     default_logger : function(msg) {
        console.log(msg);
     },

    init: function(p, cb) {

        var st = this;

        p.connect(function(error) {

            if (error) {

                console.error(error);

            } else {
                p.updateRssi(function(error, rssi) {
                    st.logger('RSSI:'+rssi);
                    st.rssi = rssi;
                });

                p.discoverAllServicesAndCharacteristics(function(error, srvs, cha) {

                    var srv;

                    while (srvs.length) {

                        srv = srvs.shift();

                        //console.log(getTiAttribute(srv.uuid));

                        while (srv.characteristics.length) {
                            st.addCharacteristic(srv.characteristics.shift());
                        }

                    }

                    cb(st);

                });


            }
        });

    },

    addCharacteristic: function(ch) {

        var tiAttr = getTiAttribute(ch.uuid);

        try {
            //removeSpaces to make CamelCaseNames
            var fName = tiAttr[2].split(' ').join('');

            this[fName] = {
                ch: ch,
                info: tiAttr
            };

        } catch (err) {
            console.error('unknown characterstic ', tiAttr, err);
        }

    },

    readConfig: function(cname, cb) {
        var st = this;
        st[cname].ch.read(function(err, buf) {
            cb(st, st[cname].info[2], err, buf);
        });
    },
    readConfigString: function(cname, cb) {
        var st = this;
        st[cname].ch.read(function(err, buf) {
            cb(st, st[cname].info[2], err, buf.toString());
        });
    },

    readConfigHex: function(cname, cb) {
        var st = this;
        st[cname].ch.read(function(err, buf) {
            cb(st, st[cname].info[2], err, buf.toString('hex'));
        });
    },

    getSystemId: function(cb) {
        var st = this;
        st.SystemID.ch.read(function(err, data) {

            var systemId = [
                data.readUInt8(7).toString(16),
                data.readUInt8(6).toString(16),
                data.readUInt8(5).toString(16),
                data.readUInt8(4).toString(16),
                data.readUInt8(3).toString(16),
                data.readUInt8(2).toString(16),
                data.readUInt8(2).toString(16),
                data.readUInt8(0).toString(16)
            ].join(':');
            cb(st, st.SystemID.info[2], err, systemId);
        });
    },

    getModelNumberString: function(cb) {
        this.readConfigString('ModelNumberString', cb);
    },

    getSerialNumberString: function(cb) {
        this.readConfigString('SerialNumberString', cb);
    },

    getFirmwareRevisionString: function(cb) {
        this.readConfigString('FirmwareRevisionString', cb);
    },

    ////////////////////////////////////////////////////////////////////////////////////

    getIRTemperatureConfig: function(cb) {
        this.readConfig('IRTemperatureConfig', cb);
    },

    startIRTemperature: function(cb) {
        var onBit = new Buffer([0x01]);
        this.IRTemperatureConfig.ch.write(onBit, true, cb);
    },

    stopIRTemperature: function(cb) {
        var offBit = new Buffer([0x00]);
        this.IRTemperatureConfig.ch.write(offBit, true, cb);
    },

    getIRTemperatureData: function(cb) {
        var st = this;

        st.IRTemperatureData.ch.read(function(err, data) {

            var ambientTemperature = data.readInt16LE(2) / 128.0,
                Vobj2 = data.readInt16LE(0) * 0.00000015625,
                Tdie2 = ambientTemperature + 273.15,
                S0 = 5.593 * Math.pow(10, -14),
                a1 = 1.75 * Math.pow(10, -3),
                a2 = -1.678 * Math.pow(10, -5),
                b0 = -2.94 * Math.pow(10, -5),
                b1 = -5.7 * Math.pow(10, -7),
                b2 = 4.63 * Math.pow(10, -9),
                c2 = 13.4,
                Tref = 298.15,
                S = S0 * (1 + a1 * (Tdie2 - Tref) + a2 * Math.pow((Tdie2 - Tref), 2)),
                Vos = b0 + b1 * (Tdie2 - Tref) + b2 * Math.pow((Tdie2 - Tref), 2),
                fObj = (Vobj2 - Vos) + c2 * Math.pow((Vobj2 - Vos), 2),
                objectTemperature = Math.pow(Math.pow(Tdie2, 4) + (fObj / S), 0.25);
            objectTemperature = (objectTemperature - 273.15);

            cb(st, st.IRTemperatureData.info[2], err, {
                objectTemperature: objectTemperature,
                ambientTemperature: ambientTemperature
            });

        });
    },

    ////////////////////////////////////////////////////////////////////////////////////

    getHumidityConfig: function(cb) {
        this.readConfigHex('HumidityConfig', cb);
    },

    startHumidity: function(cb) {
        var onBit = new Buffer([0x01]);
        this.HumidityConfig.ch.write(onBit, true, cb);
    },

    stopHumidity: function(cb) {
        var offBit = new Buffer([0x00]);
        this.HumidityConfig.ch.write(offBit, true, cb);
    },

    getHumidityData: function(cb) {
        var st = this;

        st.HumidityData.ch.read(function(err, data) {

            var temperature = -46.85 + 175.72 / 65536.0 * data.readUInt16LE(0),
                humidity = -6.0 + 125.0 / 65536.0 * (data.readUInt16LE(2) & ~0x0003);

            cb(st, st.HumidityData.info[2], err, {
                temperature: temperature,
                humidity: humidity
            });


        });
    },

    ////////////////////////////////////////////////////////////////////////////////////

    getBarometerConfig: function(cb) {
        this.readConfigHex('BarometerConfig', cb);
    },

    startBarometer: function(cb) {
        var onBit = new Buffer([0x01]);
        this.BarometerConfig.ch.write(onBit, true, cb);
    },

    stopBarometer: function(cb) {
        var offBit = new Buffer([0x00]);
        this.BarometerConfig.ch.write(offBit, true, cb);
    },

    getBarometerCalibration: function(cb) {
        var calibrationBit = new Buffer([0x02]),
            st = this;
        this.BarometerConfig.ch.write(calibrationBit, true, function() {
            st.BarometerCalibration.ch.read(function(err, data) {
                st._barometricPressureCalibrationData = data;
                cb(st, st.BarometerCalibration.info[2], err, data);
            });
        });
    },

    getBarometerData: function(cb) {
        var st = this;

        if (!st._barometricPressureCalibrationData) return;

        st.BarometerData.ch.read(function(err, data) {

            // For computation refer :  http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#Barometric_Pressure_Sensor_2
            var temp, // Temperature raw value from sensor
                pressure, // Pressure raw value from sensor
                S, // Interim value in calculation
                O, // Interim value in calculation
                p_a, // Pressure actual value in unit Pascal.

                c0 = st._barometricPressureCalibrationData.readUInt16LE(0),
                c1 = st._barometricPressureCalibrationData.readUInt16LE(2),
                c2 = st._barometricPressureCalibrationData.readUInt16LE(4),
                c3 = st._barometricPressureCalibrationData.readUInt16LE(6),

                c4 = st._barometricPressureCalibrationData.readInt16LE(8),
                c5 = st._barometricPressureCalibrationData.readInt16LE(10),
                c6 = st._barometricPressureCalibrationData.readInt16LE(12),
                c7 = st._barometricPressureCalibrationData.readInt16LE(14);

            temp = data.readInt16LE(0);
            pressure = data.readUInt16LE(2);

            S = c2 + ((c3 * temp) / 131072.0) + ((c4 * (temp * temp)) / 17179869184.0);
            O = (c5 * 16384.0) + (((c6 * temp) / 8)) + ((c7 * (temp * temp)) / 524288.0);
            Pa = (((S * pressure) + O) / 16384.0);

            Pa /= 100.0;

            cb(st, st.BarometerData.info[2], err, Pa);
        });
    }


};


module.exports = SensorTag;

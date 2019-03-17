'use strict';

const I2C = require('i2c-bus');

// register constants
const REG_OFFSET = 0x24; // tuning
const REG_OSC = 0x25; // oscillator register
// bit 7 = clock invert, 0 = non-inverting, 1 = inverted
// bit 6 = OFFM, offset calibration mode
// bit 5 = 12/24 hour mode, 1 = 12 hour mode 0 = 24 hour mode
// bit 4 = Low jitter mode, 0 = normal, 1 = reduced CLK output jitter
// bit 3 - 2 = drive control, 00 = normal Rs 100k, 01 = low drive Rs 60k, 10 and 11 = high drive Rs 500k
// bit 1 - 0 = load capacitance, 00 = 7.0pF, 01 = 6.0pF, 10 and 11 = 12.5pF
const REG_BATT = 0x26; // battery switch
// bit 4 = enable/disable battery switch feature, 0 = enable, 1 = disable
// bit 3 = battery switch refresh rate, 0 = low, 1 = high
// bit 2 - 1 = battery switch mode, 00 = at Vth level, 01 = at Vbat level, 10 = at higher of Vth or Vbat, 11 = at lower of Vth or Vbat
// bit 0 = battery switch threshold voltage, 0 = 1.5V, 1 = 2.8V
const REG_IO = 0x27; // Pin IO register
const REG_FUNC = 0x28; // function register
// bit 7 = enable/disable 100th second, 0 = disabled, 1 = enabled
// bit 6-5 = periodic interrupt
// bit 4 = RTC Mode, 0 = real time, 1 = stop watch
// bit 3 = stop mode, 0 = stop controlled by stop bit, 1 = stop controlled by TS Pin
// bit 2-0 = clock output frequency
const REG_FLAGS = 0x2B; // flag status register
const REG_STOP = 0x2E; // stop enable
// bit 7 -1 not used
// bit 0 = run/stop, 0 = run, 1 = stop
const REG_RESET = 0x2F; // software reset control
// software reset = 0x2C, triggers CPR and CTS
// clear prescaler = 0xA4
// clear timestamp = 0x25

// default module settings
const Defaults = {
  i2cDev: 1,
  address: 0x51
};

// library module for NXP Semiconductor Real-Time Clock / Calendar
class PCF85263A {
  // class constructor, use settings to override i2c device and chip address
  constructor (settings) {
    this.settings = Object.assign({}, Defaults, settings);
    this.i2cWire = null;
    this.autoExport();
  }

  // auto export class methods
  autoExport () {
    let self = this;
    Object.getOwnPropertyNames(Object.getPrototypeOf(self)).forEach(function (name) {
      if (/^_[^_]+/.test(name)) {
        self[name.replace(/^_/, '')] = self[name].bind(self);
      }
    });
  }

  // initialize the class instance
  _init () {
    this.i2cWire = I2C.openSync(this.settings.i2cDev);
  }

  // set the time counters to 24 hour mode
  _set24HourMode () {
    this.setHourMode(24);
  }

  // set the time counters to 12 hour mode
  _set12HourMode () {
    this.setHourMode(12);
  }

  // set clock hour mode 12/24
  _setHourMode (hour) {
    let time = this.getTime();
    let then = Date.now();
    this.stopClock();
    // bit 5 = 12/24 hour mode, 1 = 12 hour mode 0 = 24 hour mode
    let byte = this.getRegister(REG_OSC);
    switch (hour) {
      case 12:
      byte = byte | 0x20;
      break;

      case 24:
      byte = byte & 0xDF;
      break;

      default:
      throw new Error('Unknown hour mode ' + hour);
    }
    this.setRegister(REG_OSC, byte);
    time += Date.now() - then; // adjust for lost time
    this.setTime(time);
  }

  // get the set hour mode, 12 or 24 hours
  _getHourMode () {
    return (0x20 & this.getRegister(REG_OSC) ? 12 : 24);
  }

  _enableHundredths () {
    let byte = this.getRegister(REG_FUNC);
    // bit 7 on
    byte = byte | 0x80;
    this.setRegister(REG_FUNC, byte);
  }

  _disableHundredths () {
    let byte = this.getRegister(REG_FUNC);
    // bit 7 off
    byte = byte & 0x7F;
    this.setRegister(REG_FUNC, byte);
  }

  // set drive control for quartz series resistance, ESR, motional resistance, or Rs
  // 100k ohms = 'normal', 60k ohms = 'low', 500k ohms = 'high'
  _setDriveControl (drive) {
    // bit 3 - 2 = drive control, 00 = normal Rs 100k, 01 = low drive Rs 60k, 10 and 11 = high drive Rs 500k
    let bits = 0x00;
    switch (drive) {
      case 'low':
        bits = 0x04;
        break;

      case 'normal':
        bits = 0x00;
        break;

      case 'high':
        bits = 0x08;
        break;

      default:
        throw new Error('Invalid drive mode ' + drive);
    }
    let byte = this.getRegister(REG_OSC);
    byte = byte | bits;
    this.setRegister(REG_OSC, byte);
  }

  // set load capacitance for quartz crystal in pF, valid values are 6, 7, or 12.5
  _setLoadCapacitance (Cl) {
    // bit 1 - 0 = load capacitance, 00 = 7.0pF, 01 = 6.0pF, 10 and 11 = 12.5pF
    let bits = 0x00;
    switch (Cl) {
      case 7:
        bits = 0x00;
        break;

      case 6:
        bits = 0x01;
        break;

      case 12.5:
        bits = 0x02;
        break;

      default:
        throw new Error('Invalid load capacitance.');
    }
    let byte = this.getRegister(REG_OSC);
    byte = byte | bits;
    this.setRegister(REG_OSC, byte);
  }

  // enable the battery switch circuitry
  _enableBatterySwitch () {
    let byte = this.getRegister(REG_BATT);
    byte = byte & 0x0F;
    this.setRegister(REG_BATT, byte);
  }

  // disable the battery switch circuitry
  _disableBatterySwitch () {
    let byte = this.getRegister(REG_BATT);
    byte = byte | 0x10;
    this.setRegister(REG_BATT, byte);
  }

  // TODO add methods to set battery switch settings

  // set the control register to stop the clock
  _stopClock () {
    this.setRegister(REG_STOP, 0x01);
  }

  // set control register to start the clock
  _startClock () {
    this.setRegister(REG_STOP, 0x00);
  }

  // get the time from the real time clock, type = 'string' = raw time string, 'date' = Date object, default returns time integer
  _getTime (type) {
    let ts = '';
    this.writeBytes([0x00]); // position pointer at first register
    let bytes = this.readBytes(8); // read time registers
    let hour;

    // determine hour based on the clock's hour mode
    if (this.getHourMode() === 12) {
      hour = this.bcdToByte(bytes[3] & 0xDF);
      if (hour === 12) {
        hour = 0; // 12 AM is 00
      }
      if (bytes[3] & 0x20) {
        hour = hour + 12; // in PM add 12
      }
    }
    else {
      hour = this.bcdToByte(bytes[3]);
    }

    // create timestamp string from clock registers
    ts += (2000 + this.bcdToByte(bytes[7]));
    ts += '-' + this.zeroPad(this.bcdToByte(bytes[6]));
    ts += '-' + this.zeroPad(this.bcdToByte(bytes[4]));
    ts += 'T' + this.zeroPad(hour);
    ts += ':' + this.zeroPad(this.bcdToByte(bytes[2]));
    ts += ':' + this.zeroPad(this.bcdToByte(bytes[1]));
    ts += '.' + this.zeroTail(this.bcdToByte(bytes[0])) + 'Z';

    // return time based on type requested
    switch (type) {
      case 'string':
      return ts;

      case 'date':
      return new Date(ts);

      default:
      return new Date(ts).getTime();
    }
  }

  // set the time in the real time clock using the provided date, date = Date, timestamp string, or time integer
  _setTime (date) {
    // make sure date is a Date object
    switch (typeof date) {
      case 'number':
      date = new Date(date);
      break;

      case 'string':
      date = new Date(date);
      break;

      default:
      break;
    }

    // determine hour based on clock 12/24 hour mode
    let hour = date.getUTCHours();
    if (this.getHourMode() === 12) {
      if (hour === 0) {
        hour = this.byteToBcd(12);
      }
      else if (hour > 12) {
        hour = this.byteToBcd(hour - 12) & 0x20; // set AM/PM bit
      }
      else {
        hour = this.byteToBcd(hour);
      }
    }
    else {
      hour = this.byteToBcd(hour);
    }

    // set clock registers
    let bytes = [REG_STOP, 0x00, 0xA4]; // start write at stop register, stop clock and clear prescaler
    bytes.push(this.byteToBcd(Math.floor(date.getUTCMilliseconds() / 10)));
    bytes.push(this.byteToBcd(date.getUTCSeconds()));
    bytes.push(this.byteToBcd(date.getUTCMinutes()));
    bytes.push(hour);
    bytes.push(this.byteToBcd(date.getUTCDate()));
    bytes.push(this.byteToBcd(date.getUTCDay()));
    bytes.push(this.byteToBcd(date.getUTCMonth() + 1));
    bytes.push(this.byteToBcd(date.getUTCFullYear() - 2000));
    this.writeBytes(bytes);
    this.startClock();
  }

  // ensure single digit has a leading 0
  zeroPad (num) {
    return (num > 9 ? '' : '0') + num;
  }

  // ensure single digit has a trailing 0
  zeroTail (num) {
    return num + (num > 9 ? '' : '0');
  }

  // convert bcd byte to byte
  bcdToByte (bcd) {
    return (bcd & 0x0F) + 10 * ((bcd >> 4) & 0x0F);
  }

  // convert byte to bcd byte
  byteToBcd (byte) {
    byte = this.zeroPad(byte);
    return (parseInt(byte[0]) << 4) | parseInt(byte[1]);
  }

  // get byte from a register
  _getRegister (register) {
    this._writeBytes([register]);
    return this._readBytes(1)[0];
  }

  // set byte in a register
  _setRegister (register, byte) {
    this.writeBytes([register, byte]);
  }

  // write array of bytes to clock
  _writeBytes (bytes) {
    let writeBuffer = Buffer.from(bytes);
    this.i2cWire.i2cWriteSync(this.settings.address, writeBuffer.length, writeBuffer);
  }

  // read array of bytes from clock
  _readBytes (length) {
    let readBuffer = Buffer.alloc(length);
    this.i2cWire.i2cReadSync(this.settings.address, readBuffer.length, readBuffer);
    return [...readBuffer];
  }
}

module.exports = PCF85263A;

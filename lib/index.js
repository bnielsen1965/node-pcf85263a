'use strict';

const I2C = require('i2c-bus');

const REG_OFFSET = 0x24; // tuning
const REG_OSC = 0x25; // oscillator register
// bit 5 = 12/24 hour mode, 1 = 12 hour mode 0 = 24 hour mode
const REG_BATT = 0x26; // battery switch
// bit 4 = enable/disable battery switch feature, 0 = enable, 1 = disable
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

const Defaults = {
  i2cDev: 1,
  address: 0x51
};

class PCF85263A {
  constructor (settings) {
    this.settings = Object.assign({}, Defaults, settings);
    this.i2cWire = null;
    this.autoExport();
  }

  autoExport () {
    let self = this;
    Object.getOwnPropertyNames(Object.getPrototypeOf(self)).forEach(function (name) {
      if (/^_[^_]+/.test(name)) {
        self[name.replace(/^_/, '')] = self[name].bind(self);
      }
    });
  }

  _init () {
    this.i2cWire = I2C.openSync(this.settings.i2cDev);
  }


  _set24HourMode() {
    let byte = this.getRegister(REG_OSC);
    byte = byte & 0xDF;
    this.setRegister(REG_OSC, byte);
  }

  _enableHundredths() {
    let byte = this.getRegister(REG_FUNC);
    byte = byte | 0x80;
    this.setRegister(REG_FUNC, byte);
  }

  stopClock() {
    this.i2cWire.i2cWriteSync(this.settings.address, 2, Buffer.from([REG_STOP, 0x01]));
  }

  _startClock() {
    this.i2cWire.i2cWriteSync(this.settings.address, 2, Buffer.from([REG_STOP, 0x00]));
  }

  _getRegister(register) {
    let readBuffer = Buffer.alloc(1);
    this.i2cWire.i2cWriteSync(this.settings.address, 1, Buffer.from([register]));
    this.i2cWire.i2cReadSync(this.settings.address, readBuffer.length, readBuffer);
    return readBuffer[0];
  }

  _setRegister(register, byte) {
    this.i2cWire.i2cWriteSync(this.settings.address, 2, Buffer.from([register, byte]));
  }

  _getTime(type) {
    let ts = '';
    let readBuffer = Buffer.alloc(8);
    this.i2cWire.i2cWriteSync(this.settings.address, 1, Buffer.from([0x00]))
    this.i2cWire.i2cReadSync(this.settings.address, readBuffer.length, readBuffer);
    ts += (2000 + this.bcdToByte(readBuffer[7] & 0x7F));
    ts += '-' + this.zeroPad(this.bcdToByte(readBuffer[6] & 0x7F));
    ts += '-' + this.zeroPad(this.bcdToByte(readBuffer[4] & 0x7F));
    ts += 'T' + this.zeroPad(this.bcdToByte(readBuffer[3] & 0x7F));
    ts += ':' + this.zeroPad(this.bcdToByte(readBuffer[2] & 0x7F));
    ts += ':' + this.zeroPad(this.bcdToByte(readBuffer[1] & 0x7F));
    ts += '.' + this.zeroTail(this.bcdToByte(readBuffer[0] & 0x7F)) + 'Z';
    return (type === 'string' ? ts : new Date(ts).getTime());
  }

  _setTime (date) {
    let bytes = [REG_STOP, 0x00, 0xA4]; // start write at stop register, stop clock and clear prescaler
    bytes.push(this.byteToBcd(Math.floor(date.getUTCMilliseconds() / 10)));
    bytes.push(this.byteToBcd(date.getUTCSeconds()));
    bytes.push(this.byteToBcd(date.getUTCMinutes()));
    bytes.push(this.byteToBcd(date.getUTCHours()));
    bytes.push(this.byteToBcd(date.getUTCDate()));
    bytes.push(this.byteToBcd(date.getUTCDay()));
    bytes.push(this.byteToBcd(date.getUTCMonth() + 1));
    bytes.push(this.byteToBcd(date.getUTCFullYear() - 2000));
    let writeBuffer = Buffer.from(bytes);
    this.i2cWire.i2cWriteSync(this.settings.address, writeBuffer.length, writeBuffer);
    startClock();
  }

  zeroPad (num) {
    return (num > 9 ? '' : '0') + num;
  }

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

}

module.exports = PCF85263A;

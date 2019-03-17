# pcf85263a

NXP Semiconductor PCF85263A Real-Time Clock / Calendar library for NodeJS.

A library that provides methods to interface with an NXP PCF85263A Real-Time Clock
on an i2c interface.


# Install

> npm install --save pcf85263a

NOTE: The module depends on the [i2c-bus](https://www.npmjs.com/package/i2c-bus) library for i2c communication.


# Usage

* Connect the NXP PCF85263A chip to the I2C bus on your board, I.E. a Raspberry Pi.
* Configure the operating system for your board for operation of the I2C interface.
* Create your NodeJS project and install the pcf85263a module in the project.
* In your project code create an instance of the pcf85263a library module.
* Use the library methods to configure your NXP PCF85263A, I.E. set Rs, Cl, etc.
* And begin using the time methods to interact with the NSP PCF85263A.

## Example

```Javascript
'use strict';

// i2c on Raspberry Pi /dev/i2c-1
// crystal = cm200c32768hzft, Rs = 50k ohms, Cl = 12.5pF
// no battery backup

const PCF85263A = require('pcf85263a');
let clock = new PCF85263A();
clock.init();

clock.setDriveControl('low'); // 50k ohms is in the low range for PCF85263A
clock.setLoadCapacitance(12.5); // 12.5 pF
clock.disableBatterySwitch(); // no battery backup, turn off to save power
clock.enableHundredths(); // hundredths byte doesn't increment by default

// start in 12 hour mode
let hourMode = 12;
clock.set12HourMode();
const hourSwap = true; // we will toggle back and forth between modes to test

// set real time clock to current system time
let date = new Date();
clock.setTime(date);

// begin test routine
getRTC();

function getRTC() {
  let t = clock.getTime();
  console.log('RTC Time #:', t);
  console.log('RTC Time # to Date:', new Date(t).toISOString());
  console.log('RTC Time String: ', clock.getTime('string'));
  console.log('\n');
  if (hourSwap) {
    hourMode = (hourMode === 12 ? 24 : 12);
    clock.setHourMode(hourMode);
    t = clock.getTime();
  }
  setTimeout(getRTC, 500); // call again in 500 milliseconds
}
```


# Methods

Each instance of the pcf85263a module provides a set of methods to interact with
the connected device.


## init()

You must always call the init() method first to establish the I2C connection to the
device.


## set24HourMode()

Set the 12/24 hour mode on the device to 24 hour mode.


## set12HourMode()

Set the 12/24 hour mode on the device to 12 hour mode.


## setHourMode(hour)

Set the hour mode on the device by passing the hour mode integer (12 or 24).


## getHourMode()

Returns an integer for the current hour mode set on the device (12 or 24).


## enableHundredths()

Set the device to count time in hundredths.


## disableHundredths()

Set the device to count time in seconds.


## setDriveControl(drive)

Set drive control for quartz series resistance, ESR, motional resistance, or Rs of
the oscillator crystal.

Possible drive modes are "normal", "low", or "high". Resistance values for drive
modes are noted as 100k ohms = 'normal', 60k ohms = 'low', 500k ohms = 'high'.


## setLoadCapacitance(capacitance)

Set the load capacitance value for the oscillator crystal. Valid values are 6, 7, or 12.5.


## enableBatterySwitch()

Enable the battery switch circuit when using a battery backup on the real time clock.


## disableBatterySwitch()

Disable the battery switch circuit when not using a backup battery on the real time
clock. This will reduce power consumption.


## stopClock()

Stop the real time clock. This is necessary when changing some device settings.
The library methods that change settings will automatically stop and start the clock.
This method is only used when your project is changing register settings itself.


## startClock()

Start the real time clock.


## getTime(type)

Get the current time in the real time clock. The value returned is an integer from
a Javascript Date.getTime() based on the value read from the real time clock.

Alternate return types can be specified in the call. "string" returns the raw timestamp
string derived from the real time clock. "date" will return a Javascript Date object
derived from the real time clock.


## setTime(time)

Set the current time in the real time clock. The time value passed to the setTime()
method can be an Javascript Date integer from the getTime() method, a string representation
of a timestamp that can be interpreted by the Javascript Date object, or a Javascript
Date object set tot he desired timestamp.


## zeroPad(number)

Convert a number from 0 to 99 into a 0 padded string representation.


## zeroTail(number)

Convert a number from 0 to 99 into a zero tailed string representation.


## bcdToByte(bcd)

Converts a BCD encoded byte into a byte value. I.E. BCD 0x18 becomes 0x12.


## byteToBcd(byte)

Converts a byte number into BCD format value. I.E. 0x16 becomes 0x22.


## getRegister(register)

Get the value from a PCF85263A register.


## setRegister(register, byte)

Set the value in a PCF85263A register.


## writeBytes(bytes)

Write an array of bytes to the I2C interface.


## readBytes(length)

Read an array of bytes from the I2c interface.

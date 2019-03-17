'use strict';

// crystal = cm200c32768hzft, Rs = 50k ohms, Cl = 12.5pF
// no battery backup

const PCF85263A = require('../lib/index.js');
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

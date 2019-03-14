'use strict';

const PCF85263A = require('../lib/index.js');
let clock = new PCF85263A();
clock.init();
clock.stopClock();
clock.enableHundredths();
clock.set24HourMode();
clock.startClock();
getRTC();


function getRTC() {
  console.log(clock.getTime(), clock.getTime('string'));
  setTimeout(getRTC, 100);
}

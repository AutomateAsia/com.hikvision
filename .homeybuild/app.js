'use strict';

const Homey = require('homey');

class HikvisionApp extends Homey.App {

    async onInit() {
        this.log('Hikvision is running...');
    }
}

module.exports = HikvisionApp;

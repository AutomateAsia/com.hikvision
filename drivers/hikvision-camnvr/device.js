'use strict';

const Homey = require('homey');
const HikvisionAPI = require('./hikvision.js').hikvisionApi;

class HikCamera extends Homey.Device {
    
    async onInit() {
        this.name = this.getName();
        this.log(`Initializing device: ${this.name}`);
        
        this.settings = this.getSettings();
        await this.setCapabilityValue("hik_status", false);
        
        this.driver = await this.getDriverAsync();
        await this.updateCapabilities();
        this.connectToHikvision();
    }

    async getDriverAsync() {
        return new Promise((resolve) => {
            const driver = this.getDriver();
            driver.ready(() => resolve(driver));
        });
    }

    async updateCapabilities() {
        this.log('Updating Capabilities');
        try {
            this.hikApi = new HikvisionAPI({
                host: this.settings.address,
                port: this.settings.port,
                ssl: this.settings.ssl,
                strict: this.settings.strict,
                user: this.settings.username,
                pass: this.settings.password,
                log: true
            });

            this.hikApi.on('socket', async () => {
                await this.handleConnection('connect');
                await this.driver._triggers.trgOnConnected.trigger(this);
            });

            this.hikApi.on('error', async (error) => {
                this.error('Hikvision API Error:', error);
                await this.handleConnection('error');
                await this.driver._triggers.trgOnError.trigger(this);
            });

            this.hikApi.on('alarm', async (code, action, index) => {
                const token = { channelID: index };
                const eventTriggers = {
                    'VideoMotion': { start: 'trgTVideoMotionStart', stop: 'trgVideoMotionStop' },
                    'AlarmLocal': { start: 'trgAlarmLocalStart', stop: 'trgAlarmLocalStop' },
                    'VideoLoss': { start: 'trgVideoLossStart', stop: 'trgVideoLossStop' },
                    'VideoBlind': { start: 'trgVideoBlindStart', stop: 'trgVideoBlindStop' },
                    'LineDetection': { start: 'trgLineDetectionStart', stop: 'trgLineDetectionStop' },
                    'IntrusionDetection': { start: 'trgIntrusionDetectionStart', stop: 'trgIntrusionDetectionStop' }
                };

                if (eventTriggers[code]) {
                    if (action === 'Start') {
                        await this.driver._triggers[eventTriggers[code].start].trigger(this, token);
                    } else if (action === 'Stop') {
                        await this.driver._triggers[eventTriggers[code].stop].trigger(this, token);
                    }
                }
            });

        } catch (error) {
            this.error('Failed to update capabilities:', error.message);
        }
    }

    async handleConnection(status) {
        if (status === 'disconnect' || status === 'error') {
            await this.setCapabilityValue("hik_status", false);
            this.setUnavailable(Homey.__("error"));
        } else if (status === 'connect') {
            this.setAvailable();
            await this.setCapabilityValue("hik_status", true);
        }
    }
}

module.exports = HikCamera;

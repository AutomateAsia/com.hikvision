'use strict';

const Homey = require('homey');
const axios = require('axios');
const xml2js = require('xml2js');
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
            const protocol = this.settings.ssl ? 'https://' : 'http://';
            const url = `${protocol}${this.settings.address}:${this.settings.port}/ISAPI/System/deviceInfo`;
            
            const response = await axios.get(url, {
                auth: {
                    username: this.settings.username,
                    password: this.settings.password
                },
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: this.settings.strict }),
            });

            const result = await xml2js.parseStringPromise(response.data);
            const deviceType = result?.DeviceInfo?.deviceType?.[0] || 'Unknown';
            const firmwareVersion = result?.DeviceInfo?.firmwareVersion?.[0] || 'Unknown';

            await this.setCapabilityValue("hik_type", deviceType);
            await this.setCapabilityValue("hik_version", firmwareVersion);
            this.log(`Device Type: ${deviceType}, Firmware Version: ${firmwareVersion}`);
        } catch (error) {
            this.error('Failed to update capabilities:', error.message);
        }
    }

    async onSettings(oldSettings, newSettings, changedKeys) {
        this.settings = newSettings;
        await this.updateCapabilities();
        this.connectToHikvision();
    }

    async connectToHikvision() {
        try {
            this.log('Connecting to Hikvision device...');
            
            const options = {
                host: this.settings.address,
                port: this.settings.port,
                ssl: this.settings.ssl,
                strict: this.settings.strict,
                user: this.settings.username,
                pass: this.settings.password,
                log: false,
            };
            
            this.hikApi = new HikvisionAPI(options);

            this.hikApi.on('socket', async () => {
                await this.handleConnection('connect');
                await this.driver._triggers.trgOnConnected.trigger(this);
            });

            this.hikApi.on('close', async () => {
                await this.handleConnection('disconnect');
                await this.driver._triggers.trgOnDisconnected.trigger(this);
            });

            this.hikApi.on('error', async (error) => {
                this.log('Hikvision API Error:', error);
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
            this.error('Failed to connect to Hikvision:', error.message);
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

    async ptzZoom(pan, tilt, zoom, channel) {
        try {
            const isNVR = this.getCapabilityValue('hik_type') === "NVR";
            const PTZurl = isNVR
                ? `:${this.settings.port}/ISAPI/ContentMgmt/PTZCtrlProxy/channels/${channel}/continuous`
                : `:${this.settings.port}/ISAPI/PTZCtrl/channels/${channel}/continuous`;

            const protocol = this.settings.ssl ? 'https://' : 'http://';
            const url = `${protocol}${this.settings.address}${PTZurl}`;
            
            const body = `<PTZData><pan>${pan}</pan><tilt>${tilt}</tilt><zoom>${zoom}</zoom></PTZData>`;
            
            await axios.put(url, body, {
                auth: {
                    username: this.settings.username,
                    password: this.settings.password
                },
                headers: { 'Content-Type': 'application/xml' },
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: this.settings.strict })
            });

            return true;
        } catch (error) {
            this.error('PTZ Zoom Command Failed:', error.message);
            return false;
        }
    }
}

module.exports = HikCamera;

'use strict';

const Homey = require('homey');
const HikvisionAPI = require('./hikvision.js').hikvisionApi;

class HikvisionDriver extends Homey.Driver {

    async onInit() { 
        this.log('Hikvision Driver Initialized');
    
        await this.registerFlowCards();
    
        const ptzAction = await this.homey.flow.getActionCard('ptzcontinuous');
        ptzAction.registerRunListener(async (args) => {     
            if (args.device) {
                return await args.device.ptzZoom(args.pannumber, args.tiltnumber, args.zoomnumber, args.channel);
            }
            return true;
        });
    }
    

    async registerFlowCards() {
        this._triggers = {
            trgOnConnected: await this.homey.flow.getDeviceTriggerCard('OnConnected'),
            trgOnDisconnected: await this.homey.flow.getDeviceTriggerCard('OnDisconnected'),
            trgOnError: await this.homey.flow.getDeviceTriggerCard('OnError'),
            trgTVideoMotionStart: await this.homey.flow.getDeviceTriggerCard('VideoMotionStart'),
            trgVideoMotionStop: await this.homey.flow.getDeviceTriggerCard('VideoMotionStop'),
            trgAlarmLocalStart: await this.homey.flow.getDeviceTriggerCard('AlarmLocalStart'),
            trgAlarmLocalStop: await this.homey.flow.getDeviceTriggerCard('AlarmLocalStop'),
            trgVideoLossStart: await this.homey.flow.getDeviceTriggerCard('VideoLossStart'),
            trgVideoLossStop: await this.homey.flow.getDeviceTriggerCard('VideoLossStop'),
            trgVideoBlindStart: await this.homey.flow.getDeviceTriggerCard('VideoBlindStart'),
            trgVideoBlindStop: await this.homey.flow.getDeviceTriggerCard('VideoBlindStop'),
            trgLineDetectionStart: await this.homey.flow.getDeviceTriggerCard('LineDetectionStart'),
            trgLineDetectionStop: await this.homey.flow.getDeviceTriggerCard('LineDetectionStop'),
            trgIntrusionDetectionStart: await this.homey.flow.getDeviceTriggerCard('IntrusionDetectionStart'),
            trgIntrusionDetectionStop: await this.homey.flow.getDeviceTriggerCard('IntrusionDetectionStop'),
        };
    }
    
    async onPair(socket) {
        socket.setHandler('testConnection', async (data) => {
            try {
                const testUrl = `${data.ssl ? 'https' : 'http'}://${data.address}:${data.port}/ISAPI/System/deviceInfo`;
                const axios = require('axios');
    
                const response = await axios.get(testUrl, {
                    auth: {
                        username: data.username,
                        password: data.password
                    },
                    timeout: 5000,
                    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: data.strict })
                });
    
                if (response.status === 200) {
                    return { name: data.address, id: data.address, error: "" };
                } else {
                    return { name: "", id: "", error: "Connection Failed" };
                }
            } catch (error) {
                this.error('Pairing Failed:', error.message);
                return { name: "", id: "", error: "Error in Pairing" };
            }
        });
    }
    
}

module.exports = HikvisionDriver;

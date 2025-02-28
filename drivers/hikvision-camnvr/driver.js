'use strict';

const Homey = require('homey');
const HikvisionAPI = require('./hikvision.js').hikvisionApi;

class HikvisionDriver extends Homey.Driver {

    async onInit() { 
        this.log('Hikvision Driver Initialized');

        this.registerFlowCards();

        new Homey.FlowCardAction('ptzcontinuous')
            .register()
            .registerRunListener(async (args) => {     
                if (args.device) {
                    return await args.device.ptzZoom(args.pannumber, args.tiltnumber, args.zoomnumber, args.channel);
                }
                return true;
            });
    }

    registerFlowCards() {
        this._triggers = {
            trgOnConnected: new Homey.FlowCardTriggerDevice('OnConnected').register(),
            trgOnDisconnected: new Homey.FlowCardTriggerDevice('OnDisconnected').register(),
            trgOnError: new Homey.FlowCardTriggerDevice('OnError').register(),
            trgTVideoMotionStart: new Homey.FlowCardTriggerDevice('VideoMotionStart').register(),
            trgVideoMotionStop: new Homey.FlowCardTriggerDevice('VideoMotionStop').register(),
            trgAlarmLocalStart: new Homey.FlowCardTriggerDevice('AlarmLocalStart').register(),
            trgAlarmLocalStop: new Homey.FlowCardTriggerDevice('AlarmLocalStop').register(),
            trgVideoLossStart: new Homey.FlowCardTriggerDevice('VideoLossStart').register(),
            trgVideoLossStop: new Homey.FlowCardTriggerDevice('VideoLossStop').register(),
            trgVideoBlindStart: new Homey.FlowCardTriggerDevice('VideoBlindStart').register(),
            trgVideoBlindStop: new Homey.FlowCardTriggerDevice('VideoBlindStop').register(),
            trgLineDetectionStart: new Homey.FlowCardTriggerDevice('LineDetectionStart').register(),
            trgLineDetectionStop: new Homey.FlowCardTriggerDevice('LineDetectionStop').register(),
            trgIntrusionDetectionStart: new Homey.FlowCardTriggerDevice('IntrusionDetectionStart').register(),
            trgIntrusionDetectionStop: new Homey.FlowCardTriggerDevice('IntrusionDetectionStop').register(),
        };
    }

    async onPair(socket) {
        socket.on('testConnection', async (data, callback) => {
            try {
                const hikApi = new HikvisionAPI({
                    host: data.address,
                    port: data.port,
                    ssl: data.ssl,
                    strict: data.strict,
                    user: data.username,
                    pass: data.password,
                    log: true
                });

                hikApi.on('socket', async () => {
                    callback(null, { name: data.address, id: data.address, error: "" });
                });

                hikApi.on('error', async (error) => {
                    this.error('Pairing error:', error);
                    callback(true, { name: "", id: "", error: "Connection Failed" });
                });

            } catch (error) {
                this.error('Pairing Failed:', error.message);
                callback(true, { name: "", id: "", error: "Error in Pairing" });
            }
        });
    }
}

module.exports = HikvisionDriver;

'use strict';

const Homey = require('homey');
const axios = require('axios');

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
                const protocol = data.ssl ? 'https://' : 'http://';
                const url = `${protocol}${data.address}:${data.port}/ISAPI/System/deviceInfo`;

                this.log(`Testing connection: ${url}`);

                const response = await axios.get(url, {
                    auth: {
                        username: data.username,
                        password: data.password
                    },
                    timeout: 5000,
                    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: data.strict }),
                });

                if (response.status === 200) {
                    const deviceName = response.data.match("<deviceName>(.*)</deviceName>")?.[1] || "Unknown";
                    const deviceID = response.data.match("<deviceID>(.*)</deviceID>")?.[1] || "Unknown";

                    this.log(`Device Found - Name: ${deviceName}, ID: ${deviceID}`);

                    callback(null, { name: deviceName, id: deviceID, error: "" });
                } else {
                    this.log('Device Connection Failed', response.status);
                    callback(true, { name: "", id: "", error: response.status });
                }
            } catch (error) {
                this.log('Error in Pairing:', error.message);
                callback(true, { name: "", id: "", error: 404 });
            }
        });
    }

    async onPairListDevices(data, callback) {
        try {
            this.log("Listing Devices", data);
            callback(null, []);
        } catch (error) {
            this.error("Error Listing Devices:", error.message);
            callback(error);
        }
    }
}

module.exports = HikvisionDriver;

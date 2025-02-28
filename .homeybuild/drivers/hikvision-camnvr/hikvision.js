#!/usr/bin/nodejs
// Hikvision HTTP API Module

const EventEmitter = require('events');
const axios = require('axios');
const xml2js = require('xml2js');

class HikvisionAPI extends EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.BASEURI = `${options.ssl ? 'https://' : 'http://'}${options.host}:${options.port}`;
        this.activeEvents = {};
        this.triggerActive = false;
        this.TRACE = options.log || false;
        this.client = this.connect();
    }

    async connect() {
        try {
            const url = `${this.BASEURI}/ISAPI/Event/notification/alertStream`;
            this.log(`Connecting to Hikvision API at: ${url}`);

            const response = await axios({
                method: 'get',
                url: url,
                auth: {
                    username: this.options.user,
                    password: this.options.pass
                },
                headers: { 'Accept': 'multipart/x-mixed-replace' },
                responseType: 'stream',
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: this.options.strict })
            });

            response.data.on('data', (data) => this.handleData(data));
            response.data.on('error', (err) => this.handleError(err));
            response.data.on('end', () => this.handleEnd());

            this.emit('socket');
        } catch (error) {
            this.log('Error connecting to Hikvision:', error.message);
            setTimeout(() => this.connect(), 60000);
        }
    }

    async handleData(data) {
        try {
            const result = await xml2js.parseStringPromise(data.toString());
            if (result && result['EventNotificationAlert']) {
                let { eventType, eventState, channelID, dynChannelID, activePostCount } = result['EventNotificationAlert'];

                let code = eventType ? eventType[0] : 'Unknown';
                let action = eventState ? eventState[0] : 'Unknown';
                let index = channelID ? parseInt(channelID[0]) : dynChannelID ? parseInt(dynChannelID[0]) : 0;
                let count = activePostCount ? parseInt(activePostCount[0]) : 0;

                code = this.normalizeEventCode(code);
                action = action === 'active' ? 'Start' : 'Stop';

                const eventIdentifier = `${code}${index}`;

                if (count === 0) {
                    if (this.triggerActive) {
                        Object.entries(this.activeEvents).forEach(([key, eventDetails]) => {
                            this.log(`Ending Event: ${key} - ${eventDetails.code}`);
                            this.emit("alarm", eventDetails.code, 'Stop', eventDetails.index);
                        });
                        this.activeEvents = {};
                        this.triggerActive = false;
                    } else {
                        this.emit("alarm", code, action, index);
                    }
                } else if (!this.activeEvents[eventIdentifier]) {
                    this.activeEvents[eventIdentifier] = { code, index, lastTimestamp: Date.now() };
                    this.emit("alarm", code, action, index);
                    this.triggerActive = true;
                } else {
                    this.activeEvents[eventIdentifier].lastTimestamp = Date.now();
                    Object.entries(this.activeEvents).forEach(([key, eventDetails]) => {
                        if ((Date.now() - eventDetails.lastTimestamp) / 1000 > 2) {
                            this.log(`Ending Event: ${key} - ${eventDetails.code}`);
                            this.emit("alarm", eventDetails.code, 'Stop', eventDetails.index);
                            delete this.activeEvents[key];
                        }
                    });
                }
            }
        } catch (error) {
            this.log('Error parsing Hikvision data:', error.message);
        }
    }

    normalizeEventCode(code) {
        const eventMap = {
            'IO': 'AlarmLocal',
            'VMD': 'VideoMotion',
            'linedetection': 'LineDetection',
            'fielddetection': 'IntrusionDetection',
            'videoloss': 'VideoLoss',
            'shelteralarm': 'VideoBlind'
        };
        return eventMap[code] || code;
    }

    handleEnd() {
        this.log("Connection closed! Reconnecting in 30 seconds...");
        setTimeout(() => this.connect(), 30000);
    }

    handleError(error) {
        this.log("Connection error:", error.message);
        this.emit("error", error);
        setTimeout(() => this.connect(), 60000);
    }

    log(...args) {
        if (this.TRACE) console.log('[Hikvision]', ...args);
    }
}

module.exports = { hikvisionApi: HikvisionAPI };

'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('athom-api');

class LumniApp extends Homey.App {
    async onInit() {
        await this.getApi();
        this.deviceValues = [];
        await this.AddFlowCards();
        await this.initAddOrRemoveDevices();
        await this.enumerateDevices();
        this.log('Zone luminance ready for action');
    }

    getApi() {
        if (!this.api) {
            this.api = HomeyAPI.forCurrentHomey();
        }
        return this.api;
    }

    async AddFlowCards() {
        this.log('Initialze flow cards');
        this.AddConditionFlowCards();
        this.AddTriggerFlowCards();
    }

    async AddConditionFlowCards() {
        new Homey.FlowCardCondition('dark_in')
            .register()
            .registerRunListener(this._onFlowActionGetLuminances.bind(this))
            .getArgument('zone')
            .registerAutocompleteListener(this._onZoneAutoComplete.bind(this));
    }

    async AddTriggerFlowCards() {
        this.itsDarkTrigger = new Homey.FlowCardTrigger('its_dark');
        this.itsDarkTrigger
            .register()
            .registerRunListener(this._onFlowActionTriggerDark.bind(this))
            .getArgument('zone')
            .registerAutocompleteListener(this._onZoneAutoComplete.bind(this));
        this.itsLightTrigger = new Homey.FlowCardTrigger('its_light');
        this.itsLightTrigger
            .register()
            .registerRunListener(this._onFlowActionTriggerLight.bind(this))
            .getArgument('zone')
            .registerAutocompleteListener(this._onZoneAutoComplete.bind(this));
    }

    async initAddOrRemoveDevices() {
        this.log('Add device add and remove event handlers');
        let api = await this.getApi();
        api.devices.on('device.create', async (id) => {
            this.log('New device found!');
            if (["measure_luminance"].includes(device.capabilities[cap])) {
                var device = await this.waitForDevice(allDevices[id], 0);
                if (device) {
                    await this.addDevice(device);
                }
            }
        });

        api.devices.on('device.delete', async (id) => {
            let foundIndex = deviceValues.findIndex(x => x.id == id);
            if (foundIndex > -1)
                deviceValues.splice(foundIndex, 1);
        });
    }

    // Get all devices and add them
    async enumerateDevices() {

        this.log('Enumerating devices start');

        let allDevices = await this.getDevices();
        for (let id in allDevices) {
            var device = await this.waitForDevice(allDevices[id], 0);
            if (device) {
                for (let cap in device.capabilities) {
                    if (["measure_luminance"].includes(device.capabilities[cap])) {
                        await this.addDevice(device);
                    }
                }
            }
        }
        this.log(this.deviceValues);
        this.log('Enumerating devices done');
    }

    // Yolo function courtesy of Robert Klep ;)
    async waitForDevice(id, addCounter) {
        let api = await this.getApi();
        const device = await api.devices.getDevice({ id: id.id });
        if (device.ready) {
            return device;
        }
        await delay(1000);
        addCounter++;
        if (addCounter < 12) {
            return this.waitForDevice(id, addCounter);
        } else {
            this.log("Found Device, not ready:    " + device.name);
            return false;
        }
    }

    async addDevice(device) {
        this.log('Found luminance sensor:        ' + device.name);
        await this.setDeviceValues(device, device.capabilitiesObj["measure_luminance"].value);
        device.makeCapabilityInstance('measure_luminance', function (device, luminance) {
            this.stateChange(device, luminance);
        }.bind(this, device));
    }

    async setDeviceValues(device, luminance) {
        let id = device.id;
        if (!this.deviceValues) {
            this.log('Create device array');
            this.deviceValues = [];
            this.deviceValues.push({ id: id, zone: device.zone, luminance: luminance });
        } else {
            var foundIndex = this.deviceValues.findIndex(x => x.id == id);
            if (foundIndex > -1)
                this.deviceValues[foundIndex].luminance = luminance;
            else {
                this.deviceValues.push({ id: id, zone: device.zone, luminance: luminance });
            }
        }
    }

    async stateChange(device, luminance) {
        this.log('Lumni event trigger for ' + device.name + ' zone ' + device.zone + ', value = ' + luminance);
        let tokens = {};
        this.setDeviceValues(device, luminance);
        let state = { 'zone': device.zone};
        this.itsDarkTrigger.trigger(tokens, state);
    }

    async getDevices() {
        let homeyAPI = await this.getApi();
        return await homeyAPI.devices.getDevices();
    }

    async getZones() {
        let homeyAPI = await this.getApi();
        return await homeyAPI.zones.getZones();
    }

    async _onFlowActionGetLuminances(args) {
        let lux = args.lux;
        let current = await this.getCurrentLuminance(args, true);
        this.log("current lux: " + current + ', thresshold lux: ' + lux);
        return current < lux;
    }

    async _onFlowActionTriggerDark(args,state) {
        let lux = args.lux;
        this.log("Trigger for zone : " + state.zone + ', current zone ' + args.zone.instanceId);
        if (state.zone != args.zone.instanceId) {
            this.log("No trigger needed for this zone");
            return false;
        }
        let current = await this.getCurrentLuminance(args, false);
        this.log("current lux: " + current + ', thresshold lux: ' + lux);
        return current < lux;
    }

    async _onFlowActionTriggerLight(args, state) {
        let lux = args.lux;
        this.log("Trigger for zone : " + state.zone + ', current zone ' + args.zone.instanceId);
        if (state.zone != args.zone.instanceId) {
            this.log("No trigger needed for this zone");
            return false;
        }
        let current = await this.getCurrentLuminance(args, false);
        this.log("current lux: " + current + ', thresshold lux: ' + lux);
        return current >= lux;
    }

    async getCurrentLuminance(args, freshValues) {
        let luminances = await this.getZoneLuminances(args.zone.instanceId, freshValues);
        if (luminances.lenght === 0) {
            this.log("No luminance sensor found.");
            return 0;
        }
        if (luminances.lenght === 1) {
            this.log("One sensor found with value: " + luminances[0]);
            return luminances[0];
        }
        switch (args.type) {
            case "min":
                this.log(luminances.length + " sensors found with lowest value: " + Math.min(luminances));
                return Math.min(luminances);
            
            case "max":
                this.log(luminances.length + " sensors found with highest value: " + Math.max(luminances));
                return Math.max(luminances);
            default:
                let sum = luminances.reduce((previous, current) => current += previous);
                let avg = sum / luminances.length;
                this.log(luminances.length + " sensors found with average value: " + avg);
                return avg;
        }
    }

    async getZoneLuminances(zoneid, freshValues) {
        this.log("Check for zone " + zoneid);
        let zoneLuminances = [];

        if (freshValues) {
            let allDevices = await this.getDevices();
            for (let id in allDevices) {
                let device = allDevices[id];
                this.log(device.name + " with zone " + device.zone);
                if (device.zone === zoneid) {
                    this.log(device.name + " has correct zone");
                    for (let cap in device.capabilities) {
                        if (["measure_luminance"].includes(device.capabilities[cap])) {
                            zoneLuminances.push(device.capabilitiesObj["measure_luminance"].value);
                        }
                    }
                }
            }
        } else {
            let values = this.deviceValues.filter(x => x.zone == zoneid);
            for (let index in values) {
                var value = values[index];
                zoneLuminances.push(value.luminance);
            }
        }
        return zoneLuminances;
    }

    async _onZoneAutoComplete(query, args) {
        let zones = await this.getZones();
        return Object.values(zones).map(z => {
            return { instanceId: z.id, name: z.name };
        });
    }
}
module.exports = LumniApp;

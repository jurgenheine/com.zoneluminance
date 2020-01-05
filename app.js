'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('athom-api');

async function login() {
    //Authenticate against the current Homey.
    const homeyAPI = await HomeyAPI.forCurrentHomey();
    return homeyAPI;
}

class LumniApp extends Homey.App {
    async onInit() {
        login();
        new Homey.FlowCardCondition('dark_in')
            .register()
            .registerRunListener(this._onFlowActionGetLuminances.bind(this))
            .getArgument('zone')
            .registerAutocompleteListener(this._onZoneAutoComplete.bind(this));
    }
 
    async getDevices() {
        var homeyAPI = await login();
        return await homeyAPI.devices.getDevices();
    }

    async getZones() {
        var homeyAPI = await login();
        return await homeyAPI.zones.getZones();
    }

    async _onFlowActionGetLuminances(args) {
        let lux = args.lux;

        var current = await this.getCurrentLuminance(args);
        return current < lux;
    }

    async getCurrentLuminance(args) {
        let luminances = await this.getZoneLuminances(args.zone.instanceId);
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

    async getZoneLuminances(zoneid) {
        this.log("Check for zone " + zoneid);
        var zoneLuminances = [];
        let allDevices =await this.getDevices();
        for (let id in allDevices) {
            var device = allDevices[id];
            this.log(device.name +" with zone " + device.zone);
            if (device.zone === zoneid) {
                this.log(device.name + " has correct zone");
                for (let cap in device.capabilities) {
                    if (["measure_luminance"].includes(device.capabilities[cap])) {
                        zoneLuminances.push(device.capabilitiesObj["measure_luminance"].value);
                    }
                }
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

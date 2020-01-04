'use strict';

const Homey = require('homey'),
const { HomeyAPI } = require('athom-api');

class LumniApp extends Homey.App {

    onInit() {
        new Homey.FlowCardCondition('dark_in')
            .register()
            .registerRunListener(this._onFlowActionGetLumni.bind(this))
            .getArgument('zone')
            .registerAutocompleteListener(this._onZoneAutoComplete.bind(this));

        this.logToHomey(`Lumni has been initialized`);
    }

    getApi() {
        if (!this.api) {
            this.api = HomeyAPI.forCurrentHomey();
        }
        return this.api;
    }

    async getDevices() {
        const api = await this.getApi();
        return await api.devices.getDevices();
    }

    async getZones() {
        const api = await this.getApi();
        return await api.zones.getZones();
    }

    _onFlowActionGetLumni(args) {
        let type = args.type;
        let lux = args.lux;
        let luminances = getZoneLuminances(args.zone);
        if (luminances.lenght === 0)
            return true;
        if (luminances.lenght === 1)
            return luminances[0] >= lux;
        switch (type) {
            case "min":
                return Math.min(luminances) >= lux;
            case "avg":
                let sum = luminances.reduce((previous, current) => current += previous);
                let avg = sum / values.length;
                return avg >= lux;
            case "max":
                return Math.max(luminances) >= value;
        }
        return false;
    }

    async getZoneLuminances(zoneid) {
        var zoneLuminances = []
        let allDevices = await this.getDevices();
        for (let id in allDevices) {
            var device = allDevices[id];
            if (device.zone === zoneid) {
                for (let cap in device.capabilities) {
                    if (["measure_luminance"].includes(device.capabilities[cap])) {
                        zoneLuminances.push(device.getCapabilityValue("measure_luminance"));
                    }
                }
            }
        };
        return zoneLuminances;
    }

    _onZoneAutoComplete(query, args) {
        const zones = this.getZones();
        return Object.values(zones).map(z => {
            return { instanceId: z.id, name: z.name };
        });
    }
}
module.exports = LumniApp;

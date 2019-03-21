import * as sbs1 from 'sbs1';
import * as _ from 'underscore';
import { AppConfig } from '../loadConfig';
import { FlightCollection } from './flightCollection';

/**
 * Airplane Service
 *
 * This service will handle tracking the airplane data received from dump1090.
 * Planned responsibilities, ordered by priority:
 *   1. Gather and keep latest data point(s) about visible planes
 *   2. Alert initializer when a plane enters the geofence
 *   3. Garbage collect or swap off old data
 *
 * Future ideas:
 *   - Track high-level daily stats about planes seen
 *   - Persist daily stats for historical purposes
 *   - Track and save observed flight paths (not just latest location)
 *   - Generate flight path images on a map
 */

const range = 2500;
let prevCallsignLength = 0;
let prevInRange: string[] = [];

export class AirplaneService {
    private readonly sbsClient: sbs1.Client;
    private readonly flights: FlightCollection;

    public constructor(config: AppConfig) {
        this.flights = new FlightCollection();

        const sbsOptions: sbs1.Options = {
            host: config.dump1090_host,
            port: config.dump1090_port
        };
        this.sbsClient = sbs1.createClient(sbsOptions);
        this.sbsClient.on('message', this.onMessage.bind(this));

        setInterval(() => {
            const callsigns = this.flights.getAllCallsigns();
            const length = callsigns.length;

            if (length > prevCallsignLength) {
                prevCallsignLength = length;
                console.log(`Callsigns: ${callsigns.join(',')}`);
            }
        }, 1000);
        setInterval(() => {
            const inRange = Object.keys(this.flights.getFlightsInRange(
                config.home_lat,
                config.home_lon,
                range
            ));

            if (!_.isEqual(inRange, prevInRange)) {
                prevInRange = inRange;
                console.log(`In range: ${inRange}`);
            }
        }, 1000);
    }

    private normalizeMessage(message: sbs1.Message): sbs1.Message {
        // call signs are received as fixed length with padding, remove this
        if (message.callsign) {
            message.callsign = message.callsign.trim();
        }

        return message;
    }

    private onMessage(rawMsg: sbs1.Message): void {
        if (
            !rawMsg.hex_ident ||
            !rawMsg.generated_date ||
            !rawMsg.generated_time
        ) {
            return;
        }

        this.flights.updateFlight(this.normalizeMessage(rawMsg));
    }
}

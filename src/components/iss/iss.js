
import * as React from 'react'
const { getCurrentPositionPromise } = require('geolocation-promise');
import * as satellite from 'satellite.js'
import { useCallback, useEffect, useState, useRef } from 'react';

function radians_to_degrees(radians) {
    var pi = Math.PI;
    return radians * (180 / pi);
}

function degrees_to_radians(degrees) {
    var pi = Math.PI;
    return degrees * (pi / 180);
}

function calculate_relatives(my_latitude_rad, my_longitude_rad, beta, compassHeading, satrec) {
    let phi1 = my_latitude_rad; // Phi1
    let lambda1 = my_longitude_rad; // Lambda1

    let positionAndVelocity = satellite.propagate(satrec, new Date());
    let gmst = satellite.gstime(new Date());
    let positionEci = positionAndVelocity.position;
    let positionGd = satellite.eciToGeodetic(positionEci, gmst);
    let iss_longitude_rad = positionGd.longitude;
    let iss_latitude_rad = positionGd.latitude;
    let iss_altitude_km = positionGd.height;

    let phi2 = iss_latitude_rad; // Phi2
    let lambda2 = iss_longitude_rad; // Lambda2

    const EARTH_RADIUS = 6371; //km equal 3959 ml

    let psi = radians_to_degrees(Math.atan2(Math.sin(lambda2 - lambda1) * Math.cos(phi2), Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - phi2)));

    let rS = iss_altitude_km + EARTH_RADIUS; // Radius from the center of the earth to the station (km)
    let y = Math.acos(Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(lambda1 - lambda2));  // earth phi2 angle

    let d = Math.sqrt((1 + Math.pow((EARTH_RADIUS / rS), 2)) - (2 * (EARTH_RADIUS / rS) * Math.cos(y))); // distance to the iss

    let azimuth = (psi < 0) ? 360 + psi : psi;
    let El = radians_to_degrees(Math.acos(Math.sin(y) / d) * ((d > 0.34) ? -1 : 1));

    return [compassHeading - azimuth, beta - El];
}

function ISSFinder(props) {
    let [state, _setState] = useState({
        satrec: null,
        ISS_orientation_h: 0,
        ISS_orientation_a: 0
    });

    let stateRef = useRef(state);

    let setState = (x) => {
        let tmp = { ...stateRef.current, ...x };
        stateRef.current = tmp;
        _setState(tmp)
    }

    let handleOrientation = async (event) => {
        if (stateRef.current.satrec) {
            let compassHeading = event.webkitCompassHeading || Math.abs(event.alpha - 360);
            const position = await getCurrentPositionPromise();

            let my_longitude_rad = degrees_to_radians(position.coords.longitude);
            let my_latitude_rad = degrees_to_radians(position.coords.latitude);

            let [ISS_orientation_h, ISS_orientation_a] = calculate_relatives(
                my_latitude_rad,
                my_longitude_rad,
                event.beta,
                compassHeading,
                stateRef.current.satrec);

            setState({ ISS_orientation_h, ISS_orientation_a })
        }
    };

    useEffect(async () => {
        let req = await fetch("https://api.wheretheiss.at/v1/satellites/25544/tles",
            {
                method: 'GET', // *GET, POST, PUT, DELETE, etc.
                mode: 'cors', // no-cors, *cors, same-origin
            }
        );
        let response = await req.json();

        let satrec = satellite.twoline2satrec(response["line1"], response["line2"]);
        setState({ satrec });

        window.addEventListener("deviceorientation", handleOrientation);
        return () => {

            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, []);


        const items = [];
        for (let key in state) {
            if (key != 'satrec') {
                items.push(<li key={key}>{key}: {state[key]}</li>)
            }
        }
        return (
            <ul>
                {items}
            </ul>
        );
}

export default ISSFinder;
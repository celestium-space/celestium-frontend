import React from "react";
import Popup from "reactjs-popup";
import { Popup as SemanticPopup } from "semantic-ui-react";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import Countdown from "react-countdown";
import CelestiumLogo from "../images/CelestiumLogo";

const launch = new Date("2022-01-18T12:00:00+02:00");

const options = {
  timeZoneName: "short",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

export default function CelestiumInformationPopup(props) {
  return (
    <Popup open={props.open} closeOnDocumentClick modal nested>
      {(close) => (
        <div className="modal">
          <button className="close" onClick={close}>
            &times;
          </button>
          <div className="header">Welcome to the Celestium Canvas</div>
          <div className="content" style={{ maxWidth: "500px" }}>
            {/* The image created here will be sent to the ISS in: */}
            The image created here will be sent to the International Space
            Station.
            <br />
            <br />
            The specific date has not yet been set, but as soon as we know a{" "}
            <i>countdown</i> will start here. However,{" "}
            <i>pixels placed now still counts!</i>
          </div>
          {/* <SemanticPopup
            style={{ height: "100%", textAlign: "center" }}
            position="top center"
            content="This time is subject to change if deemed nessesary by NASA"
            trigger={
              <div className="modal">
                <Countdown
                  daysInHours={true}
                  date={launch}
                  renderer={({
                    total,
                    days,
                    hours,
                    minutes,
                    seconds,
                    milliseconds,
                    completed,
                  }) => {
                    return (
                      <div className="header2">
                        {days ? `${days} Days - ` : ""}
                        {hours.toString().padStart(2, "0")}:
                        {minutes.toString().padStart(2, "0")}:
                        {seconds.toString().padStart(2, "0")}*
                      </div>
                    );
                  }}
                />
                <div className="header3">
                  {launch.toLocaleString(undefined, options)}
                </div>
              </div>
            }
          /> */}
          <div className="content" style={{ width: "280px" }}>
            Click anywhere on the canvas to contribute, by placing your pixel
            and mine a Celestium Token (
            <CelestiumLogo lineHeight="14pt" />)
          </div>
        </div>
      )}
    </Popup>
  );
}

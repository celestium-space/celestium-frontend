import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import Countdown from "react-countdown";
import CelestiumLogo from "../images/CelestiumLogo";

export default function CelestiumInformationPopup(props) {
  return (
    <Popup open={props.open} closeOnDocumentClick modal nested>
      {(close) => (
        <div className="modal">
          <button className="close" onClick={close}>
            &times;
          </button>
          <div className="header">Welcome to the Celestium Canvas</div>
          <div className="content">
            The image created here will be sent to the ISS at:
          </div>
          <Countdown
            daysInHours={true}
            zeroPadTime={2}
            date="2021-10-17T12:00:00+02:00"
            renderer={({ hours, minutes, seconds, completed }) => {
              return (
                <div className="header2">
                  {hours}:{minutes}:{seconds}
                </div>
              );
            }}
          />
          <div className="header3">12:00 EST, October 17, 2021</div>
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

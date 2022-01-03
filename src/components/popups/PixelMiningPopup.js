import React, { useState } from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { GiRingedPlanet } from "react-icons/gi";
import { IoWallet } from "react-icons/io5";
import CelestiumLogo from "../images/CelestiumLogo";
import Countdown from "react-countdown";
import { Popup as SemanticPopup } from "semantic-ui-react";

function PixelMiningPopup(props) {
  let [rememberConfirm, setRememberConfirm] = useState(false);
  let [confirmMiningPopup, setConfirmMiningPopup] = useState(false);

  return (
    <div>
      <Popup
        open={props.startMiningPopup && !rememberConfirm}
        closeOnDocumentClick
        modal
        nested
        onClose={() => {
          if (!confirmMiningPopup) {
            props.onStartMiningPopupClose();
            props.onDoneMiningPopupClose();
          }
        }}
      >
        {(close) => (
          <div className="modal">
            <button className="close" onClick={close}>
              ×
            </button>
            <div className="header">Confirm selection</div>
            <div className="content" style={{ maxWidth: "500px" }}>
              You have selected pixel{" "}
              <i>
                ({props.clickedX}, {props.clickedY})
              </i>{" "}
              to mine.
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Your browser will try to mine the pixel and set it to your
              selected color.
            </div>
            <div className="content">
              <i>This will take some time</i> and your device may experience
              slowdowns during this process.
            </div>

            <div className="actions">
              <button
                className="ui button"
                onClick={() => {
                  if (document.getElementById("rememberConfirm").checked) {
                    setRememberConfirm(true);
                  }
                  setConfirmMiningPopup(true);
                }}
              >
                Confirm
              </button>
              <div className="ui checkbox">
                <input
                  id="rememberConfirm"
                  type="checkbox"
                  className="example"
                />
                <label style={{ color: "white" }}> Do not ask again</label>
              </div>
            </div>
          </div>
        )}
      </Popup>
      <Popup
        open={props.startMiningPopup && (confirmMiningPopup || rememberConfirm)}
        onOpen={() => {
          props.onConfirm();
        }}
        onClose={() => {
          props.onStartMiningPopupClose();
          setConfirmMiningPopup(false);
        }}
        closeOnDocumentClick
        modal
        nested
      >
        {(close) => (
          <div className="modal">
            <button className="close" onClick={close}>
              ×
            </button>
            <div className="header">Mining in progress...</div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Do not close this window or the mining process will be aborted.
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Mining is an inheritly random process. It is theoritically
              possible to mine for hours or only a couple of seconds. However
              the extremes are very unlikely.
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Based on how fast your device is currently mining we have
              estimated the time most transactions should statistically fall
              within. However, <i>it is very possible to go over time</i>. As
              mining is completely random, aborting and &quot;retrying&quot;
              will unfortunately not help.
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              You may see the countdown move irregularly. This is because the
              amount of resources that are available on your device can
              fluctuate.
            </div>
            <Countdown
              overtime={true}
              daysInHours={true}
              date={props.eta}
              renderer={({
                total,
                days,
                hours,
                minutes,
                seconds,
                milliseconds,
                completed,
              }) => {
                let calculating =
                  isNaN(hours) || isNaN(minutes) || isNaN(seconds);
                return (
                  <SemanticPopup
                    style={{ height: "100%", textAlign: "center" }}
                    position="top center"
                    trigger={
                      <div className="content" style={{ maxWidth: "500px" }}>
                        {(!completed ? "Expected time left " : "Over time ") +
                          "(" +
                          props.currentTransaction +
                          "/2*): "}
                        <i hidden={calculating}>
                          {completed ? "+" : ""}
                          {hours.toString().padStart(2, "0")}:
                          {minutes.toString().padStart(2, "0")}:
                          {seconds.toString().padStart(2, "0")}
                        </i>
                        <i hidden={!calculating}>Calculating...</i>
                      </div>
                    }
                  >
                    Mining two transactions:
                    <br />
                    1. Transaction changing the pixel
                    <br />
                    2. Transaction transferring{" "}
                    <CelestiumLogo color="#5a5a5a" lineHeight="14pt" /> to you
                  </SemanticPopup>
                );
              }}
            />
          </div>
        )}
      </Popup>
      <Popup
        open={props.doneMiningPopup}
        onClose={() => {
          props.onDoneMiningPopupClose();
        }}
        closeOnDocumentClick
        modal
        nested
      >
        {(close) => (
          <div className="modal">
            <button className="close" onClick={close}>
              ×
            </button>
            <div className="header">You have successfully mined a Pixel</div>
            <div className="content" style={{ maxWidth: "400px" }}>
              Reward: <b>1</b>{" "}
              <i>
                Celestium Token (<CelestiumLogo lineHeight="20pt" />)
              </i>
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              You can spend you Celestium tokens at the{" "}
              <a href="/asteroids">Asteroid Database</a>{" "}
              <a href="/asteroids" style={{ color: "white" }}>
                <GiRingedPlanet size={15} />
              </a>
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Or see your current balance in your <a href="/wallet">Wallet</a>{" "}
              <a href="/wallet" style={{ color: "white" }}>
                <IoWallet size={15} />
              </a>
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
}

export default PixelMiningPopup;

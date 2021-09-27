import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { GiRingedPlanet } from "react-icons/gi";
import { IoColorPalette, IoWallet } from "react-icons/io5";

function PixelMiningPopup(props) {
  return (
    <div>
      <Popup
        open={props.startMiningPopup}
        onClose={() => {
          props.onStartMiningPopupClose();
        }}
        closeOnDocumentClick
        modal
        nested
      >
        {(close) => (
          <div className="modal">
            <button className="close" onClick={close}>
              &times;
            </button>
            <div className="header">Confirm selection</div>
            <div className="content">
              You have selected pixel{" "}
              <i>
                ({props.clickedX}, {props.clickedY})
              </i>{" "}
              to mine.
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Your browser will now try to mine the pixel and set it to your
              selected color.
            </div>
            <div className="content">
              <i>This will take some time</i> and you may experience slowdowns
              during this process.
            </div>

            <div className="actions">
              <button
                className="ui button"
                onClick={() => {
                  props.onConfirm();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </Popup>
      <Popup
        open={props.confirmMiningPopup}
        onClose={() => {
          props.onConfirmMiningPopupClose();
        }}
        closeOnDocumentClick
        modal
        nested
      >
        {(close) => (
          <div className="modal">
            <button className="close" onClick={close}>
              &times;
            </button>
            <div className="header">Mining in progress...</div>
            <div className="content">
              Do not close this window or the mining process will be aborted
            </div>
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
              &times;
            </button>
            <div className="header">You have successfully mined a Pixel</div>
            <div className="content">
              Reward: <b>1</b> <i>Celestium Token (C)</i>
            </div>
            <div className="content" style={{ maxWidth: "400px" }}>
              You can spend you Celestium tokens at the{" "}
              <a href="/store">Asteranks Database</a>{" "}
              <a href="/store" style={{ color: "white" }}>
                <GiRingedPlanet size={15} />
              </a>
            </div>
            <div className="content">
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

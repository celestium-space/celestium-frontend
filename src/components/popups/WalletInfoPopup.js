import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { Button } from "semantic-ui-react";

export default function WalletInfoPopup(props) {
  return (
    <Popup
      open={props.open}
      onClose={props.onClose}
      closeOnDocumentClick
      modal
      nested
    >
      {() => (
        <div className="modal">
          <button className="close" onClick={props.onClose}>
            &times;
          </button>
          <div className="header">Wallet</div>
          <div
            className="content"
            style={{ textAlign: "left", maxWidth: "440px" }}
          >
            <br/>
            This is your personal wallet.
            <br/>
            <br/>
            Here you can find all the assets you acquire, including Celestium tokens, asteroids, and space debris.
            <br/>
            <br/>
            Click on an asteroid to learn more about it.
            <br/>
            <br/>
            Click on the link in the table to track your space debris in real-time.
            <br/>
          </div>
        </div>
      )}
    </Popup>
  );
}

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
          <button className="close" onClick={close}>
            &times;
          </button>
          <div className="header">Wallet Info</div>
          <div
            className="content"
            style={{ textAlign: "left", maxWidth: "440px" }}
          >
            This is your wallet.
            <br />
            Here you can find your current balance in Celestium and the objects
            you have bought the rights to.
            <br />
            Celestium is a crypto-currency on a blockchain. This means that all
            informtion is placed on a public
          </div>
        </div>
      )}
    </Popup>
  );
}

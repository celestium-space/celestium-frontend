import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { Button } from "semantic-ui-react";
import { getKeyPair, uint8ArrToHexStr } from "../../utils";

export default function ExportSKPopup(props) {
  let [pk, sk] = getKeyPair().map(uint8ArrToHexStr);
  let url = window.webkitURL || window.URL;

  let pkHref = url.createObjectURL(
    new Blob([pk], { type: "text/plain", name: "pk.txt" })
  );
  let skHref = url.createObjectURL(
    new Blob([sk], { type: "text/plain", name: "sk.txt" })
  );

  return (
    <Popup
      open={props.open}
      onClose={props.onClose}
      closeOnDocumentClick
      modal
      nested
    >
      {(close) => (
        <div className="modal">
          <button className="close" onClick={close}>
            &times;
          </button>
          <div className="header">Please Confirm</div>
          <div className="content" style={{ maxWidth: "500px" }}>
            <i>WARNING:</i> You are about to export your Secret Key.
            <br />
            <br />
            Anybody with this secret key will be able to spend the celestium in
            your wallet. Please, <i>do not share you Secret Key with others</i>.
            <br />
            <br />
            <span style={{ fontWeight: "bold" }}>Advanced Users:</span> If you
            want to export your Public Key instead, please click{" "}
            <a href={pkHref} onClick={close} download="pk.txt">
              here
            </a>
            .
          </div>
          <div className="actions">
            <Button
              className="close"
              href={skHref}
              onClick={close}
              download="sk.txt"
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
    </Popup>
  );
}

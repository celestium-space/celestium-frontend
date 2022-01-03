import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { Button } from "semantic-ui-react";
import { getKeyPair, uint8ArrToHexStr } from "../../utils";

export default function ExportSKPopup(props) {
  let [_, sk] = getKeyPair();
  sk = uint8ArrToHexStr(sk);
  let url = window.webkitURL || window.URL;
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
          </div>
          <div className="content" style={{ maxWidth: "500px" }}>
            Anybody with this secret key will be able to spend the celestium in
            your wallet. Please, <i>do not share you Secret Key with others</i>.
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

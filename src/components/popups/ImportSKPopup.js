import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { Button } from "semantic-ui-react";
import { FilePicker } from "react-file-picker";
import { importSecretKey } from "../../utils";

export default function ExportSKPopup(props) {
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
          <div className="header">Importing Secret Key</div>
          <div className="content" style={{ maxWidth: "500px" }}>
            <br />
            Coming soon!
            {/* You are about to import a Secret Key into this wallet.
            <br />
            You should only do this if you have{" "}
            <i>a file containing an exported Secret Key</i> from another device.
            <br />
            <br />
            Importing Secret Keys means that all NFTs, debris and Celelestium
            toknes has to be <i>tranferred one of the the two keys</i>. When
            importing Secret Keys you have two choices; transferring everything
            to the imported Secret Key and replacing the key in your wallet or
            transferring everything to the Secret Key already in your wallet.
            <br />
            <br />
            <span style={{ fontWeight: "bold" }}>
              Using imported Secret Key:
            </span>{" "}
            You shold choose this option if you want this device to be synced up
            with the device you exported the Secret Key from. If Celestium is
            spent and/or NFTs are bought from another device (with the same
            Secret Key) those changes will also appear here and vice versa. If
            any other device is using the existing key in this wallet, they will
            become empty as all value is transferred to the imported Secret Key.
            <br />
            <br />
            <span style={{ fontWeight: "bold" }}>Using existing key:</span> You
            should choose this option if you are not planning to use the divce
            from which you have exported the Secret Key you are currentily
            importing. All value will be transferred to the Secret Key already
            in this wallet, meaning that all other wallets using the imported
            Secret Key will be emptied.
            <br />
            <br />
            <i>REMEMBER:</i> do not share your Secret Key with others. */}
          </div>
          <div className="actions">
            <FilePicker
              extensions={["txt"]}
              onChange={(FileObject) => {
                FileObject.text().then((c) => {
                  importSecretKey(c, true);
                });
              }}
            >
              <Button className="close" onClick={close}>
                Use Imported Secret Key
              </Button>
            </FilePicker>
            <FilePicker
              extensions={["txt"]}
              onChange={(FileObject) => {
                FileObject.text().then((c) => {
                  importSecretKey(c, false);
                });
              }}
            >
              <Button className="close" onClick={close}>
                Use Existing Secret Key
              </Button>
            </FilePicker>
          </div>
        </div>
      )}
    </Popup>
  );
}

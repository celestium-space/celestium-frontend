import React, { useState } from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { Button } from "semantic-ui-react";
import { FilePicker } from "react-file-picker";
import Countdown from "react-countdown";

export default function ExportSKPopup(props) {
  let [isMigrating, setIsMigrating] = useState(false);

  return (
    <div>
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
              You are about to import a Secret Key into this wallet.
              <br />
              You should only do this if you have{" "}
              <i>a file containing an exported Secret Key</i> from another
              device.
              <br />
              <br />
              Importing Secret Keys means that all NFTs, debris and Celelestium
              tokens owned by the Secret Key in this wallet will to be{" "}
              <i>tranferred to the Secret Key you are importing</i>. After all
              value has been transferred, the wallet on this device will remove
              its current Secret Key and start using the imported Secret Key.
              <br />
              <br />
              This essentially means that all value owned by both keys will be
              combined and this device will be synced up with the device you
              exported the Secret Key from. If Celestium is spent and/or NFTs
              are bought from the device those changes will also appear here and
              vice versa.
              <br />
              <br />
              We recommend placing the Secret Key you are currently importing in
              a safe place and always use that file when importing Secret Keys
              into other devices in the future.
              <br />
              <br />
              <i>REMEMBER:</i> do not share your Secret Key with others.
            </div>
            <div className="actions">
              <FilePicker
                extensions={["txt"]}
                onChange={(FileObject) => {
                  FileObject.text().then((c) => {
                    props.importSecretKey(c, true);
                    setIsMigrating(true);
                  });
                }}
              >
                <Button className="close" onClick={close}>
                  Migrate Value and Import Secret Key
                </Button>
              </FilePicker>
            </div>
          </div>
        )}
      </Popup>
      <Popup
        open={isMigrating}
        onClose={() => {
          setIsMigrating(false);
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
              You are currently mining the migration transaction transferring
              all value to the desired Secret Key. If you refresh or leave this
              site, the migration will be aborted, and no value will be
              transferred.
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Mining is an inheritly random process. It is theoritically
              possible to mine for hours or only a couple of seconds. However
              the extremes are very unlikely.
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Based on how fast your device is currently mining we have
              estimated the time most transactions should statistically fall
              within. However, <i>it is very possible to go over time</i>.
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
                  <div className="content" style={{ maxWidth: "500px" }}>
                    {!completed ? "Expected time left: " : "Over time: "}
                    <i hidden={calculating}>
                      {completed ? "+" : ""}
                      {hours.toString().padStart(2, "0")}:
                      {minutes.toString().padStart(2, "0")}:
                      {seconds.toString().padStart(2, "0")}
                    </i>
                    <i hidden={!calculating}>
                      Preparing migration transaction...
                    </i>
                  </div>
                );
              }}
            />
          </div>
        )}
      </Popup>
      <Popup
        open={props.doneMiningPopup}
        onOpen={() => {
          setIsMigrating(false);
        }}
        closeOnDocumentClick={false}
        modal
        nested
      >
        {(close) => (
          <div className="modal">
            <div className="header">Migration Complete</div>
            <br />
            <div className="content" style={{ maxWidth: "400px" }}>
              Your wallet has been updated and all its value on the Blockchain
              has now been transferred to the desired Secret Key. Please reload
              this page to see the changes.
              <br />
              <br />
              If the changes do not appear on the first reload, please wait a
              couple of seconds and try again; Secret Key migration can be a bit
              heavy for the backend.
            </div>
            <div className="actions">
              <Button
                className="close"
                onClick={() => {
                  location.reload();
                }}
              >
                Reload
              </Button>
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
}

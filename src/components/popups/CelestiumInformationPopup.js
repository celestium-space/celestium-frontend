import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";

function MyPopup(props) {
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
          <div className="header2">16:42.00 EST</div>
          <div className="header3">September 30, 2021</div>
          <div className="content">
            Click anywhere on the canvas to contribute, by placing your pixel
            and mining a Celestium Token (C)
          </div>
        </div>
      )}
    </Popup>
  );
}

export default MyPopup;

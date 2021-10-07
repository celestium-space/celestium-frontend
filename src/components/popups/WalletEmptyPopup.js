import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { IoColorPalette } from "react-icons/io5";

function MyPopup(props) {
  return (
    <Popup open={props.open} closeOnDocumentClick modal nested>
      {(close) => (
        <div className="modal">
          <button className="close" onClick={close}>
            &times;
          </button>
          <div className="header">Your Wallet is currently empty</div>
          <div className="content" style={{ maxWidth: "440px" }}>
            You can mine Celestium Tokens by placing pixels on the{" "}
            <a href="/">
              Celestium Canvas{" "}
              <b style={{ color: "white" }}>
                <IoColorPalette size={15} />
              </b>
            </a>
          </div>
        </div>
      )}
    </Popup>
  );
}

export default MyPopup;

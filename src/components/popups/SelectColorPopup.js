import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { IoColorPalette } from "react-icons/io5";

function MyPopup(props) {
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
          <div className="header">Please select a color on the right first</div>
          <div className="content" />
        </div>
      )}
    </Popup>
  );
}

export default MyPopup;

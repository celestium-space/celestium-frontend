import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";

function MiningConfirmPopup(props) {
  return (
    <div>
      <Popup
        open={props.open}
        onClose={() => {
          props.onClose();
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
            <div className="content">You have selected</div>

            <div className="actions">
              <button
                className="button"
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
      <Popup open={props.confirmOpen} closeOnDocumentClick modal nested>
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
    </div>
  );
}

export default MiningConfirmPopup;

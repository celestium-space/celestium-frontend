import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";

function Down(props) {
  return (
    <Popup open={props.open} closeOnDocumentClick={false} modal nested>
      {(close) => (
        <div className="modal">
          <div className="header">
            Celestium is temporarily down for maintenance.
            <br />
            <br />
            Sorry for the inconvenience.
            <br />
            <br />
          </div>
        </div>
      )}
    </Popup>
  );
}

export default Down;

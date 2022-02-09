import React from "react";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import "./FullScreenAsteroid.css";
import Popup from "reactjs-popup";

export default function FrontPageInfo(props) {
  return (
    <Popup
      open={props.showFullScreenAsteroid}
      closeOnDocumentClick
      modal
      nested
      onClose={() => props.onClose()}
    >
      <video
        autoPlay={true}
        muted="muted"
        playsInline
        loop
        src={`videos-full/${props.item.full_name}.mp4`}
        className="video"
      />
    </Popup>
  );
}

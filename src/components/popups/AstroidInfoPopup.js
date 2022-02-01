import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { Button } from "semantic-ui-react";

export default function AstroidInfoPopup(props) {
  return (
    <Popup
      open={props.open}
      onClose={props.onClose}
      closeOnDocumentClick
      modal
      nested
    >
      {() => (
        <div className="modal">
          <button className="close" onClick={props.onClose}>
            &times;
          </button>
          <div className="header">Asteroid Database</div>
          <div
            className="content"
            style={{ textAlign: "left", maxWidth: "440px" }}
          >
            <p>
              <br />
              The database consists of 600,000 real near-earth asteroids.
              <br />
              <br />
              Asteroid data such as details on orbits, mass and composition is used to estimate the costs and rewards of mining asteroids.
              <br />
              <br />
              The associated AI generated image has been created from space radiation collected aboard the International Space Station.
              <br />
              <br />
              Composition data is based on spectral classification and size.
              <br />
              <br />
              The calculations incorporate conclusions from multiple scientific publications in addition to cross-referencing known meteorite data.
              <br />
              <br />
              The data is based upon Asterank’s database sourced from the Minor Planet Center and NASA JPL.
            </p>
          </div>
        </div>
      )}
    </Popup>
  );
}

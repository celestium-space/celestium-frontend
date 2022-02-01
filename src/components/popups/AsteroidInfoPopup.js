import React from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import { MdOutlineGridOn } from "react-icons/md";

export default function AsteroidInfoPopup(props) {
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
          <div className="content" style={{ maxWidth: "460px" }}>
            <p>
              <br />
              This database consists of 600,000 real near-earth asteroids.
              <br />
              <br />
              All the real asteroids are linked to the artworks AI-generated
              space images, which you can get in the form of non-fungible tokens
              (NFTs). You get the NFTs by clicking on one of the database&apos;s
              600,000 asteroids name - and then you press the button “exchange
              for Celestium” (upper-middle of the screen).
              <br />
              <br />
              Asteroid data such as details on orbits, mass and composition is
              used to estimate the costs and rewards of mining asteroids.
              <br />
              <br />
              Composition data is based on spectral classification and size.
              <br />
              <br />
              The calculations incorporate conclusions from multiple scientific
              publications in addition to cross-referencing known meteorite
              data.
              <br />
              <br />
              The associated AI generated images has been created from space
              radiation collected aboard the International Space Station. The
              same ISS where, while one AI is buisy collecting data for the
              images, another collects all the transactions. These are the
              transactions created by us forming the image on the{" "}
              <a href="/wallet">Grid</a>{" "}
              <a href="/wallet" style={{ color: "white" }}>
                <MdOutlineGridOn size={15} />
              </a>
              . The AI consolidates these transactions into a block and mines
              it. All while in space!
              <br />
              <br />
              The data is based upon Asterank&apos;s database sourced from the
              Minor Planet Center and NASA JPL.
              <br />
              <br />
            </p>
          </div>
        </div>
      )}
    </Popup>
  );
}

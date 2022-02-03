import React from "react";
import { Menu } from "semantic-ui-react";
import { GiRingedPlanet } from "react-icons/gi";
import { IoColorPalette, IoWallet } from "react-icons/io5";
import { Link } from "react-router-dom";
import "./Navbar.css";
import { Button } from "semantic-ui-react";
import { useState, useEffect, useRef } from "react";

function Navbar(props) {

  const [state, setState] = useState({infoOpen: false});

  return (
    <div>
      <div className="navbar">
        <div className="menuContainer">
          <Menu id="semanticNavbar" icon compact inverted size="large">
            <Menu.Item
              active={props.active == "grid"}
              onClick={() => {
                window.location.replace("/grid");
              }}
            >
              <IoColorPalette className="menuIcon" />
            </Menu.Item>
            <Menu.Item
              onClick={() => {
                window.location.replace("/asteroids");
              }}
              active={props.active == "asteroids"}
            >
              <GiRingedPlanet className="menuIcon" />
            </Menu.Item>
            <Menu.Item
              active={props.active == "wallet"}
              onClick={() => {
                window.location.replace("/wallet");
              }}
            >
              <IoWallet className="menuIcon" />
            </Menu.Item>
          </Menu>
        </div>
      </div>

      <Button
        circular
        className="question-btn"
        icon="info circle"
        style={{
          padding: "0",
          fontSize: "40px",
          backgroundColor: "#333333",
          color: "white",
          bottom: "11px",
          right: "10px",
          position: "absolute",
        }}
        onClick={() => {
                window.location.replace("/info");
        }}
      >
        </Button>

    </div>
  );
}

export default Navbar;

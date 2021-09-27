import React from "react";
import { Menu } from "semantic-ui-react";
import { GiRingedPlanet } from "react-icons/gi";
import { IoColorPalette, IoWallet } from "react-icons/io5";
import { Link } from "react-router-dom";
import "./Navbar.css";

function Navbar(props) {
  return (
    <div className="navbar">
      <div className="menuContainer">
        <Menu id="semanticNavbar" icon compact inverted size="large">
          <Menu.Item as={Link} active={props.active == "grid"} to="/">
            <IoColorPalette className="menuIcon" />
          </Menu.Item>
          <Menu.Item as={Link} active={props.active == "store"} to="/store">
            <GiRingedPlanet className="menuIcon" />
          </Menu.Item>
          <Menu.Item as={Link} active={props.active == "setting"} to="/setting">
            <IoWallet className="menuIcon" />
          </Menu.Item>
        </Menu>
      </div>
    </div>
  );
}

export default Navbar;

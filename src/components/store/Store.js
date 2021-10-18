import React, { Component } from "react";
import _ from "lodash";
import BuyPopup from "../popups/BuyPopup";
import "./Store.css";

class Store extends Component {
  constructor(props) {
    super(props);
    this.state = {
      imageUrl: "/images/loading.png",
    };
  }

  gotStoreItemData(image_url) {
    this.setState({ imageUrl: image_url });
  }

  render() {
    return (
      <div>
        <div
          style={{
            paddingTop: "5px",
            paddingBottom: "5px",
            borderBottom: "1px solid white",
            position: "fixed",
            top: "0",
            left: "0",
            display: "flex",
            backgroundColor: "#1a1a1a",
            width: "100vw",
          }}
        >
          <span
            style={{
              padding: "8px 65px 0px 32px",
              fontSize: "24pt",
              fontWeight: "bold",
              color: "white",
              verticalAlign: "center",
            }}
          >
            Asteroid Database
          </span>
          <BuyPopup
            onClick={(name) => {
              this.onClick(name);
            }}
            imageUrl={this.state.imageUrl}
            resetImageUrl={() => {
              this.setState({ imageUrl: "/images/loading.png" });
            }}
          ></BuyPopup>
        </div>
        <iframe
          id="asterankIframe"
          style={{ height: "calc(100vh - 10px)", width: "100%" }}
          src="asterank"
        ></iframe>
      </div>
    );
  }
}

export default Store;

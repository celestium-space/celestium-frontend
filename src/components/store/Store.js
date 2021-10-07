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
        <BuyPopup
          onClick={(name) => {
            this.onClick(name);
          }}
          imageUrl={this.state.imageUrl}
          resetImageUrl={() => {
            this.setState({ imageUrl: "/images/loading.png" });
          }}
        ></BuyPopup>
        <iframe
          id="asterankIframe"
          style={{ height: "calc(100vh - 10px)", width: "100%" }}
          src="https://cryptocanvas.space/asterank"
        ></iframe>
      </div>
    );
  }
}

export default Store;

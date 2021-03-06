import React, { Component } from "react";
import _ from "lodash";
import BuyPopup from "../popups/BuyPopup";
import "./Asteroids.css";
import { Grid, Button, Table } from "semantic-ui-react";
import AsteroidInfoPopup from "../popups/AsteroidInfoPopup";

class Asteroids extends Component {
  constructor(props) {
    super(props);
    this.state = {
      store_item: {
        store_value_in_dust: "Fetching...",
        profit: "Fetching...",
        price: "Fetching...",
      },
      eta: "Calculating...",
      asteroidInfo: true,
      debris_name: "Unknown debris",
    };
  }

  set_debris_name(name) {
    this.setState({ debris_name: name });
  }

  gotAsteroidsItemData(store_item) {
    console.log(store_item);
    this.setState({
      store_item: store_item,
    });
  }

  mineTransaction(name) {
    try {
      console.log(`Trying to buy store item "${name}"`);
      if (this.storeItemExchange) {
        this.storeItemExchange(name);
      }
    } catch (error) {
      console.log(error);
    }
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
            doneMiningPopup={this.state.doneMiningPopup}
            onDoneMiningPopupClose={() => {
              this.setState({ doneMiningPopup: false });
            }}
            onClick={(name) => {
              this.onClick(name);
            }}
            onConfirm={(name) => {
              this.mineTransaction(name);
            }}
            debris_name={this.state.debris_name}
            store_item={this.state.store_item}
            eta={this.state.eta}
          />

          <Button
            circular
            icon="question circle outline"
            style={{
              padding: "0",
              fontSize: "30px",
              backgroundColor: "#333333",
              color: "white",
            }}
            onClick={() => {
              this.setState({ asteroidInfo: true });
            }}
          />
        </div>
        <iframe
          id="asterankIframe"
          style={{ height: "calc(100vh - 10px)", width: "100%" }}
          src="asterank"
        ></iframe>
        <AsteroidInfoPopup
          open={this.state.asteroidInfo}
          onClose={() => {
            this.setState({ asteroidInfo: false });
          }}
        ></AsteroidInfoPopup>
      </div>
    );
  }
}

export default Asteroids;

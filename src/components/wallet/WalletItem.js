import React, { Component } from "react";
import { Grid, Image, Card } from "semantic-ui-react";
import FullScreenAsteroid from "../popups/FullScreenAsteroid";
import "./Wallet.css";

function randInt(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

class WalletItem extends Component {
  constructor(props) {
    super(props);
    this.state = {
      fullscreen: false,
      item: props.item,
      id: props.id,
    };
  }

  componentDidMount() {
    fetch(
      "https://jsonplaceholder.typicode.com/todos/" + this.props.id.toString()
    )
      .then((response) => response.json())
      .then((json) => {
        this.setState({
          description: json.title,
        });
      });
  }

  render() {
    return (
      <Card
        style={{
          backgroundColor: "#1a1a1a",
          boxShadow: "none",
        }}
        onClick={(x) => {
          this.setState({ fullscreen: true });
        }}
      >
        <video
          autoPlay={true}
          muted="muted"
          playsInline
          loop
          className="column"
          src={`videos-256/${this.state.item.full_name}.mp4`}
          style={{
            width: "256px",
            paddingLeft: "0",
            paddingRight: "14px",
          }}
        />
        <Card.Content>
          <Card.Header style={{ color: "white" }}>
            {this.state.item.full_name}
          </Card.Header>
          <Card.Description style={{ color: "white" }}>
            <Grid columns={2}>
              <Grid.Row
                style={{
                  fontSize: "10px",
                }}
              >
                <Grid.Column>
                  Est. Profit ($)
                  <br />
                  Price (CEL)
                </Grid.Column>
                <Grid.Column>
                  {this.state.item.profit}
                  <br />
                  {this.state.item.store_value_in_dust}
                </Grid.Column>
              </Grid.Row>
            </Grid>
          </Card.Description>
        </Card.Content>
        <FullScreenAsteroid
          showFullScreenAsteroid={this.state.fullscreen}
          onClose={() => {
            this.setState({ fullscreen: false });
          }}
          item={this.state.item}
        ></FullScreenAsteroid>
      </Card>
    );
  }
}

export default WalletItem;

import React, { Component } from "react";
import { Grid, Image, Card } from "semantic-ui-react";
import FullScreenAsteroid from "../popups/FullScreenAsteroid";
import "./Wallet.css";
import CelestiumLogo from "../images/CelestiumLogo";
import { numberToShortScale } from "../../utils";

const DUST_PER_CEL_POWER = 31;
const DUST_PER_CEL = BigInt("1" + "0".repeat(DUST_PER_CEL_POWER));

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
    let asteroid_value_cel = `${(
      BigInt(this.state.item.store_value_in_dust) / DUST_PER_CEL
    ).toString()}.${(BigInt(this.state.item.store_value_in_dust) % DUST_PER_CEL)
      .toString()
      .padStart(DUST_PER_CEL_POWER, "0")}`;

    return (
      <Card
        style={{
          backgroundColor: "#1a1a1a",
          boxShadow: "none",
          width: "100%",
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
            width: "100%",
          }}
        />
        <Card.Content>
          <Card.Header style={{ color: "white" }}>
            {this.state.item.full_name}
          </Card.Header>
          <Card.Description style={{ color: "white" }}>
            <Grid columns={2}>
              <Grid.Row>
                <Grid.Column>Est. Profit ($)</Grid.Column>
                <Grid.Column>
                  {numberToShortScale(this.state.item.profit)}
                </Grid.Column>
              </Grid.Row>
              <Grid.Row>
                <Grid.Column>
                  Price (
                  <CelestiumLogo
                    label={asteroid_value_cel}
                    margin="auto 2px auto 2px"
                    lineHeight="14pt"
                  />
                  )
                </Grid.Column>
                <Grid.Column className="celestium-balance">
                  {asteroid_value_cel}
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

import React, { Component } from "react";
import { Grid, Image, Card } from "semantic-ui-react";
import "./Wallet.css";

function randInt(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

class WalletItem extends Component {
  constructor(props) {
    super(props);
    this.state = {
      url: `/images/${randInt(0, 2)}.gif`,
      description: "lorem somthing here",
      id: props.id,
      price: 10,
    };

    this.onClick = props.onClick;
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
        style={{ backgroundColor: "#1a1a1a", boxShadow: "none" }}
        onClick={(x) => {
          if (this.onClick) this.onClick(this.state.id);
        }}
      >
        <Image src={this.state.url} wrapped ui />
        <Card.Content>
          <Card.Header style={{ color: "white" }}>
            1943 Anteros (1973 EC)
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
                  1.25 trillion
                  <br />
                  1.092348
                </Grid.Column>
              </Grid.Row>
            </Grid>
          </Card.Description>
        </Card.Content>
      </Card>
    );
  }
}

export default WalletItem;

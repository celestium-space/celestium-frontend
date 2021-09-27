import React, { Component } from "react";
import { Grid } from "semantic-ui-react";
import StoreItem from "./StoreItem";
import _ from "lodash";

class Store extends Component {
  constructor(props) {
    super(props);
    this.columns = 7;
    console.log(props.logic);
    this.onClick = props.onClick;
  }

  render() {
    return (
      <Grid doubling columns={this.columns}>
        {_.range(1, this.columns + 1).map((x) =>
          _.range(1, this.columns + 1).map((y) => (
            <Grid.Column key={(x * this.columns + y).toString()}>
              <StoreItem
                id={x * this.columns + y}
                onClick={(x) => this.onClick(x)}
              ></StoreItem>
            </Grid.Column>
          ))
        )}
      </Grid>
    );
  }
}

export default Store;

import React, { Component } from "react";
import { Grid, Button, Table, Menu, Icon, Label } from "semantic-ui-react";
import WalletItem from "./WalletItem";
import WalletEmptyPopup from "../popups/WalletEmptyPopup";
import _ from "lodash";

class Wallet extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div
        style={{
          color: "white",
        }}
      >
        <Grid
          columns={4}
          divided
          style={{
            marginTop: "10px",
            marginLeft: "20px",
            width: "750px",
          }}
        >
          <Grid.Row>
            <Grid.Column style={{ marginTop: "auto", marginBottom: "auto" }}>
              Wallet Balance
            </Grid.Column>
            <Grid.Column style={{ marginTop: "auto", marginBottom: "auto" }}>
              3.2847211039 CEL
            </Grid.Column>
            <Grid.Column style={{ paddingRight: "0" }}>
              <Button>Export Private Key</Button>
            </Grid.Column>
            <Grid.Column
              style={{
                marginTop: "auto",
                marginBottom: "auto",
                paddingLeft: "0",
                fontSize: "10px",
                lineHeight: "110%",
              }}
            >
              WARNING: Do not share
              <br />
              your private key with others
            </Grid.Column>
          </Grid.Row>
        </Grid>
        <div style={{ marginLeft: "34px" }}>Aquired Space Debris:</div>
        <Grid columns={2} divided style={{ marginLeft: "34px" }}>
          <Grid.Column style={{ width: "200px" }}>
            <img style={{ width: "100%" }} src="/debris.png"></img>
          </Grid.Column>
          <Grid.Column>
            <Table celled inverted selectable>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Name</Table.HeaderCell>
                  <Table.HeaderCell>Int&apos;l Designator</Table.HeaderCell>
                  <Table.HeaderCell>Altitude</Table.HeaderCell>
                  <Table.HeaderCell>Velocity</Table.HeaderCell>
                  <Table.HeaderCell>Period</Table.HeaderCell>
                  <Table.HeaderCell>Track Location</Table.HeaderCell>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                <Table.Row>
                  <Table.Cell>FENGYUN 1C DEB</Table.Cell>
                  <Table.Cell>1999-025EWV</Table.Cell>
                  <Table.Cell>989.23 km</Table.Cell>
                  <Table.Cell>7.39 km/s</Table.Cell>
                  <Table.Cell>105.97 minDEB</Table.Cell>
                  <Table.Cell>
                    <a href="http://stuffin.space">http://stuffin.space</a>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </Grid.Column>
        </Grid>
        <Grid doubling columns={this.columns}>
          {_.range(1, this.columns + 1).map((x) =>
            _.range(1, this.columns + 1).map((y) => (
              <Grid.Column key={(x * this.columns + y).toString()}>
                <WalletItem
                  id={x * this.columns + y}
                  onClick={(x) => this.onClick(x)}
                ></WalletItem>
              </Grid.Column>
            ))
          )}
        </Grid>
        <WalletEmptyPopup open={true}></WalletEmptyPopup>
      </div>
    );
  }
}

export default Wallet;

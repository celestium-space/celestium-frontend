import React, { Component } from "react";
import { Grid, Button, Table } from "semantic-ui-react";
import WalletItem from "./WalletItem";
import WalletEmptyPopup from "../popups/WalletEmptyPopup";
import _ from "lodash";
import "./Wallet.css";
import ExportSKPopup from "../popups/ExportSKPopup";
import WalletInfoPopup from "../popups/WalletInfoPopup";

class Wallet extends Component {
  constructor(props) {
    super(props);
    this.columns = 3;
    this.state = { exportSK: false, importSK: false, walletInfo: false };
  }

  render() {
    return (
      <div
        style={{
          color: "white",
        }}
      >
        <Grid
          columns={6}
          divided
          style={{
            marginTop: "0px",
            marginBottom: "10px",
            marginLeft: "20px",
            maxWidth: "880px",
          }}
        >
          <Grid.Row>
            <Grid.Column
              style={{
                width: "200px",
                fontSize: "20px",
                marginTop: "auto",
                marginBottom: "auto",
              }}
            >
              Wallet Balance
            </Grid.Column>
            <Grid.Column style={{ marginTop: "auto", marginBottom: "auto" }}>
              3.28411039 CEL
            </Grid.Column>
            <Grid.Column
              style={{ width: "170px", paddingLeft: "0", paddingRight: "0" }}
            >
              <Button
                onClick={() => {
                  this.setState({ importSK: true });
                }}
              >
                Import Private Key
              </Button>
            </Grid.Column>
            <Grid.Column
              style={{ width: "170px", paddingLeft: "0", paddingRight: "0" }}
            >
              <Button
                onClick={() => {
                  this.setState({ exportSK: true });
                }}
              >
                Export Private Key
              </Button>
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
            <Grid.Column
              style={{
                width: "30px",
                padding: "0",
                marginTop: "auto",
                marginBottom: "auto",
              }}
            >
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
                  this.setState({ walletInfo: true });
                }}
              />
            </Grid.Column>
          </Grid.Row>
        </Grid>
        <div
          style={{
            marginLeft: "34px",
            fontSize: "20px",
            paddingTop: "0px",
            paddingBottom: "10px",
          }}
        >
          Aquired Space Debris:
        </div>
        <Grid
          columns={2}
          divided
          style={{
            marginLeft: "34px",
            marginRight: "34px",
            marginBottom: "-18px",
          }}
        >
          <Grid.Column
            style={{ width: "200px", paddingLeft: "0", paddingRight: "0" }}
          >
            <img style={{ width: "100%" }} src="/debris.gif"></img>
          </Grid.Column>
          <Grid.Column
            style={{
              width: "calc(100vw - 200px - 88px)",
              paddingLeft: "0",
              paddingRight: "0",
            }}
          >
            <div className="table-container">
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
                    <Table.Cell>http://stuffin.space</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell>FENGYUN 1C DEB</Table.Cell>
                    <Table.Cell>1999-025EWV</Table.Cell>
                    <Table.Cell>989.23 km</Table.Cell>
                    <Table.Cell>7.39 km/s</Table.Cell>
                    <Table.Cell>105.97 minDEB</Table.Cell>
                    <Table.Cell>http://stuffin.space</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell>FENGYUN 1C DEB</Table.Cell>
                    <Table.Cell>1999-025EWV</Table.Cell>
                    <Table.Cell>989.23 km</Table.Cell>
                    <Table.Cell>7.39 km/s</Table.Cell>
                    <Table.Cell>105.97 minDEB</Table.Cell>
                    <Table.Cell>http://stuffin.space</Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell>FENGYUN 1C DEB</Table.Cell>
                    <Table.Cell>1999-025EWV</Table.Cell>
                    <Table.Cell>989.23 km</Table.Cell>
                    <Table.Cell>7.39 km/s</Table.Cell>
                    <Table.Cell>105.97 minDEB</Table.Cell>
                    <Table.Cell>http://stuffin.space</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table>
            </div>
          </Grid.Column>
        </Grid>
        <div
          style={{
            borderTop: "5px solid white",
            backgroundColor: "#1a1a1a",
          }}
        >
          <Grid
            columns={3}
            divided
            style={{
              marginTop: "10px",
              marginLeft: "20px",
              width: "750px",
            }}
          >
            <Grid.Row>
              <Grid.Column
                style={{
                  fontSize: "20px",
                  marginTop: "auto",
                  marginBottom: "auto",
                }}
              >
                Aquired Asteroids
              </Grid.Column>
              <Grid.Column style={{ marginTop: "auto", marginBottom: "auto" }}>
                Total Value (CEL)
                <br />
                34.98237492102
              </Grid.Column>
              <Grid.Column>
                Est. Profit ($)
                <br />
                54.83 trillion
              </Grid.Column>
            </Grid.Row>
          </Grid>
          ­
          <div
            style={{
              overflowX: "scroll",
              height: "calc(100vh - 440px)",
            }}
          >
            <Grid
              style={{
                marginLeft: "20px",
                marginRight: "20px",
                marginTop: "5px",
                marginBottom: "5px",
              }}
            >
              {_.range(1, this.columns + 1).map((x) =>
                _.range(1, this.columns + 1).map((y) => (
                  <Grid.Column
                    style={{
                      margin: "-1px",
                      border: "1px solid white",
                      width: "220px",
                    }}
                    key={(x * this.columns + y).toString()}
                  >
                    <WalletItem
                      id={x * this.columns + y}
                      onClick={(x) => this.onClick(x)}
                    ></WalletItem>
                  </Grid.Column>
                ))
              )}
            </Grid>
          </div>
          <WalletEmptyPopup open={true}></WalletEmptyPopup>
          <ExportSKPopup
            open={this.state.exportSK}
            onClose={() => {
              this.setState({ exportSK: false });
            }}
          ></ExportSKPopup>
          <WalletInfoPopup
            open={this.state.walletInfo}
            onClose={() => {
              this.setState({ walletInfo: false });
            }}
          ></WalletInfoPopup>
        </div>
      </div>
    );
  }
}

export default Wallet;

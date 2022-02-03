import React, { Component } from "react";
import { Grid, Button, Table } from "semantic-ui-react";
import WalletItem from "./WalletItem";
import WalletEmptyPopup from "../popups/WalletEmptyPopup";
import _ from "lodash";
import "./Wallet.css";
import ExportSKPopup from "../popups/ExportSKPopup";
import WalletInfoPopup from "../popups/WalletInfoPopup";
import CelestiumLogo from "../images/CelestiumLogo";
import { Popup as SemanticPopup } from "semantic-ui-react";
import { IoColorPalette } from "react-icons/io5";

const DUST_PER_CEL_POWER = 31;
const DUST_PER_CEL = BigInt("1" + "0".repeat(DUST_PER_CEL_POWER));

class Wallet extends Component {
  constructor(props) {
    super(props);
    this.columns = 3;

    this.state = {
      exportSK: false,
      importSK: false,
      walletInfo: false,
      balance: null,
      user_data: { balance: null, owned_store_items: [] },
    };
  }

  componentDidUpdate() {
    if (this.state.user_data.balance == null && this.props.logic) {
      this.props.logic.getUserData();
    }
  }

  render() {
    let total_asteroids_value_cel = BigInt(0);
    let total_asteroids_value_dollars = 0;
    for (let item of this.state.user_data.owned_store_items) {
      total_asteroids_value_cel += BigInt(item.store_value_in_dust);
      total_asteroids_value_dollars += item.profit;
    }

    total_asteroids_value_cel = `${(
      total_asteroids_value_cel / DUST_PER_CEL
    ).toString()}.${(total_asteroids_value_cel % DUST_PER_CEL)
      .toString()
      .padStart(DUST_PER_CEL_POWER, "0")}`;

    let actual_balance = "Getting balance...";
    if (this.state.user_data.balance != null) {
      let big_int_balance = BigInt(this.state.user_data.balance);
      actual_balance = `${(big_int_balance / DUST_PER_CEL).toString()}.${(
        big_int_balance % DUST_PER_CEL
      )
        .toString()
        .padStart(DUST_PER_CEL_POWER, "0")}`;
    }

    let wallet_empty =
      this.state.user_data.balance != null &&
      BigInt(this.state.user_data.balance) == BigInt(0);
    let asteroids_message =
      this.state.user_data.balance == null ? (
        "Loading your asteroids..."
      ) : (
        <div>
          No asteroids found, yet! Remember you can buy asteroids in the{" "}
          <a href="/asteroids">
            Asteroids Market <IoColorPalette size={15} />
          </a>
        </div>
      );
    return (
      <div
        style={{
          color: "white",
        }}
      >
        <div className="wallet-header">
          <div
            style={{
              width: "200px",
              fontSize: "26px",
              marginTop: "auto",
              marginBottom: "auto",
            }}
          >
            Wallet
          </div>
          <SemanticPopup
            style={{ height: "100%", textAlign: "center" }}
            position="top center"
            content={actual_balance}
            trigger={
              <div className="wallet-balance celestium-balance">
                {actual_balance}
              </div>
            }
          />
          <CelestiumLogo
            hidden={this.state.user_data.balance == null}
            label={actual_balance}
            margin="auto 20px auto 5px"
            lineHeight="14pt"
          />
          <div style={{ width: "170px", paddingLeft: "0", paddingRight: "0" }}>
            <Button
              onClick={() => {
                this.setState({ importSK: true });
              }}
            >
              Import Secret Key
            </Button>
          </div>
          <div style={{ width: "170px", paddingLeft: "0", paddingRight: "0" }}>
            <Button
              onClick={() => {
                this.setState({ exportSK: true });
              }}
            >
              Export Secret Key
            </Button>
          </div>
          <div
            style={{
              marginTop: "auto",
              marginBottom: "auto",
              paddingLeft: "0",
              fontSize: "10px",
              lineHeight: "110%",
              width: "160px",
            }}
          >
            WARNING: Do not share
            <br />
            your secret key with others
          </div>
          <div
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
          </div>
        </div>
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
                  <Table.Row></Table.Row>
                  <Table.Row></Table.Row>
                  <Table.Row
                    style={{
                      fontSize: "14pt",
                      height: "100px",
                      lineHeight: "100px",
                      marginLeft: "20px",
                      textAlign: "center",
                    }}
                  >
                    Space debris coming soon...
                  </Table.Row>
                  <Table.Row></Table.Row>
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
                Aquired Asteroids:
              </Grid.Column>
              <Grid.Column style={{ marginTop: "auto", marginBottom: "auto" }}>
                Total Value (
                <CelestiumLogo margin="auto 2px auto 2px" lineHeight="14pt" />)
                <br />
                <div className="celestium-balance">
                  {total_asteroids_value_cel}
                </div>
              </Grid.Column>
              <Grid.Column>
                Est. Profit ($)
                <br />
                {total_asteroids_value_dollars}
              </Grid.Column>
            </Grid.Row>
          </Grid>
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
              {this.state.user_data.owned_store_items.length > 0 ? (
                this.state.user_data.owned_store_items.map(
                  (listValue, index) => {
                    return (
                      <Grid.Column
                        style={{
                          width: "266px",
                          margin: "5px",
                        }}
                        key={index}
                      >
                        <WalletItem
                          id={index}
                          onClick={(x) => this.onClick(x)}
                          item={listValue}
                        ></WalletItem>
                      </Grid.Column>
                    );
                  }
                )
              ) : (
                <div
                  style={{
                    fontSize: "20pt",
                    textAlign: "center",
                    height: "100%",
                    margin: "auto",
                    marginTop: "20vh",
                  }}
                >
                  {asteroids_message}
                </div>
              )}
            </Grid>
          </div>
          <WalletEmptyPopup open={wallet_empty}></WalletEmptyPopup>
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

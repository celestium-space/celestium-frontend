import "./Gans.css";
import { Button, Header, Icon, Image, Card } from "semantic-ui-react";
import React, { createRef, useRef } from "react";
import InfiniteScroll from "react-infinite-scroll-component";
import GanView from "./ganView/GanView";
import { useLocation } from "react-router-dom";
import Popup from "reactjs-popup";
import { Menu } from "semantic-ui-react";
import { GiRingedPlanet } from "react-icons/gi";
import { IoColorPalette, IoWallet } from "react-icons/io5";

export default class Gans extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      userCards: [],
      hasMore: true,
      videos: []
    };
  }

  async componentDidMount() {

    let res = await fetch(
      "https://celestium.space/asterank/api/rankings?sort_by=score&limit=1000"
    );
    let json = await res.json();
    let vid = json.map(x => {return x['full_name'] + ".mp4"});

    console.log(json);
    console.log(vid);

    this.setState({videos: vid}, () => {
      this.fetchMoreData(30);
    });

  }

  render() {
    return (
      <div className="global">
        <br />
        <InfiniteScroll
          dataLength={this.state.userCards.length}
          next={() => {
            this.fetchMoreData(0);
          }}
          hasMore={this.state.hasMore}
          hasChildren={this.state.userCards.length > 0}
        >
          <Card.Group className="card-container" centered itemsPerRow={5}>
            {[...this.state.userCards]}
          </Card.Group>
        </InfiniteScroll>

        <div className="navbar">
          <div className="menuContainer">
            <Menu id="semanticNavbar" icon compact inverted size="large">
              <Menu.Item
                onClick={() => {
                  window.location.replace("/frontend");
                }}
              >
                Enter
              </Menu.Item>
            </Menu>
          </div>
        </div>
      </div>
    );
  }

  async fetchMoreData(amount) {
    let currentAmount = this.state.userCards.length;
    let newAmount = currentAmount + 5;
    if (amount != 0) {
      newAmount = amount;
    }
    let ids = [];
    for (let i = 0; i < newAmount; i++) {
      ids.push([i, i % this.state.videos.length]);
    }
    let newGans = ids.map(x => {
      return <GanView
        imgsrc={"https://celestium.space/videos-256/" + this.state.videos[x[1]]}
        key={x[0]}
      ></GanView>
    });
    this.setState({
      userCards: newGans
    });
  }
}

// begin delay
// text done vid start
// video link
// description

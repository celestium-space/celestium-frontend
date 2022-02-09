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
      hasMore: false,
    };
  }

  videos = ["1080 Orchis (1927 QB).mp4",
    "1705 Tapio (1941 SL1).mp4",
    "1104 Syringa (1928 XA).mp4",
    "3000 Leonardo (1981 EG19).mp4",
    "3628 Boznemcova (1979 WD).mp4",
    "1386 Storeria (1935 PA).mp4",
    "783 Nora (1914 UL).mp4",
    "1493 Sigrid (1938 QB).mp4",
    "3684 Berry (1983 AK).mp4",
  ];

  componentDidMount() {
    this.fetchMoreData(30);
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
      ids.push([i, i % this.videos.length]);
    }
    let newGans = ids.map(x => {
      return <GanView
        imgsrc={"https://celestium.space/videos-256/" + this.videos[x[1]]}
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

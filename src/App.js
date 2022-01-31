import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Switch, Route, useLocation } from "react-router-dom";
import { range } from "./utils";
import Grid from "./components/grid/Grid";
import LogicHandler from "./logicHandler";
import Asteroids from "./components/asteroids/Asteroids";
import Navbar from "./components/navbar/Navbar";
import "./App.css";
import Wallet from "./components/wallet/Wallet";
import FrontPageInfo from "./components/popups/FrontPageInfo";
import { Button } from "semantic-ui-react";

function App() {
  window.app_handle = this;

  let [state, setState] = useState({
    logic: null,
    showInfo: null,
    showCelestiumInfoOnStart: null,
  });
  let grid = useRef();
  let pixelControls = useRef();
  let location = useLocation();
  let asteroidsPage = useRef();
  let walletPage = useRef();

  useEffect(() => {
    if (grid.current) {
      let initialGrid = range(0, 1000000)
        .map((_) => [0, 0, 255, 255])
        .flat();
      grid.current.updatePixels(0, 0, 1000, 1000, initialGrid);
    }
  }, [location]);

  useEffect(() => {
    let showCelestiumInfoOnStart =
      localStorage.getItem("showCelestiumInfoOnStart") != "false";

    let logic = new LogicHandler(
      grid.current,
      pixelControls.current,
      asteroidsPage.current,
      walletPage.current
    );
    setState({
      showInfo: showCelestiumInfoOnStart,
      showCelestiumInfoOnStart: showCelestiumInfoOnStart,
      logic: logic,
    });
  }, [grid, pixelControls, asteroidsPage, walletPage]);

  let style = {
    display: "none",
  };
  if (!state.showInfo) {
    style = {};
  }

  return (
    <div>
      <div style={style}>
        <Switch>
          <Route path="/asteroids">
            <div className="content">
              <Asteroids ref={asteroidsPage}></Asteroids>
            </div>
            <Navbar active="asteroids"></Navbar>
          </Route>
          <Route path="/wallet">
            <Wallet ref={walletPage} logic={state.logic}></Wallet>
            <Navbar active="wallet"></Navbar>
          </Route>
          <Route path="/">
            <Grid
              ref={grid}
              pixelControls={pixelControls}
              logic={state.logic}
            ></Grid>
            <Navbar active="grid"></Navbar>
          </Route>
        </Switch>
        <Button
          circular
          className="question-btn"
          icon="question circle outline"
          style={{
            padding: "0",
            fontSize: "40px",
            backgroundColor: "#333333",
            color: "white",
            bottom: "11px",
            right: "10px",
            position: "absolute",
          }}
          onClick={() => {
            setState({ showInfo: true });
          }}
        />
      </div>
      <FrontPageInfo
        showCelestiumInfo={state.showInfo}
        setShowCelestiumInfo={(change) => {
          console.log("show change!");
          setState({ showInfo: change });
        }}
        showCelestiumInfoOnStart={state.showCelestiumInfoOnStart}
        setShowCelestiumInfoOnStart={(change) => {
          console.log("show on start change!");
          setState({ showCelestiumInfoOnStart: change });
          localStorage.setItem("showCelestiumInfoOnStart", change);
        }}
      ></FrontPageInfo>
    </div>
  );
}

export default App;

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Switch, Route, useLocation } from "react-router-dom";
import { range } from "./utils";
import Grid from "./components/grid/Grid";
import PixelControls from "./components/pixelcontrols/PixelControls";
import LogicHandler from "./logicHandler";
import Store from "./components/store/Store";
import Navbar from "./components/navbar/Navbar";
import "./App.css";
import Wallet from "./components/wallet/Wallet";

function App() {
  window.app_handle = this;

  let [state, setState] = useState({ logic: null });
  let grid = useRef();
  let pixelControls = useRef();
  let location = useLocation();
  let store = useRef();
  let logic = null;

  useEffect(() => {
    if (grid.current) {
      let initialGrid = range(0, 1000000)
        .map((_) => [0, 0, 255, 255])
        .flat();
      grid.current.updatePixels(0, 0, 1000, 1000, initialGrid);
    }

    let logic = new LogicHandler(
      grid.current,
      pixelControls.current,
      store.current
    );
    logic.getSocket();
    setState({ logic: logic });
  }, [location]);

  return (
    <Switch>
      <Route path="/store">
        <div className="content">
          <Store ref={store} logic={logic}></Store>
        </div>
        <Navbar active="store"></Navbar>
      </Route>
      <Route path="/wallet">
        <div className="content">
          <Wallet></Wallet>
        </div>
        <Navbar active="wallet"></Navbar>
      </Route>
      <Route path="/">
        <Grid ref={grid}></Grid>
        <PixelControls ref={pixelControls}></PixelControls>
        <Navbar active="grid"></Navbar>
      </Route>
    </Switch>
  );
}

export default App;

import * as React from 'react';
import { useState, useEffect, useRef, createRef } from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  withRouter,
  useLocation
} from "react-router-dom";
import { generateAndMinePixelNFT, buyBackendItem, range } from './utils'
import Grid from './components/grid/grid'
import PixelControls from './components/pixelcontrols/pixelcontrols';
import LogicHandler from './logicHandler'
import Store from './components/store/store'
import Navbar from './components/navbar/navbar';
import './App.css';

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
      let initialGrid = range(0, 1000000).map(_ => [0, 0, 255, 255]).flat();
      grid.current.updatePixels(0, 0, 1000, 1000, initialGrid);
    }

    console.log(pixelControls.current);
    let logic = new LogicHandler(grid.current, pixelControls.current, store.current);
    logic.getSocket();
    setState({ logic: logic });
  }, [location]);

  return (
    <Switch>
      <Route path="/grid">
        <div className="content">
          <Grid ref={grid}></Grid>
          <PixelControls ref={pixelControls}></PixelControls>
        </div>
        <Navbar active="grid"></Navbar>
      </Route>
      <Route path="/">
        <div className="content">
          <Navbar active="store"></Navbar>
          <Store ref={store} logic={logic}></Store>
        </div>
      </Route>
    </Switch>
  );
}

export default App;

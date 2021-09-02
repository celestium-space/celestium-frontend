import * as React from 'react';
import { useState, useEffect, useRef, createRef } from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route
} from "react-router-dom";
import { generateAndMinePixelNFT, buyBackendItem, range } from './utils'
import Grid from './components/grid/grid'
import Controlls from './components/pixelcontrolls/pixelcontrolls';
import logicHandler from './logicHandler'

function App() {
  window.app_handle = this;

  let [state, setState] = useState({ socket: null });
  let grid = useRef();
  let controllers = useRef();

  useEffect(() => {
    let initialGrid = range(0, 1000000).map(_ => [0, 0, 255, 255]).flat();
    console.log(initialGrid);
    grid.current.updatePixels(0, 0, 1000, 1000, initialGrid);
    let socket_addr = 'wss://api.celestium.hutli.org';
    console.log(`Connecting to "${socket_addr}"...`);
    let socket = new WebSocket(socket_addr);
    console.log(socket.readyState);
    setState({ socket: socket, logic: new logicHandler(socket, grid.current) });
  }, []);

  return (
    <Router>
      <Switch>
        <Route path="/">
          <Grid ref={grid}></Grid>
          <Controlls ref={controllers}></Controlls>
        </Route>
        <Route path="/test">
          <div>
            <button onClick={generateAndMinePixelNFT}>
              Generate and mine pixel NFT
            </button>
            <br />
            <button onClick={buyBackendItem}>
              Buy backend item
            </button>
          </div>
        </Route>
      </Switch>
    </Router >
  );
}

export default App;

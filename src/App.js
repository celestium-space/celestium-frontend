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
import Controlls from './components/pixelcontrolls/pixelcontrolls';
import logicHandler from './logicHandler'
import Store from './components/store/store'
import Navbar from './components/navbar/navbar';

function App() {
  window.app_handle = this;

  let [state, setState] = useState({ socket: null });
  let grid = useRef();
  let controllers = useRef();
  let location = useLocation();
  let store = useRef();
  let logic = null;

  useEffect(() => {
    if (grid.current) {
      grid.current.updatePixels(0, 0, 1000, 1000, range(0, 1000000).map(_ => [255, 0, 0, 255]).flat());
    } 

    // let initialGrid = range(0, 1000000).map(_ => [0, 0, 255, 255]).flat();
    // console.log(initialGrid);
    // grid.current.updatePixels(0, 0, 1000, 1000, initialGrid);
    // let socket_addr = 'wss://api.celestium.hutli.org';
    // console.log(`Connecting to "${socket_addr}"...`);
    // let socket = new WebSocket(socket_addr);
    // console.log(socket.readyState);

    logic = new logicHandler(socket, grid.current, controllers.current, store.current);
  }, [location]);

  return (
      <Switch>
        <Route path="/grid">
          <Navbar active="grid"></Navbar>
          <Grid ref={grid}></Grid>
          <Controlls ref={controllers}></Controlls>
        </Route>
        <Route path="/">
          <Navbar active="store"></Navbar>
          <Store ref={store} socket={socket}></Store>
        </Route>
      </Switch>
  );
}

export default App;

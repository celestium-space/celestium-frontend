import * as React from 'react';
import * as Secp256k1 from 'secp256k1';
import {
  BrowserRouter as Router,
  Switch,
  Route
} from "react-router-dom";
import { sha3_256 } from './sha3.min.js';
import { randomBytes } from 'crypto';
import {generateAndMinePixelNFT, buyBackendItem} from './utils'
import Grid from './components/grid/grid'

function App() {
  window.app_handle = this;


  return (
    <Router>
      <Switch>
        <Route path="/">
          <Grid></Grid>
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

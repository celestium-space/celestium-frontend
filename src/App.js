import * as React from 'react'
import { useState, useEffect } from 'react'
import { io } from "socket.io-client";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useRouteMatch,
  useParams
} from "react-router-dom";
import Navbar from './components/navbar/navbar';
// import Store from './components/store/store';
import Buy from './components/store/buy';
import { Container, Form, FormButton, Header } from 'semantic-ui-react';

var loadJS = function (url, implementationCode, location) {
  //url is URL of external file, implementationCode is the code
  //to be called from the file, location is the location to 
  //insert the <script> element

  var scriptTag = document.createElement('script');
  scriptTag.src = url;

  scriptTag.onload = implementationCode;
  scriptTag.onreadystatechange = implementationCode;
  location.appendChild(scriptTag);

};

function App() {
  let [state, setState] = useState({
    wallet: null,
    pool: null
  });

  window.app_handle = this;

  async function pik() {
    console.log(state.wallet);
    let k = state.wallet.create_and_mine_string_nft(new Uint8Array([0, 0, 0]));
    console.log(k);
  }

    useEffect(() => {
    function loadWasm() {
      let msg = 'This demo requires a current version of Firefox (e.g., 79.0)';
      if (typeof SharedArrayBuffer !== 'function') {
        alert('this browser does not have SharedArrayBuffer support enabled' + '\n\n' + msg);
        return
      }
      // Test for bulk memory operations with passive data segments
      //  (module (memory 1) (data passive ""))
      const buf = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
        0x05, 0x03, 0x01, 0x00, 0x01, 0x0b, 0x03, 0x01, 0x01, 0x00]);
      if (!WebAssembly.validate(buf)) {
        alert('this browser does not support passive wasm memory, demo does not work' + '\n\n' + msg);
        return
      }

      wasm_bindgen('./celestium_wasm_bg.wasm')
        .then(run)
        .catch(console.error);
    }

    loadWasm();

    const { WASMWallet, WorkerPool } = wasm_bindgen;

    function run() {
      // The maximal concurrency of our web worker pool is `hardwareConcurrency`,
      // so set that up here and this ideally is the only location we create web
      // workers.
      let pool = new WorkerPool(navigator.hardwareConcurrency);

      // Configure various buttons and such.
      function fuck() {
        if (!localStorage.getItem("pk_bin") || !localStorage.getItem("sk_bin")) {
          console.log("No keys!");
          localStorage.setItem("pk_bin", "{\"0\":2,\"1\":159,\"2\":144,\"3\":13,\"4\":103,\"5\":147,\"6\":50,\"7\":58,\"8\":202,\"9\":16,\"10\":36,\"11\":110,\"12\":161,\"13\":51,\"14\":214,\"15\":167,\"16\":3,\"17\":1,\"18\":179,\"19\":103,\"20\":192,\"21\":221,\"22\":59,\"23\":249,\"24\":207,\"25\":7,\"26\":108,\"27\":132,\"28\":42,\"29\":246,\"30\":126,\"31\":67,\"32\":227}");
          localStorage.setItem("sk_bin", "{\"0\":205,\"1\":37,\"2\":8,\"3\":20,\"4\":118,\"5\":209,\"6\":72,\"7\":27,\"8\":2,\"9\":128,\"10\":253,\"11\":42,\"12\":184,\"13\":79,\"14\":120,\"15\":133,\"16\":90,\"17\":63,\"18\":186,\"19\":230,\"20\":226,\"21\":192,\"22\":243,\"23\":245,\"24\":205,\"25\":236,\"26\":240,\"27\":248,\"28\":175,\"29\":73,\"30\":21,\"31\":168}")
        }
        let pk = new Uint8Array(Object.values(JSON.parse(localStorage.getItem("pk_bin"))));
        let sk = new Uint8Array(Object.values(JSON.parse(localStorage.getItem("sk_bin"))));
        let wasm_wallet = new WASMWallet(pk, sk, pool, parseInt(navigator.hardwareConcurrency));
        let message = new Uint8Array([0x48, 0x0e, 0x6c, 0x6c, 0x6f]);
        let transaction = wasm_wallet.create_and_mine_string_nft(message);
        console.log(transaction);

      }

      fuck();
    }
  }, []);

  return (
    <Router>
      <Switch>
        <Route path="/">
          <div>
            <h1>{state.wallet ? state.wallet.name : ""}</h1>
            <button onClick={async (x) => {
              setTimeout(pik, 0);
            }}>
              Activate Lasers
            </button>
          </div>
        </Route>
      </Switch>
    </Router>
  );
}

export default App;
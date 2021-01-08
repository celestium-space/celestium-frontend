import * as React from 'react'
import { useState, useEffect } from 'react'
import ISSFinder from './components/iss/iss'
import * as p2pClientLib from "celestium-p2p";
import * as client from "celestium-client-logic";
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
import Store from './components/store/store';
import { Container, Header } from 'semantic-ui-react';


function App() {
  let [state, setState] = useState({
    client: null,
    pk: null,
    sk: null
  });

  useEffect(async () => {
    p2pClientLib.RTCSessionDescription = RTCSessionDescription;
    p2pClientLib.RTCIceCandidate = RTCIceCandidate;
    p2pClientLib.RTCPeerConnection = RTCPeerConnection;
    p2pClientLib.io = io;
    client.p2pClientLib = p2pClientLib;
    client.storage = localStorage;
    let wallet = await import("celestium-wasm");
    client.walletLib = wallet;
    let instance = client.initNewClient();
    let pk = new Uint8Array([0x3, 0xFD, 0xA0, 0x6F, 0xE7, 0xF9, 0x24, 0xCA, 0x5E, 0xC4, 0x14, 0xB7, 0x2D, 0xB7, 0xB0, 0xC4, 0x14, 0x9B, 0xE1, 0x42, 0x0D, 0x13, 0xB4, 0x1F, 0xC6, 0xFA, 0x5F, 0xCD, 0x70, 0xA9, 0xBF, 0x51, 0xC9])
    let sk = new Uint8Array([0xDA, 0x2C, 0xA5, 0x40, 0x17, 0xEF, 0xC6, 0x9B, 0x1C, 0x05, 0x93, 0x1D, 0x56, 0x4E, 0x5D, 0x5D, 0xBA, 0x0F, 0xE0, 0xD8, 0x90, 0xD5, 0x2D, 0x46, 0x1C, 0x52, 0xB7, 0xFB, 0x1E, 0xD4, 0xB8, 0x36]);
    setState({ client: instance, pk, sk });
    // oconsole.log(instance);
    // console.log(pk);
    // console.log(instance.walletClientLib.generateTestBlockchain(pk, sk, 100));
    // console.log(instance.walletClientLib.getBalance()); 
    //console.log(instance)

  }, [])

  return (
    <Router>
      <Switch>
        <Route path="/send">
          <Send state={state}></Send>
        </Route>
        <Route path="/iss">
          <Navbar active="iss"></Navbar>
        </Route>
        <Route path="/store">
          <Store></Store>
          <Navbar active="store"></Navbar>
        </Route>
        <Route path="/">
          <Recv state={state} />
        </Route>
      </Switch>
    </Router>
  );
}

function Recv(props) {
  useEffect(async () => {
    if (props.state.client) {
      props.state.client.walletClientLib.initEmpty();
      let k = await props.state.client.receiveTransaction();
      console.log(k);
    }
  }, [props.state.client])
  return <h1>recv</h1>;
}

function Send(props) {
  useEffect(async () => {
    if (props.state.client) {
      // props.state.client.walletClientLib.generateInitBlockchain(props.state.pk, props.state.sk, 100);
      // props.state.client.saveWallet();

      props.state.client.walletClientLib.initEmpty();

      let binary_wallet = props.state.client.walletClientLib.walletToBinary();
      let pk = binary_wallet.get_pk_bin();
      console.log("send to", pk);
      props.state.client.walletClientLib.deleteWallet();
      props.state.client.loadWallet();
      console.log("balance", props.state.client.walletClientLib.getBalance());

      console.log(props.state.client.sendTransaction(pk, 100, 20));
    }
  }, [props.state])
  return <h1>send</h1>;
}


export default App;
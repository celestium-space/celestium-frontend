import * as React from 'react'
import { useState, useEffect } from 'react'
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
<<<<<<< HEAD
import Buy from './components/store/buy';
import { Container, Form, Header } from 'semantic-ui-react';
import ISSFinder from './components/iss/iss';
=======
import { Container, Header } from 'semantic-ui-react';
import * as msgpack from '@msgpack/msgpack';

>>>>>>> f6c1dda361392822403cdc0e3757dd54635581e5

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
    client.msgpack = msgpack;
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
          <ISSFinder></ISSFinder>
          <Navbar active="iss"></Navbar>
        </Route>
        <Route path="/store">
          <Store></Store>
          <Navbar active="store"></Navbar>
        </Route>
        <Route path="/buy">
          <Buy></Buy>
          <Navbar active="store"></Navbar>
        </Route>
        <Route path="/">
          <Recv state={state} />
          <Navbar active="store"></Navbar>
        </Route>
      </Switch>
    </Router>
  );
}

function Recv(props) {
  useEffect(async () => {
    if (props.state.client) {
      props.state.client.walletClientLib.initWithKeyPair(props.state.pk, props.state.sk);
      console.log("Created empty wallet; Blockchain len:", props.state.client.walletClientLib.blockchainLength());
      console.log("Asking for blockchain...");
      await props.state.client.receiveBlockchain();
      console.log("Got blockchain; Blockchain len:", props.state.client.walletClientLib.blockchainLength());
      console.log("My balance:", props.state.client.walletClientLib.getBalance());
      //console.log(await props.state.client.receiveTransaction());
      //await props.state.client.mineOffChainTransactions();
    }
  }, [props.state.client])
  return <h1>recv</h1>;
}

function Send(props) {
  useEffect(async () => {
    if (props.state.client) {
      props.state.client.walletClientLib.generateInitBlockchain();
      console.log("Created init wallet; My balance:", props.state.client.walletClientLib.getBalance());
      props.state.client.walletClientLib.sendCoins(props.state.pk, 100, 20);
      console.log("Sent 100CEL (20), starting miner...");
      await props.state.client.mineOffChainTransactions();
      console.log("Blocks mined! Len:", props.state.client.walletClientLib.blockchainLength(), ". ", props.state.client.walletClientLib.getBalance(), ". Trying to send blockchain...");
      console.log(await props.state.client.sendBlockchain());
      //let pk = props.state.client.walletClientLib.getPK();
      //console.log(props.state.client.sendTransaction(pk, 100, 20));
    }
  }, [props.state])
  return <h1>send</h1>;
}


export default App;
import * as React from "react";
import { useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import * as p2pClientLib from "celestium-p2p";
import * as client from "celestium-client-logic";
import { io } from "socket.io-client";

function App() {
  useEffect(() => {
    p2pClientLib.RTCSessionDescription = RTCSessionDescription
    p2pClientLib.RTCIceCandidate = RTCIceCandidate
    p2pClientLib.RTCPeerConnection = RTCPeerConnection
    p2pClientLib.io = io;
    client.p2pClientLib = p2pClientLib
    client.storage = localStorage
    import("celestium-wasm").then(x => {
      client.walletLib = x;
      console.log(client.initNewClient());
      console.log(x.generateTestBlockchain(Math.round(Date.now() / 1000)));
      console.log("Current balance: " + x.getBalance());
    });
  }, [])
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;

import * as React from 'react'
import { useEffect } from 'react'
import logo from './logo.svg'
import './App.css'
import * as p2pClientLib from 'celestium-p2p'
import * as client from 'celestium-client-logic'
import { io } from 'socket.io-client'

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
      window.indexedDB["PK"] = new Uint8Array([0x03, 0xFD, 0xA0, 0x6F, 0xE7, 0xF9, 0x24, 0xCA, 0x5E, 0xC4, 0x14, 0xB7, 0x2D, 0xB7, 0xB0, 0xC4, 0x14, 0x9B, 0xE1, 0x42, 0x0D, 0x13, 0xB4, 0x1F, 0xC6, 0xFA, 0x5F, 0xCD, 0x70, 0xA9, 0xBF, 0x51, 0xC9]) // Since indexedDB is not persistant on localhost
      window.indexedDB["SK"] = new Uint8Array([0xDA, 0x2C, 0xA5, 0x40, 0x17, 0xEF, 0xC6, 0x9B, 0x1C, 0x05, 0x93, 0x1D, 0x56, 0x4E, 0x5D, 0x5D, 0xBA, 0x0F, 0xE0, 0xD8, 0x90, 0xD5, 0x2D, 0x46, 0x1C, 0x52, 0xB7, 0xFB, 0x1E, 0xD4, 0xB8, 0x36]) // Since indexedDB is not persistant on localhost
      let serialized_pk = window.indexedDB["PK"];
      let serialized_sk = window.indexedDB["SK"];
      console.log(x.generateTestBlockchain(serialized_pk, serialized_sk, Math.round(Date.now() / 1000)));
      console.log("Current balance: ", x.getBalance());
      let bw = x.walletToBinary();
      console.log('Serialized blockchain: "', bw.mf_leafs_bin(), '" - please save me!');
      x.deleteWallet();
      x.walletFromBinary(bw)
      console.log('Loaded wallet from binary, balance:', x.getBalance());
      window.indexedDB["PK2"] = new Uint8Array([0x03, 0x53, 0x57, 0xCF, 0x0A, 0x29, 0x24, 0x3C, 0x45, 0x15, 0x86, 0x5D, 0x6B, 0xEF, 0x6A, 0x3B, 0x30, 0x9B, 0xA3, 0x33, 0x3B, 0xDC, 0x12, 0x0C, 0x02, 0x91, 0x95, 0xF1, 0xCF, 0x61, 0xD9, 0xB4, 0x9E]) // Since indexedDB is not persistant on localhost
      console.log('Sending coins, transaction:', x.sendCoins(window.indexedDB["PK2"], 200, 1000))
      console.log('Mining value:', x.getMiningValue())
      console.log('Balance:', x.getBalance())
      let miner = x.minerFromOffChain(new Uint8Array(32))
      while (miner.doWork() == undefined) { }
      console.log('Mined!:', miner.doWork())
      x.minerToBlockchain(miner)
      console.log('Post miner balance:', x.getBalance())
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

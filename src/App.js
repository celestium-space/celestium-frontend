import * as React from 'react';
import * as Secp256k1 from 'secp256k1';
import {
  BrowserRouter as Router,
  Switch,
  Route
} from "react-router-dom";
import { sha3_256 } from './sha3.min.js';
import { randomBytes } from 'crypto';

function i2hex(i) {
  return ('0' + i.toString(16)).slice(-2);
}

function uint8ArrToHexStr(arr) {
  return arr.reduce(function (memo, i) { return memo + i2hex(i) }, '');
}

function hexStrToUint8Arr(hex_str) {
  return new Uint8Array(hex_str.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

function App() {
  window.app_handle = this;

  const thread_work = 0x200000;
  const desired_threads = 8; //navigator.hardwareConcurrency; <- This lies
  let magic = undefined;
  let start = performance.now();
  let i = 0;

  function startMiningThreadIfNeeded(result, mining_data) {
    if (!magic) {
      if (result) {
        magic = result;
        alert(`Found working magic in ${(performance.now() - start) / 1000}s! ${magic.toString(16)}`);
      } else {
        let from = i * thread_work;
        let to = (i + 1) * thread_work;

        console.log(`Starting new worker thread mining from 0x${from.toString(16)} to 0x${to.toString(16)}`);
        let worker = new Worker('worker.js');

        worker.addEventListener('message', function (e) {
          startMiningThreadIfNeeded(e.data, mining_data);
        });
        worker.postMessage([from, to, mining_data]);
        i++;
      }
    }
  }

  function getKeyPair() {
    let pk = localStorage.getItem("pk_bin");
    let sk = localStorage.getItem("sk_bin");
    if (!pk || !sk) {
      console.log("No keys in localstorage, generating new pair");
      while (true) {
        sk = randomBytes(32);
        if (Secp256k1.privateKeyVerify(sk)) {
          pk = Secp256k1.publicKeyCreate(sk);
        }
        localStorage.setItem("pk_bin", uint8ArrToHexStr(pk));
        localStorage.setItem("sk_bin", uint8ArrToHexStr(sk));
      }
    }
    return [hexStrToUint8Arr(pk), hexStrToUint8Arr(sk)];
  }

  function create_pixel_nft(block_hash, prev_pixel_hash, x, y, c, pk) {
    const transaction_version_len = 1;
    const transaction_input_count_len = 1;
    const transaction_input_block_hash_len = 32;
    const transaction_input_message_len = 32;
    const transaction_input_index_len = 1;
    const transaction_output_count_len = 1;
    const transaction_output_value_len = 32;
    const transaction_output_pk_len = 33;

    let transaction = new Uint8Array(
      transaction_version_len +
      transaction_input_count_len +
      transaction_input_block_hash_len +
      transaction_input_message_len +
      transaction_input_index_len +
      transaction_output_count_len +
      transaction_output_value_len +
      transaction_output_pk_len);

    if (Object.prototype.toString.call(block_hash) != "[object Uint8Array]") {
      console.error('Expected block hash of type "[object Uint8Array]" got "' + Object.prototype.toString.call(block_hash) + '"');
      return;
    } else if (block_hash.byteLength != 32) {
      console.error('Expected block hash of lenght 32 got ' + block_hash.byteLength);
      return;
    }

    if (Object.prototype.toString.call(pk) != "[object Uint8Array]") {
      console.error('Expected public key of type "[object Uint8Array]" got "' + Object.prototype.toString.call(pk) + '"');
      return;
    } else if (pk.byteLength != 33) {
      console.error('Expected public key of lenght 32 got ' + pk.byteLength);
      return;
    }

    transaction[0] = 0; // Transaction version
    transaction[1] = 0; // Transaction input count (0 = base transaction)
    transaction.set(block_hash, 2);
    transaction.set(prev_pixel_hash, 34);
    transaction[62] = (x >> 8) & 0xff;
    transaction[63] = x & 0xff;
    transaction[64] = (y >> 8) & 0xff;
    transaction[65] = y & 0xff;
    transaction[66] = c & 0xff;
    transaction[67] = 1; // Transaction output count
    let actual_nft = transaction.slice(34, 67);
    let hash = sha3_256(uint8ArrToHexStr(actual_nft));
    transaction.set(hexStrToUint8Arr(hash), 68);
    transaction.set(pk, 100);
    return transaction;
  }

  function generateAndMinePixelNFT() {
    let [pk, _] = getKeyPair();
    //let pk = hexStrToUint8Arr("03ae555efe4544f5b468de12a59dccce934d049ded9d2990ec0a4e75e727ead306");
    let block_hash = new Uint8Array(32).map(function (_) { return 1; }); // Get from celestium-api
    let prev_pixel_hash = new Uint8Array(28).map(function (_) { return 2; }); // Get from celestium-api
    let x = 100;
    let y = 200;
    let color = 3;
    let pixel_nft = create_pixel_nft(block_hash, prev_pixel_hash, x, y, color, pk);

    start = performance.now();
    for (let i = 0; i < desired_threads; i++) {
      startMiningThreadIfNeeded(undefined, pixel_nft);
    }
  }

  function getBackendItem() { // Get from celestium-api instead
    const transaction_version_len = 1;
    const transaction_input_count_len = 1;
    const transaction_input_block_hash_len = 32;
    const transaction_input_id_len = 32;
    const transaction_input_index_len = 1;
    const transaction_input_sig_len = 64;
    const transaction_input_len = transaction_input_block_hash_len + transaction_input_id_len + transaction_input_index_len + transaction_input_sig_len;
    const transaction_output_count_len = 1;
    const transaction_output_value_len = 32;
    const transaction_output_pk_len = 33;
    const transaction_output_len = transaction_output_count_len + transaction_output_value_len + transaction_output_pk_len;

    let transaction = new Uint8Array(
      transaction_version_len +
      transaction_input_count_len +
      transaction_input_len * 3 +
      transaction_output_count_len +
      transaction_output_len * 3);

    let i = 0;
    transaction[i++] = 0; // Transaction version
    transaction[i++] = 3; // Transaction input count
    for (let ii = 1; ii < 4; ii++) {
      transaction.set(new Uint8Array(transaction_input_len).map(function (_) { return ii; }), i);
      i += transaction_input_len;
    }
    transaction[i++] = 3; // Transaction output count
    for (let ii = 4; ii < 7; ii++) {
      transaction.set(new Uint8Array(transaction_output_len).map(function (_) { return ii; }), i);
      i += transaction_output_len;
    }
    return transaction;
  }

  function buyBackendItem() {

    let [pk, _] = getKeyPair();
    //let pk = hexStrToUint8Arr("03ae555efe4544f5b468de12a59dccce934d049ded9d2990ec0a4e75e727ead306");

    let backend_item_transaction = getBackendItem();

    start = performance.now();
    for (let i = 0; i < desired_threads; i++) {
      startMiningThreadIfNeeded(undefined, backend_item_transaction);
    }
  }

  return (
    <Router>
      <Switch>
        <Route path="/">
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
import {
  generateAndMinePixelNFT,
  mineTransaction,
  intToColor,
  getKeyPair,
  uint8ArrToHexStr,
  hexStrToUint8Arr,
  serializeTransaction,
} from "./utils";
import env from "@beam-australia/react-env";
import * as Secp256k1 from "secp256k1";
import { sha3_256 } from "./sha3.min.js";

const default_address =
  window.location.protocol.replace(/^http/, "ws") +
  "api." +
  window.location.hostname +
  (window.location.port ? ":" + window.location.port : "");
const socket_address = env("SOCKET_ADDRESS") || default_address;

const CMDOpcodes = {
  GET_ENTIRE_IMAGE: 0x01,
  ENTIRE_IMAGE: 0x02,
  UPDATE_PIXEL: 0x03,
  UNMINED_TRANSACTION: 0x04,
  MINED_TRANSACTION: 0x05,
  GET_PIXEL_DATA: 0x06,
  PIXEL_DATA: 0x07,
  GET_ASTEROID: 0x08,
  ASTEROID: 0x9,
  BUY_ASTEROID: 0x0a,
  GET_USER_DATA: 0x0b,
  USER_DATA: 0x0c,
};

class LogicHandler {
  constructor(grid, pixelControls, asteroidPage, walletPage, setBackendDown) {
    this.grid = grid;
    this.pixelControls = pixelControls;
    this.asteroidPage = asteroidPage;
    this.walletPage = walletPage;
    this.setBackendDown = setBackendDown;

    this.balance = 0n;
    if (this.grid) {
      this.grid.onClick = (x, y, rgb) => {
        this.clickPixel(x, y, rgb);
      };
    }
    if (this.pixelControls) {
      this.pixelControls.onChange = (val) => {
        this.activeColor = val;
      };
    }
    if (this.asteroidPage) {
      this.asteroidPage.onClick = (name) => {
        this.getAsteroid(name);
      };
      this.asteroidPage.storeItemExchange = (name) => {
        this.storeItemExchange(name);
      };
    }
  }

  getEntireImage() {
    this.getSocket().then((socket) =>
      socket.send(Uint8Array.from([CMDOpcodes.GET_ENTIRE_IMAGE]))
    );
  }

  getUserData() {
    let [pk, _] = getKeyPair();
    this.getSocket().then((socket) => {
      console.log(
        `Connected (${
          socket.readyState
        }), getting userdata for [0x${uint8ArrToHexStr(pk)}]`
      );
      setTimeout(function () {
        socket.send(Uint8Array.from([CMDOpcodes.GET_USER_DATA, ...pk]));
      }, 2000);
    });
  }

  async getAsteroid(item_name) {
    let enc = new TextEncoder();
    let item_name_enc = enc.encode(item_name);

    let arr = new Uint8Array(1 + item_name_enc.byteLength);
    arr[0] = CMDOpcodes.GET_ASTEROID;
    for (let i = 0; i < item_name_enc.byteLength; i++) {
      arr[i + 1] = item_name_enc[i];
    }

    let socket = await this.getSocket();
    socket.send(arr);
  }

  async storeItemExchange(item_name) {
    let enc = new TextEncoder();
    let item_name_enc = enc.encode(item_name);

    let arr = new Uint8Array(34 + item_name_enc.byteLength);
    arr[0] = CMDOpcodes.BUY_ASTEROID;

    let [pk, _] = getKeyPair();
    for (let i = 0; i < 33; i++) {
      arr[i + 1] = pk[i];
    }
    console.log(`[0x${uint8ArrToHexStr(pk)}] buying "${item_name}"`);

    for (let i = 0; i < item_name_enc.byteLength; i++) {
      arr[i + 34] = item_name_enc[i];
    }

    let socket = await this.getSocket();
    socket.send(arr);
  }

  async getAsteroids(from, to) {
    // build payload bytes
    let arr = new Uint8Array(17);
    arr[0] = CMDOpcodes.GET_ASTEROIDS;
    arr[1] = (0xff000000 & from) >> 24;
    arr[2] = (0x00ff0000 & from) >> 16;
    arr[3] = (0x0000ff00 & from) >> 8;
    arr[4] = 0x000000ff & from;
    arr[5] = (0xff000000 & to) >> 24;
    arr[6] = (0x00ff0000 & to) >> 16;
    arr[7] = (0x0000ff00 & to) >> 8;
    arr[8] = 0x000000ff & to;
    socket.send(arr);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getSocket() {
    if (
      !this.socket ||
      this.socket.readyState == WebSocket.CLOSING ||
      this.socket.readyState == WebSocket.CLOSED
    ) {
      console.log(`Connecting to "${socket_address}"...`);
      this.socket = new WebSocket(socket_address);
      this.socket.addEventListener("open", (x) => {
        this.openHandler(x);
      });
      this.socket.addEventListener("message", (x) => {
        this.messageHandler(x);
      });
    }

    while (this.socket.readyState == WebSocket.CONNECTING) {
      console.log(`Still connecting to "${socket_address}"...`);
      await this.sleep(1000);
    }
    if (this.socket.readyState == WebSocket.OPEN) {
      console.log(`Success, connected to "${socket_address}"`);
      this.setBackendDown(false);
    } else {
      console.log(`Error connecting to "${socket_address}"`);
      this.setBackendDown(true);
    }
    return this.socket;
  }

  async clickPixel(x, y, current_rgb) {
    let index = this.pixelControls.state.active;
    let [pk, _] = getKeyPair();
    this.getSocket().then((socket) => {
      this.mining_data = [x, y, index];
      let to_send = Uint8Array.from([
        CMDOpcodes.GET_PIXEL_DATA,
        x >> 8,
        x & 0xff,
        y >> 8,
        y & 0xff,
        ...pk,
      ]);
      console.log("Requesting up-to-date pixel data from server");
      socket.send(to_send);
    });
  }

  openHandler(evnet) {}

  async messageHandler(evt) {
    let array = [];
    if (typeof evt.data === "string" || evt.data instanceof String) {
      console.error(`WS Server said: ${evt.data}`);
      return;
    }
    let arrayBuffer = new Uint8Array(await evt.data.arrayBuffer());
    arrayBuffer.forEach((element) => {
      array.push(element);
    });
    let cmdOpcode = array[0];
    switch (cmdOpcode) {
      case CMDOpcodes.ENTIRE_IMAGE:
        if (this.grid) {
          console.log("Got entire image");
          let color = array
            .slice(1)
            .map((c) => intToColor(c))
            .flat();
          this.grid.updatePixels(0, 0, 1000, 1000, color);
        }
        break;
      case CMDOpcodes.UPDATE_PIXEL:
        if (this.grid) {
          let x = (array[1] << 8) + array[2];
          let y = (array[3] << 8) + array[4];
          let color = array
            .slice(5)
            .map((c) => intToColor(c))
            .flat();
          console.log(`Got new pixel (${x}, ${y}) -> ${color}`);
          this.grid.updatePixels(x, y, 1, 1, color);
        }
        break;
      case CMDOpcodes.PIXEL_DATA:
        if (this.mining_data) {
          console.log("Got pixel data, continuing NFT creation");
          this.grid.set_eta("Calculating...");

          let [x, y, index] = this.mining_data;
          let pixel_hash = array.slice(1, 29);
          let block_hash = array.slice(29, 61);
          let katjing_transaction = array.slice(61);

          console.log("Mining pixel NFT transaction");
          this.grid.set_current_transaction(1);
          let pixel_nft_transaction = await generateAndMinePixelNFT(
            x,
            y,
            index,
            block_hash,
            pixel_hash,
            (eta) => {
              this.grid.set_eta(eta);
            }
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
          console.log("Mining katjing transaction");
          this.grid.set_current_transaction(2);
          katjing_transaction = await mineTransaction(
            new Uint8Array(
              katjing_transaction.slice(0, katjing_transaction.length - 1)
            ),
            (eta) => {
              this.grid.set_eta(eta);
            }
          );

          let pixel_transaction_message = new Uint8Array(
            1 + pixel_nft_transaction.byteLength
          );
          pixel_transaction_message[0] = CMDOpcodes.MINED_TRANSACTION;
          for (let i = 0; i < pixel_nft_transaction.byteLength; i++) {
            pixel_transaction_message[i + 1] = pixel_nft_transaction[i];
          }
          console.log(`Sending mined pixel transaction`);
          (await this.getSocket()).send(pixel_transaction_message.buffer);

          let katjing_transaction_message = new Uint8Array(
            1 + katjing_transaction.byteLength
          );
          katjing_transaction_message[0] = CMDOpcodes.MINED_TRANSACTION;
          for (let i = 0; i < katjing_transaction.byteLength; i++) {
            katjing_transaction_message[i + 1] = katjing_transaction[i];
          }
          console.log(`Sending mined katjing transaction`);
          (await this.getSocket()).send(katjing_transaction_message.buffer);

          this.mining_data = undefined;

          this.grid.doneMining();
        } else {
          console.warn("Got unexpected pixel data, ignoring");
        }
        break;
      case CMDOpcodes.ASTEROID:
        console.log("Got asteroid data, updating...");
        let store_item = JSON.parse(
          new TextDecoder().decode(new Uint8Array(array))
        );
        this.asteroidPage.gotAsteroidsItemData(store_item);
        break;
      case CMDOpcodes.USER_DATA:
        console.log("Got user data, updating...");
        let user_data = JSON.parse(
          new TextDecoder().decode(new Uint8Array(array)).trim()
        );
        if (this.walletPage) {
          let current_user_data = this.walletPage.user_data;
          if (current_user_data) {
            user_data.balance = String(
              BigInt(user_data.balance) + BigInt(current_user_data.balance)
            );
            user_data.owned_store_items = user_data.owned_store_items.concat(
              current_user_data.owned_store_items
            );
            user_data.owned_debris += user_data.owned_debris.concat(
              current_user_data.owned_debris
            );
          }

          console.log(user_data);
          this.walletPage.setState({ user_data: user_data });
        }
        break;
      case CMDOpcodes.UNMINED_TRANSACTION:
        console.log("Got transaction!");
        let [_, sk] = getKeyPair();
        let i = 1;

        let debris_name = "";
        do {
          debris_name += String.fromCharCode(array[i]);
        } while (array[++i] != 0);
        i++;
        console.log(debris_name);
        console.log(`${i} | ${array.slice(0, 20)}`);

        this.asteroidPage.set_debris_name(debris_name);

        let transaction = {};
        transaction.version = array[i++];
        transaction.input_count = array[i++];
        transaction.inputs = [];
        for (_ in [...Array(transaction.input_count).keys()]) {
          let block_hash = array.slice(i, i + 32);
          i += 32;
          let transaction_hash = array.slice(i, i + 32);
          i += 32;
          let index = [];
          do {
            index.push([array[i]]);
          } while (array[i++] >= 0x80);
          let signature = array.slice(i, i + 64);
          i += 64;
          transaction.inputs.push({
            block_hash: new Uint8Array(block_hash),
            transaction_hash: new Uint8Array(transaction_hash),
            index: new Uint8Array(index),
            signature: new Uint8Array(signature),
          });
        }
        transaction.output_count = array[i++];
        transaction.outputs = [];
        for (_ in [...Array(transaction.output_count).keys()]) {
          let output_value_version = array[i++];
          let output_value = array.slice(i, i + 32);
          i += 32;
          let output_pk = array.slice(i, i + 33); // On purpose, compressed PKs are 33 bytes long
          i += 33;
          transaction.outputs.push({
            value: {
              version: output_value_version,
              value: new Uint8Array(output_value),
            },
            pk: new Uint8Array(output_pk),
          });
        }
        transaction.magic = new Uint8Array(array.slice(i));

        let sign_digest = Uint8Array.from(
          serializeTransaction(transaction, false)
        );
        let sign_hash = sha3_256(sign_digest);
        const signature = Secp256k1.ecdsaSign(
          hexStrToUint8Arr(sign_hash),
          sk
        ).signature;
        for (let input of transaction.inputs) {
          if (input.signature.reduce((a, b) => a + b) == 0) {
            input.signature = signature;
          }
        }
        let serialized_transaction = serializeTransaction(transaction, true);

        let mined_transaction = await mineTransaction(
          new Uint8Array(serialized_transaction),
          (eta) => {
            this.asteroidPage.set_eta(eta);
          }
        );
        let arr = new Uint8Array(2 + mined_transaction.byteLength);
        arr[0] = CMDOpcodes.MINED_TRANSACTION;
        arr[1] = 1;
        for (let i = 0; i < mined_transaction.byteLength; i++) {
          arr[i + 2] = mined_transaction[i];
        }
        console.log(
          `Sending signed and mined transaction: ${uint8ArrToHexStr(arr)}`
        );
        let socket = await this.getSocket();
        socket.send(arr.buffer);

        this.asteroidPage.doneMining();
        break;
      default:
        console.warn(
          `WS Server sent unknown or unexpected command "${cmdOpcode}", ignoring`
        );
        break;
    }
  }
}

export default LogicHandler;

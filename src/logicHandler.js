import { GiConsoleController } from "react-icons/gi";
import {
  findColorIndex,
  generateAndMinePixelNFT,
  intToColor,
  getKeyPair,
} from "./utils";

const CMDOpcodes = {
  ERROR: 0x00,
  GET_ENTIRE_IMAGE: 0x01,
  ENTIRE_IMAGE: 0x02,
  UPDATE_PIXEL: 0x03,
  UNMINED_TRANSACTION: 0x04,
  MINED_TRANSACTION: 0x05,
  GET_PIXEL_DATA: 0x06,
  PIXEL_DATA: 0x07,
  GET_STORE_ITEMS: 0x08,
  STORE_ITEMS: 0x9,
  BUY_STORE_ITEM: 0x0a,
  GET_USER_DATA: 0x0b,
  USER_DATA: 0x0c,
};

class LogicHandler {
  constructor(grid, pixelControls, store) {
    this.grid = grid;
    this.pixelControls = pixelControls;
    this.balance = 0; //how do??
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
    this.store = store;
    if (this.store) {
      this.store.onClick = (x) => {
        this.storeBuy(x);
      };
    }

    this.getSocket().then((socket) =>
      socket.send(Uint8Array.from([CMDOpcodes.GET_ENTIRE_IMAGE]))
    );
  }

  async storeBuy(item_hash) {
    item_hash = [
      0x78, 0x38, 0x5a, 0x69, 0xab, 0x4e, 0x52, 0x5a, 0xd4, 0x65, 0x6e, 0xe3,
      0x5d, 0xe0, 0x02, 0x93, 0x3e, 0xfc, 0xd2, 0x54, 0x3c, 0x1c, 0x5d, 0xf3,
      0x3c, 0x9c, 0x42, 0x31, 0x78, 0xc7, 0x41, 0xe9,
    ];
    let socket = await this.getSocket();
    let arr = new Uint8Array(66);
    arr[0] = CMDOpcodes.BUY_STORE_ITEM;
    for (let i = 0; i < 32; i++) {
      arr[i + 1] = item_hash[i];
    }

    let [pk, _] = getKeyPair();
    for (let i = 0; i < 33; i++) {
      arr[i + 33] = pk[i];
    }
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
      let socket_addr = "wss://api.cryptocanvas.space";
      console.log(`Connecting to "${socket_addr}"...`);
      this.socket = new WebSocket(socket_addr);
      this.socket.addEventListener("open", (x) => {
        this.openHandler(x);
      });
      this.socket.addEventListener("message", (x) => {
        this.messageHandler(x);
      });
      while (this.socket.readyState == WebSocket.CONNECTING) {
        await this.sleep(1000);
      }
      console.log("Connected!");
    }
    return this.socket;
  }

  async clickPixel(x, y, current_rgb) {
    let index = this.pixelControls.state.active;
    this.getSocket().then((socket) => {
      this.mining_data = [x, y, index];
      let to_send = Uint8Array.from([
        CMDOpcodes.GET_PIXEL_DATA,
        x >> 8,
        x & 0xff,
        y >> 8,
        y & 0xff,
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
        } else {
          console.error("No grid initialized");
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
        } else {
          console.error("No grid initialized");
        }
        break;
      case CMDOpcodes.PIXEL_DATA:
        if (this.mining_data) {
          console.log("Got pixel data, continuing NFT creation");

          this.grid.startMining();

          let [x, y, index] = this.mining_data;
          let pixel_hash = array.slice(1, 29);
          let block_hash = array.slice(29);

          let transaction = await generateAndMinePixelNFT(
            x,
            y,
            index,
            block_hash,
            pixel_hash
          );
          let arr = new Uint8Array(transaction.byteLength + 1);
          arr[0] = CMDOpcodes.MINED_TRANSACTION;
          for (let i = 0; i < transaction.byteLength; i++) {
            arr[i + 1] = transaction[i];
          }
          console.log(`Sending mined transaction.`);
          let socket = await this.getSocket();
          socket.send(arr.buffer);

          this.mining_data = undefined;

          this.grid.doneMining();
        } else {
          console.warn("Got unexpected pixel data, ignoring");
        }
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

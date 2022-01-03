import {
  generateAndMinePixelNFT,
  mineTransaction,
  intToColor,
  getKeyPair,
  uint8ArrToHexStr,
} from "./utils";
import env from "@beam-australia/react-env";

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
  constructor(grid, pixelControls, asteroidPage, walletPage) {
    this.grid = grid;
    this.pixelControls = pixelControls;
    this.asteroidPage = asteroidPage;
    this.walletPage = walletPage;

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
    }

    this.getSocket().then((socket) =>
      socket.send(Uint8Array.from([CMDOpcodes.GET_ENTIRE_IMAGE]))
    );

    this.getSocket().then((socket) =>
      socket.send(
        Uint8Array.from([CMDOpcodes.GET_USER_DATA, ...getKeyPair()[0]])
      )
    );
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

  async asteroidExchange(item_hash) {
    item_hash = [
      0x78, 0x38, 0x5a, 0x69, 0xab, 0x4e, 0x52, 0x5a, 0xd4, 0x65, 0x6e, 0xe3,
      0x5d, 0xe0, 0x02, 0x93, 0x3e, 0xfc, 0xd2, 0x54, 0x3c, 0x1c, 0x5d, 0xf3,
      0x3c, 0x9c, 0x42, 0x31, 0x78, 0xc7, 0x41, 0xe9,
    ];
    let socket = await this.getSocket();
    let arr = new Uint8Array(66);
    arr[0] = CMDOpcodes.BUY_ASTEROID;
    for (let i = 0; i < 32; i++) {
      arr[i + 1] = item_hash[i];
    }

    let [pk, _] = getKeyPair();
    for (let i = 0; i < 33; i++) {
      arr[i + 33] = pk[i];
    }
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
          let arr = new Uint8Array(
            1 +
              pixel_nft_transaction.byteLength +
              katjing_transaction.byteLength
          );
          arr[0] = CMDOpcodes.MINED_TRANSACTION;
          for (let i = 0; i < pixel_nft_transaction.byteLength; i++) {
            arr[i + 1] = pixel_nft_transaction[i];
          }
          for (let i = 0; i < katjing_transaction.byteLength; i++) {
            arr[i + 1 + pixel_nft_transaction.byteLength] =
              katjing_transaction[i];
          }
          console.log(`Sending mined transactions.`);
          let socket = await this.getSocket();
          socket.send(arr.buffer);

          this.mining_data = undefined;

          this.grid.doneMining();
        } else {
          console.warn("Got unexpected pixel data, ignoring");
        }
        break;
      case CMDOpcodes.ASTEROID:
        let image_url = new TextDecoder().decode(new Uint8Array(array));
        console.log(image_url);
        this.asteroidPage.gotAsteroidData(image_url);
      case CMDOpcodes.USER_DATA:
        console.log("Got user data, updating...");
        let balance = BigInt(
          `0x${uint8ArrToHexStr(Uint8Array.from(array.slice(1)))}`
        );
        if (this.walletPage) {
          this.walletPage.setState({ balance: balance });
        }
        console.log(`New balance: ${balance}`);
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

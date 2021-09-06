import { FaThumbsUp } from 'react-icons/fa';
import { findColorIndex, generateAndMinePixelNFT, intToColor, uint8ArrToHexStr } from './utils'

class LogicHandler {

    constructor(socket, grid, controlls, store) {
        this.grid = grid;
        this.socket = socket;
        this.controlls = controlls;
        this.balance = 0; //how do??
        this.socket.addEventListener('open', (x) => { this.openHandler(x) });
        this.socket.addEventListener('message', (x) => { this.messageHandler(x) });
        if (this.grid) {
            this.grid.onClick = (x, y, rgb) => {
                this.clickPixel(x, y, rgb);
            };
        }
        if (this.controlls) {
            this.controlls.onChange = (val) => {
                this.activeColor = val;
            }
        }
        //don't remove the lambda!! it will change the meaning of this inside clickPixel
        this.store = store;
        if (this.store)
            this.store.onClick = (x) => { this.storeBuy(x) };
    }

    storeBuy(x) {
    }

    async clickPixel(x, y, rgb) {
        let index = findColorIndex(rgb);
        if (index == -1) {
            alert("Please select a color first");
        } else {
            let transaction = await generateAndMinePixelNFT(x, y, index);
            let arr = new Uint8Array(transaction.byteLength + 1);
            arr[0] = 3;
            for (let i = 0; i < transaction.byteLength; i++) {
                arr[i + 1] = transaction[i];
            }
            this.socket.send(arr.buffer);
        }
    }

    openHandler(evnet) {
    }


    async messageHandler(evt) {
        let gridData = null;
        let arrayBuffer = new Uint8Array(await evt.data.arrayBuffer());
        let array = [];
        arrayBuffer.forEach(element => {
            array.push(element);
        });
        let CMD_OPCODE = array[0];
        switch (CMD_OPCODE) {
            case 0x0:
                if (this.grid) {
			gridData = array.slice(1).map(c => intToColor(c)).flat();
			this.grid.updatePixels(0, 0, 1000, 1000, gridData);
		}
                break;
            case 0x1:
                if (this.gird) {
                    gridData = view.buffer.slice(5);
                    let x = view.getInt16(1);
                    let y = view.getInt16(3);
                    this.grid.updatePixels(x, y, 1, 1, gridData);
                }
                break;
            default:
                break;
        }
    }


}

export default LogicHandler;

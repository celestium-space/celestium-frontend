import { findColorIndex, generateAndMinePixelNFT } from './utils'

class LogicHandler {

    constructor(socket, grid, controlls) {
        this.grid = grid;
        this.socket = socket;
        this.socket.addEventListener('open', (x) => { this.openHandler(x) });
        this.socket.addEventListener('message', (x) => { this.messageHandler(x) });
        this.grid.onClick = (x, y, rgb) => {
            this.clickPixel(x, y, rgb);
        };
        //don't remove the lambda!! it will change the meaning of this inside clickPixel
    }

    async clickPixel(x, y, rgb) {
        let index = findColorIndex(rgb);
        let transaction = await generateAndMinePixelNFT(x, y, index);
        let arr = new Uint8Array(137);
        arr[0] = 3;
        for (let i = 0; i < 136; i++) {
            arr[i + 1] = transaction[i];
        }
        this.socket.send(arr.buffer);
    }

    openHandler(evnet) {
    }

    messageHandler(evt) {
        const view = new DataView(evt.data);
        let gridData = null;
        switch (view.getInt8(0)) {
            case 0x0:
                gridData = view.buffer.slice(1);
                this.grid.updatePixels(0, 0, 1000, 1000, gridData);
                break;
            case 0x1:
                gridData = view.buffer.slice(5);
                let x = view.getInt16(1);
                let y = view.getInt16(3);
                this.grid.updatePixels(x, y, 1, 1, gridData);
                break;
            default:
                break;
        }
    }


}

export default LogicHandler;
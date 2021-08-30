import {findColorIndex, generateAndMinePixelNFT} from './utils'

class LogicHandler {

    constructor(socket, grid, controlls) {
        this.grid = grid;
        this.socket = socket;
        this.socket.addEventListener('open', this.openHandler);
        this.socket.addEventListener('message', this.messageHandler);
        this.grid.onClick = this.clickPixel;
    }

    clickPixel(x,y,rgb) {
        let index = findColorIndex(rgb);
        let transaction = generateAndMinePixelNFT(x,y,index);
        console.log("trans:", transaction);
        transaction.then(x => {
            console.log("prom:", x);
        })
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
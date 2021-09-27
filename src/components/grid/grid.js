import React, {
  Component,
  useEffect,
  useRef,
  useState,
  createRef,
} from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./grid.css";

class Grid extends Component {
  constructor(props) {
    super(props);
    this.canvasRef = createRef();
    this.onClick = props.onClick;

    this.scale = 1;
    this.scaleMultiplier = 0.8;
    this.startDragOffset = {};
    this.mouseDown = false;

    this.updatePixels = (x, y, width, height, data) => {
      let canvas = this.canvasRef.current;
      let ctx = canvas.getContext("2d");
      let array = new Uint8ClampedArray(data);
      let k = new ImageData(array, width, height);
      ctx.putImageData(k, x, y);
    };
  }

  getCursorPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (1 / this.scale);
    const y = (event.clientY - rect.top) * (1 / this.scale);
    return [x, y];
  }

  helpMenu() {
    if (true) {
      return true;
    }
  }

  zoomIn() {
    let crypto_canvas = document.getElementsByClassName("cryptoCanvas")[0];
    this.scale *= 1.25;
    crypto_canvas.style.height = `${this.scale * 100}%`;
    crypto_canvas.style.width = `${this.scale * 100}%`;
  }

  zoomOut() {
    let crypto_canvas = document.getElementsByClassName("cryptoCanvas")[0];
    this.scale *= 0.8;
    crypto_canvas.style.height = `${this.scael * 100}%`;
    crypto_canvas.style.width = `${this.scale * 100}%`;
  }

  render() {
    return (
      <div className="gridContainer">
        <div className="ui vertical controls">
          <button
            className="inverted circular ui icon button topButton"
            onClick={(event) => {
              this.zoomIn();
            }}
          >
            <i className="icon plus"></i>
          </button>
          <button
            className="inverted circular ui icon button"
            onClick={(event) => {
              this.zoomOut();
            }}
          >
            <i className="icon minus"></i>
          </button>
        </div>
        <div className="canvasContainer">
          <canvas
            className="cryptoCanvas"
            id="canvas"
            width="1000px"
            height="1000px"
            style={{
              width: "100%",
              height: "100%",
            }}
            ref={this.canvasRef}
            onClick={(event) => {
              let canvas = this.canvasRef.current;
              let [x, y] = this.getCursorPosition(canvas, event);
              let ctx = canvas.getContext("2d");
              let data = ctx.getImageData(x, y, 1, 1).data;
              let rgb = [data[0], data[1], data[2]];
              if (this.onClick) {
                this.onClick(Math.round(x), Math.round(y), rgb);
              }
            }}
          ></canvas>
        </div>
        <Popup open={this.helpMenu()} modal nested>
          {(close) => (
            <div className="modal">
              <button className="close" onClick={close}>
                &times;
              </button>
              <div className="header">Welcome to the Celestium Canvas</div>
              <div className="content">
                The image created here will be sent to the ISS at:
              </div>
              <div className="header2">16:42.00 EST</div>
              <div className="header3">September 30, 2021</div>
              <div className="content">
                Click anywhere on the canvas to contribute, by placing your
                pixel and mining a Celestium Token (C)
              </div>
            </div>
          )}
        </Popup>
      </div>
    );
  }
}

export default Grid;

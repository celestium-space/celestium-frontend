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

function getCursorPosition(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  return [x, y];
}

class Grid extends Component {
  constructor(props) {
    super(props);
    this.canvasRef = createRef();
    this.onClick = props.onClick;

    this.scale = 100;
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

  componentDidMount() {
    this.canvasRef.current.getContext("2d").imageSmoothingEnabled = false;
  }

  helpMenu() {
    if (true) {
      return true;
    }
  }

  draw(scale, translatePos) {
    let canvas = this.canvasRef.current;
    let context = canvas.getContext("2d");

    context.translate(translatePos.x, translatePos.y);
    context.scale(scale, scale);
    context.save();
  }

  onMouseDown(evt) {
    this.mouseDown = true;
    startDragOffset.x = evt.clientX - translatePos.x;
    startDragOffset.y = evt.clientY - translatePos.y;
  }

  onMouseUp(evt) {
    this.mouseDown = false;
  }

  onMouseover(evt) {
    this.mouseDown = false;
  }

  onMouseOut(evt) {
    this.mouseDown = false;
  }

  onMouseMove(evt) {
    if (this.mouseDown) {
      this.translatePos.x = evt.clientX - this.startDragOffset.x;
      this.translatePos.y = evt.clientY - this.startDragOffset.y;
      draw(this.scale, this.translatePos);
    }
  }

  // add button event listeners
  zoomIn() {
    let crypto_canvas = document.getElementsByClassName("cryptoCanvas")[0];
    this.scale *= 1.25;
    crypto_canvas.style.height = `${this.scale}%`;
    crypto_canvas.style.width = `${this.scale}%`;
  }

  zoomOut() {
    let crypto_canvas = document.getElementsByClassName("cryptoCanvas")[0];
    this.scale *= 0.8;
    crypto_canvas.style.height = `${this.scale}%`;
    crypto_canvas.style.width = `${this.scale}%`;
  }

  render() {
    return (
      <div>
        <input
          type="button"
          value="+"
          onClick={(event) => {
            this.zoomIn();
          }}
        ></input>
        <input
          type="button"
          value="-"
          onClick={(event) => {
            this.zoomOut();
          }}
        ></input>
        <div className="canvasContainer">
          <canvas
            className="cryptoCanvas"
            id="canvas"
            style={{
              width: "100%",
              height: "100%",
            }}
            ref={this.canvasRef}
            onClick={(event) => {
              let canvas = this.canvasRef.current;
              let [x, y] = getCursorPosition(canvas, event);
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

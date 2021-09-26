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

    this.scale = 1.0;
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

  helpMenu() {
    if (true) {
      return true;
    }
  }

  draw(scale, translatePos) {
    let canvas = this.canvasRef;
    var context = canvas.getContext("2d");

    // clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.translate(translatePos.x, translatePos.y);
    context.scale(scale, scale);
    context.beginPath(); // begin custom shape
    context.moveTo(-119, -20);
    context.bezierCurveTo(-159, 0, -159, 50, -59, 50);
    context.bezierCurveTo(-39, 80, 31, 80, 51, 50);
    context.bezierCurveTo(131, 50, 131, 20, 101, 0);
    context.bezierCurveTo(141, -60, 81, -70, 51, -50);
    context.bezierCurveTo(31, -95, -39, -80, -39, -50);
    context.bezierCurveTo(-89, -95, -139, -80, -119, -20);
    context.closePath(); // complete custom shape
    let grd = context.createLinearGradient(-59, -100, 81, 100);
    grd.addColorStop(0, "#8ED6FF"); // light blue
    grd.addColorStop(1, "#004CB3"); // dark blue
    context.fillStyle = grd;
    context.fill();

    context.lineWidth = 5;
    context.strokeStyle = "#0000ff";
    context.stroke();
    context.restore();
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
    this.scale /= this.scaleMultiplier;
    draw(this.scale, this.translatePos);
  }

  zoomOut() {
    this.scale *= this.scaleMultiplier;
    draw(this.scale, this.translatePos);
  }

  render() {
    return (
      <div>
        <input type="button" value="+" onClick={this.zoomIn}></input>
        <input type="button" value="-" onClick={this.zoomOut}></input>
        <canvas
          className="cryptoCanvas"
          id="canvas"
          ref={this.canvasRef}
          width={1000}
          height={1000}
          onClick={(event) => {
            if (!this.translatePos) {
              this.translatePos = {
                x: this.canvasRef.current.width / 2,
                y: this.canvasRef.current.height / 2,
              };
            }
            let canvas = this.canvasRef.current;
            let [x, y] = getCursorPosition(canvas, event);
            let ctx = canvas.getContext("2d");
            let data = ctx.getImageData(x, y, 1, 1).data;
            let rgb = [data[0], data[1], data[2]];
            if (this.onClick) {
              this.onClick(Math.round(x), Math.round(y), rgb);
            }
          }}
          style={{
            // border: '2px solid #000',
            marginTop: 10,
            marginLeft: 10,
          }}
        ></canvas>
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

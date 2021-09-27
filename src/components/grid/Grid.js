import React, { Component, createRef } from "react";
import "reactjs-popup/dist/index.css";
import "./Grid.css";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import CelestiumInformationPopup from "../popups/CelestiumInformationPopup";
import MiningConfirmPopup from "../popups/MiningConfirmPopup";

class Grid extends Component {
  constructor(props) {
    super(props);
    this.state = {
      confirmMiningPopupState: false,
      clickedX: 0,
      clickedY: 0,
    };
    this.canvasRef = createRef();
    this.scale = 1;
    this.moved = false;
    this.onClick = props.onClick;

    this.updatePixels = (x, y, width, height, data) => {
      let canvas = this.canvasRef.current;
      let ctx = canvas.getContext("2d");
      let array = new Uint8ClampedArray(data);
      let k = new ImageData(array, width, height);
      ctx.putImageData(k, x, y);
    };
  }

  mine() {
    let canvas = this.canvasRef.current;

    const rect = canvas.getBoundingClientRect();
    const x = (this.state.clickedX - rect.left) * (1 / this.scale);
    const y = (this.state.clickedY - rect.top) * (1 / this.scale);

    let ctx = canvas.getContext("2d");
    let data = ctx.getImageData(x, y, 1, 1).data;
    let rgb = [data[0], data[1], data[2]];
    if (this.onClick) {
      this.onClick(Math.round(x), Math.round(y), rgb);
    }
  }

  render() {
    return (
      <div className="gridContainer">
        <TransformWrapper
          initialScale={1}
          initialPositionX={0}
          initialPositionY={0}
        >
          {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
            <React.Fragment>
              <div className="ui vertical controls">
                <button
                  className="inverted circular ui icon button right floated"
                  onClick={(event) => {
                    zoomIn();
                  }}
                >
                  <i className="icon plus"></i>
                </button>
                <button
                  className="inverted circular ui icon button right floated"
                  onClick={(event) => {
                    zoomOut();
                  }}
                >
                  <i className="icon minus"></i>
                </button>
                <button
                  className="inverted circular ui icon button mini right floated"
                  onClick={(event) => {
                    resetTransform();
                  }}
                >
                  <i className="icon equals"></i>
                </button>
              </div>
              <TransformComponent>
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
                  onMouseDown={() => {
                    this.moved = false;
                  }}
                  onMouseMove={() => {
                    this.moved = true;
                  }}
                  onMouseUp={(event) => {
                    if (!this.moved) {
                      this.setState({
                        confirmMiningPopupState: true,
                        clickedX: event.clientX,
                        clickedY: event.clientY,
                      });
                    }
                  }}
                ></canvas>
              </TransformComponent>
            </React.Fragment>
          )}
        </TransformWrapper>
        <MiningConfirmPopup
          onConfirm={() => {
            this.setState({ confirmOpen: true });
            this.mine();
          }}
          confirmOpen={this.state.confirmOpen}
          open={this.state.confirmMiningPopupState}
          onClose={() => {
            this.setState({ confirmMiningPopupState: false });
          }}
        ></MiningConfirmPopup>
        <CelestiumInformationPopup open={true}></CelestiumInformationPopup>
      </div>
    );
  }
}

export default Grid;

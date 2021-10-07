import React, { Component, createRef } from "react";
import "reactjs-popup/dist/index.css";
import "./Grid.css";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import CelestiumInformationPopup from "../popups/CelestiumInformationPopup";
import PixelMiningPopup from "../popups/PixelMiningPopup";

class Grid extends Component {
  constructor(props) {
    super(props);
    this.state = {
      startMiningPopup: false,
      doneMiningPopup: false,
      clickedX: 0,
      clickedY: 0,
    };
    this.canvasRef = createRef();
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

  doneMining() {
    this.setState({
      startMiningPopup: false,
      doneMiningPopup: true,
    });
  }

  mine() {
    let canvas = this.canvasRef.current;
    let ctx = canvas.getContext("2d");
    let data = ctx.getImageData(
      this.state.clickedX,
      this.state.clickedY,
      1,
      1
    ).data;
    let rgb = [data[0], data[1], data[2]];
    if (this.onClick) {
      this.onClick(this.state.clickedX, this.state.clickedY, rgb);
    }
  }

  render() {
    return (
      <div className="gridContainer">
        <TransformWrapper>
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
                      const rect = canvas.getBoundingClientRect();
                      //---- Here be dragons ----
                      const x = Math.floor(
                        ((event.clientX - rect.left) * 1000) / rect.width
                      );
                      const y = Math.floor(
                        ((event.clientY - rect.top) * 1000) / rect.height
                      );
                      //-------------------------
                      console.log("Starting mining popup!");
                      this.setState({
                        startMiningPopup: true,
                        clickedX: x,
                        clickedY: y,
                      });
                    }
                  }}
                ></canvas>
              </TransformComponent>
            </React.Fragment>
          )}
        </TransformWrapper>
        <PixelMiningPopup
          clickedX={this.state.clickedX}
          clickedY={this.state.clickedY}
          onConfirm={() => {
            this.mine();
          }}
          startMiningPopup={this.state.startMiningPopup}
          doneMiningPopup={this.state.doneMiningPopup}
          onStartMiningPopupClose={() => {
            this.setState({ startMiningPopup: false });
          }}
          onDoneMiningPopupClose={() => {
            this.setState({ doneMiningPopup: false });
          }}
        ></PixelMiningPopup>
        <CelestiumInformationPopup open={true}></CelestiumInformationPopup>
      </div>
    );
  }
}

export default Grid;

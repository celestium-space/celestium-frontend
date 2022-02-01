import React, { Component, createRef } from "react";
import "reactjs-popup/dist/index.css";
import "./Grid.css";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import CelestiumInformationPopup from "../popups/CelestiumInformationPopup";
import PixelMiningPopup from "../popups/PixelMiningPopup";
import PixelControls from "../pixelcontrols/PixelControls";
import SelectColorPopup from "../popups/SelectColorPopup";

class Grid extends Component {
  constructor(props) {
    super(props);

    this.state = {
      selectColorPopup: false,
      clickedOnce: false,
      pixelControls: props.pixelControls,
      startMiningPopup: false,
      doneMiningPopup: false,
      clickedX: 0,
      clickedY: 0,
      eta: "Calculating...",
      currentTransaction: 1,
    };
    this.moved = false;
    this.onClick = props.onClick;
  }

  componentDidMount() {
    if (this.props.logic) {
      this.props.logic.getEntireImage();
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.logic == null && this.props.logic) {
      this.props.logic.getEntireImage();
    }
  }

  doneMining() {
    this.setState({
      startMiningPopup: false,
      doneMiningPopup: true,
    });
  }

  updatePixels(x, y, width, height, data) {
    try {
      let canvas = document.getElementById("canvas");
      let ctx = canvas.getContext("2d");
      let array = new Uint8ClampedArray(data);
      let k = new ImageData(array, width, height);
      ctx.putImageData(k, x, y);
    } catch (error) {
      console.error(error);
    }
  }

  set_eta(eta) {
    this.setState({ eta: eta });
  }

  set_current_transaction(nr) {
    this.setState({ currentTransaction: nr });
  }

  mine() {
    try {
      let canvas = document.getElementById("canvas");
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
    } catch (error) {
      console.log(error);
    }
  }

  render() {
    return (
      <div>
        <div className="gridContainer">
          <TransformWrapper maxScale={30}>
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
                    width="1000"
                    height="1000"
                    onMouseDown={() => {
                      this.moved = false;
                    }}
                    onMouseMove={() => {
                      this.moved = true;
                    }}
                    onMouseUp={(event) => {
                      if (!this.moved) {
                        if (this.state.clickedOnce) {
                          const rect = canvas.getBoundingClientRect();
                          //---- Here be dragons ----
                          const x = Math.floor(
                            ((event.clientX - rect.left) * 1000) / rect.width
                          );
                          const y = Math.floor(
                            ((event.clientY - rect.top) * 1000) / rect.height
                          );
                          //-------------------------
                          this.setState({
                            startMiningPopup: true,
                            clickedX: x,
                            clickedY: y,
                          });
                        } else {
                          this.setState({ selectColorPopup: true });
                        }
                      }
                    }}
                  ></canvas>
                </TransformComponent>
                <PixelControls
                  clickedOnce={() => {
                    this.setState({ clickedOnce: true });
                  }}
                  ref={this.state.pixelControls}
                ></PixelControls>
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
            eta={this.state.eta}
            currentTransaction={this.state.currentTransaction}
          ></PixelMiningPopup>
          <CelestiumInformationPopup open={true}></CelestiumInformationPopup>
          <SelectColorPopup
            open={this.state.selectColorPopup}
            onClose={() => {
              this.setState({ selectColorPopup: false });
            }}
          />
        </div>
      </div>
    );
  }
}

export default Grid;

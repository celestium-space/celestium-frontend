import React, {
  Component,
  useEffect,
  useRef,
  useState,
  createRef,
} from "react";
import { range, intToRgb } from "../../utils";
import "./PixelControls.css";

class PixelControls extends Component {
  constructor(props) {
    super(props);
    this.state = { active: 0 };
    this.onChange = props.onChange;

    let click = (i) => {
      props.clickedOnce();
      this.setState({ active: i });
      if (this.onChange) this.onChange(i);
    };
    this.click = click;
  }

  render() {
    let click = this.click;
    return (
      <div className="my-grid">
        {range(8).map((i) => (
          <div
            key={i.toString()}
            style={{
              top: "0",
              margin: "0",
              padding: "0",
              height: "50px",
              width: "50px",
            }}
          >
            <div
              onClick={(_) => click(i)}
              style={{
                border: this.state.active == i ? "2px solid gray" : "",
                width: "36px",
                height: "36px",
                backgroundColor: intToRgb(i),
                margin: "5px",
                top: 0,
              }}
            ></div>
          </div>
        ))}
        ;
      </div>
    );
  }
}

export default PixelControls;

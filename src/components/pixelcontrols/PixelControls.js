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
        {range(16).map((i) => (
          <div
            key={i.toString()}
            onClick={(_) => click(i)}
            className="my-grid-color"
            style={{
              border: this.state.active == i ? "2px solid gray" : "",
              backgroundColor: intToRgb(i),
            }}
          />
        ))}
      </div>
    );
  }
}

export default PixelControls;

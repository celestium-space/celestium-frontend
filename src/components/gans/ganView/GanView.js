import { Card } from "semantic-ui-react";
import React from "react";
import "./GanView.css";

export default class GanView extends React.Component {
  video_ref = React.createRef();

  constructor(props) {
    super(props);
    this.state = {
    };
  }

  play() {
    this.video_ref.current.play();
  }

  render() {
    return (
        <div className="visual-container"
          onClick={x => {
              window.location.replace("https://celestium.space/frontend");
          }}
        >
            <video
              autoPlay={true}
              muted="muted"
              playsInline
              ref={this.video_ref}
              loop
            >
              <source src={this.props.imgsrc} type="video/mp4" />
            </video>
        </div>
    );
  }
}

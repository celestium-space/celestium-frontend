import React, { useState } from "react";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import "./FrontPageInfo.css";
import { Button, Checkbox } from "semantic-ui-react";

export default function FrontPageInfo(props) {
  let style = { display: "none" };
  if (props.showCelestiumInfo) {
    style = {};
  }
  return (
    <div className="global" style={style}>
      <div className="center">
        <p>
          <br />
          <br />
          <br />
          <br />
          <br />
          <br />
          <br />
          <br />
          <br />
          <br />
          Who has the power to access space and all of its resources? How do we
          as a society define how space can and should be used? And how might
          human actions in space be able to transform the quality of life of all
          of humanity, instead of serving as more wealth for the few?
          <br />
          <br />
          Each NFT has its own image generated by the AI. The AI itself is a
          generative adversarial network (GAN), trained on thousands of images
          of existing planets, stars, and nebulas across the cosmos, which it
          uses to generate images of its own unique celestial objects.
          <br />
          <br />
          In order to receive the Celestium tokens, individuals must participate
          in a global process of creating collaborative images to be sent
          directly into space as contemporary portrayals of humanity’s vision
          for the future of space exploration. At the end of its time aboard the
          ISS, the blockchain will live on, embodying the imagery generated by
          the collective of mankind.
          <br />
          <br />
          In order to receive the Celestium tokens, individuals must participate
          in a global process of creating collaborative images to be sent
          directly into space as contemporary portrayals of humanity’s vision
          for the future of space exploration. At the end of its time aboard the
          ISS, the blockchain will live on, embodying the imagery generated by
          the collective of mankind.
          <br />
          <br />
          In order to receive the Celestium tokens, individuals must participate
          in a global process of creating collaborative images to be sent
          directly into space as contemporary portrayals of humanity’s vision
          for the future of space exploration. At the end of its time aboard the
          ISS, the blockchain will live on, embodying the imagery generated by
          the collective of mankind.
          <br />
          <br />
          In order to receive the Celestium tokens, individuals must participate
          in a global process of creating collaborative images to be sent
          directly into space as contemporary portrayals of humanity’s vision
          for the future of space exploration. At the end of its time aboard the
          ISS, the blockchain will live on, embodying the imagery generated by
          the collective of mankind.
        </p>
        <div className="right">
          <div className="ui checkbox" style={{ marginRight: "20px" }}>
            <input
              id="rememberCelestiumInfoConfirm"
              type="checkbox"
              className="example"
              checked={props.doNotShowCelestiumInfoOnStart}
              onChange={() => {
                props.setdoNotShowCelestiumInfoOnStart(
                  !props.doNotShowCelestiumInfoOnStart
                );
              }}
            />
            <label style={{ color: "white" }}>Do not show me this again</label>
          </div>
          <Button
            onClick={() => {
              props.setShowCelestiumInfo(false);
            }}
          >
            Enter
          </Button>
        </div>
      </div>
      <h1>CELESTIUM</h1>
    </div>
  );
}

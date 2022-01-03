import React, { useState, useRef, useEffect } from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import "../../utils.js";
import CelestiumLogo from "../images/CelestiumLogo";

function GetSelection(
  setAsterankObjectName,
  setAsterankObjectSVG,
  setIsBuying,
  setIsError,
  onClick
) {
  let iframe = document.getElementById("asterankIframe");

  let innerDoc = iframe.contentDocument
    ? iframe.contentDocument
    : iframe.contentWindow.document;

  let name = innerDoc.getElementById("selection-details").children[0].innerHTML;

  onClick(name);
  if (name) {
    setAsterankObjectName(name);
    let svg = innerDoc.getElementById("orbit-2d-diagram").children[0];
    setAsterankObjectSVG(svg);
    setIsBuying(true);
  } else {
    setIsError(true);
  }
}

function BuyPopup(props) {
  let [asterankObjectName, setAsterankObjectName] = useState("");
  let [asterankObjectSVG, setAsterankObjectSVG] = useState("");
  const svgRef = useRef(null);
  let [isBuying, setIsBuying] = useState(false);
  let [isError, setIsError] = useState(false);

  return (
    <div>
      <button
        className="ui button"
        onClick={() => {
          GetSelection(
            setAsterankObjectName,
            setAsterankObjectSVG,
            setIsBuying,
            setIsError,
            props.onClick
          );
        }}
      >
        Exchange for <CelestiumLogo color="#5a5a5a" lineHeight="14pt" />
      </button>
      <Popup
        open={isBuying}
        position="right center"
        closeOnDocumentClick
        contentStyle={{ width: "600px" }}
        modal
        nested
        onClose={() => {
          props.resetImageUrl();
          setIsBuying(false);
        }}
        onOpen={() => {
          let svg = asterankObjectSVG.cloneNode(true);
          svg.setAttribute("width", 170);
          svg.setAttribute("viewBox", "70 0 170 170");
          svg.setAttribute("transform", "scale(1.6)");
          svgRef.current.appendChild(svg);
        }}
      >
        {(close) => (
          <div className="modal">
            <button className="close" onClick={close}>
              &times;
            </button>
            <div className="header-dark">{asterankObjectName}</div>
            <div className="ui two column full grid">
              <div className="row">
                <div
                  className="column"
                  style={{
                    padding: "0px",
                  }}
                  ref={svgRef}
                ></div>
                <div
                  className="ui two column full grid"
                  style={{ paddingRight: "0px", paddingLeft: "24px" }}
                >
                  <div className="row" style={{ paddingBottom: "0" }}>
                    <img
                      className="column"
                      src={props.imageUrl}
                      style={{
                        width: 156,
                        paddingLeft: "0",
                        paddingRight: "14px",
                      }}
                    />
                    <div
                      className="column content"
                      style={{
                        paddingLeft: "5px",
                        paddingRight: "0",
                        width: "127px",
                      }}
                    >
                      <ul className="buy-page-listing">
                        <li>
                          <span>
                            <b>Aphellion</b> (AU): 1.73948598
                          </span>
                        </li>
                        <li>
                          <span>
                            <b>Diameter</b> (km): 2.3
                          </span>
                        </li>
                        <li>
                          <span>
                            <b>Semi-major Axis</b> (AU): 1.49382754
                          </span>
                        </li>
                        <li>
                          <span>
                            <b>Rotation</b> (hrs): 2.9485
                          </span>
                        </li>
                      </ul>
                      Composition
                      <ul className="buy-page-listing">
                        <li>
                          <span>iron</span>
                        </li>
                        <li>
                          <span>nickel</span>
                        </li>
                        <li>
                          <span>cobalt</span>
                        </li>
                      </ul>
                      Upcoming Approaches
                      <ul className="buy-page-listing">
                        <li>
                          <span>
                            <b>May 30, 2026</b>: 0.132 AU
                          </span>
                        </li>
                        <li>
                          <span>
                            <b>Apr 01, 2023</b>: 0.274 AU
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div
                    className="row"
                    style={{ paddingBottom: "0", paddingLeft: "24.5px" }}
                  >
                    <div
                      className="column content"
                      style={{ textAlign: "right" }}
                    >
                      Value ($)
                      <br />
                      <b>Est. Profit ($)</b>
                      <br />
                      <b>Price (CEL)</b>
                    </div>
                    <div
                      className="column content"
                      style={{ paddingLeft: "5px" }}
                    >
                      <div>
                        5.57 trillion <br />
                        <b>1.25 trillion</b> <br />
                        <b>1.0001020123</b>
                      </div>
                    </div>
                  </div>
                  <div className="row" style={{ paddingBottom: "0" }}>
                    <div className="ui button">Confirm</div>
                    <div
                      className="column content"
                      style={{ width: "180px", paddingRight: "0px" }}
                    >
                      Mining this space object will take <i>1-3 min</i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Popup>
      <Popup
        open={isError}
        position="right center"
        closeOnDocumentClick
        modal
        nested
        onClose={() => {
          setIsError(false);
        }}
      >
        {(close) => (
          <div className="modal">
            <button className="close" onClick={close}>
              &times;
            </button>
            <div className="header">Error</div>
            <div className="content" style={{ maxWidth: "400px" }}>
              Please select a space object before trying to buy it.
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
}

export default BuyPopup;

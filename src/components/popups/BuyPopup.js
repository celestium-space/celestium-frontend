import React, { useState, useRef, useEffect } from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import "../../utils.js";
import { GiRingedPlanet } from "react-icons/gi";
import { IoWallet } from "react-icons/io5";
import CelestiumLogo from "../images/CelestiumLogo";
import Countdown from "react-countdown";

function getAsteroidName() {
  let iframe = document.getElementById("asterankIframe");

  let innerDoc = iframe.contentDocument
    ? iframe.contentDocument
    : iframe.contentWindow.document;

  return [
    innerDoc.getElementById("selection-details").children[0].innerHTML,
    innerDoc.getElementById("orbit-2d-diagram").children[0],
  ];
}

function getSelection(
  setAsterankObjectName,
  setAsterankObjectSVG,
  setIsBuying,
  setIsError,
  onClick
) {
  let [asteroid_name, svg] = getAsteroidName();
  if (asteroid_name) {
    onClick(asteroid_name);
    setAsterankObjectName(asteroid_name);
    setAsterankObjectSVG(svg);
    setIsBuying(true);
  } else {
    setIsError(true);
  }
}

function BuyPopup(props) {
  let [asterankObjectName, setAsterankObjectName] = useState("loading");
  let [asterankObjectSVG, setAsterankObjectSVG] = useState("");
  const svgRef = useRef(null);
  let [isBuying, setIsBuying] = useState(false);
  let [isError, setIsError] = useState(false);
  let [confirmMiningPopup, setConfirmMiningPopup] = useState(false);

  let store_value_in_cel = isNaN(props.store_value_in_dust)
    ? props.store_value_in_dust
    : `${
        BigInt(props.store_value_in_dust) / 10000000000000000000000000000000n
      }.${(
        BigInt(props.store_value_in_dust) % 10000000000000000000000000000000n
      )
        .toString()
        .padStart(31, "0")
        .substring(0, 20)}...`;

  return (
    <div>
      <button
        className="ui button"
        onClick={() => {
          getSelection(
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
        contentStyle={{ width: "770px" }}
        modal
        nested
        onClose={() => {
          setIsBuying(false);
          setConfirmMiningPopup(false);
        }}
        onOpen={() => {
          let svg = asterankObjectSVG.cloneNode(true);
          svg.setAttribute("width", 170);
          svg.setAttribute("height", 244);
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
                    width: "300px",
                  }}
                  ref={svgRef}
                ></div>
                <div
                  className="ui two column full grid"
                  style={{
                    paddingRight: "0px",
                    paddingLeft: "24px",
                    width: "500px",
                  }}
                >
                  <div className="row" style={{ paddingBottom: "0" }}>
                    <video
                      autoPlay={true}
                      muted="muted"
                      playsInline
                      loop
                      className="column"
                      src={`videos-256/${asterankObjectName}.mp4`}
                      style={{
                        width: 256,
                        paddingLeft: "0",
                        paddingRight: "14px",
                      }}
                    />
                    <div
                      className="column content"
                      style={{
                        paddingLeft: "5px",
                        paddingRight: "0",
                        width: "200px",
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
                      <b>
                        Price (
                        <CelestiumLogo lineHeight="14pt" />)
                      </b>
                    </div>
                    <div
                      className="column content"
                      style={{ paddingLeft: "5px" }}
                    >
                      <div>
                        5.57 trillion <br />
                        <b>1.25 trillion</b> <br />
                        <b>{store_value_in_cel}</b>
                      </div>
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
                      Mining this space object will take <i>1-3 min</i>
                    </div>
                    <div
                      className="ui button"
                      onClick={() => {
                        setConfirmMiningPopup(true);
                      }}
                    >
                      Confirm
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Popup>
      <Popup
        open={isBuying && confirmMiningPopup}
        onOpen={() => {
          props.onConfirm(asterankObjectName);
        }}
        onClose={() => {
          setConfirmMiningPopup(false);
        }}
        closeOnDocumentClick
        modal
        nested
      >
        {(close) => (
          <div className="modal">
            <button className="close" onClick={close}>
              ×
            </button>
            <div className="header">Mining in progress...</div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Do not close this window or the mining process will be aborted.
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Mining is an inheritly random process. It is theoritically
              possible to mine for hours or only a couple of seconds. However
              the extremes are very unlikely.
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              Based on how fast your device is currently mining we have
              estimated the time most transactions should statistically fall
              within. However, <i>it is very possible to go over time</i>. As
              mining is completely random, aborting and &quot;retrying&quot;
              will unfortunately not help.
            </div>
            <div className="content" style={{ maxWidth: "500px" }}>
              You may see the countdown move irregularly. This is because the
              amount of resources that are available on your device can
              fluctuate.
            </div>
            <Countdown
              overtime={true}
              daysInHours={true}
              date={props.eta}
              renderer={({
                total,
                days,
                hours,
                minutes,
                seconds,
                milliseconds,
                completed,
              }) => {
                let calculating =
                  isNaN(hours) || isNaN(minutes) || isNaN(seconds);
                return (
                  <div className="content" style={{ maxWidth: "500px" }}>
                    {!completed ? "Expected time left: " : "Over time: "}
                    <i hidden={calculating}>
                      {completed ? "+" : ""}
                      {hours.toString().padStart(2, "0")}:
                      {minutes.toString().padStart(2, "0")}:
                      {seconds.toString().padStart(2, "0")}
                    </i>
                    <i hidden={!calculating}>Calculating...</i>
                  </div>
                );
              }}
            />
          </div>
        )}
      </Popup>
      <Popup
        open={props.doneMiningPopup}
        onOpen={() => {
          setIsBuying(false);
          setConfirmMiningPopup(false);
        }}
        onClose={() => {
          props.onDoneMiningPopupClose();
        }}
        closeOnDocumentClick
        modal
        nested
      >
        {(close) => (
          <div className="modal">
            <button className="close" onClick={close}>
              ×
            </button>
            <div className="header">Congratulations!</div>
            <br />
            <div className="content" style={{ maxWidth: "400px" }}>
              You have aquired the asteroid: <i>{asterankObjectName}</i>
            </div>
            <div className="content" style={{ maxWidth: "300px" }}>
              You can view all your asteroids and see your current balance in
              your <a href="/wallet">Wallet</a>{" "}
              <a href="/wallet" style={{ color: "white" }}>
                <IoWallet size={15} />
              </a>
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

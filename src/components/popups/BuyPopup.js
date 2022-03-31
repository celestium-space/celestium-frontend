import React, { useState, useRef } from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import "../../utils.js";
import { IoWallet } from "react-icons/io5";
import CelestiumLogo from "../images/CelestiumLogo";
import Countdown from "react-countdown";
import { numberToShortScale } from "../../utils";

function getAsteroidName(setAsterankDetails) {
  let iframe = document.getElementById("asterankIframe");

  let innerDoc = iframe.contentDocument
    ? iframe.contentDocument
    : iframe.contentWindow.document;

  let name = innerDoc.getElementById("selection-details").children[0].innerHTML;
  let query = name.split("(")[1].split(")")[0];

  let jpl_request = new XMLHttpRequest();
  jpl_request.onreadystatechange = function () {
    if (jpl_request.readyState == 4 && jpl_request.status == 200) {
      let jpl_details = JSON.parse(jpl_request.responseText);
      let compositions_request = new XMLHttpRequest();
      compositions_request.onreadystatechange = function () {
        if (
          compositions_request.readyState == 4 &&
          compositions_request.status == 200
        ) {
          let details = Object.assign(
            jpl_details,
            JSON.parse(compositions_request.responseText)
          );
          console.log(details);
          setAsterankDetails(details);
        }
      };
      compositions_request.open(
        "GET",
        "https://www.asterank.com/api/compositions",
        true
      );
      compositions_request.send(null);
    }
  };
  jpl_request.open(
    "GET",
    "https://www.asterank.com/jpl/lookup?query=" + query,
    true
  );
  jpl_request.send(null);

  return [name, innerDoc.getElementById("orbit-2d-diagram").children[0]];
}

function pou(num) {
  return num >= 0 ? num : "Unknown";
}

function getSelection(
  setAsterankObjectName,
  setAsterankObjectSVG,
  setAsterankComposition,
  setIsBuying,
  setIsError,
  onClick
) {
  let [asteroid_name, svg] = getAsteroidName(setAsterankComposition);
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
  let [asterankDetails, setAsterankDetails] = useState(null);
  const svgRef = useRef(null);
  let [isBuying, setIsBuying] = useState(false);
  let [isError, setIsError] = useState(false);
  let [confirmMiningPopup, setConfirmMiningPopup] = useState(false);

  let store_value_in_cel = isNaN(props.store_item.store_value_in_dust)
    ? props.store_item.store_value_in_dust
    : `${
        BigInt(props.store_item.store_value_in_dust) /
        10000000000000000000000000000000n
      }.${(
        BigInt(props.store_item.store_value_in_dust) %
        10000000000000000000000000000000n
      )
        .toString()
        .padStart(31, "0")}`;

  if (asterankDetails) {
    console.log(asterankDetails);
  }

  let compositions =
    props.store_item.asteroid_specification && asterankDetails
      ? asterankDetails[props.store_item.asteroid_specification]
      : [];

  console.log(compositions);

  return (
    <div>
      <button
        className="ui button"
        onClick={() => {
          getSelection(
            setAsterankObjectName,
            setAsterankObjectSVG,
            setAsterankDetails,
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
        style={{ overflow: "hidden" }}
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
                  <div
                    className="row"
                    style={{ paddingBottom: "0", paddingRight: "0" }}
                  >
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
                    {asterankDetails ? (
                      <div
                        className="column content"
                        style={{
                          paddingLeft: "5px",
                          paddingRight: "0",
                          width: "210px",
                        }}
                      >
                        <ul className="buy-page-listing">
                          <li>
                            <b>Aphelion (AU)</b>:{"  "}
                            {pou(asterankDetails["Aphelion (AU)"])}
                          </li>

                          <li>
                            <b>Diameter (km)</b>:{"  "}
                            {pou(asterankDetails["Diameter (km)"])}
                          </li>

                          <li>
                            <b>Semi-major Axis (AU)</b>:{"  "}
                            {pou(asterankDetails["Semi-major Axis (AU)"])}
                          </li>

                          <li>
                            <b>GM (km^3/s^2)</b>:{"  "}
                            {pou(asterankDetails["GM (km^3/s^2)"])}
                          </li>

                          <li>
                            <b>Rotation (hrs)</b>:{"  "}
                            {pou(asterankDetails["Rotation (hrs)"])}
                          </li>

                          <li>
                            <b>Inclination (deg)</b>:{"  "}
                            {pou(asterankDetails["Inclination (deg)"])}
                          </li>

                          <li>
                            <b>Extent (km)</b>:{"  "}
                            {pou(asterankDetails["Extent (km)"])}
                          </li>

                          <li>
                            <b>Perihelion (AU)</b>:{"  "}
                            {pou(asterankDetails["Perihelion (AU)"])}
                          </li>

                          <li>
                            <b>Density (g/cm^3)</b>:{"  "}
                            {pou(asterankDetails["Density (g/cm^3)"])}
                          </li>

                          <li>
                            <b>Period (days)</b>:{"  "}
                            {pou(asterankDetails["Period (days)"])}
                          </li>

                          <li>
                            <b>EMOID (AU)</b>:{"  "}
                            {pou(asterankDetails["EMOID (AU)"])}
                          </li>

                          <li>
                            <b>Albedo</b>:{"  "}
                            {pou(asterankDetails["Albedo"])}
                          </li>
                        </ul>
                        Composition
                        <ul className="buy-page-listing">
                          {Object.keys(compositions).map((key) => (
                            <li key={key}>
                              <span>{key}</span>
                            </li>
                          ))}
                        </ul>
                        {/*Upcoming Approaches
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
                      </ul> */}
                      </div>
                    ) : (
                      "Fetching..."
                    )}
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
                      <div
                        style={{
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                        }}
                      >
                        {numberToShortScale(props.store_item.price)}
                        <br />
                        <b>
                          {numberToShortScale(props.store_item.profit)}
                        </b>{" "}
                        <br />
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
                      className={
                        "ui button" + process.env.REACT_APP_FREEZE_BLOCKCHAIN
                          ? " disabled"
                          : ""
                      }
                      onClick={() => {
                        if (!process.env.REACT_APP_FREEZE_BLOCKCHAIN) {
                          setConfirmMiningPopup(true);
                        }
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
                    <i hidden={!calculating}>Preparing NFT...</i>
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
              You have aquired the asteroid:
              <br />
              <i>{asterankObjectName}</i>
              <br />
              Unfortunately the space around earth is getting polluted, so you
              have also been asigned a piece of the space garbage:
              <br />
              <i>{props.debris_name}</i>.
            </div>
            <div className="content" style={{ maxWidth: "300px" }}>
              You can view and read more about your asteroids and space debris
              and see your current balance in your <a href="/wallet">Wallet</a>{" "}
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

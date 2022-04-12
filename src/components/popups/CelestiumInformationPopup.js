import React from "react";
import Popup from "reactjs-popup";
import { Popup as SemanticPopup } from "semantic-ui-react";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import Countdown from "react-countdown";
import CelestiumLogo from "../images/CelestiumLogo";

const launch = new Date("2022-03-31T18:00:00+00:00");

const options = {
  timeZoneName: "short",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

export default function CelestiumInformationPopup(props) {
  return (
    <Popup open={props.open} closeOnDocumentClick modal nested>
      {(close) => (
        <div className="modal">
          <button className="close" onClick={close}>
            &times;
          </button>
          <div className="header">Welcome to the Celestium Canvas</div>
          {process.env.REACT_APP_FREEZE_BLOCKCHAIN ? (
            <React.Fragment>
              <div className="content" style={{ maxWidth: "400px" }}>
                The Celestium Artwork is now over. The blockchain has been
                frozen and sent to NASA so they can verify the package before
                the 5th of April 2022, where it will be mined onboard the ISS.
              </div>
              <div className="content" style={{ maxWidth: "400px" }}>
                You can still browse the canvas, your wallet, and the asteroids,
                but no transactions are currently accepted.
              </div>
              <div className="content" style={{ maxWidth: "400px" }}>
                After the 5th of April 2022, you will again be able to buy
                asteroids and NFTs for the Celestium you have in your wallet.
              </div>
            </React.Fragment>
          ) : process.env.REACT_APP_FREEZE_CANVAS ? (
            <React.Fragment>
              <div className="content" style={{ maxWidth: "400px" }}>
                The Celestium Artwork is now over. The block containing all
                transactions creating this canvas has successfully been sent to
                the ISS, mined and sent to earth. This block is now a part of
                the blockchain as Block #1.
              </div>
              <div className="content" style={{ maxWidth: "400px" }}>
                To preserve the pixels sent to space, this instance does not
                accept pixel base transactions. This means that you can now only
                browse the canvas and not change pixels anymore.
              </div>
              <div className="content" style={{ maxWidth: "400px" }}>
                This instance still accepts all other transactions. This means
                that you can still exchange CEL for asteroids, transfer and
                export wallets and export your NFTs.
              </div>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="content" style={{ maxWidth: "300px" }}>
                Final date has now been planned by NASA and the image created
                here will be frozen in:
                {/*The image created here will be sent to the International Space
            Station.
            <br />
            <br />
            The specific date has not yet been set, but as soon as we know a{" "}
            <i>countdown</i> will start here. However,{" "}
            <i>pixels placed now still counts!</i>*/}
              </div>
              <SemanticPopup
                style={{ height: "100%", textAlign: "center" }}
                position="top center"
                content="This time is subject to change if deemed nessesary by NASA"
                trigger={
                  <div className="modal">
                    <Countdown
                      daysInHours={true}
                      date={launch}
                      renderer={({
                        total,
                        days,
                        hours,
                        minutes,
                        seconds,
                        milliseconds,
                        completed,
                      }) => {
                        return (
                          <div className="header2">
                            {days ? `${days} Days - ` : ""}
                            {hours.toString().padStart(2, "0")}:
                            {minutes.toString().padStart(2, "0")}:
                            {seconds.toString().padStart(2, "0")}*
                          </div>
                        );
                      }}
                    />
                    <div className="header3">
                      {launch.toLocaleString(undefined, options)}
                    </div>
                  </div>
                }
              />
              <br />
              <div className="content" style={{ maxWidth: "300px" }}>
                The block will be checked by NASA cyber security and sent to the
                ISS on 5th of April 2022.
              </div>
              <div className="content" style={{ maxWidth: "300px" }}>
                Click anywhere on the canvas to contribute, by placing your
                pixel and mine a Celestium Token (
                <CelestiumLogo lineHeight="14pt" />)
              </div>
            </React.Fragment>
          )}
        </div>
      )}
    </Popup>
  );
}

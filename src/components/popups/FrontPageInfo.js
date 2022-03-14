import React, { useState } from "react";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import "./FrontPageInfo.css";
import { Button, Checkbox } from "semantic-ui-react";

export default function FrontPageInfo(props) {
  return (
    <div className="global">
      <div className="phone-info">
        <b>
          If the website looks strange on your mobile device try accessing it on
          a desktop/laptop.
        </b>
      </div>
      <div className="center">
        <p>
          <h2>
            Celestium - Artificial intelligence and blockchain art created
            aboard the International Space Station (ISS)
          </h2>
          By artist Cecilie Waagner Falkenstrøm and art-tech team ARTificial
          Mind
          <br />
          <br />
          You are about to experience the Celestium artwork. The artwork is the
          first of its kind artificial intelligence (AI) and blockchain artwork
          to operate from space, as it orbits the Earth aboard NASA's part of
          the International Space Station (ISS).
          <br />
          <br />
          Celestium is the first of its kind artificial intelligence (AI) and
          blockchain artwork to operate from space, as it since December 17th
          2021 has orbited the Earth aboard NASA's part of the International
          Space Station (ISS). The artwork, which takes the form of a hybrid
          AI-Blockchain algorithm, uses data from cosmic radiation that it
          experienced aboard the ISS, to seed and create a series of digital
          tokens and AI-generated space images.
          <br />
          <br />
          <b>
            Here on this website you can collect the artwork's unique space
            tokens and space images from February 1st to March 22th, 2022, by
            interacting with the artwork.
          </b>
          <br />
          <br />
          As a part of the interactive experience, here you will be given the
          opportunity to take part in the creation of a global collaborative
          artwork that will also be sent into space to the International Space
          Station in March 2022.
          <br />
          <br />
          The artwork questions the capitalistic dynamics of space exploration
          as it scrutinizes questions in relation to decentralization and
          sustainability: How might human actions in space be able to transform
          the quality of life of all of humanity, instead of serving as more
          wealth for the few? Can access to space and all its resources be
          decentralized? How can we make sure that the people who harvest
          asteroids' resources are responsible for the space debris they
          produce?
          <br />
          <br />
          <b>Interact with the artwork:</b>
          <br />
          Upon entering the web platform, you will be confronted with an
          interactive canvas of 1000 by 1000 pixels where you are invited to
          contribute your take on the human condition to a collaborative image
          that will be sent into space to the International Space Station in
          March 2022.
          <br />
          <br />
          As a reward for your contribution, you will receive a Celestium token
          generated from space radiation harvested by the artwork aboard the
          International Space Station. You can exchange this fungible token for
          real asteroids that orbit our solar system, in the form of
          non-fungible tokens (NFTs).
          <br />
          <br />
          You can see each of the near-earth asteroids, numbering over 600,000,
          as they are rendered within the artplatform's Asteroid Database, along
          with an accompanying visualization generated by the AI algorithm
          (GAN), from space radiation harvested aboard the ISS. You can exchange
          your Celestium tokens to acquire an asteroid and its accompanying AI
          generated image, in the form of an NFT.
          <br />
          <br />
          Along with any exchange, you will also be allocated a piece of space
          debris equivalent to the amount that would be produced in the
          asteroids harvesting in order to raise awareness of the shared
          responsibility of the sustainable disposal of generated waste products
          in space.
          <br />
          <br />
          All the assets you acquire, including Celestium tokens, asteroids, and
          space debris are gathered within your personal wallets.
          <br />
          <br />
          You can learn more about the Celestium artwork at:
          <br />
          <a href="https://www.artificialmind.ai/projects/celestium">
            https://www.artificialmind.ai/projects/celestium
          </a>
          <br />
          <br />
          Artist:
          <br />
          Artist Cecilie Waagner Falkenstrøm and art-tech studio ARTificial Mind
          <br />
          <br />
          Tech Development:
          <br />
          ARTificial Mind team: Jens Hegner Stærmose, Alexander Krog, Cody Lukas
          Anderson, Asbjørn Olling and Cecilie Waagner Falkenstrøm.
          <br />
          <br />
          Initial Idea:
          <br />
          Cecilie Waagner Falkenstrøm and Niels Zibrandtsen.
          <br />
          <br />
          Year:
          <br />
          2021/2022
          <br />
          <br />
          Period aboard the International Space Station (ISS):
          <br />
          December 17th, 2021 - March 2022
          <br />
          <br />
          Thanks to:
          <br />
          NASA, CASIS, Lonestar, Redwire Corporation, Canonical, MindFuture
          Foundation, Danish Arts Foundation, Space For Art Foundation, and
          retired NASA astronaut Nicole Stott.
          <br />
          <br />
          Contact
          <br />
          Artist Cecilie Waagner Falkenstrøm
          <br />
          <a href="mailto:cwf@artificialmind.ai">cwf@artificialmind.ai</a>
          <br />
          <a href="https://www.artificialmind.ai">www.artificialmind.ai</a>
          <br />
          <br />
        </p>
      </div>
      <div className="logo-container">
        <Button
          className="logo-button"
          onClick={() => {
            window.location.replace("/grid");
          }}
        >
          Enter
        </Button>
        <h1 className="logo">CELESTIUM</h1>
      </div>
    </div>
  );
}

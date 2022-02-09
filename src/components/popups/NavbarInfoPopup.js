import React, { useState } from "react";
import "reactjs-popup/dist/index.css";
import "./MyPopups.css";
import "./FrontPageInfo.css";
import { Button, Checkbox } from "semantic-ui-react";

export default function NavbarInfoPopup(props) {
  return (
    <div className="global">
      <div className="center">
        <br />
        <br />
        <br />
        <p>
          <h2>
            How to Interact with the Artwork.
          </h2>
          <h3>
            Step 1: Contribute your take on the human condition to a collaborative global image that will be sent to ISS.
          </h3>
          On the Landing page <a href="http://celestium.space/grid">celestium.space/grid</a> you are able to color the pixels of 1000 by 1000 pixel image.
          <br />
          <br />
          This is done 1 pixel at a time where you select the color from the pallet on the side of the image you wish to use and then select where to place it in the image.
          <br />
          <br />
          You can zoom in and out of the image canvas using your mouses scroll wheel or clicking on the icons at the top left of the canvas.
          <br />
          <br />
          Once you have placed your pixel you will have to wait for your computer to process the request.
          <br />
          <br />
          Once processed your pixel will change color. This could take a minute. If it does not change color then try to refresh the page and your pixel should appear.
          <br />
          <br />
          As a reward for your pixel contribution to the collective “human condition canvas”, you will receive 1 Celestium token which has been seeded from space aboard the ISS.
          <br />
          <br />
          Note that just because you have placed a pixel, the canvas is live for everyone around the world. So anyone can come along and change the color of said pixel again.
          <br />
          <br />
          In March 2022 the image created along with its full history of all the pixels that have been placed will be sent up into space aboard the ISS and be mined before returning to earth back on the blockchain. Thereby allowing all humans an equal say in the cultural artifacts we decide to send into space as representations of who we are as humans.
          <br />
          <br />
          Because the images full history is stored on the blockchain which is sent into space, your contribution will be a part of that journey and can always be located in the Celestium Blockchains history regardless of whether someone has changed the color of a pixel you set.
          <h3>
            Step 2: Use your Celestium token in exchange for Asteroids and AI-Generated Images.
          </h3>
          On the International Space Station, the Celestium artwork’s artificial intelligence (GAN), which has been trained on thousands of images of deep space, harvests space radiation in order to generate its own unique animated visualizations of space objects.
          <br />
          <br />
          Each of these images has then been linked with one of the over 600,000 real-world asteroids flying around our solar system right now.
          <br />
          <br />
          On the Asteroid page <a href="http://celestium.space/asteroids">celestial.space/asteroids</a> you are able to see all of the real near-earth asteroids that have been identified.
          <br />
          <br />
          You can click on an asteroid in the table to get more information about it, sort through them using the dropdown menu, or search bar just above the table.
          <br />
          <br />
          You can see the AI-generated image associated with an asteroid by clicking the Exchange for C button on the top left corner of the screen.
          <br />
          <br />
          If at any point you find an asteroid and/or accompanying AI-generated image that you want to keep for yourself you may trade in the celestium tokens that you received (by placing pixels) for the real asteroid and accompanying AI image. These are then given to you in the form of a non-fungible token (NFT) and will be stored in your wallet which can be seen on the Wallet page  <a href="http://celestium.space/wallet">celestial.space/wallet</a>.
          <br />
          <br />
          The asteroid database is open to all as a free access platform, however, all asteroids and AI-generated images are single editions. This means once you decide to exchange celestium to acquire an asteroid and AI-generated image only you will be able to see the asteroid in the database on your browser and in your wallet.
          <br />
          <br />
          Note that if you are trying to exchange celestium tokens for asteroids in the Asteroid page <a href="http://celestium.space/asteroids">celestial.space/asteroids</a>, make sure that you ensure that you have enough celestium to carry out the exchange. Otherwise, the mining process can go on indefinitely. You can see the celestium cost of an asteroid just above the Confirm button located in the bottom right of the popup that appears after you have selected the asteroid and clicked on the exchange for C button.
          <br />
          <br />
          If you are unsure as to how much Celestium you have to use, you can see your balance in the wallet landing page.
          <h3>Step 3: View your collection in your Wallet</h3>
          On the  Wallet page <a href="http://celestium.space/wallet">celestial.space/wallet</a> you are able to see:
          <br />
          <br />
          How much Celestium you have, which is written in the top left corner of the screen
          <br />
          <br />
          Which Asteroids you have acquired as NFTs along with their AI-generated visualizations, represented in a grid in the lower half of the screen.
          <br />
          <br />
          The total value of the space assets you have acquired, which is written in the middle of the screen above the grid of asteroids.
          <br />
          <br />
          And the space debris which you have been allocated as a result of your capitalist endeavors in space, depicted in a table in the top half of the screen
          <br />
          <br />
          By clicking on an AI-generated image you will open a popup of the full resolution video generated from space radiation aboard the ISS which you are free to download.
          <br />
          <br />
          At the top of the page, you can also transfer the asteroids, images, and celestium tokens you have acquired from one account to another using the Import and Export Private Key buttons (These buttons are currently under development)
          <br />
          <br />
          If you export your private key it is important that you do not share the file that is exported with anyone unless you want to transfer your asteroids, images, and celestium tokens to their wallet.
          <h3>Technical Difficulties</h3>
          There can emerge technical errors with the platform in times of high user demand which can result in delays in response time with our server.
          <br />
          <br />
          If you experience such a delay first try refreshing your webpage.
          <br />
          <br />
          If this does not correct the issue then try again in a couple of minutes.
          <br />
          <br />
          A typical sign of a technical error is if you refresh the Landing page <a href="http://celestium.space/grid">celestium.space/grid</a> and the square canvas is completely blue for an extended period of time. In which case try back in a couple of minutes when the demand has died down.
          <br />

        </p>
        <div className="right">
          <Button
            onClick={() => {
              window.location.replace("https://celestium.space/grid");
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

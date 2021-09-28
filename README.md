# celestium-frontend

This is the react front-end for the Celestium project.

It's pixelflut backed by the celestium blockchain.
Once your pixelflut transactions have made it onto the blockchain,
you will be rewarded with some crypto-currency that you can use to buy NFTs,
which represent known asteroids in orbit of the sun.


## Development

### Change the Backend URL

As of yet, the URL of the back end is *hard-coded* in a javascript file somewhere.

Find it and change it (and remember to not commit it!),
or mess around with name resolution on your local machine so it works right.

*This should be fixed* - but I don't have any more time rn so 🤷


### 🐳 Running w/ docker

```
docker-compose up
```

### 🧰 Running front-end only, w/o docker

```sh
npm install
npm run start
```


## Deployment

This repo has two branches which are built and deployed automagically.

**master** builds for production.

**dev** builds for development.

These are built using docker in Gitlab CI and pushed to our private docker registry.


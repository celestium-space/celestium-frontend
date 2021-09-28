# celestium-frontend

This is the react front-end for the Celestium project.

It's pixelflut backed by the celestium blockchain.
Once your pixelflut transactions have made it onto the blockchain,
you will be rewarded with some crypto-currency that you can use to buy NFTs,
which represent known asteroids in orbit of the sun.


## Setting the Backend URL

By default, the backend URL is calculated based on the URL of the react app.

It's probably easiest to understand with examples:

- `https://example.com   -> wss://api.example.com`
- `http://localhost:1234 -> ws://api.localhost:1234`

Notice that it uses `wss` if the webapp uses `https`, adds the `api` subdomain, and *does not* change the port.

This can be overridden by setting the environment variable `REACT_APP_SOCKET_ADDRESS`.
For instance, this is how the development compose file is set up.

## Development

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


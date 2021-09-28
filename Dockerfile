FROM node:16

WORKDIR /app

# npm deps
COPY package.json ./
COPY package-lock.json ./
COPY semantic.json ./
COPY .eslintrc.js ./
RUN npm install
RUN npm install --global http-server

# the application
COPY src ./src
COPY public ./public

# fail build if app does not build
RUN npm run build

# build again, to inject runtime env vars
CMD npm run build && http-server /app/build

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
RUN npm run build

# run it
CMD http-server /app/build

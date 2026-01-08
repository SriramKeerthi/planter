FROM node:alpine as build

# Create app directory
WORKDIR /app

# Bundle app source
COPY . .
RUN apk add --no-cache \
    autoconf \
    automake \
    bash \
    g++ \
    libc6-compat \
    libjpeg-turbo-dev \
    libpng-dev \
    make \
    nasm \
    gifsicle
RUN npm install
RUN npx nx build planter-ws-client

FROM node:alpine as runtime
WORKDIR /app
COPY --from=build /app/dist/apps/planter-ws-client /app
RUN npm install
RUN ls -al

CMD [ "node", "main.js" ]

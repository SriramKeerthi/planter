FROM node:alpine as build

# Create app directory
WORKDIR /app

# Bundle app source
COPY . .
RUN npm install
RUN npx nx build planter-ws

FROM node:alpine as runtime
WORKDIR /app
COPY --from=build /app/dist/apps/planter-ws /app
RUN sh -c ls
RUN npm install

EXPOSE 3000 80
CMD [ "node", "src/main.js" ]

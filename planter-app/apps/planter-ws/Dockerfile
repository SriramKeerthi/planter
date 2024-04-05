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
RUN npm install
RUN ls -al

EXPOSE 3000 3000
CMD [ "node", "main.js" ]

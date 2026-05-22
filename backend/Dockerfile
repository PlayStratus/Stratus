FROM docker.io/node:alpine

WORKDIR /app
COPY package.json package-lock.json .
RUN npm ci

COPY --parents lib/ routes/ socket/ server.ts tsconfig.json .

RUN npm run build

CMD ["npm", "start"]

FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY server.mjs ./

ENV DATA_DIR=/data/diagrams
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server.mjs"]

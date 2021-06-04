FROM --platform=${TARGETPLATFORM:-linux/amd64} node:12.13.0-alpine as ship

ENV NPM_CONFIG_LOGLEVEL warn
ENV APIPORT=3333
ENV PGUSER=postgres
ENV PGHOST=db.fhirstation.net
ENV PGPORT=5432
ENV SQLLIMIT=51

WORKDIR /home/app

COPY package.json ./
COPY tls ./
COPY . .

RUN \
    apk --no-cache add curl ca-certificates && \
    addgroup -S app && adduser -S -g app app && \
    mkdir -p /home/app && \
    npm i && \
    chown app:app -R /home/app && \
    chmod 777 /tmp

USER app

CMD ["/usr/local/bin/node", "index.js"]

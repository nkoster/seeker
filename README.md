# seeker

```
APIPORT=3334 PGUSER=postgres PGHOST=192.168.67.166 PGPORT=5432 nomon index.js
```

```
psql -h 192.168.67.166 -U postgres "sslcert=/home/niels/src/node/seeker/tls/client_postgres.crt sslkey=/home/niels/src/node/seeker/tls/client_postgres.key sslrootcert=/home/niels/src/node/seeker/tls/root.crt sslmode=verify-ca"
```

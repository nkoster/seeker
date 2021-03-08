# seeker

```
APIPORT=3334 PGUSER=postgres PGHOST=192.168.67.166 PGPORT=5432 nodemon index.js
```

```
psql -h 192.168.67.166 -U postgres "sslcert=tls/client_postgres.crt sslkey=tls/client_postgres.key sslrootcert=tls/root.crt sslmode=verify-ca"
```

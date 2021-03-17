(async _ => {

  const DEBUG = true
  const DEVDELAY = 0
  const express = require('express')
  const app = express()
  const cors = require('cors')
  const fs = require('fs')

  const config = {
    database: process.env.PGDATABASE || 'postgres',
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || '5432',
    ssl: {
      rejectUnauthorized: false,
      ca: fs.readFileSync('tls/root.crt').toString(),
      key: fs.readFileSync('tls/client_postgres.key').toString(),
      cert: fs.readFileSync('tls/client_postgres.crt').toString()
    }
  }

  const apiPort = process.env.APIPORT || 3333

  const { Client } = require('pg')
  const client = new Client(config)
  const pidKiller = new Client(config)

  /* 51 so the client can say something like "50+ rows" */
  const LIMIT = process.env.SQLLIMIT || 51

  const sqlSelectQuery = queryId => {
    return `
  SELECT kafka_topic, kafka_offset, identifier_type, identifier_value
  /*${queryId}*/
  FROM dist_identifier_20210312
  -- FROM identifier_20210311
  WHERE ($1 = '' OR kafka_topic ilike $1)
  AND ($2 = '' OR identifier_type ilike $2)
  AND ($3 = '' OR identifier_value ilike $3)
  AND RIGHT('0000000000' || CAST(kafka_offset AS VARCHAR(10)), 10) like $4
  ORDER BY kafka_offset DESC
  LIMIT ${LIMIT}
  `
  }

  const sqlKillQuery = queryId => {
    return `
    with pids as (
      /*notthisone*/
       select pid
       from   pg_stat_activity
       where  query like '%/*${queryId}*/%'
       and    query not like '%/*notthisone*/%'
       and state='active'
      )
    select pg_cancel_backend(pid) from pids;
    `
  }
  app.use(cors())
  app.use(express.json())

  try {
    await client.connect()
    await pidKiller.connect()
  } catch(err) {
    DEBUG && console.log(err.message)
  }

  const api = async (req, res) => {
    const queryId = req.body.queryId
    DEBUG && console.log('queryId:', queryId)
    const query = {
      name: queryId,
      text: sqlSelectQuery(queryId),
      values: [
        `%${req.body.search.queryKafkaTopic}%`,
        `%${req.body.search.queryIdentifierType}%`,
        `%${req.body.search.queryIdentifierValue}%`,
        `%${req.body.search.queryKafkaOffset}%`
      ]
    }
    try {
      await pidKiller.query(sqlKillQuery(queryId))
    } catch (err) {
      DEBUG && console.log(err.message)
    }
    try {
      const data = await client.query(query)
      res.setHeader('Content-Type', 'application/json')
      if (DEVDELAY > 0)
        setTimeout(_ => res.send(JSON.stringify(data.rows)), DEVDELAY)
      else
        res.send(JSON.stringify(data.rows))
      DEBUG && console.log('rows:', data.rows.length)
    } catch (err) {
      DEBUG && console.log(err.message)
    }
  }

  app.post('/api/v1/search', api)

  app.listen(apiPort, _ => 
    console.log('Seeker at port', apiPort)
  ).on('error', err => console.log(err.message))

})()

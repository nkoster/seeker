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

  /* 51 so the client can say something like "50+ rows" */
  const LIMIT = process.env.SQLLIMIT || 51

  const sqlSelect = `
  SELECT kafka_topic, kafka_offset, identifier_type, identifier_value
  -- FROM dist_identifier_20210312
  FROM identifier_20210311
  WHERE ($1 = '' OR kafka_topic ilike $1)
  AND ($2 = '' OR identifier_type ilike $2)
  AND ($3 = '' OR identifier_value ilike $3)
  AND RIGHT('0000000000' || CAST(kafka_offset AS VARCHAR(10)), 10) like $4
  ORDER BY kafka_offset DESC
  LIMIT ${LIMIT}
  `
  app.use(cors())
  app.use(express.json())

  try {
    await client.connect()
  } catch(err) {
    console.log('Oh boy...', err.message)
  }

  const api = async (req, res) => {
    try {
      const query = {
        name: 'seeker',
        text: sqlSelect,
        values: [
          `%${req.body.search.queryKafkaTopic}%`,
          `%${req.body.search.queryIdentifierType}%`,
          `%${req.body.search.queryIdentifierValue}%`,
          `%${req.body.search.queryKafkaOffset}%`
        ]
      }
      const data = await client.query(query)
      res.setHeader('Content-Type', 'application/json')
      if (DEVDELAY > 0)
        setTimeout(_ => res.send(JSON.stringify(data.rows)), DEVDELAY)
      else
        res.send(JSON.stringify(data.rows))
      DEBUG && console.log('rows:', data.rows.length)
    } catch (err) {
        console.log(err.stack)
    }
  }

  app.post('/api/v1/search', api)

  app.listen(apiPort, _ => console.log('Seeker at port', apiPort))

})()

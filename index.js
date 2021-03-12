(_ => {

  const DEBUG = false
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
      cert: fs.readFileSync('tls/client_postgres.crt').toString(),
    }
  }

  const apiPort = process.env.APIPORT || 3333

  const { Pool } = require('pg')
  const pool = new Pool(config)

  const LIMIT = process.env.SQLLIMIT || 50

  const sqlSelect = `
  SELECT kafka_topic, kafka_offset, identifier_type, identifier_value
  FROM identifier_20210311
  WHERE identifier_value ilike $1
  AND RIGHT('0000000000' || CAST(kafka_offset AS VARCHAR(10)), 10) like $2
  LIMIT ${LIMIT}
  `
//right('00000' + cast(Your_Field as varchar(5)), 5)

  app.use(cors())
  app.use(express.json())
  
  const api = async (req, res) => {
    let client
    try {
      client = await pool.connect()
    } catch(err) {
      console.log('Oh boy...', err.message)
      process.exit(1)
    }
    try {
      try {
        const query = {
          name: 'seeker',
          text: sqlSelect,
          values: [
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
      } finally {
        client.release()
      } 
    } catch (err) {
        // client.release()
        console.log(err.stack)
    }
  }

  app.post('/api/v1/search', api)

  app.listen(apiPort, _ => console.log('Seeker at port', apiPort))

})()

(_ => {

  const express = require('express')
  const app = express()
  const port = 3333

  const { Client } = require('pg')
  const select = 'SELECT kafka_topic, kafka_offset, identifier_type, identifier_value FROM identifier i NATURAL JOIN kafka_topic NATURAL JOIN identifier_type WHERE identifier_value ilike $1'
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    port: 5432
  })
  
  app.use(express.json())
  
  client.connect()
  
  const api = async (req, res) => {
    try {
      const query = {
        name: 'fetch',
        text: select,
        values: [`%${req.body.search}%`]
      }
      const data = await client.query(query)
      res.setHeader('Content-Type', 'application/json')
      res.send(JSON.stringify(data.rows))
    } catch (err) {
      console.log(err.stack)
    }
  }

  app.post('/api/v1/search', (req, res) => api(req, res))

  app.listen(port, () => {
    console.log(`Function PG listening at http://localhost:${port}`)
  }).on('close', () => client.end())

})()

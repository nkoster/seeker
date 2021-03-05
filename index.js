(_ => {

  const express = require('express')
  const app = express()
  const port = 3333

  const { Pool } = require('pg')
  const pool = new Pool()

  const sqlSelect = 'SELECT kafka_topic, kafka_offset, identifier_type, identifier_value FROM identifier i NATURAL JOIN kafka_topic NATURAL JOIN identifier_type WHERE identifier_value ilike $1'

  app.use(express.json())
  
  const api = async (req, res) => {
    const client = await pool.connect()
    try {
      try {
        const query = {
          name: 'seeker',
          text: sqlSelect,
          values: [`%${req.body.search}%`]
        }
        const data = await client.query(query)
        res.setHeader('Content-Type', 'application/json')
        res.send(JSON.stringify(data.rows))
        console.log('rows:', data.rows.length)
      } finally {
        client.release()
      } 
    } catch (err) {
        client.release()
        console.log(err.stack)
    }
  }

  app.post('/api/v1/search', api)

  app.listen(port, _ => {
    console.log(`Seeker listening at http://localhost:${port}`)
  })

})()

(async _ => {

  require('dotenv').config()

  const DEBUG = true
  const DEVDELAY = 0
  const express = require('express')
  const app = express()
  const jwt = require('jsonwebtoken')
  const cors = require('cors')
  const fs = require('fs')

  const config = {
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER || 'postgres',
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

  const { Pool } = require('pg')
  const clientPool = new Pool(config)
  const pidKillerPool = new Pool(config)

  const sqlSelectQuery = queryId => {
    return `
    SELECT /*${queryId}*/
      * from func_identifier(in_identifier_value => $3,
      in_identifier_type => $2,
      in_kafka_topic => $1 ,
      in_kafka_offset => $4,
      in_kafka_partition => null)
    `
  }

  const sqlKillQuery = queryId => {
    return `
    WITH pids AS (
      /*notthisone*/
      SELECT pid
      FROM   pg_stat_activity
      WHERE  query LIKE '%/*${queryId}*/%'
      AND    query NOT LIKE '%/*notthisone*/%'
      AND    state='active'
    )
    SELECT pg_cancel_backend(pid) FROM pids;
    `
  }

  const topicsQuery = {
    name: 'GimmeTheTopix',
    text: 'SELECT * FROM dist_kafka_topic'
  }

  app.use(cors())
  app.use(express.json())

  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) {
      return res.redirect('/')
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if (err) {
        return res.redirect('/')
      }
      req.user = user
      next()
    })
  }

  const client = await clientPool.connect()
  const pidKiller = await pidKillerPool.connect()

  const doSearchQuery = async (req, res) => {

    const queryId = req.body.queryId
    DEBUG && console.log('queryId:', queryId)

    const query = {
      name: queryId,
      text: sqlSelectQuery(queryId),
      values: [
        req.body.search.queryKafkaTopic,
        req.body.search.queryIdentifierType,
        req.body.search.queryIdentifierValue,
        req.body.search.queryKafkaOffset ? parseInt(req.body.search.queryKafkaOffset) : null
      ]
    }
   
    try {
      await pidKiller.query(sqlKillQuery(queryId))
    } catch (err) {
      DEBUG && console.log(err.message)
    } finally {
      // pidKiller.release()
    }

    const data = await new Promise(async (resolve, reject) => {
      let result
      try {
        result = await client.query(query)
      } catch (err) {
        reject( { rows: [] } )
        console.log(err.message)
      } finally {
        resolve(result)
        // client.release()
      }    
    })

    try {
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

  const doTopics = async (_, res) => {

    res.setHeader('Content-Type', 'application/json')

    let data

    data = await new Promise(async (resolve, reject) => {
      let result
      try {
        result = await client.query(topicsQuery)
      } catch (err) {
        reject( { rows: [] } )
        console.log(err.message)
      } finally {
        resolve(result)
      }    
    })

    res.send(JSON.stringify(data.rows))

  }

  app.post('/api/v1/search', authenticateToken, doSearchQuery)
  app.post('/api/v1/topics', authenticateToken, doTopics)

  app.listen(apiPort, _ => 
    console.log('Seeker at port', apiPort)
  ).on('error', err => console.log(err.message))

})()

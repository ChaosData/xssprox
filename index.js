const express = require('express');
const WebSocket = require('ws');
const getRawBody = require('raw-body');

const ws = new WebSocket.Server({
  port: 3001,
  clientTracking: true
});

ws.on('connection', function connection(client) {
  client.on('message', (data) => {
    handleMessage(JSON.parse(data));
  });
});

var app = express();

app.use(function (req, res, next) {
  if ('content-length' in req.headers) {
    getRawBody(req, {
      length: req.headers['content-length'],
      limit: '1mb',
    }, function (err, buf) {
      if (err) return next(err)
      req.rawbuf = buf
      next()
    })
  } else {
    req.rawbuf = null
    next()
  }
})


app.all('*', function (req, res) { //no CONNECT
  let clients = ws.clients;
  if (clients.size == 0) {
    res.status(504).end();
    return;
  }
  for (let client of ws.clients) {
    request(client, req, res);
    return;
  }
})

app.listen(3000, function () {
})

let cid = 0;
let inflight = {};

function handleMessage(msg) {
  if (!(msg.id in inflight)) {
    return;
  }

  let res = inflight[msg.id];

  res.status(msg.status);
  res.set(msg.headers);

  if (msg.body === null) {
    res.end();
  } else {
    res.send(Buffer.from(msg.body, 'base64'));
  }

  delete inflight[msg.id];
}


function request(client, req, res) {
  if (client.readyState != WebSocket.OPEN) {
    res.status(504).end();
    return;
  }
  let id = ++cid;
  inflight[id] = res;

  let body = null;
  if (req.rawbuf != null) {
    body = req.rawbuf.toString('base64');
  }

  client.send(JSON.stringify({
    id: id,
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: body
  }));
}

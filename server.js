const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json({ limit: '50mb' }));
app.use(express.text({ limit: '50mb' }));
app.use(express.static('public'));

const DATA_DIR = 'data';
const BOTS_FILE = path.join(DATA_DIR, 'bots.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

let bots = new Map();
let wsConnections = new Map();

function loadBots() {
  if (fs.existsSync(BOTS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BOTS_FILE, 'utf8'));
      Object.entries(data).forEach(([id, bot]) => {
        bots.set(id, { ...bot, process: null, output: [] });
      });
    } catch (e) {
      console.error('Error loading bots:', e.message);
    }
  }
}

function saveBots() {
  const data = {};
  bots.forEach((bot, id) => {
    data[id] = {
      id: bot.id,
      name: bot.name,
      host: bot.host,
      port: bot.port,
      username: bot.username,
      version: bot.version,
      email: bot.email,
      password: bot.password
    };
  });
  fs.writeFileSync(BOTS_FILE, JSON.stringify(data, null, 2));
}

loadBots();

// API
app.get('/api/bots', (req, res) => {
  const list = Array.from(bots.values()).map(bot => ({
    id: bot.id,
    name: bot.name,
    host: bot.host,
    port: bot.port,
    username: bot.username,
    version: bot.version,
    running: bot.process !== null,
    uptime: bot.startTime ? Math.floor((Date.now() - bot.startTime) / 1000) : 0
  }));
  res.json(list);
});

app.post('/api/bots', (req, res) => {
  const { name, host, port, username, version, email, password } = req.body;
  if (!name || !host || !port || !username || !version || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const id = Math.random().toString(36).substring(7);
  const bot = {
    id,
    name,
    host,
    port: parseInt(port),
    username,
    version,
    email,
    password,
    process: null,
    startTime: null,
    output: []
  };

  bots.set(id, bot);
  saveBots();
  res.json({ success: true, id });
});

app.delete('/api/bots/:id', (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: 'Not found' });
  if (bot.process) bot.process.kill();
  bots.delete(req.params.id);
  saveBots();
  res.json({ success: true });
});

app.post('/api/bots/:id/start', (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot) return res.status(404).json({ error: 'Not found' });
  if (bot.process) return res.status(400).json({ error: 'Already running' });

  const code = `
const mineflayer = require('mineflayer');
const bot = mineflayer.createBot({
  host: '${bot.host}',
  port: ${bot.port},
  username: '${bot.username}',
  password: '${bot.password}',
  version: '${bot.version}',
  auth: 'microsoft'
});
bot.on('login', () => console.log('[LOGIN]'));
bot.on('spawn', () => {
  console.log('[SPAWN]');
  setTimeout(() => bot.chat('Bot online!'), 1000);
});
bot.on('error', e => console.error('[ERROR] ' + e.message));
bot.on('end', () => console.log('[END]'));
bot.on('kicked', r => console.error('[KICKED] ' + r));
`;

  bot.process = spawn('node', ['-e', code]);
  bot.startTime = Date.now();
  bot.output = [];

  bot.process.stdout.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      bot.output.push(line);
      if (bot.output.length > 500) bot.output.shift();
      broadcast(req.params.id, line);
    }
  });

  bot.process.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      bot.output.push('[ERR] ' + line);
      if (bot.output.length > 500) bot.output.shift();
      broadcast(req.params.id, '[ERR] ' + line);
    }
  });

  bot.process.on('close', () => {
    bot.process = null;
    bot.startTime = null;
    broadcast(req.params.id, '[CLOSED]');
  });

  res.json({ success: true });
});

app.post('/api/bots/:id/stop', (req, res) => {
  const bot = bots.get(req.params.id);
  if (!bot || !bot.process) return res.status(400).json({ error: 'Not running' });
  bot.process.kill();
  bot.process = null;
  bot.startTime = null;
  res.json({ success: true });
});

wss.on('connection', (ws) => {
  let botId = null;
  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.action === 'watch') {
      botId = data.id;
      if (!wsConnections.has(botId)) wsConnections.set(botId, []);
      wsConnections.get(botId).push(ws);
      const bot = bots.get(botId);
      if (bot) bot.output.forEach(line => ws.send(JSON.stringify({ line })));
    }
  });
  ws.on('close', () => {
    if (botId && wsConnections.has(botId)) {
      const arr = wsConnections.get(botId);
      arr.splice(arr.indexOf(ws), 1);
    }
  });
});

function broadcast(botId, line) {
  const conns = wsConnections.get(botId);
  if (conns) conns.forEach(ws => ws.readyState === 1 && ws.send(JSON.stringify({ line })));
}

const PORT = 3000;
server.listen(PORT, () => console.log(`\n✓ Bot Panel: http://localhost:${PORT}\n`));

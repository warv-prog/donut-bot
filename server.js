const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));
app.use(express.json());

// Store all bot instances
const bots = new Map();
const botConnections = new Map(); // WebSocket connections per bot

// Load saved bot configs
const CONFIG_FILE = 'bots-config.json';
let savedConfigs = {};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    savedConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (e) {
    console.error('Error loading saved configs:', e.message);
  }
}

// Save configs to file
function saveConfigs() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(savedConfigs, null, 2));
}

// Get all bots status
app.get('/api/bots', (req, res) => {
  const botsList = Array.from(bots.entries()).map(([id, bot]) => ({
    id,
    name: bot.name,
    running: bot.process !== null,
    config: bot.config,
    uptime: bot.startTime ? Date.now() - bot.startTime : 0,
    output: bot.output.slice(-50) // Last 50 lines
  }));
  res.json(botsList);
});

// Create new bot
app.post('/api/bots/create', (req, res) => {
  const { name, config } = req.body;
  const id = uuidv4().substring(0, 8);

  bots.set(id, {
    id,
    name,
    config,
    process: null,
    startTime: null,
    output: [],
    connections: []
  });

  savedConfigs[id] = { name, config };
  saveConfigs();

  res.json({ success: true, id, message: 'Bot created' });
});

// Delete bot
app.post('/api/bots/:id/delete', (req, res) => {
  const { id } = req.params;
  const bot = bots.get(id);

  if (!bot) {
    return res.json({ success: false, message: 'Bot not found' });
  }

  if (bot.process) {
    bot.process.kill();
  }

  bots.delete(id);
  delete savedConfigs[id];
  saveConfigs();

  res.json({ success: true, message: 'Bot deleted' });
});

// Update bot config
app.post('/api/bots/:id/config', (req, res) => {
  const { id } = req.params;
  const { config } = req.body;

  const bot = bots.get(id);
  if (!bot) {
    return res.json({ success: false, message: 'Bot not found' });
  }

  bot.config = config;
  savedConfigs[id].config = config;
  saveConfigs();

  res.json({ success: true, message: 'Config updated' });
});

// Start bot
app.post('/api/bots/:id/start', (req, res) => {
  const { id } = req.params;
  const bot = bots.get(id);

  if (!bot) {
    return res.json({ success: false, message: 'Bot not found' });
  }

  if (bot.process) {
    return res.json({ success: false, message: 'Bot already running' });
  }

  // Create bot.js with config
  const botScript = `
const mineflayer = require('mineflayer');
const botConfig = ${JSON.stringify(bot.config)};

console.log('[BOT] Starting with config:', {
  host: botConfig.host,
  port: botConfig.port,
  username: botConfig.username,
  version: botConfig.version
});

const bot = mineflayer.createBot({
  host: botConfig.host,
  port: botConfig.port,
  username: botConfig.username,
  accessToken: botConfig.accessToken,
  clientToken: botConfig.clientToken,
  auth: 'mojang',
  version: botConfig.version
});

bot.on('login', () => {
  console.log('[BOT] ✓ Logged in as', bot.username);
});

bot.on('spawn', () => {
  console.log('[BOT] ✓ Spawned in world');
  bot.chat('Bot online!');
});

bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  console.log('[CHAT] [' + username + '] ' + message);
});

bot.on('error', (err) => {
  console.error('[ERROR]', err.message);
});

bot.on('end', () => {
  console.log('[BOT] Disconnected');
  process.exit(0);
});

bot.on('kicked', (reason) => {
  console.error('[KICKED]', reason);
});
`;

  bot.process = spawn('node', ['-e', botScript], {
    stdio: 'pipe'
  });

  bot.startTime = Date.now();
  bot.output = [];

  bot.process.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l);
    lines.forEach(line => {
      bot.output.push(line);
      if (bot.output.length > 500) bot.output.shift(); // Keep last 500 lines
      broadcastToBot(id, line + '\n');
    });
  });

  bot.process.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l);
    lines.forEach(line => {
      bot.output.push(`[ERROR] ${line}`);
      if (bot.output.length > 500) bot.output.shift();
      broadcastToBot(id, `[ERROR] ${line}\n`);
    });
  });

  bot.process.on('close', (code) => {
    broadcastToBot(id, `\n[Bot process exited with code ${code}]\n`);
    bot.process = null;
    bot.startTime = null;
  });

  res.json({ success: true, message: 'Bot started' });
});

// Stop bot
app.post('/api/bots/:id/stop', (req, res) => {
  const { id } = req.params;
  const bot = bots.get(id);

  if (!bot) {
    return res.json({ success: false, message: 'Bot not found' });
  }

  if (!bot.process) {
    return res.json({ success: false, message: 'Bot not running' });
  }

  bot.process.kill();
  bot.process = null;
  bot.startTime = null;

  res.json({ success: true, message: 'Bot stopped' });
});

// WebSocket for real-time terminal per bot
wss.on('connection', (ws) => {
  let currentBotId = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    if (data.type === 'subscribe') {
      currentBotId = data.botId;
      if (!botConnections.has(currentBotId)) {
        botConnections.set(currentBotId, []);
      }
      botConnections.get(currentBotId).push(ws);

      const bot = bots.get(currentBotId);
      if (bot) {
        ws.send(JSON.stringify({ type: 'history', data: bot.output.join('\n') }));
      }
    }
  });

  ws.on('close', () => {
    if (currentBotId && botConnections.has(currentBotId)) {
      const connections = botConnections.get(currentBotId);
      const index = connections.indexOf(ws);
      if (index > -1) {
        connections.splice(index, 1);
      }
    }
  });
});

function broadcastToBot(botId, data) {
  const connections = botConnections.get(botId);
  if (connections) {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });
  }
}

// Load initial bots from config
Object.entries(savedConfigs).forEach(([id, { name, config }]) => {
  bots.set(id, {
    id,
    name,
    config,
    process: null,
    startTime: null,
    output: [],
    connections: []
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🤖 Multi-Bot Control Panel running on http://localhost:${PORT}`);
});

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
const botConnections = new Map();

// Cache directory for auth sessions
const CACHE_DIR = path.join(__dirname, 'cache');
const CONFIG_FILE = 'bots-config.json';
let savedConfigs = {};

// Create cache directory if it doesn't exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

if (fs.existsSync(CONFIG_FILE)) {
  try {
    savedConfigs = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (e) {
    console.error('Error loading saved configs:', e.message);
  }
}

function saveConfigs() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(savedConfigs, null, 2));
}

// Get cached accounts
app.get('/api/cache/accounts', (req, res) => {
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    const accounts = files.map(f => {
      const filePath = path.join(CACHE_DIR, f);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        id: f.replace('.json', ''),
        email: data.email || 'Unknown',
        profile: data.profile || {}
      };
    });
    res.json(accounts);
  } catch (error) {
    console.error('Error reading cache:', error);
    res.json([]);
  }
});

// Delete cached account
app.post('/api/cache/delete/:id', (req, res) => {
  try {
    const filePath = path.join(CACHE_DIR, `${req.params.id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Cache deleted' });
    } else {
      res.json({ success: false, message: 'Cache not found' });
    }
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// Get all bots status
app.get('/api/bots', (req, res) => {
  const botsList = Array.from(bots.entries()).map(([id, bot]) => ({
    id,
    name: bot.name,
    running: bot.process !== null,
    config: bot.config,
    uptime: bot.startTime ? Date.now() - bot.startTime : 0,
    output: bot.output.slice(-50)
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

// Login and cache account
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const { Authenticator } = require('prismarine-auth');
    const cacheId = email.replace(/[^a-z0-9]/gi, '_');
    const cachePath = path.join(CACHE_DIR, `${cacheId}.json`);
    
    console.log(`[AUTH] Logging in ${email}...`);
    
    const auth = new Authenticator();
    await auth.loginToMicrosoft(email, password, { cache: cachePath });
    
    const profile = auth.getSelectedProfile();
    const accessToken = auth.accessToken;
    
    // Save cache with metadata
    const cacheData = {
      email,
      profile: profile,
      accessToken,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
    
    res.json({
      success: true,
      message: 'Logged in and cached',
      cacheId,
      profile
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error.message);
    res.json({
      success: false,
      message: error.message
    });
  }
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

  // Get auth method and prepare bot script
  const authMethod = bot.config.authMethod || 'cached';
  let botScript;

  if (authMethod === 'cached') {
    const cachePath = path.join(CACHE_DIR, `${bot.config.cacheId}.json`);
    const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    
    botScript = `
const mineflayer = require('mineflayer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const botConfig = ${JSON.stringify(bot.config)};
const cachePath = ${JSON.stringify(cachePath)};

console.log('[BOT] Starting with cached session:', {
  host: botConfig.host,
  port: botConfig.port,
  username: botConfig.username,
  version: botConfig.version,
  auth: 'microsoft',
  cache: 'ENABLED'
});

const { Authenticator } = require('prismarine-auth');
const auth = new Authenticator();

// Load cached session
auth.getAuth('microsoft', { cache: cachePath }).then(async (session) => {
  console.log('[BOT] ✓ Using cached session');
  
  const bot = mineflayer.createBot({
    host: botConfig.host,
    port: botConfig.port,
    username: botConfig.username,
    auth: 'microsoft',
    version: botConfig.version,
    authTitle: 'Mineflayer',
    session
  });

  bot.on('login', () => {
    console.log('[BOT] ✓ Logged in as', bot.username);
  });

  bot.on('spawn', () => {
    console.log('[BOT] ✓ Spawned in world');
    setTimeout(() => {
      bot.chat('Bot online!');
    }, 1000);
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
}).catch(err => {
  console.error('[AUTH ERROR]', err.message);
  console.error('Cache may be expired. Please login again.');
  process.exit(1);
});
`;
  } else {
    // Fresh login
    botScript = `
const mineflayer = require('mineflayer');
const { Authenticator } = require('prismarine-auth');
const path = require('path');
const fs = require('fs');

const botConfig = ${JSON.stringify(bot.config)};
const cachePath = ${JSON.stringify(path.join(CACHE_DIR, `${bot.config.email.replace(/[^a-z0-9]/gi, '_')}.json`))};

console.log('[BOT] Starting with Microsoft login:', {
  host: botConfig.host,
  port: botConfig.port,
  username: botConfig.username,
  version: botConfig.version
});

const auth = new Authenticator();
auth.getAuth('microsoft', { cache: cachePath }).then(async (session) => {
  console.log('[BOT] ✓ Microsoft auth successful');
  
  const bot = mineflayer.createBot({
    host: botConfig.host,
    port: botConfig.port,
    username: botConfig.username,
    auth: 'microsoft',
    version: botConfig.version,
    authTitle: 'Mineflayer',
    session
  });

  bot.on('login', () => {
    console.log('[BOT] ✓ Logged in as', bot.username);
  });

  bot.on('spawn', () => {
    console.log('[BOT] ✓ Spawned in world');
    setTimeout(() => {
      bot.chat('Bot online!');
    }, 1000);
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
}).catch(err => {
  console.error('[AUTH ERROR]', err.message);
  process.exit(1);
});
`;
  }

  bot.process = spawn('node', ['-e', botScript], {
    stdio: 'pipe',
    env: { ...process.env }
  });

  bot.startTime = Date.now();
  bot.output = [];

  bot.process.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l);
    lines.forEach(line => {
      bot.output.push(line);
      if (bot.output.length > 500) bot.output.shift();
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
  console.log(`📁 Cache directory: ${CACHE_DIR}`);
});

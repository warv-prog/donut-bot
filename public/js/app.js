const Term = window.Terminal;
const FitAddon = window.FitAddon;

let currentBotId = null;
let currentTerm = null;
let ws = null;

// Initialize WebSocket
function initWebSocket() {
  ws = new WebSocket(`ws://${window.location.host}`);
  ws.onopen = () => console.log('WebSocket connected');
  ws.onclose = () => {
    console.log('WebSocket disconnected, reconnecting...');
    setTimeout(initWebSocket, 3000);
  };
  ws.onerror = (e) => console.error('WebSocket error:', e);
  ws.onmessage = handleWebSocketMessage;
}

initWebSocket();

// Handle WebSocket messages
function handleWebSocketMessage(e) {
  const msg = JSON.parse(e.data);
  if (currentTerm) {
    if (msg.type === 'history') {
      currentTerm.write(msg.data);
    } else if (msg.type === 'output') {
      currentTerm.write(msg.data);
    }
  }
}

// Load and display bots
async function loadBots() {
  try {
    const response = await fetch('/api/bots');
    const botsList = await response.json();

    const botListEl = document.getElementById('botList');
    botListEl.innerHTML = '';

    botsList.forEach(bot => {
      const botEl = document.createElement('div');
      botEl.className = 'bot-item' + (bot.id === currentBotId ? ' active' : '');
      botEl.onclick = () => selectBot(bot.id);

      const uptime = bot.uptime > 0
        ? ` (${Math.floor(bot.uptime / 1000)}s)`
        : '';

      botEl.innerHTML = `
        <button class="delete-btn" onclick="deleteBot('${bot.id}', event)">×</button>
        <div class="bot-name">${bot.name}</div>
        <div class="bot-status ${bot.running ? 'running' : 'stopped'}">
          ${bot.running ? '● Running' : '● Stopped'}${uptime}
        </div>
      `;

      botListEl.appendChild(botEl);
    });
  } catch (error) {
    console.error('Error loading bots:', error);
  }
}

// Select and view bot
function selectBot(botId) {
  currentBotId = botId;
  loadBots();

  fetch('/api/bots').then(r => r.json()).then(bots => {
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;

    // Update header
    document.getElementById('mainHeader').textContent = `🤖 ${bot.name} - ${bot.running ? '● Running' : '● Stopped'}`;

    // Setup terminal
    const content = document.getElementById('content');
    content.innerHTML = `
      <div style="padding: 15px; background: #252526; border-bottom: 1px solid #3e3e42; display: flex; gap: 10px;">
        <button onclick="startBot('${botId}')" style="flex: 1; background: #4caf50;">Start</button>
        <button onclick="stopBot('${botId}')" class="danger" style="flex: 1;">Stop</button>
        <button onclick="updateBotConfig('${botId}')" style="flex: 1; background: #ff9800;">Update Config</button>
      </div>
      <div class="terminal-container" id="terminalBox"></div>
    `;

    // Create terminal
    currentTerm = new Term({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#e0e0e0',
        cursor: '#fff'
      }
    });

    const fitAddon = new FitAddon.FitAddon();
    currentTerm.loadAddon(fitAddon);
    currentTerm.open(document.getElementById('terminalBox'));
    fitAddon.fit();

    window.addEventListener('resize', () => fitAddon.fit());

    // Subscribe to bot output
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', botId }));
    }
  });
}

// Create new bot
async function createBot() {
  const name = document.getElementById('botName').value.trim();
  if (!name) {
    alert('Bot name required');
    return;
  }

  const host = document.getElementById('botHost').value.trim();
  if (!host) {
    alert('Server host required');
    return;
  }

  const username = document.getElementById('botUsername').value.trim();
  if (!username) {
    alert('Bot username required');
    return;
  }

  const token = document.getElementById('botToken').value.trim();
  if (!token) {
    alert('Access token required');
    return;
  }

  const config = {
    host: host,
    port: parseInt(document.getElementById('botPort').value),
    username: username,
    accessToken: token,
    clientToken: document.getElementById('botClientToken').value.trim() || uuidv4(),
    version: document.getElementById('botVersion').value
  };

  try {
    const response = await fetch('/api/bots/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config })
    });

    const result = await response.json();
    if (result.success) {
      document.getElementById('botName').value = '';
      document.getElementById('botHost').value = '';
      document.getElementById('botUsername').value = '';
      document.getElementById('botToken').value = '';
      document.getElementById('botClientToken').value = '';
      loadBots();
      alert(`Bot created with ID: ${result.id}`);
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error creating bot:', error);
    alert('Failed to create bot');
  }
}

// Start bot
async function startBot(botId) {
  try {
    const response = await fetch(`/api/bots/${botId}/start`, { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      loadBots();
      selectBot(botId);
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error starting bot:', error);
  }
}

// Stop bot
async function stopBot(botId) {
  try {
    const response = await fetch(`/api/bots/${botId}/stop`, { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      loadBots();
      selectBot(botId);
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error stopping bot:', error);
  }
}

// Delete bot
async function deleteBot(botId, event) {
  event.stopPropagation();
  if (!confirm('Delete this bot?')) return;

  try {
    const response = await fetch(`/api/bots/${botId}/delete`, { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      if (currentBotId === botId) currentBotId = null;
      loadBots();
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error deleting bot:', error);
  }
}

// Update bot config
async function updateBotConfig(botId) {
  const host = prompt('Server Host:');
  if (!host) return;
  const port = prompt('Port:', '25565');
  const username = prompt('Bot Username:');
  const version = prompt('Version:', '1.21');

  try {
    const response = await fetch(`/api/bots/${botId}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: { host, port: parseInt(port), username, version }
      })
    });

    const result = await response.json();
    if (result.success) {
      loadBots();
      alert('Config updated');
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error updating config:', error);
  }
}

// Generate UUID
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Auto-refresh bots every 2 seconds
setInterval(loadBots, 2000);
loadBots();

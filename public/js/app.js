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

// Toggle auth fields
function toggleAuthFields() {
  const method = document.getElementById('authMethod').value;
  const microsoftFields = document.getElementById('microsoftFields');
  const cachedFields = document.getElementById('cachedFields');
  
  if (method === 'microsoft') {
    microsoftFields.style.display = 'block';
    cachedFields.style.display = 'none';
  } else {
    microsoftFields.style.display = 'none';
    cachedFields.style.display = 'block';
    loadCachedAccounts();
  }
}

// Load cached accounts
async function loadCachedAccounts() {
  try {
    const response = await fetch('/api/cache/accounts');
    const accounts = await response.json();
    
    const select = document.getElementById('cachedAccount');
    select.innerHTML = '<option value="">Select account...</option>';
    
    accounts.forEach(acc => {
      const option = document.createElement('option');
      option.value = acc.id;
      option.textContent = acc.email || acc.id;
      select.appendChild(option);
    });
    
    // Update cache management
    const cacheList = document.getElementById('cacheList');
    cacheList.innerHTML = '';
    
    accounts.forEach(acc => {
      const item = document.createElement('div');
      item.className = 'cache-item';
      const date = new Date(acc.timestamp || Date.now()).toLocaleDateString();
      item.innerHTML = `
        <div class="cache-item-info">
          <div class="cache-item-email">✓ ${acc.email}</div>
          <div class="cache-item-time">${date}</div>
        </div>
        <button class="cache-delete-btn danger" onclick="deleteCacheAccount('${acc.id}')">✕</button>
      `;
      cacheList.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading cached accounts:', error);
  }
}

// Delete cache account
async function deleteCacheAccount(id) {
  if (!confirm('Delete this cached account?')) return;
  
  try {
    const response = await fetch(`/api/cache/delete/${id}`, { method: 'POST' });
    const result = await response.json();
    if (result.success) {
      loadCachedAccounts();
    }
  } catch (error) {
    console.error('Error deleting cache:', error);
  }
}

// Login and cache
async function loginAndCache() {
  const email = document.getElementById('botEmail').value.trim();
  const password = document.getElementById('botPassword').value.trim();
  
  if (!email || !password) {
    alert('Email and password required');
    return;
  }
  
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = 'Logging in...';
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(`✓ Account cached! Ready to use.\n${result.profile?.name || email}`);
      document.getElementById('botEmail').value = '';
      document.getElementById('botPassword').value = '';
      
      // Switch to cached method
      document.getElementById('authMethod').value = 'cached';
      toggleAuthFields();
      loadCachedAccounts();
    } else {
      alert(`❌ Login failed: ${result.message}`);
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Login & Cache';
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

    document.getElementById('mainHeader').textContent = `🤖 ${bot.name} - ${bot.running ? '● Running' : '● Stopped'}`;

    const content = document.getElementById('content');
    content.innerHTML = `
      <div style="padding: 15px; background: #252526; border-bottom: 1px solid #3e3e42; display: flex; gap: 10px;">
        <button onclick="startBot('${botId}')" style="flex: 1; background: #4caf50;">Start</button>
        <button onclick="stopBot('${botId}')" class="danger" style="flex: 1;">Stop</button>
        <button onclick="updateBotConfig('${botId}')" style="flex: 1; background: #ff9800;">Update Config</button>
      </div>
      <div class="terminal-container" id="terminalBox"></div>
    `;

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

  const authMethod = document.getElementById('authMethod').value;
  let config;

  if (authMethod === 'cached') {
    const cacheId = document.getElementById('cachedAccount').value;
    if (!cacheId) {
      alert('Select a cached account');
      return;
    }
    
    config = {
      host,
      port: parseInt(document.getElementById('botPort').value),
      username,
      version: document.getElementById('botVersion').value,
      authMethod: 'cached',
      cacheId
    };
  } else {
    const email = document.getElementById('botEmail').value.trim();
    if (!email) {
      alert('Microsoft email required');
      return;
    }
    
    config = {
      host,
      port: parseInt(document.getElementById('botPort').value),
      username,
      version: document.getElementById('botVersion').value,
      authMethod: 'microsoft',
      email
    };
  }

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
      loadBots();
      alert(`✓ Bot created with ID: ${result.id}`);
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

// Initialize on load
window.addEventListener('load', () => {
  loadBots();
  loadCachedAccounts();
  setInterval(loadBots, 2000);
});

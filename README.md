# 🤖 Multi-Bot Control Panel

A web-based control panel for managing multiple Mineflayer bots simultaneously on Donut SMP and other Minecraft servers.

## Features

✅ **Run unlimited bots at once**  
✅ **Web UI dashboard**  
✅ **Real-time terminal output per bot**  
✅ **Start/Stop/Delete bots**  
✅ **Mojang authentication (access tokens)**  
✅ **Auto-saves bot configs**  
✅ **Uptime tracking**  
✅ **Version 1.21+ support**  

## Folder Structure

```
donut-bot/
├── server.js                 # Express server + WebSocket
├── package.json              # Dependencies
├── bots-config.json          # Auto-generated bot configs
├── public/
│   ├── index.html            # Main UI
│   ├── css/
│   │   └── style.css         # Styles
│   └── js/
│       └── app.js            # Client-side logic
└── README.md                 # This file
```

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/warv-prog/donut-bot.git
   cd donut-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the server:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   ```
   http://localhost:3000
   ```

## How to Use

### Create a Bot
1. Fill in the form on the left sidebar:
   - **Bot Name**: Any name (e.g., "Donut Bot 1")
   - **Server Host**: Server IP or domain (e.g., donut-smp.com)
   - **Port**: Default 25565
   - **Username**: Bot's Minecraft username
   - **Access Token**: Your Mojang access token
   - **Client Token**: Can be any UUID (auto-generated if empty)
   - **Version**: Minecraft version (1.21, 1.21.1, etc.)
2. Click "Create Bot"

### Start a Bot
1. Click on a bot from the list
2. Click "Start" button
3. Watch the terminal output

### Stop a Bot
1. Click on the running bot
2. Click "Stop" button

### Delete a Bot
1. Hover over a bot in the list
2. Click the red "×" button

## Getting Access Token

### Option 1: Using Prismarine Auth (Recommended)

```bash
npm install prismarine-auth
```

Create `get-token.js`:
```javascript
const { Authenticator } = require('prismarine-auth');

const auth = new Authenticator();
auth.loginToMicrosoft().then(async () => {
  const profile = auth.getSelectedProfile();
  console.log('Access Token:', auth.accessToken);
  console.log('Profile:', profile);
  process.exit(0);
});
```

Run:
```bash
node get-token.js
```

### Option 2: From Minecraft Launcher
If you have Minecraft Launcher installed:
1. Find `launcher_accounts.json` in your `.minecraft` folder
2. Copy the `accessToken` from there

### Option 3: Manual Token
Get from your Mojang account settings or use launcher tools.

## Anti-Bot Bypass & Detection

⚠️ **Important:** This system does NOT automatically bypass anti-bot systems.

Servers like Donut SMP have anti-bot protections that may include:
- **IP blacklisting**: Multiple accounts from same IP
- **UUID detection**: Detects bot UUIDs
- **Join speed limits**: Kicks if too many join too fast
- **Movement analysis**: Detects unnatural bot movement
- **Chat patterns**: Detects repetitive/bot-like messages
- **Captcha/Verification**: May require solving puzzles
- **Rate limiting**: Limits join attempts per IP

### Tips to Improve Compatibility:

1. **Use Different IPs/Proxies**
   - Each bot should have different IP if possible
   - Use VPNs (if server allows)
   - Spread out across multiple networks

2. **Vary Bot Behavior**
   - Different usernames
   - Vary join times (add delays)
   - Random movement patterns
   - Realistic chat intervals

3. **Spread Join Times**
   - Don't start all bots at once
   - Add 5-10 second delays between starts
   - Stagger activity

4. **Check Server Rules**
   - Some servers allow bots
   - Others explicitly forbid them
   - Read Donut SMP rules first

5. **Add Anti-Detection Code**

Modify the bot behavior in `server.js` to add:
```javascript
// Random delays
setTimeout(() => {
  bot.chat('Hello!');
}, Math.random() * 5000 + 2000);

// Random movement
const movements = ['forward', 'left', 'right', 'back'];
setInterval(() => {
  const move = movements[Math.floor(Math.random() * movements.length)];
  bot.setControlState(move, Math.random() > 0.5);
}, 3000);
```

6. **Monitor for Kicks**
   - Check the terminal output
   - If kicked repeatedly, adjust strategy
   - Some servers may have whitelist requirements

## Configuration File

Bots are automatically saved in `bots-config.json`:
```json
{
  "abc12345": {
    "name": "Bot 1",
    "config": {
      "host": "donut-smp.com",
      "port": 25565,
      "username": "BotName1",
      "version": "1.21"
    }
  },
  "def67890": {
    "name": "Bot 2",
    "config": {
      "host": "donut-smp.com",
      "port": 25565,
      "username": "BotName2",
      "version": "1.21"
    }
  }
}
```

## Troubleshooting

### Bot won't connect
- ✅ Check server IP/port
- ✅ Verify access token is valid
- ✅ Confirm server is online
- ✅ Check terminal output for errors
- ✅ Check if bot username is banned

### SocketError
- ✅ Server might be down
- ✅ Firewall blocking port 25565
- ✅ Wrong server address
- ✅ Network connectivity issue

### Token expired
- ✅ Get a new access token
- ✅ Update bot config
- ✅ Restart bot

### Bot gets kicked
- ✅ Anti-bot detection (most likely)
- ✅ Server full
- ✅ Username already connected
- ✅ Server maintenance
- ✅ Whitelist required

### Multiple bots not connecting
- ✅ Use different IPs if possible
- ✅ Stagger join times
- ✅ Check rate limiting
- ✅ Verify different usernames

## API Endpoints

- `GET /api/bots` - List all bots
- `POST /api/bots/create` - Create new bot
- `POST /api/bots/:id/start` - Start bot
- `POST /api/bots/:id/stop` - Stop bot
- `POST /api/bots/:id/delete` - Delete bot
- `POST /api/bots/:id/config` - Update config
- `WS /` - WebSocket for terminal streaming

## License

MIT

## Disclaimer

⚠️ Use responsibly. Not for malicious purposes. Respect server rules and terms of service.

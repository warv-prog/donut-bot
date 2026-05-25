# 🤖 Multi-Bot Control Panel with Cached Sessions

A web-based control panel for managing multiple Mineflayer bots simultaneously on Donut SMP and other Minecraft servers. Now with **session caching** support!

## ✨ New Features

✅ **Cached Microsoft Sessions** - Login once, use cached tokens forever  
✅ **No password storage** - Only secure tokens cached  
✅ **Multiple cached accounts** - Manage different accounts  
✅ **Cache management UI** - Delete expired sessions  
✅ **Run unlimited bots** - All simultaneously  
✅ **Real-time terminal** - Watch each bot independently  
✅ **Version 1.21+ support** - Latest Minecraft  

## 📦 Installation

```bash
# Clone
git clone https://github.com/warv-prog/donut-bot.git
cd donut-bot

# Install
npm install

# Run
npm start
```

Visit: **http://localhost:3000**

## 🎯 How to Use

### Step 1: Cache Your Microsoft Account (First Time Only)

1. In the sidebar, select **"Login with Microsoft"**
2. Enter your Microsoft/Minecraft email
3. Enter your password
4. Click **"Login & Cache"**
5. Password is NOT saved, only session tokens ✅

### Step 2: Create Bots Using Cached Sessions

1. Select **"Use Cached Session"** (default)
2. Choose your account from dropdown
3. Fill in:
   - Bot Name
   - Server Host (e.g., donutsmp.net)
   - Port (25565)
   - Bot Username
   - Version (1.21)
4. Click **"Create Bot"**

### Step 3: Start & Monitor

1. Click bot name from list
2. Click **"Start"** button
3. Watch terminal output
4. Multiple bots run simultaneously!

## 📁 Folder Structure

```
donut-bot/
├── server.js                 # Express + caching logic
├── package.json              # Dependencies
├── bots-config.json          # Auto-saved bot configs
├── cache/                    # 🆕 Session cache folder
│   ├── account1@mail_com.json
│   └── account2@mail_com.json
└── public/
    ├── index.html            # UI
    ├── css/
    │   └── style.css         # Styling
    └── js/
        └── app.js            # Frontend logic
```

## 🔐 Security Features

✅ **No passwords saved** - Only Microsoft session tokens  
✅ **Local caching only** - Sessions stored on YOUR computer  
✅ **Cache expiration** - Tokens refresh automatically  
✅ **Manage cache** - Delete accounts from UI  
✅ **Never shared** - No cloud upload  

## 🎮 Running Multiple Bots

**From one cached account:**
```
1. Create "Bot 1" → Start
2. Create "Bot 2" → Start
3. Create "Bot 3" → Start

All run simultaneously with shared cache!
```

**From multiple accounts:**
```
1. Cache account A
2. Cache account B
3. Create bots from each account
4. All run independently
```

## ⚠️ About Anti-Bot Detection

Donut SMP and most servers have anti-bot protections:
- **Join rate limits** - Too many bots from same IP = ban
- **UUID detection** - Detects bot patterns
- **Whitelist required** - May need approval
- **Chat/Movement analysis** - Detects bot behavior

### Tips:
- Use different proxies/IPs per bot if possible
- Stagger bot starts (5-10 second delays)
- Add random movement/chat patterns
- Check server rules first

## 🆘 Troubleshooting

### "Cache expired" error
- Login again with Microsoft to refresh
- Cache automatically handles token renewal

### Bot won't connect
- Verify server IP/port
- Check cache is valid
- Look at terminal output

### Multiple bots kicked
- Likely anti-bot detection
- Use different IPs/proxies
- Space out bot joins
- Modify bot behavior to seem human-like

### Cache not showing
- Refresh page
- Check browser console for errors
- Restart server

## 📝 Config Files

**bots-config.json** - Bot configuration:
```json
{
  "abc12345": {
    "name": "Bot 1",
    "config": {
      "host": "donutsmp.net",
      "port": 25565,
      "username": "BotName",
      "version": "1.21",
      "authMethod": "cached",
      "cacheId": "account@mail_com"
    }
  }
}
```

**cache/account@mail_com.json** - Session tokens (auto-managed):
```json
{
  "email": "account@mail.com",
  "accessToken": "...",
  "profile": {...},
  "timestamp": 1234567890
}
```

## 🚀 Advanced Usage

### Use Fresh Login Each Time

In bot creation, select **"Login with Microsoft"** instead of cached.
Useful for testing or one-time bots.

### Clear All Cache

```bash
rm -rf cache/
```

Or delete individual accounts from UI.

### Check Cache Folder Size

```bash
ls -lh cache/
```

Cache files are small (~1-5KB each).

## 📚 API Endpoints

**Auth:**
- `POST /api/auth/login` - Login & cache account
- `GET /api/cache/accounts` - List cached accounts
- `POST /api/cache/delete/:id` - Delete cache

**Bots:**
- `GET /api/bots` - List all bots
- `POST /api/bots/create` - Create new bot
- `POST /api/bots/:id/start` - Start bot
- `POST /api/bots/:id/stop` - Stop bot
- `POST /api/bots/:id/delete` - Delete bot
- `WS /` - Terminal streaming

## 🔄 Update

```bash
git pull
npm install
npm start
```

## 📖 Commands

```bash
# Start app
npm start

# Stop app
Ctrl + C

# Clear cache
rm -rf cache/

# View Node version
node --version
```

## ⚖️ License

MIT

## ⚠️ Disclaimer

Use responsibly. Respect server rules and terms of service. Not for malicious purposes.

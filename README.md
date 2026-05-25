# Bot Panel v3 - Simple & Direct

## Setup

```bash
git pull
npm install
npm start
```

Visit: `http://localhost:3000`

## Usage

### Option 1: Upload Credentials File

1. Create `creds.txt`:
```
email@microsoft.com:password123
email2@microsoft.com:password456
```

2. Click "Load .txt File"
3. Fill bot details
4. Click "Create Bot"
5. Click "Start"

### Option 2: Manual Entry

1. Fill email/password directly in form
2. Fill bot details
3. Click "Create Bot"
4. Click "Start"

## File Format

**creds.txt:**
```
email:password
email:password
email:password
```

One per line, separated by colon.

## Data Storage

- `data/bots.json` - Bot configurations (includes email/password)

## That's it

No complex caching. No auth libraries. Just email:password and run.

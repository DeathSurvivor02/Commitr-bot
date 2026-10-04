# Commitr-bot

A small background tool that tracks your daily coding activity and posts a clean standup summary directly to Discord.

It monitors the folders you're working in, checks your git changes, calculates how long you were actually coding (ignoring idle breaks), and posts an embed with your stats so you don't have to write manual standup updates.

---

## What It Tracks

- **Active Coding Time:** Counts minutes you're actively saving and editing files. Pauses if you step away for more than 10 minutes (customizable).
- **Git Impact:** Runs a quick local `git diff --stat` to count added and deleted lines for the day.
- **Top Languages:** Breaks down your changes by file extension (`.ts`, `.cs`, `.cpp`, `.py`, `.sql`, etc.).
- **Commits:** Pulls your commit messages made today so you have a tidy changelog.
- **Bot Sync:** Automatically syncs live metrics over to the local tracker bot API (`http://localhost:3000/api/metrics`) if it's running.

---

## Quick Start

### 1. Install dependencies
Make sure you have Node.js 18+ installed.

```bash
npm install
```

### 2. Configure `.env`
Copy the sample environment file:

```bash
cp .env.template .env
```

Open `.env` and fill in your details:

```ini
# Your Discord channel webhook (Server Settings -> Integrations -> Webhooks)
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/your/webhook/url"

# Folders to watch, separated by commas (defaults to current folder)
WATCH_DIRECTORIES="."

# When to post the daily summary automatically (24-hour time HH:mm)
DISPATCH_TIME="18:00"

# Minutes of inactivity before the active timer pauses
IDLE_TIMEOUT_MINUTES=10
```

---

## How to Run

### Post today's progress right now
```bash
npm start -- --now
```

### Preview the Discord embed in your terminal without posting
```bash
npm start -- --dry-run
```

### Run as a background daemon
Keeps running, monitors file saves, and automatically posts to Discord at your scheduled `DISPATCH_TIME`:
```bash
npm start -- --daemon
```

### Run tests
```bash
npm test
```

---

## File Noise Filtering

Commitr-bot automatically skips build artifacts and editor junk so your metrics stay accurate. It ignores:
- `node_modules/`, `dist/`, `build/`, `bin/`, `obj/`
- `.git/`, `.vs/`, `.vscode/`, `.idea/`, `.gradle/`
- `__pycache__/`, `.venv/`, `venv/`
- `.log`, `.tmp`, `.swp`, `.bak`, `.dll`, `.exe`, `.pdb`
- System files like `.DS_Store` and `Thumbs.db`

---

## License

[MIT](LICENSE)

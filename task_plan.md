# Implementation Plan: Automated Developer Activity & Telemetry Discord Reporter

## Objective
Build and configure a local background service that tracks workspace edits, computes daily metrics, and dispatches a formatted daily standup summary embed to a designated Discord channel.

---

### Phase 1: Environment & Project Scaffolding
- [x] Initialize repository structure:
  - `src/collector/` (Event listeners, file watcher, Git diff parser)
  - `src/aggregator/` (Session timing, line-count buffers, idle detector)
  - `src/dispatcher/` (Discord webhook/REST client, rate-limit retry logic)
  - `src/storage/` (Local SQLite or JSON cache for daily persistence)
- [x] Add `.env.template` containing:
  - `DISCORD_WEBHOOK_URL=`
  - `WATCH_DIRECTORIES=`
  - `DISPATCH_TIME="18:00"` (or on-demand trigger)
  - `IDLE_TIMEOUT_MINUTES=10`
- [x] Add `.gitignore` ignoring build artifacts, local telemetry cache, and `.env`.

---

### Phase 2: Telemetry & Activity Monitoring Engine
- [x] Implement workspace change detection:
  - Attach file system observers to ignore noise (`node_modules`, `bin/`, `obj/`, `.git/`, temporary editor swap files).
  - Track timestamps of save/change events to calculate active coding intervals.
- [x] Implement Git metrics collector:
  - Execute localized `git diff --stat` against the start of the day.
  - Parse output to extract inserted/deleted line counts and group by file extension (`.cpp`, `.cs`, `.java`, `.sql`).
- [x] Implement persistence:
  - Periodically flush current day metrics to `.telemetry/state.json` to prevent data loss on crashes.

---

### Phase 3: Aggregator & Standup Formatter
- [x] Group raw events into a high-level `DailySummary` model:
  - Total Active Duration (hours/minutes minus idle gaps)
  - Commits Made (`git log --since="today" --oneline`)
  - Lines Changed (`+X / -Y`)
  - Primary Languages Worked On
- [x] Construct Discord Embed payload:
  - Embed Title: `🛠️ Daily Developer Activity Log - [Date]`
  - Fields:
    - `⏱️ Active Time`: e.g., `3h 45m`
    - `📊 Net Code Impact`: `+320 / -85 lines`
    - `📁 Top File Types`: `C# (65%), C++ (25%), SQL (10%)`
    - `📝 Key Commits`: Bulleted list of today's commit messages

---

### Phase 4: Network Dispatcher & Error Resilience
- [x] Implement HTTP POST client pointing to Discord Webhook URL.
- [x] Build retry middleware:
  - Handle HTTP 429 (Rate Limit): Read `Retry-After` header and delay accordingly.
  - Handle HTTP 5xx: Apply exponential backoff (1s, 2s, 4s, up to 3 attempts).
- [x] Add CLI flags:
  - `--daemon`: Run continuously in the background and dispatch at the configured schedule.
  - `--now`: Immediately summarize and post today's current progress to Discord.
  - `--dry-run`: Output the generated JSON embed payload to the console without sending.

---

### Phase 5: Verification & Testing
- [x] **Unit Tests**:
  - Test Git diff output parsing against sample git terminal dumps.
  - Test session idle interval calculations (verify gaps >10 min do not count toward active time).
- [x] **Integration Test**:
  - Run with `--dry-run` to verify embed JSON formatting against Discord API specs.
  - Trigger `--now` to send a live test message to a private Discord test channel.
- [x] **Artifact Generation**:
  - Produce an Antigravity Walkthrough artifact documenting setup, configuration, and execution flags.
---
trigger: always_on
---

# Role & Architecture Guidelines: Developer Telemetry & Discord Reporting Service

## Primary Objective
Develop a production-grade, event-driven developer activity reporter. The service collects editing telemetry and Git workspace diffs, aggregates sessions locally, and dispatches structured daily standup summaries to Discord via webhooks or bot gateway.

## Technology & Engineering Constraints
1. **Backend / Core Engine**:
   - Implement the core service in **C# (.NET 8/9 console daemon)** or **Node.js/TypeScript**.
   - Do NOT use heavy, slow web scrapers or unoptimized polling loops.
   - Separate telemetry gathering, metrics aggregation, and network transport into distinct decoupled modules.
2. **Telemetry Source**:
   - Primary: Monitor workspace changes using local file system change hooks (`FileSystemWatcher` in .NET or `chokidar` in Node.js) paired with local Git CLI queries (`git diff --shortstat`, `git log --since="midnight"`).
   - Track: Files modified, net insertions/deletions, active session duration (idle timeout threshold: 10 minutes), and language breakdowns.
3. **Resilience & Rate Limiting**:
   - Discord API webhooks enforce strict rate limits (30 requests/min per webhook).
   - Implement an in-memory batch buffer with exponential backoff and retry logic for network timeouts and HTTP 429 errors.
   - Keep a local persistent SQLite or flat-file state store (`.telemetry/state.json`) so session stats survive app restarts or machine reboots.
4. **Discord Output Standards**:
   - Use Discord Rich Embed format (`title`, `fields`, `footer`, timestamps, hexadecimal color accents).
   - Summary must include:
     - Total Active Coding Duration
     - Top Languages / File Types Touched
     - Total Lines Inserted (+) and Deleted (-)
     - Recent Commit Summaries (if any)
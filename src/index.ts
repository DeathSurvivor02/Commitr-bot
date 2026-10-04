import { Command } from 'commander';
import dotenv from 'dotenv';
import { CronJob } from 'cron';
import { FileWatcher } from './collector/watcher';
import { TelemetryStore } from './storage';
import { SessionTracker } from './aggregator/session';
import { DailySummaryAggregator } from './aggregator/summary';
import { DiscordDispatcher } from './dispatcher';

import path from 'path';
import { GitCollector } from './collector/git';

dotenv.config();

const program = new Command();

program
  .name('commitr-bot')
  .description('Developer Telemetry & Discord Reporting Service')
  .version('1.0.0')
  .option('-d, --daemon', 'Run continuously in background mode with scheduled daily dispatch')
  .option('-n, --now', 'Immediately summarize and dispatch current progress to Discord')
  .option('--dry-run', 'Print the formatted Discord embed payload without sending to Discord')
  .parse(process.argv);

const options = program.opts();

// Initialize shared core modules
const store = new TelemetryStore();
const idleTimeout = parseInt(process.env.IDLE_TIMEOUT_MINUTES || '10', 10);
const sessionTracker = new SessionTracker(store, idleTimeout);
const summaryAggregator = new DailySummaryAggregator(sessionTracker);
const dispatcher = new DiscordDispatcher();
const gitCollector = new GitCollector();

function extractProjectName(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.includes('AWS/eBookReader') || norm.includes('eBookReader')) return 'eBookReader (AWS)';
  if (norm.includes('Software Security')) return 'Software Security';
  if (norm.includes('Transit-Routing-Engine')) return 'Transit-Routing-Engine';
  if (norm.includes('Personal-Workspace02')) return 'Personal-Workspace02';
  if (norm.includes('Commitr-bot')) return 'Commitr-bot';
  if (norm.includes('Valorant-API')) return 'Valorant-API';

  const musicIdx = norm.toLowerCase().indexOf('/music/');
  if (musicIdx !== -1) {
    const afterMusic = norm.substring(musicIdx + '/music/'.length);
    const parts = afterMusic.split('/');
    if (parts.length > 0 && parts[0]) return parts[0];
  }
  return 'Workspace';
}

function extractRelativePath(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/');
  const musicIdx = norm.toLowerCase().indexOf('/music/');
  if (musicIdx !== -1) {
    return norm.substring(musicIdx + '/music/'.length);
  }
  return path.basename(filePath);
}

async function syncToBotServer() {
  try {
    const summary = summaryAggregator.generateSummary();
    const state = sessionTracker.getState();

    const languages: Record<string, { activeSeconds: number; keystrokes: number }> = {};
    const projects: Record<string, { activeSeconds: number; fileCount: number }> = {};
    const topFiles: Array<{
      relativePath: string;
      languageId: string;
      activeSeconds: number;
      linesAdded: number;
      linesDeleted: number;
      keystrokes: number;
    }> = [];

    const projectFilesMap: Record<string, Set<string>> = {};

    for (const [filePath, count] of Object.entries(state.modifiedFiles)) {
      const lang = gitCollector.detectLanguage(filePath);
      const proj = extractProjectName(filePath);
      const relPath = extractRelativePath(filePath);

      if (!languages[lang]) {
        languages[lang] = { activeSeconds: 0, keystrokes: 0 };
      }
      languages[lang].keystrokes += count * 5;
      languages[lang].activeSeconds += Math.min(state.activeTimeSeconds, count * 30);

      if (!projects[proj]) {
        projects[proj] = { activeSeconds: 0, fileCount: 0 };
        projectFilesMap[proj] = new Set();
      }
      projectFilesMap[proj].add(relPath);
      projects[proj].activeSeconds += Math.min(state.activeTimeSeconds, count * 30);

      topFiles.push({
        relativePath: relPath,
        languageId: lang,
        activeSeconds: Math.min(state.activeTimeSeconds, count * 30),
        linesAdded: 0,
        linesDeleted: 0,
        keystrokes: count * 5
      });
    }

    for (const [proj, files] of Object.entries(projectFilesMap)) {
      if (projects[proj]) {
        projects[proj].fileCount = files.size;
      }
    }

    // Default fallback project if none tracked yet
    if (Object.keys(projects).length === 0) {
      projects['Music Workspace'] = { activeSeconds: state.activeTimeSeconds, fileCount: 0 };
    }

    const payload = {
      date: state.date,
      totalActiveSeconds: state.activeTimeSeconds,
      idleSeconds: 0,
      keystrokesTotal: state.fileEventsCount * 5,
      linesAddedTotal: summary.linesAdded,
      linesDeletedTotal: summary.linesDeleted,
      projects,
      languages,
      topFiles: topFiles.sort((a, b) => b.activeSeconds - a.activeSeconds).slice(0, 10)
    };

    await fetch('http://localhost:3000/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    // Silent catch if bot server is offline
  }
}

async function runImmediateDispatch(isDryRun: boolean) {
  console.log('📊 Aggregating current telemetry & Git activity...');
  const summary = summaryAggregator.generateSummary();
  console.log(`⏱️ Active Duration: ${summary.activeDurationText}`);
  console.log(`📊 Lines Added/Deleted: +${summary.linesAdded} / -${summary.linesDeleted}`);
  console.log(`📝 Commits Today: ${summary.commitsToday.length}`);

  const success = await dispatcher.dispatch(summary, isDryRun);
  if (!success && !isDryRun) {
    process.exitCode = 1;
  }
}

function parseCronFromTime(timeStr: string): string {
  const parts = timeStr.trim().split(':');
  if (parts.length === 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return `${minutes} ${hours} * * *`;
    }
  }
  return '0 18 * * *'; // Default 18:00
}

async function runDaemon(isDryRun: boolean) {
  const watchDirsStr = process.env.WATCH_DIRECTORIES || '.';
  const watchDirs = watchDirsStr.split(',').map(d => d.trim()).filter(Boolean);
  const dispatchTime = process.env.DISPATCH_TIME || '18:00';
  const cronPattern = parseCronFromTime(dispatchTime);

  console.log('🤖 Commitr-bot Daemon started.');
  console.log(`⏱️ Idle Threshold: ${idleTimeout} minutes`);
  console.log(`⏰ Scheduled Standup Dispatch Time: ${dispatchTime} (Cron: '${cronPattern}')`);

  // Debounced sync function to only push updates when files are actively edited
  let debounceTimer: NodeJS.Timeout | null = null;
  const triggerDebouncedSync = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncToBotServer().catch(() => {});
    }, 5000);
  };

  // Start File Watcher
  const watcher = new FileWatcher({
    directories: watchDirs,
    onFileChange: (filepath, eventType) => {
      sessionTracker.recordEvent(filepath);
      triggerDebouncedSync();
    }
  });

  watcher.start();

  // Schedule Cron Job for daily dispatch
  const job = new CronJob(
    cronPattern,
    async () => {
      console.log(`\n⏰ Scheduled Standup Trigger (${dispatchTime}) firing...`);
      await runImmediateDispatch(isDryRun);
    },
    null,
    true
  );

  console.log('✅ Telemetry daemon is active and monitoring workspace changes in background...');

  // Graceful shutdown handling
  const shutdown = async () => {
    console.log('\n⏳ Shutting down Commitr-bot daemon...');
    job.stop();
    await watcher.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main() {
  if (options.now) {
    await runImmediateDispatch(Boolean(options.dryRun));
  } else if (options.daemon) {
    await runDaemon(Boolean(options.dryRun));
  } else {
    // If no explicit mode specified, handle dry-run or show help
    if (options.dryRun) {
      await runImmediateDispatch(true);
    } else {
      console.log('🤖 Commitr-bot Developer Telemetry Service');
      console.log('Run with --now, --daemon, or --dry-run.');
      program.help();
    }
  }
}

main().catch(err => {
  console.error('❌ Fatal Application Error:', err);
  process.exit(1);
});

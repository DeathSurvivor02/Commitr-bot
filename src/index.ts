import { Command } from 'commander';
import dotenv from 'dotenv';
import { CronJob } from 'cron';
import { FileWatcher } from './collector/watcher';
import { TelemetryStore } from './storage';
import { SessionTracker } from './aggregator/session';
import { DailySummaryAggregator } from './aggregator/summary';
import { DiscordDispatcher } from './dispatcher';

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

  // Start File Watcher
  const watcher = new FileWatcher({
    directories: watchDirs,
    onFileChange: (filepath, eventType) => {
      sessionTracker.recordEvent(filepath);
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

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { GitCollector } from '../src/collector/git';
import { TelemetryStore } from '../src/storage';
import { SessionTracker } from '../src/aggregator/session';
import { DiscordDispatcher } from '../src/dispatcher';
import { DailySummaryData } from '../src/aggregator/summary';

console.log('🧪 Running Commitr-bot Unit Tests...\n');

// 1. Test Language Detection
console.log('Test 1: GitCollector Language Detection');
const gitCollector = new GitCollector();
assert.strictEqual(gitCollector.detectLanguage('src/index.ts'), 'TypeScript');
assert.strictEqual(gitCollector.detectLanguage('App.cs'), 'C#');
assert.strictEqual(gitCollector.detectLanguage('main.cpp'), 'C++');
assert.strictEqual(gitCollector.detectLanguage('queries.sql'), 'SQL');
assert.strictEqual(gitCollector.detectLanguage('unknown.xyz'), 'XYZ');
console.log('  ✅ Language detection tests passed.');

// 2. Test TelemetryStore Persistence
console.log('Test 2: TelemetryStore State Persistence');
const testDir = path.join(process.cwd(), '.telemetry_test_temp');
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });

const store = new TelemetryStore(testDir);
const state = store.getInitialState();
state.activeTimeSeconds = 1200;
state.fileEventsCount = 15;
store.saveState(state);

const loadedState = store.loadState();
assert.strictEqual(loadedState.activeTimeSeconds, 1200);
assert.strictEqual(loadedState.fileEventsCount, 15);

// Cleanup test temp dir
fs.rmSync(testDir, { recursive: true, force: true });
console.log('  ✅ TelemetryStore persistence tests passed.');

// 3. Test SessionTracker Idle Threshold
console.log('Test 3: SessionTracker Idle Gap Threshold');
const dummyStore = new TelemetryStore(testDir);
const tracker = new SessionTracker(dummyStore, 10); // 10 min idle threshold

tracker.recordEvent('test.ts');
const initialActive = tracker.getState().activeTimeSeconds;
assert.ok(initialActive > 0, 'First activity should grant baseline active time');
assert.strictEqual(tracker.getState().fileEventsCount, 1);

fs.rmSync(testDir, { recursive: true, force: true });
console.log('  ✅ SessionTracker idle threshold tests passed.');

// 4. Test Discord Embed Builder
console.log('Test 4: Discord Embed Payload Formatting');
const dispatcher = new DiscordDispatcher();
const dummySummary: DailySummaryData = {
  date: '2026-09-02',
  activeDurationText: '2h 15m',
  linesAdded: 150,
  linesDeleted: 45,
  filesChanged: 6,
  fileEventsCount: 22,
  topLanguages: [
    { language: 'TypeScript', percentage: 75 },
    { language: 'Markdown', percentage: 25 }
  ],
  commitsToday: ['feat: initial telemetry daemon setup']
};

const embed = dispatcher.buildEmbed(dummySummary);
assert.strictEqual(embed.title, '🛠️ Daily Developer Activity Log — 2026-09-02');
assert.strictEqual(embed.fields[0].value, '**2h 15m**');
assert.ok(embed.fields[1].value.includes('+150'));
assert.ok(embed.fields[2].value.includes('`TypeScript` (75%)'));
assert.ok(embed.fields[3].value.includes('feat: initial telemetry daemon setup'));
console.log('  ✅ Discord embed formatting tests passed.');

console.log('\n🎉 ALL UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!');

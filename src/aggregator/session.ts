import { TelemetryStore, TelemetryState } from '../storage';

export class SessionTracker {
  private store: TelemetryStore;
  private state: TelemetryState;
  private idleTimeoutMs: number;

  constructor(store: TelemetryStore, idleTimeoutMinutes: number = 10) {
    this.store = store;
    this.state = this.store.loadState();
    this.idleTimeoutMs = idleTimeoutMinutes * 60 * 1000;
  }

  public getState(): TelemetryState {
    return this.state;
  }

  public recordEvent(filepath: string): void {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // Reset state if date changed overnight
    if (this.state.date !== today) {
      this.state = this.store.getInitialState();
    }

    if (this.state.lastActiveTimestamp === null) {
      // First activity of session
      this.state.lastActiveTimestamp = now;
      this.state.activeTimeSeconds += 60; // Grant 1 min baseline for first edit
    } else {
      const elapsedMs = now - this.state.lastActiveTimestamp;
      if (elapsedMs <= this.idleTimeoutMs) {
        // Continuous activity within threshold
        const elapsedSec = Math.floor(elapsedMs / 1000);
        if (elapsedSec > 0) {
          this.state.activeTimeSeconds += elapsedSec;
        }
      } else {
        // Idle threshold exceeded -> gap created, start new session block
        this.state.activeTimeSeconds += 60; // 1 min baseline for new block
      }
      this.state.lastActiveTimestamp = now;
    }

    this.state.fileEventsCount += 1;
    this.state.modifiedFiles[filepath] = (this.state.modifiedFiles[filepath] || 0) + 1;

    // Flush to storage cache
    this.store.saveState(this.state);
  }

  public getFormattedActiveDuration(): string {
    const totalSec = this.state.activeTimeSeconds;
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    if (hours === 0 && minutes === 0) {
      return '< 1m';
    }
    if (hours === 0) {
      return `${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  }
}

import fs from 'fs';
import path from 'path';

export interface TelemetryState {
  date: string; // YYYY-MM-DD
  activeTimeSeconds: number;
  lastActiveTimestamp: number | null;
  fileEventsCount: number;
  modifiedFiles: Record<string, number>;
}

export class TelemetryStore {
  private storageDir: string;
  private primaryFilePath: string;
  private fallbackFilePath: string;

  constructor(customDir?: string) {
    this.storageDir = customDir || path.join(process.cwd(), '.telemetry');
    this.primaryFilePath = path.join(this.storageDir, 'cache.json');
    this.fallbackFilePath = path.join(this.storageDir, 'state.json');
  }

  private getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  public getInitialState(): TelemetryState {
    const today = this.getTodayDateString();
    return {
      date: today,
      activeTimeSeconds: 0,
      lastActiveTimestamp: null,
      fileEventsCount: 0,
      modifiedFiles: {}
    };
  }

  public loadState(): TelemetryState {
    try {
      let targetFile = this.primaryFilePath;
      if (!fs.existsSync(targetFile) && fs.existsSync(this.fallbackFilePath)) {
        targetFile = this.fallbackFilePath;
      }

      if (!fs.existsSync(targetFile)) {
        const initialState = this.getInitialState();
        this.saveState(initialState);
        return initialState;
      }

      const data = fs.readFileSync(targetFile, 'utf-8');
      const state: TelemetryState = JSON.parse(data);
      const today = this.getTodayDateString();

      // Reset state if date has changed overnight
      if (state.date !== today) {
        const freshState = this.getInitialState();
        this.saveState(freshState);
        return freshState;
      }

      // Ensure cache.json is synced if read from state.json
      if (!fs.existsSync(this.primaryFilePath)) {
        this.saveState(state);
      }

      return state;
    } catch (err) {
      console.warn('⚠️ Warning: Failed to load telemetry state cache. Starting fresh state.', err);
      const freshState = this.getInitialState();
      this.saveState(freshState);
      return freshState;
    }
  }

  public saveState(state: TelemetryState): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      const data = JSON.stringify(state, null, 2);
      // Write to .telemetry/cache.json as primary persistent store
      fs.writeFileSync(this.primaryFilePath, data, 'utf-8');
      // Also write to .telemetry/state.json for fallback compatibility
      fs.writeFileSync(this.fallbackFilePath, data, 'utf-8');
    } catch (err) {
      console.error('❌ Error saving telemetry state cache:', err);
    }
  }
}

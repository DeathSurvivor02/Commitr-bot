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
  private stateFilePath: string;

  constructor(customDir?: string) {
    this.storageDir = customDir || path.join(process.cwd(), '.telemetry');
    this.stateFilePath = path.join(this.storageDir, 'state.json');
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
      if (!fs.existsSync(this.stateFilePath)) {
        return this.getInitialState();
      }
      const data = fs.readFileSync(this.stateFilePath, 'utf-8');
      const state: TelemetryState = JSON.parse(data);
      const today = this.getTodayDateString();

      // If stored state is from a previous day, start fresh for today
      if (state.date !== today) {
        return this.getInitialState();
      }

      return state;
    } catch (err) {
      console.warn('⚠️ Warning: Failed to load telemetry state cache. Starting fresh state.', err);
      return this.getInitialState();
    }
  }

  public saveState(state: TelemetryState): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('❌ Error saving telemetry state cache:', err);
    }
  }
}

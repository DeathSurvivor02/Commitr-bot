import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';

export interface WatcherOptions {
  directories?: string[];
  onFileChange?: (filepath: string, eventType: string) => void;
}

const DEFAULT_IGNORED = [
  '**/node_modules/**',
  '**/dist/**',
  '**/bin/**',
  '**/obj/**',
  '**/.git/**',
  '**/.telemetry/**',
  '**/.vs/**',
  '**/.vscode/**',
  '**/.idea/**',
  '**/*.log',
  '**/*.tmp',
  '**/*.swp',
  '**/*.bak'
];

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private directories: string[];
  private onFileChange?: (filepath: string, eventType: string) => void;

  constructor(options: WatcherOptions = {}) {
    this.directories = options.directories && options.directories.length > 0
      ? options.directories
      : [process.cwd()];
    this.onFileChange = options.onFileChange;
  }

  public start(): void {
    if (this.watcher) return;

    this.watcher = chokidar.watch(this.directories, {
      ignored: DEFAULT_IGNORED,
      persistent: true,
      ignoreInitial: true
    });

    const handleEvent = (eventType: string) => (filepath: string) => {
      if (this.onFileChange) {
        this.onFileChange(path.normalize(filepath), eventType);
      }
    };

    this.watcher
      .on('add', handleEvent('add'))
      .on('change', handleEvent('change'))
      .on('unlink', handleEvent('unlink'));

    console.log(`📡 FileWatcher listening on: ${this.directories.join(', ')}`);
  }

  public async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      console.log('🛑 FileWatcher stopped.');
    }
  }
}

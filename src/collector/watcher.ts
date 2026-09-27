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
  '**/*.bak',
  '**/*~',
  '**/.DS_Store',
  '**/Thumbs.db'
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

  public isNoisyPath(filepath: string): boolean {
    const normalized = filepath.replace(/\\/g, '/');
    const segments = normalized.split('/');
    const noisyFolders = ['.git', '.telemetry', 'node_modules', 'dist', 'bin', 'obj', '.vs', '.vscode', '.idea'];
    if (segments.some(seg => noisyFolders.includes(seg))) {
      return true;
    }
    return (
      /\.(log|tmp|swp|bak)$/i.test(normalized) ||
      /(^|\/)(\.DS_Store|Thumbs\.db)$/i.test(normalized) ||
      normalized.endsWith('~')
    );
  }

  public start(): void {
    if (this.watcher) return;

    this.watcher = chokidar.watch(this.directories, {
      ignored: DEFAULT_IGNORED,
      persistent: true,
      ignoreInitial: true
    });

    const handleEvent = (eventType: string) => (filepath: string) => {
      const normalizedPath = path.normalize(filepath);
      if (this.isNoisyPath(normalizedPath)) {
        return; // Defense-in-depth filter for noisy paths
      }
      if (this.onFileChange) {
        this.onFileChange(normalizedPath, eventType);
      }
    };

    this.watcher
      .on('add', handleEvent('add'))
      .on('change', handleEvent('change'))
      .on('unlink', handleEvent('unlink'));

    console.log(`📡 FileWatcher active on: ${this.directories.join(', ')}`);
  }

  public async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      console.log('🛑 FileWatcher stopped.');
    }
  }
}

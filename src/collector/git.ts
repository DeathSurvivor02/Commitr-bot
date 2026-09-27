import { execSync } from 'child_process';
import path from 'path';

export interface GitDiffSummary {
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  languageStats: Record<string, { lines: number; files: number }>;
  commitsToday: string[];
  statSummaryText: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'React JS',
  '.tsx': 'React TS',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.h': 'C/C++ Header',
  '.hpp': 'C++ Header',
  '.java': 'Java',
  '.py': 'Python',
  '.sql': 'SQL',
  '.html': 'HTML',
  '.css': 'CSS',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.sh': 'Shell',
  '.ps1': 'PowerShell'
};

export class GitCollector {
  private cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd || process.cwd();
  }

  public detectLanguage(filepath: string): string {
    const ext = path.extname(filepath).toLowerCase();
    return LANGUAGE_MAP[ext] || (ext ? ext.toUpperCase().slice(1) : 'Other');
  }

  public getGitStatText(): string {
    try {
      return execSync('git diff HEAD --stat', { cwd: this.cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch {
      try {
        return execSync('git diff --stat', { cwd: this.cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      } catch {
        return '';
      }
    }
  }

  public getGitMetrics(): GitDiffSummary {
    let linesAdded = 0;
    let linesDeleted = 0;
    const fileSet = new Set<string>();
    const languageStats: Record<string, { lines: number; files: number }> = {};
    const commitsToday: string[] = [];

    // Helper to process line stats from git numstat output
    const processNumstatLine = (line: string) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const addedStr = parts[0];
        const deletedStr = parts[1];
        const file = parts.slice(2).join(' ');

        // Skip binary files marked with '-'
        const added = addedStr === '-' ? 0 : parseInt(addedStr, 10) || 0;
        const deleted = deletedStr === '-' ? 0 : parseInt(deletedStr, 10) || 0;

        linesAdded += added;
        linesDeleted += deleted;
        fileSet.add(file);

        const lang = this.detectLanguage(file);
        if (!languageStats[lang]) {
          languageStats[lang] = { lines: 0, files: 0 };
        }
        languageStats[lang].lines += added + deleted;
        languageStats[lang].files += 1;
      }
    };

    try {
      // 1. Get working tree / staged changes diff
      const uncommittedStat = execSync('git diff HEAD --numstat', { cwd: this.cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      uncommittedStat.split('\n').filter(Boolean).forEach(processNumstatLine);
    } catch {
      try {
        const uncommittedStat = execSync('git diff --numstat', { cwd: this.cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
        uncommittedStat.split('\n').filter(Boolean).forEach(processNumstatLine);
      } catch {
        // Not a git repo or git not available
      }
    }

    try {
      // 2. Get commits made today (since midnight)
      const commitLog = execSync('git log --since="midnight" --numstat --format="COMMIT:%h|%s"', { cwd: this.cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = commitLog.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        if (line.startsWith('COMMIT:')) {
          const commitMsg = line.substring('COMMIT:'.length).trim();
          if (commitMsg && !commitsToday.includes(commitMsg)) {
            commitsToday.push(commitMsg);
          }
        } else {
          processNumstatLine(line);
        }
      }
    } catch {
      // Not a git repo or no git log available
    }

    const statSummaryText = this.getGitStatText();

    return {
      linesAdded,
      linesDeleted,
      filesChanged: fileSet.size,
      languageStats,
      commitsToday,
      statSummaryText
    };
  }
}

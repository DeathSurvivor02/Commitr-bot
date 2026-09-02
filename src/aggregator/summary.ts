import { SessionTracker } from './session';
import { GitCollector, GitDiffSummary } from '../collector/git';

export interface DailySummaryData {
  date: string;
  activeDurationText: string;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  fileEventsCount: number;
  topLanguages: Array<{ language: string; percentage: number }>;
  commitsToday: string[];
}

export class DailySummaryAggregator {
  private sessionTracker: SessionTracker;
  private gitCollector: GitCollector;

  constructor(sessionTracker: SessionTracker, gitCollector?: GitCollector) {
    this.sessionTracker = sessionTracker;
    this.gitCollector = gitCollector || new GitCollector();
  }

  public generateSummary(): DailySummaryData {
    const state = this.sessionTracker.getState();
    const activeDurationText = this.sessionTracker.getFormattedActiveDuration();
    const gitMetrics: GitDiffSummary = this.gitCollector.getGitMetrics();

    // Compute top language breakdown from git metrics
    let totalLinesTouched = 0;
    Object.values(gitMetrics.languageStats).forEach(s => {
      totalLinesTouched += s.lines;
    });

    const topLanguages: Array<{ language: string; percentage: number }> = [];
    if (totalLinesTouched > 0) {
      Object.entries(gitMetrics.languageStats)
        .map(([lang, stat]) => ({
          language: lang,
          percentage: Math.round((stat.lines / totalLinesTouched) * 100)
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .forEach(item => topLanguages.push(item));
    }

    return {
      date: state.date,
      activeDurationText,
      linesAdded: gitMetrics.linesAdded,
      linesDeleted: gitMetrics.linesDeleted,
      filesChanged: gitMetrics.filesChanged,
      fileEventsCount: state.fileEventsCount,
      topLanguages,
      commitsToday: gitMetrics.commitsToday
    };
  }
}

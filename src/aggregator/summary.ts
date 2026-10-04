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
    } else if (Object.keys(state.modifiedFiles).length > 0) {
      const langEventCounts: Record<string, number> = {};
      let totalEvents = 0;
      for (const [file, count] of Object.entries(state.modifiedFiles)) {
        const lang = this.gitCollector.detectLanguage(file);
        langEventCounts[lang] = (langEventCounts[lang] || 0) + count;
        totalEvents += count;
      }
      if (totalEvents > 0) {
        Object.entries(langEventCounts)
          .map(([lang, count]) => ({
            language: lang,
            percentage: Math.round((count / totalEvents) * 100)
          }))
          .sort((a, b) => b.percentage - a.percentage)
          .forEach(item => topLanguages.push(item));
      }
    }

    const filesCount = gitMetrics.filesChanged > 0 
      ? gitMetrics.filesChanged 
      : Object.keys(state.modifiedFiles).length;

    return {
      date: state.date,
      activeDurationText,
      linesAdded: gitMetrics.linesAdded,
      linesDeleted: gitMetrics.linesDeleted,
      filesChanged: filesCount,
      fileEventsCount: state.fileEventsCount,
      topLanguages,
      commitsToday: gitMetrics.commitsToday
    };
  }
}

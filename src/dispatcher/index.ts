import { DailySummaryData } from '../aggregator/summary';

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  color: number;
  fields: DiscordEmbedField[];
  footer: { text: string };
  timestamp: string;
}

export interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  embeds: DiscordEmbed[];
}

export class DiscordDispatcher {
  private webhookUrl: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL || '';
  }

  public buildEmbed(summary: DailySummaryData): DiscordEmbed {
    const languageText = summary.topLanguages.length > 0
      ? summary.topLanguages.map(l => `\`${l.language}\` (${l.percentage}%)`).join(', ')
      : 'No files modified';

    const commitsText = summary.commitsToday.length > 0
      ? summary.commitsToday.map(c => `• ${c}`).slice(0, 10).join('\n')
      : '_No commits recorded today._';

    return {
      title: `🛠️ Daily Developer Activity Log — ${summary.date}`,
      color: 0x5865F2, // Discord Blurple
      fields: [
        {
          name: '⏱️ Active Coding Time',
          value: `**${summary.activeDurationText}**`,
          inline: true
        },
        {
          name: '📊 Net Code Impact',
          value: `\`+${summary.linesAdded}\` / \`-${summary.linesDeleted}\` lines\n(${summary.filesChanged} files touched)`,
          inline: true
        },
        {
          name: '📁 Top File Types / Languages',
          value: languageText,
          inline: false
        },
        {
          name: '📝 Commits Today',
          value: commitsText,
          inline: false
        }
      ],
      footer: {
        text: 'Commitr-bot • Developer Telemetry Service'
      },
      timestamp: new Date().toISOString()
    };
  }

  public async dispatch(summary: DailySummaryData, dryRun: boolean = false): Promise<boolean> {
    const embed = this.buildEmbed(summary);
    const payload: DiscordWebhookPayload = {
      username: 'Commitr Standup Bot',
      embeds: [embed]
    };

    if (dryRun) {
      console.log('\n================ [ DRY RUN: DISCORD EMBED PAYLOAD ] ================');
      console.log(JSON.stringify(payload, null, 2));
      console.log('===================================================================\n');
      return true;
    }

    if (!this.webhookUrl || this.webhookUrl.includes('YOUR_WEBHOOK')) {
      console.error('❌ Error: DISCORD_WEBHOOK_URL is not configured in .env');
      return false;
    }

    return await this.sendWithRetry(payload);
  }

  private async sendWithRetry(payload: DiscordWebhookPayload, maxAttempts: number = 4): Promise<boolean> {
    let attempt = 0;
    let delayMs = 1000;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 204) {
          console.log('✅ Successfully dispatched standup summary embed to Discord!');
          return true;
        }

        if (response.status === 429) {
          // Rate limited
          const rateLimitHeader = response.headers.get('Retry-After');
          const retryAfterMs = rateLimitHeader ? parseInt(rateLimitHeader, 10) * 1000 : delayMs;
          console.warn(`⚠️ Rate limited (HTTP 429) by Discord API. Waiting ${retryAfterMs}ms before retry ${attempt}/${maxAttempts}...`);
          await new Promise(res => setTimeout(res, retryAfterMs));
        } else if (response.status >= 500) {
          console.warn(`⚠️ Server error (HTTP ${response.status}) from Discord API. Waiting ${delayMs}ms before retry ${attempt}/${maxAttempts}...`);
          await new Promise(res => setTimeout(res, delayMs));
          delayMs *= 2;
        } else {
          const bodyText = await response.text();
          console.error(`❌ HTTP Error ${response.status} sending webhook:`, bodyText);
          return false;
        }
      } catch (err: any) {
        console.warn(`⚠️ Network error dispatching webhook (attempt ${attempt}/${maxAttempts}): ${err.message || err}`);
        await new Promise(res => setTimeout(res, delayMs));
        delayMs *= 2;
      }
    }

    console.error('❌ Failed to dispatch webhook after maximum retry attempts.');
    return false;
  }
}

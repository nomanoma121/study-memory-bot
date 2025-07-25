import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from './database.js';
import { formatDurationShort } from './timeUtils.js';

export class DailyReportScheduler {
  private client: Client;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  start() {
    // 毎日午後9時（21:00）にレポートを送信
    this.scheduleDaily();
    console.log('📅 Daily report scheduler started (23:00 JST)');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('📅 Daily report scheduler stopped');
    }
  }

  private scheduleDaily() {
    const now = new Date();
    const target = new Date();
    target.setHours(23, 0, 0, 0); // 午後11時に設定

    // もし今日の11時を過ぎていたら、明日の11時に設定
    if (now > target) {
      target.setDate(target.getDate() + 1);
    }

    const timeUntilFirst = target.getTime() - now.getTime();

    // 最初のレポート送信までの時間を待つ
    setTimeout(() => {
      this.sendDailyReports();
      
      // その後は24時間ごとに実行
      this.intervalId = setInterval(() => {
        this.sendDailyReports();
      }, 24 * 60 * 60 * 1000);
    }, timeUntilFirst);

    console.log(`📅 Next daily report scheduled for: ${target.toLocaleString('ja-JP')}`);
  }

  private async sendDailyReports() {
    console.log('📊 Generating daily reports...');

    // 今日の日付範囲を計算
    const today = new Date();
    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(today);
    dayEnd.setHours(23, 59, 59, 999);

    // 全ギルドをチェック
    for (const guild of this.client.guilds.cache.values()) {
      try {
        await this.sendGuildDailyReport(guild.id, dayStart, dayEnd);
      } catch (error) {
        console.error(`Failed to send daily report for guild ${guild.id}:`, error);
      }
    }
  }

  private async sendGuildDailyReport(guildId: string, dayStart: Date, dayEnd: Date) {
    // そのギルドの今日の勉強記録を取得
    const stmt = db['db'].prepare(`
      SELECT userId, subject, SUM(endTime - startTime) as totalTime, COUNT(*) as sessionCount
      FROM study_sessions 
      WHERE guildId = ? AND endTime IS NOT NULL 
      AND startTime >= ? AND startTime <= ?
      GROUP BY userId
      HAVING totalTime > 0
      ORDER BY totalTime DESC
      LIMIT 10
    `);

    const userStats = stmt.all(guildId, dayStart.getTime(), dayEnd.getTime()) as any[];

    if (userStats.length === 0) {
      return; // 勉強記録がない日はレポートを送信しない
    }

    // ギルド情報を取得
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    // レポート送信先チャンネルを探す（一般的な名前のチャンネル）
    const channelNames = ['general', '一般', '勉強', 'study', 'bot', 'ボット'];
    let targetChannel: TextChannel | null = null;

    for (const name of channelNames) {
      const channel = guild.channels.cache.find(ch => 
        ch.name.toLowerCase().includes(name) && ch.isTextBased()
      ) as TextChannel;
      
      if (channel) {
        targetChannel = channel;
        break;
      }
    }

    // デフォルトチャンネルを使用
    if (!targetChannel) {
      targetChannel = guild.systemChannel as TextChannel;
    }

    if (!targetChannel) {
      console.log(`No suitable channel found for guild ${guild.name}`);
      return;
    }

    // レポートEmbedを作成
    const dateStr = dayStart.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('📊 今日の勉強レポート')
      .setDescription(`**${dateStr}**\n\n${guild.name}の皆さん、今日もお疲れ様でした！`)
      .setThumbnail(guild.iconURL());

    // 総計を計算
    const totalStudyTime = userStats.reduce((sum, user) => sum + user.totalTime, 0);
    const totalSessions = userStats.reduce((sum, user) => sum + user.sessionCount, 0);

    embed.addFields({
      name: '📈 全体統計',
      value: `👥 勉強参加者: **${userStats.length}人**\n⏱️ 総勉強時間: **${formatDurationShort(totalStudyTime)}**\n📚 総セッション数: **${totalSessions}回**`,
      inline: false
    });

    // 個人別ランキング
    let rankingText = '';
    for (let i = 0; i < Math.min(userStats.length, 5); i++) {
      const userStat = userStats[i];
      try {
        const user = await this.client.users.fetch(userStat.userId);
        const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`;
        rankingText += `${emoji} **${user.displayName || user.username}** - ${formatDurationShort(userStat.totalTime)} (${userStat.sessionCount}回)\n`;
      } catch (error) {
        const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`;
        rankingText += `${emoji} Unknown User - ${formatDurationShort(userStat.totalTime)} (${userStat.sessionCount}回)\n`;
      }
    }

    if (rankingText) {
      embed.addFields({
        name: '🏆 今日の頑張り屋さん',
        value: rankingText,
        inline: false
      });
    }

    // 励ましメッセージ
    const avgTime = totalStudyTime / userStats.length;
    let encouragement = '';
    if (avgTime >= 4 * 60 * 60 * 1000) encouragement = '素晴らしい集中力です！明日も頑張りましょう！🌟';
    else if (avgTime >= 2 * 60 * 60 * 1000) encouragement = '良いペースで勉強できていますね！継続が大切です！📚';
    else encouragement = 'コツコツ続けることが大切です！明日も一緒に頑張りましょう！💪';

    embed.setFooter({
      text: encouragement
    });

    // レポートを送信
    await targetChannel.send({ embeds: [embed] });
    console.log(`📊 Daily report sent to ${guild.name} #${targetChannel.name}`);
  }
}
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../utils/database.js';
import { formatDurationShort } from '../utils/timeUtils.js';

export const data = new SlashCommandBuilder()
  .setName('report')
  .setDescription('今日の勉強レポートを手動で表示します（テスト用）')
  .addStringOption(option =>
    option
      .setName('date')
      .setDescription('レポートの日付 (YYYY-MM-DD 形式、省略時は今日)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild?.id;
  const dateStr = interaction.options.getString('date');

  if (!guildId) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true
    });
    return;
  }

  try {
    // 日付の解析
    let targetDate: Date;
    if (dateStr) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        await interaction.reply({
          content: '日付は YYYY-MM-DD 形式で入力してください。例: 2024-01-15',
          ephemeral: true
        });
        return;
      }
      
      targetDate = new Date(dateStr + 'T00:00:00');
      if (isNaN(targetDate.getTime())) {
        await interaction.reply({
          content: '無効な日付です。正しい日付を入力してください。',
          ephemeral: true
        });
        return;
      }
    } else {
      targetDate = new Date();
    }

    // 指定日の開始・終了時刻を計算
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // そのギルドの指定日の勉強記録を取得
    const stmt = db['db'].prepare(`
      SELECT userId, SUM(endTime - startTime) as totalTime, COUNT(*) as sessionCount
      FROM study_sessions 
      WHERE guildId = ? AND endTime IS NOT NULL 
      AND startTime >= ? AND startTime <= ?
      GROUP BY userId
      HAVING totalTime > 0
      ORDER BY totalTime DESC
      LIMIT 10
    `);

    const userStats = stmt.all(guildId, dayStart.getTime(), dayEnd.getTime()) as any[];

    const dateFormatted = targetDate.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    if (userStats.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('📊 勉強レポート')
        .setDescription(`**${dateFormatted}**\n\nこの日は勉強記録がありませんでした。`);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // レポートEmbedを作成
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('📊 勉強レポート')
      .setDescription(`**${dateFormatted}**\n\n${interaction.guild!.name}の勉強レポートです！`)
      .setThumbnail(interaction.guild!.iconURL());

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
        const user = await interaction.client.users.fetch(userStat.userId);
        const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`;
        rankingText += `${emoji} **${user.displayName || user.username}** - ${formatDurationShort(userStat.totalTime)} (${userStat.sessionCount}回)\n`;
      } catch (error) {
        const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`;
        rankingText += `${emoji} Unknown User - ${formatDurationShort(userStat.totalTime)} (${userStat.sessionCount}回)\n`;
      }
    }

    if (rankingText) {
      embed.addFields({
        name: '🏆 頑張り屋さんランキング',
        value: rankingText,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error generating report:', error);
    await interaction.reply({
      content: 'エラーが発生しました。しばらく待ってから再度お試しください。',
      ephemeral: true
    });
  }
}
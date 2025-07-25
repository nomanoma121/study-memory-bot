import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../utils/database.js';
import { formatDurationShort, getPeriodDisplayName } from '../utils/timeUtils.js';

export const data = new SlashCommandBuilder()
  .setName('log')
  .setDescription('指定したユーザーの勉強時間ログを集計して表示します')
  .addStringOption(option =>
    option
      .setName('period')
      .setDescription('集計期間')
      .setRequired(false)
      .addChoices(
        { name: '今日', value: 'today' },
        { name: '過去7日間', value: 'week' },
        { name: '過去30日間', value: 'month' },
        { name: '全期間', value: 'all' }
      )
  )
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('ログを閲覧したいユーザー')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild?.id;
  const period = (interaction.options.getString('period') as 'today' | 'week' | 'month' | 'all') || 'week';
  const targetUser = interaction.options.getUser('user') || interaction.user;

  if (!guildId) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true
    });
    return;
  }

  try {
    const sessions = db.getCompletedSessions(targetUser.id, guildId, period);

    if (sessions.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle(`${targetUser.displayName || targetUser.username} の勉強ログ (${getPeriodDisplayName(period)})`)
        .setDescription('指定期間内に完了した勉強セッションはありません。');

      await interaction.reply({ embeds: [embed] });
      return;
    }

    let totalTime = 0;
    const subjectMap = new Map<string, number>();

    for (const session of sessions) {
      const duration = session.endTime! - session.startTime;
      totalTime += duration;

      const currentTime = subjectMap.get(session.subject) || 0;
      subjectMap.set(session.subject, currentTime + duration);
    }

    const embed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle(`${targetUser.displayName || targetUser.username} の勉強ログ (${getPeriodDisplayName(period)})`)
      .addFields({
        name: '総合計時間',
        value: formatDurationShort(totalTime),
        inline: false
      });

    if (subjectMap.size > 0) {
      const subjectBreakdown = Array.from(subjectMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([subject, time]) => `• **${subject}**: ${formatDurationShort(time)}`)
        .join('\n');

      embed.addFields({
        name: '教科別内訳',
        value: subjectBreakdown,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error fetching log:', error);
    await interaction.reply({
      content: 'エラーが発生しました。しばらく待ってから再度お試しください。',
      ephemeral: true
    });
  }
}
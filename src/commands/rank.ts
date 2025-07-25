import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../utils/database.js';
import { formatDurationShort, getPeriodDisplayName, getPeriodRange, formatDate } from '../utils/timeUtils.js';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('サーバー内の勉強時間ランキングを表示します')
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
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild?.id;
  const period = (interaction.options.getString('period') as 'today' | 'week' | 'month' | 'all') || 'week';

  if (!guildId) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true
    });
    return;
  }

  try {
    const rankingData = db.getRankingData(guildId, period);

    if (rankingData.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(`勉強時間ランキング (${getPeriodDisplayName(period)})`)
        .setDescription('指定期間内に勉強を完了したメンバーはいません。');

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`勉強時間ランキング (${getPeriodDisplayName(period)})`);

    let description = '';
    const rankEmojis = ['🥇', '🥈', '🥉'];

    for (let i = 0; i < Math.min(rankingData.length, 10); i++) {
      const data = rankingData[i];
      try {
        const user = await interaction.client.users.fetch(data.userId);
        const displayName = user.displayName || user.username;
        const emoji = i < 3 ? rankEmojis[i] : `${i + 1}位`;
        
        description += `${emoji} **${displayName}** - ${formatDurationShort(data.totalTime)}\n`;
      } catch (error) {
        console.error(`Failed to fetch user ${data.userId}:`, error);
        const emoji = i < 3 ? rankEmojis[i] : `${i + 1}位`;
        description += `${emoji} Unknown User - ${formatDurationShort(data.totalTime)}\n`;
      }
    }

    embed.setDescription(description);

    const { start, end } = getPeriodRange(period);
    if (period !== 'all') {
      embed.setFooter({
        text: `集計期間: ${formatDate(start)} 〜 ${formatDate(end)}`
      });
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error fetching ranking:', error);
    await interaction.reply({
      content: 'エラーが発生しました。しばらく待ってから再度お試しください。',
      ephemeral: true
    });
  }
}
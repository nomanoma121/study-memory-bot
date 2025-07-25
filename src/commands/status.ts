import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../utils/database.js';
import { formatDurationShort } from '../utils/timeUtils.js';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('現在サーバー内で勉強しているメンバーの一覧を表示します');

export async function execute(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guild?.id;

  if (!guildId) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true
    });
    return;
  }

  try {
    const activeSessions = db.getActiveStudySessions(guildId);

    if (activeSessions.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('勉強中のメンバー')
        .setDescription('現在勉強中のメンバーはいません。');

      await interaction.reply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('勉強中のメンバー')
      .setDescription(`現在、**${activeSessions.length}** 人が集中しています！`);

    for (const session of activeSessions) {
      try {
        const user = await interaction.client.users.fetch(session.userId);
        const elapsedTime = Date.now() - session.startTime;
        
        embed.addFields({
          name: user.displayName || user.username,
          value: `**${session.subject}** を ${formatDurationShort(elapsedTime)} 継続中`,
          inline: true
        });
      } catch (error) {
        console.error(`Failed to fetch user ${session.userId}:`, error);
        embed.addFields({
          name: 'Unknown User',
          value: `**${session.subject}** を ${formatDurationShort(Date.now() - session.startTime)} 継続中`,
          inline: true
        });
      }
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error fetching status:', error);
    await interaction.reply({
      content: 'エラーが発生しました。しばらく待ってから再度お試しください。',
      ephemeral: true
    });
  }
}
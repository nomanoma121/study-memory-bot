import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../utils/database.js';
import { formatDuration } from '../utils/timeUtils.js';

export const data = new SlashCommandBuilder()
  .setName('study')
  .setDescription('勉強時間を管理します')
  .addSubcommand(subcommand =>
    subcommand
      .setName('start')
      .setDescription('勉強時間の計測を開始します')
      .addStringOption(option =>
        option
          .setName('subject')
          .setDescription('勉強内容')
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option
          .setName('force')
          .setDescription('進行中のセッションを強制終了して新しいセッションを開始')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('stop')
      .setDescription('勉強時間の計測を終了します')
      .addStringOption(option =>
        option
          .setName('note')
          .setDescription('勉強の振り返りメモ')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'start') {
    await handleStart(interaction);
  } else if (subcommand === 'stop') {
    await handleStop(interaction);
  }
}

async function handleStart(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guild?.id;
  const subject = interaction.options.getString('subject') || '作業中';
  const force = interaction.options.getBoolean('force') || false;

  if (!guildId) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true
    });
    return;
  }

  try {
    const currentSession = db.getCurrentSession(userId, guildId);

    if (currentSession) {
      if (!force) {
        const embed = new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('⚠️ エラー')
          .setDescription('すでに勉強を開始しています。終了するには `/study stop` を、強制的に新しい勉強を始めるには `force` オプションを使用してください。');

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      db.forceEndSession(userId, guildId);
    }

    db.startStudySession(userId, guildId, subject);

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('勉強開始！')
      .setDescription(`**${subject}** の勉強を開始しました。頑張ってください！💪`);

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error starting study session:', error);
    await interaction.reply({
      content: 'エラーが発生しました。しばらく待ってから再度お試しください。',
      ephemeral: true
    });
  }
}

async function handleStop(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guild?.id;
  const note = interaction.options.getString('note');

  if (!guildId) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true
    });
    return;
  }

  try {
    const completedSession = db.endStudySession(userId, guildId, note || undefined);

    if (!completedSession) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('⚠️ エラー')
        .setDescription('現在、計測中の勉強はありません。');

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const studyDuration = completedSession.endTime! - completedSession.startTime;
    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('お疲れ様でした！')
      .setDescription(`**${completedSession.subject}** の勉強を終了しました。`)
      .addFields(
        {
          name: '集中時間',
          value: formatDuration(studyDuration),
          inline: true
        }
      );

    if (completedSession.notes) {
      embed.addFields({
        name: 'メモ',
        value: completedSession.notes,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error stopping study session:', error);
    await interaction.reply({
      content: 'エラーが発生しました。しばらく待ってから再度お試しください。',
      ephemeral: true
    });
  }
}
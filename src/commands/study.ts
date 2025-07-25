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
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('add')
      .setDescription('過去の勉強記録を手動で追加します')
      .addStringOption(option =>
        option
          .setName('subject')
          .setDescription('勉強した内容')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('minutes')
          .setDescription('勉強時間（分）')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1440) // 24時間
      )
      .addStringOption(option =>
        option
          .setName('date')
          .setDescription('勉強した日付 (YYYY-MM-DD 形式、省略時は今日)')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('notes')
          .setDescription('勉強の内容やメモ')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'start') {
    await handleStart(interaction);
  } else if (subcommand === 'stop') {
    await handleStop(interaction);
  } else if (subcommand === 'add') {
    await handleAdd(interaction);
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

async function handleAdd(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guild?.id;
  const subject = interaction.options.getString('subject', true);
  const minutes = interaction.options.getInteger('minutes', true);
  const dateStr = interaction.options.getString('date');
  const notes = interaction.options.getString('notes');

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
      // YYYY-MM-DD形式のバリデーション
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        await interaction.reply({
          content: '日付は YYYY-MM-DD 形式で入力してください。例: 2024-01-15',
          ephemeral: true
        });
        return;
      }
      
      targetDate = new Date(dateStr + 'T12:00:00');
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

    // 未来の日付チェック
    const now = new Date();
    if (targetDate > now) {
      await interaction.reply({
        content: '未来の日付は指定できません。',
        ephemeral: true
      });
      return;
    }

    // セッションの開始・終了時刻を計算（指定日の12:00から）
    const startTime = targetDate.getTime();
    const endTime = startTime + (minutes * 60 * 1000);

    // データベースに直接挿入
    const stmt = db['db'].prepare(`
      INSERT INTO study_sessions (userId, guildId, subject, startTime, endTime, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(userId, guildId, subject, startTime, endTime, notes || null);

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('勉強記録を追加しました！')
      .setDescription(`**${subject}** の勉強記録を追加しました。`)
      .addFields(
        {
          name: '勉強時間',
          value: formatDuration(minutes * 60 * 1000),
          inline: true
        },
        {
          name: '勉強日',
          value: targetDate.toLocaleDateString('ja-JP'),
          inline: true
        }
      );

    if (notes) {
      embed.addFields({
        name: 'メモ',
        value: notes,
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Error adding study session:', error);
    await interaction.reply({
      content: 'エラーが発生しました。しばらく待ってから再度お試しください。',
      ephemeral: true
    });
  }
}
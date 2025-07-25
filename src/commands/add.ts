import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../utils/database.js';
import { formatDuration } from '../utils/timeUtils.js';

export const data = new SlashCommandBuilder()
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
  );

export async function execute(interaction: ChatInputCommandInteraction) {
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
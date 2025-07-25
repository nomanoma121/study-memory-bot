import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../utils/database.js';
import { formatDuration } from '../utils/timeUtils.js';

export const data = new SlashCommandBuilder()
  .setName('edit')
  .setDescription('最近の勉強記録を編集・削除します')
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('編集可能な最近の勉強記録一覧を表示')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('delete')
      .setDescription('勉強記録を削除')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('削除する勉強記録のID')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('update')
      .setDescription('勉強記録の内容を更新')
      .addIntegerOption(option =>
        option
          .setName('id')
          .setDescription('更新する勉強記録のID')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('subject')
          .setDescription('新しい勉強内容')
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('minutes')
          .setDescription('新しい勉強時間（分）')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(1440)
      )
      .addStringOption(option =>
        option
          .setName('notes')
          .setDescription('新しいメモ')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'list') {
    await handleList(interaction);
  } else if (subcommand === 'delete') {
    await handleDelete(interaction);
  } else if (subcommand === 'update') {
    await handleUpdate(interaction);
  }
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guild?.id;

  if (!guildId) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true
    });
    return;
  }

  try {
    // 過去7日間のセッションを取得
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const stmt = db['db'].prepare(`
      SELECT * FROM study_sessions 
      WHERE userId = ? AND guildId = ? AND endTime IS NOT NULL AND startTime >= ?
      ORDER BY startTime DESC
      LIMIT 10
    `);
    
    const sessions = stmt.all(userId, guildId, sevenDaysAgo);

    if (sessions.length === 0) {
      await interaction.reply({
        content: '編集可能な勉強記録がありません（過去7日間）。',
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('編集可能な勉強記録一覧（過去7日間）')
      .setDescription('以下の記録を編集・削除できます：');

    sessions.forEach((session: any) => {
      const duration = session.endTime - session.startTime;
      const date = new Date(session.startTime).toLocaleDateString('ja-JP');
      const time = new Date(session.startTime).toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      embed.addFields({
        name: `ID: ${session.id} - ${session.subject}`,
        value: `📅 ${date} ${time}\n⏱️ ${formatDuration(duration)}${session.notes ? `\n📝 ${session.notes}` : ''}`,
        inline: false
      });
    });

    embed.setFooter({
      text: '編集: /edit update id:<ID>, 削除: /edit delete id:<ID>'
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('Error listing sessions:', error);
    await interaction.reply({
      content: 'エラーが発生しました。',
      ephemeral: true
    });
  }
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guild?.id;
  const sessionId = interaction.options.getInteger('id', true);

  if (!guildId) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true
    });
    return;
  }

  try {
    // セッションの存在確認と所有者チェック
    const stmt = db['db'].prepare(`
      SELECT * FROM study_sessions 
      WHERE id = ? AND userId = ? AND guildId = ?
    `);
    
    const session = stmt.get(sessionId, userId, guildId);

    if (!session) {
      await interaction.reply({
        content: '指定された勉強記録が見つからないか、削除権限がありません。',
        ephemeral: true
      });
      return;
    }

    // セッションを削除
    const deleteStmt = db['db'].prepare('DELETE FROM study_sessions WHERE id = ?');
    deleteStmt.run(sessionId);

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('勉強記録を削除しました')
      .setDescription(`**${(session as any).subject}** の記録（ID: ${sessionId}）を削除しました。`);

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('Error deleting session:', error);
    await interaction.reply({
      content: 'エラーが発生しました。',
      ephemeral: true
    });
  }
}

async function handleUpdate(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const guildId = interaction.guild?.id;
  const sessionId = interaction.options.getInteger('id', true);
  const newSubject = interaction.options.getString('subject');
  const newMinutes = interaction.options.getInteger('minutes');
  const newNotes = interaction.options.getString('notes');

  if (!guildId) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      ephemeral: true
    });
    return;
  }

  if (!newSubject && !newMinutes && newNotes === null) {
    await interaction.reply({
      content: '更新する項目を少なくとも1つ指定してください。',
      ephemeral: true
    });
    return;
  }

  try {
    // セッションの存在確認
    const stmt = db['db'].prepare(`
      SELECT * FROM study_sessions 
      WHERE id = ? AND userId = ? AND guildId = ?
    `);
    
    const session = stmt.get(sessionId, userId, guildId);

    if (!session) {
      await interaction.reply({
        content: '指定された勉強記録が見つからないか、編集権限がありません。',
        ephemeral: true
      });
      return;
    }

    // 更新内容を準備
    const updates = [];
    const values = [];

    if (newSubject) {
      updates.push('subject = ?');
      values.push(newSubject);
    }

    if (newMinutes) {
      const newEndTime = (session as any).startTime + (newMinutes * 60 * 1000);
      updates.push('endTime = ?');
      values.push(newEndTime);
    }

    if (newNotes !== null) {
      updates.push('notes = ?');
      values.push(newNotes || null);
    }

    values.push(sessionId);

    // 更新実行
    const updateStmt = db['db'].prepare(`
      UPDATE study_sessions 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `);
    
    updateStmt.run(...values);

    // 更新後のセッションを取得
    const updatedSession = stmt.get(sessionId, userId, guildId) as any;
    const duration = updatedSession.endTime - updatedSession.startTime;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('勉強記録を更新しました')
      .setDescription(`**${updatedSession.subject}** の記録（ID: ${sessionId}）を更新しました。`)
      .addFields({
        name: '更新後の内容',
        value: `⏱️ ${formatDuration(duration)}${updatedSession.notes ? `\n📝 ${updatedSession.notes}` : ''}`,
        inline: false
      });

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (error) {
    console.error('Error updating session:', error);
    await interaction.reply({
      content: 'エラーが発生しました。',
      ephemeral: true
    });
  }
}
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('ボットの使い方とコマンド一覧を表示します');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('📚 勉強時間管理ボット - 使い方')
    .setDescription('このボットを使って勉強時間を記録・共有し、モチベーションを向上させましょう！')
    .addFields(
      {
        name: '📖 勉強を開始する',
        value: '`/study start [subject] [force]`\n• **subject**: 勉強内容（省略可）\n• **force**: 進行中のセッションを強制終了\n\n例: `/study start subject:数学`',
        inline: false
      },
      {
        name: '✅ 勉強を終了する',
        value: '`/study stop [note]`\n• **note**: 振り返りメモ（省略可）\n\n例: `/study stop note:問題集3章完了`',
        inline: false
      },
      {
        name: '👥 勉強中のメンバーを確認',
        value: '`/status`\n現在勉強中のメンバーと進行時間を表示',
        inline: false
      },
      {
        name: '📊 個人の勉強ログを確認',
        value: '`/log [period] [user]`\n• **period**: today/week/month/all\n• **user**: 対象ユーザー（省略時は自分）\n\n例: `/log period:week user:@username`',
        inline: false
      },
      {
        name: '🏆 ランキングを確認',
        value: '`/rank [period]`\n• **period**: today/week/month/all\nサーバー内の勉強時間ランキング（上位10名）\n\n例: `/rank period:month`',
        inline: false
      },
      {
        name: '❓ ヘルプ',
        value: '`/help`\nこのヘルプメッセージを表示',
        inline: false
      }
    )
    .addFields(
      {
        name: '💡 使い方のコツ',
        value: '• 短い休憩時は `/study stop` せずに継続もOK\n• `subject` で教科を分けると統計が見やすくなります\n• `force` オプションで前のセッションを強制終了できます',
        inline: false
      }
    )
    .setFooter({
      text: '頑張って勉強しましょう！📚✨'
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
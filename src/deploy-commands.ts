import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

config();

const commands: any[] = [];

export async function deployCommands() {
  try {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    console.log('🔍 Loading command files...');
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = await import(filePath);
      
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`✓ Loaded: ${command.data.name}`);
      } else {
        console.log(`⚠️ [WARNING] ${filePath} is missing required "data" or "execute" property.`);
      }
    }

    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

    console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

    // ギルド専用コマンドとして登録（即座に反映される）
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      console.error('❌ DISCORD_GUILD_ID environment variable is required for guild commands');
      process.exit(1);
    }

    const data = await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guildId),
      { body: commands },
    ) as any[];

    console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    process.exit(1);
  }
}

// 直接実行された場合のみデプロイを実行
if (require.main === module) {
  deployCommands();
}
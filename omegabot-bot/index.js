import { Client, GatewayIntentBits, EmbedBuilder, Partials } from "discord.js";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("OmegaBot is running ✅");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

client.once("ready", () => {
  console.log(`Bot is ready as ${client.user.tag}`);
  console.log(`Serving ${client.guilds.cache.size} servers`);
});

client.on("guildMemberAdd", async (member) => {
  try {
    const configSnap = await get(ref(database, `guilds/${member.guild.id}/config`));
    const config = configSnap.val();
    if (!config?.welcome?.enabled || !config.welcome.channelId) return;
    const channel = member.guild.channels.cache.get(config.welcome.channelId);
    if (!channel || !channel.isTextBased()) return;
    let content = config.welcome.content || "";
    if (content) {
      content = content.replace(/{user}/g, `<@${member.id}>`);
      content = content.replace(/{username}/g, member.user.username);
      content = content.replace(/{server}/g, member.guild.name);
      content = content.replace(/{memberCount}/g, member.guild.memberCount.toString());
    }
    const messageData = {};
    if (content) messageData.content = content;
    if (config.welcome.embedEnabled) {
      const embed = new EmbedBuilder();
      if (config.welcome.embedTitle) embed.setTitle(config.welcome.embedTitle.replace(/{user}/g, member.user.username).replace(/{server}/g, member.guild.name));
      if (config.welcome.embedDescription) embed.setDescription(config.welcome.embedDescription.replace(/{user}/g, `<@${member.id}>`).replace(/{username}/g, member.user.username).replace(/{server}/g, member.guild.name).replace(/{memberCount}/g, member.guild.memberCount.toString()));
      if (config.welcome.embedColor) embed.setColor(parseInt(config.welcome.embedColor.replace("#", ""), 16));
      if (config.welcome.embedThumbnail === "{avatar}") embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
      else if (config.welcome.embedThumbnail) embed.setThumbnail(config.welcome.embedThumbnail);
      if (config.welcome.embedImage) embed.setImage(config.welcome.embedImage);
      if (config.welcome.embedFooter) embed.setFooter({ text: config.welcome.embedFooter.replace(/{memberCount}/g, member.guild.memberCount.toString()) });
      messageData.embeds = [embed];
    }
    if (messageData.content || messageData.embeds) await channel.send(messageData);
  } catch (error) {
    console.error("Welcome error:", error.message);
  }
});

client.on("guildMemberRemove", async (member) => {
  try {
    const configSnap = await get(ref(database, `guilds/${member.guild.id}/config`));
    const config = configSnap.val();
    if (!config?.leave?.enabled || !config.leave.channelId) return;
    const channel = member.guild.channels.cache.get(config.leave.channelId);
    if (!channel || !channel.isTextBased()) return;
    let content = config.leave.content || "";
    if (content) {
      content = content.replace(/{user}/g, member.user.username);
      content = content.replace(/{username}/g, member.user.username);
      content = content.replace(/{server}/g, member.guild.name);
      content = content.replace(/{memberCount}/g, member.guild.memberCount.toString());
    }
    const messageData = {};
    if (content) messageData.content = content;
    if (config.leave.embedEnabled) {
      const embed = new EmbedBuilder();
      if (config.leave.embedTitle) embed.setTitle(config.leave.embedTitle.replace(/{user}/g, member.user.username).replace(/{server}/g, member.guild.name));
      if (config.leave.embedDescription) embed.setDescription(config.leave.embedDescription.replace(/{user}/g, member.user.username).replace(/{username}/g, member.user.username).replace(/{server}/g, member.guild.name).replace(/{memberCount}/g, member.guild.memberCount.toString()));
      if (config.leave.embedColor) embed.setColor(parseInt(config.leave.embedColor.replace("#", ""), 16));
      if (config.leave.embedThumbnail === "{avatar}") embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
      else if (config.leave.embedThumbnail) embed.setThumbnail(config.leave.embedThumbnail);
      if (config.leave.embedImage) embed.setImage(config.leave.embedImage);
      if (config.leave.embedFooter) embed.setFooter({ text: config.leave.embedFooter.replace(/{memberCount}/g, member.guild.memberCount.toString()) });
      messageData.embeds = [embed];
    }
    if (messageData.content || messageData.embeds) await channel.send(messageData);
  } catch (error) {
    console.error("Leave error:", error.message);
  }
});

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    const guild = reaction.message.guild;
    if (!guild) return;
    const configSnap = await get(ref(database, `guilds/${guild.id}/config`));
    const config = configSnap.val();
    if (!config?.verification?.enabled) return;
    if (reaction.message.channel.id !== config.verification.channelId) return;
    if (reaction.emoji.name !== config.verification.emoji) return;
    const member = await guild.members.fetch(user.id);
    if (!member) return;
    let role = guild.roles.cache.get(config.verification.roleId);
    if (!role) role = await guild.roles.fetch(config.verification.roleId);
    if (!role) return;
    await member.roles.add(role);
    console.log(`Verified: ${user.username} in ${guild.name}`);
  } catch (error) {
    console.error("Verification error:", error.message);
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("DISCORD_BOT_TOKEN not found!");
  process.exit(1);
}
client.login(token);

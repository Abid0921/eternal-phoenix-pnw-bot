import { Client, GatewayIntentBits, Partials } from "discord.js";
import fetch from "node-fetch";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

// Keep-alive server for Render
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(3000, () => console.log("Keep-alive server started"));

// Discord client with safe intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// PnW API helper
const API = "https://api.politicsandwar.com/v1";
const API_KEY = process.env.PNW_KEY;

async function pnw(endpoint) {
  try {
    const res = await fetch(`${API}/${endpoint}&key=${API_KEY}`);
    return await res.json();
  } catch (err) {
    console.error("PNW API Error:", err);
    return {};
  }
}

// Prefix
const PREFIX = "+";

// Global error handlers
client.on("error", (err) => console.error("Discord client error:", err));
process.on("unhandledRejection", (reason) =>
  console.error("Unhandled promise rejection:", reason)
);

// Message handler
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    // +nation <id>
    if (command === "nation") {
      const id = args[0];
      if (!id) return message.reply("Please provide a nation ID.");
      const data = await pnw(`nation?id=${id}`);
      if (!data.nation) return message.reply("Nation not found.");
      return message.reply(
        `🏳️ **${data.nation.name}**\n` +
        `👤 Leader: ${data.nation.leader}\n` +
        `🌆 Cities: ${data.nation.cities}\n` +
        `📊 Score: ${data.nation.score}`
      );
    }

    // +alliance <id>
    if (command === "alliance") {
      const id = args[0];
      if (!id) return message.reply("Please provide an alliance ID.");
      const data = await pnw(`alliance?id=${id}`);
      if (!data.alliance) return message.reply("Alliance not found.");
      return message.reply(
        `🏛️ **${data.alliance.name}**\n` +
        `👥 Members: ${data.alliance.members?.length || 0}\n` +
        `📊 Score: ${data.alliance.score}`
      );
    }

    // +warroom <nationid>
    if (command === "warroom") {
      const nid = args[0];
      if (!nid) return message.reply("Please provide a nation ID.");
      const data = await pnw(`nation?id=${nid}`);
      if (!data.nation) return message.reply("Nation not found.");

      const safeName = data.nation.leader.replace(/[^a-zA-Z0-9]/g, "");
      const room = await message.guild.channels.create({
        name: `war-${data.nation.nationid}-${safeName}`,
        type: 0 // GUILD_TEXT
      });

      await room.send(
        `🔺 **WAR ROOM CREATED**\n` +
        `🏳️ Nation: ${data.nation.name} (${data.nation.nationid})\n` +
        `👤 Leader: ${data.nation.leader}`
      );

      return message.reply(`War room created → ${room}`);
    }

    // +spytarget
    if (command === "spytarget") {
      const wars = await pnw(`wars?active=true`);
      const targets = (wars.wars || []).filter(
        (w) => w.war_type === "raid" || w.war_type === "attrition"
      );
      if (!targets.length) return message.reply("No spy targets found.");
      const pick = targets[Math.floor(Math.random() * targets.length)];
      return message.reply(`🎯 Spy target: Nation **${pick.defender_nation_id}**`);
    }

    // Disabled for safe intents
    if (["inactive", "colorbloc", "policyaudit"].includes(command)) {
      return message.reply(
        "This command requires GuildMembers intent; currently disabled for Render safe deployment."
      );
    }
  } catch (err) {
    console.error("Command error:", err);
    message.reply("An error occurred while executing this command.");
  }
});

// Login bot
client.login(process.env.BOT_TOKEN);

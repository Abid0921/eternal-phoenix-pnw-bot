import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import fetch from "node-fetch";
import dotenv from "dotenv";
import express from "express";
dotenv.config();

// ─────────────────────────────
// KEEP-ALIVE SERVER FOR RENDER
// ─────────────────────────────
const app = express();
app.get("/", (req, res) => res.send("Bot running"));
app.listen(3000, () => console.log("Keep-alive server started"));

// ─────────────────────────────
// DISCORD CLIENT
// ─────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// ─────────────────────────────
// PNW API SETTINGS
// ─────────────────────────────
const API = "https://api.politicsandwar.com/v1";
const API_KEY = process.env.PNW_KEY;

// API request helper
async function pnw(endpoint) {
  const res = await fetch(`${API}/${endpoint}&key=${API_KEY}`);
  const json = await res.json();
  return json;
}

// ─────────────────────────────
// REGISTER SLASH COMMANDS
// ─────────────────────────────
const commands = [
  // War room creator
  new SlashCommandBuilder()
    .setName("warroom")
    .setDescription("Create a war room for a target nation")
    .addIntegerOption(o =>
      o.setName("nationid")
        .setDescription("Nation ID")
        .setRequired(true)
    ),

  // Inactive audit
  new SlashCommandBuilder()
    .setName("inactive")
    .setDescription("List inactive alliance members"),

  // Color bloc audit
  new SlashCommandBuilder()
    .setName("colorbloc")
    .setDescription("List members in the wrong color bloc"),

  // Policy audit
  new SlashCommandBuilder()
    .setName("policyaudit")
    .setDescription("List members with wrong national policy"),

  // Spy target randomizer
  new SlashCommandBuilder()
    .setName("spytarget")
    .setDescription("Provides a random spy target"),

  // Nation lookup
  new SlashCommandBuilder()
    .setName("nation")
    .setDescription("Look up nation info")
    .addIntegerOption(o =>
      o.setName("id")
        .setDescription("Nation ID")
        .setRequired(true)
    ),

  // Alliance lookup
  new SlashCommandBuilder()
    .setName("alliance")
    .setDescription("Look up alliance info")
    .addIntegerOption(o =>
      o.setName("id")
        .setDescription("Alliance ID")
        .setRequired(true)
    )
].map(c => c.toJSON());

// Register commands on startup
const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("Slash commands registered.");
  } catch (err) {
    console.error("Command registration failed:", err);
  }
})();

// ─────────────────────────────
// BOT ONLINE
// ─────────────────────────────
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ─────────────────────────────
// COMMAND HANDLER
// ─────────────────────────────
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  // WAR ROOM MAKER
  if (i.commandName === "warroom") {
    const nid = i.options.getInteger("nationid");
    const data = await pnw(`nation?id=${nid}`);

    if (!data.nation) return i.reply("Nation not found.");

    const safeName = data.nation.leader.replace(/[^a-zA-Z0-9]/g, "");

    const room = await i.guild.channels.create({
      name: `war-${data.nation.nationid}-${safeName}`,
      type: 0
    });

    room.send(
      `🔺 **WAR ROOM CREATED**\n` +
      `🏳️ Nation: ${data.nation.name} (${data.nation.nationid})\n` +
      `👤 Leader: ${data.nation.leader}`
    );

    return i.reply(`War room created → ${room}`);
  }

  // INACTIVE AUDIT
  if (i.commandName === "inactive") {
    const alliance = await pnw(`alliance?id=${process.env.ALLIANCE_ID}`);
    const list = alliance.members.filter(
      m => m.last_active > 48 || m.vacationmode === 1
    );

    if (!list.length) return i.reply("All members are active.");

    return i.reply(
      list.map(m => `${m.nation} — ${m.last_active}h inactive`).join("\n")
        .slice(0, 1900)
    );
  }

  // COLOR BLOC AUDIT
  if (i.commandName === "colorbloc") {
    const alliance = await pnw(`alliance?id=${process.env.ALLIANCE_ID}`);
    const list = alliance.members.filter(m => m.color !== process.env.COLOR);

    if (!list.length) return i.reply("All members are in the correct color bloc.");

    return i.reply(
      list.map(m => `${m.nation} — ${m.color}`).join("\n").slice(0, 1900)
    );
  }

  // POLICY AUDIT
  if (i.commandName === "policyaudit") {
    const alliance = await pnw(`alliance?id=${process.env.ALLIANCE_ID}`);
    const list = alliance.members.filter(m => m.policy !== process.env.POLICY);

    if (!list.length) return i.reply("All members have the correct policy.");

    return i.reply(
      list.map(m => `${m.nation} — ${m.policy}`).join("\n").slice(0, 1900)
    );
  }

  // SPY TARGET GIVER
  if (i.commandName === "spytarget") {
    const wars = await pnw(`wars?active=true`);
    const targets = wars.wars.filter(
      w => w.war_type === "raid" || w.war_type === "attrition"
    );

    if (!targets.length) return i.reply("No spy targets found.");

    const pick = targets[Math.floor(Math.random() * targets.length)];

    return i.reply(`🎯 Spy target: Nation **${pick.defender_nation_id}**`);
  }

  // NATION LOOKUP
  if (i.commandName === "nation") {
    const id = i.options.getInteger("id");
    const data = await pnw(`nation?id=${id}`);

    if (!data.nation) return i.reply("Nation not found.");

    return i.reply(
      `🏳️ **${data.nation.name}**\n` +
      `👤 Leader: ${data.nation.leader}\n` +
      `🌆 Cities: ${data.nation.cities}\n` +
      `📊 Score: ${data.nation.score}`
    );
  }

  // ALLIANCE LOOKUP
  if (i.commandName === "alliance") {
    const id = i.options.getInteger("id");
    const data = await pnw(`alliance?id=${id}`);

    if (!data.alliance) return i.reply("Alliance not found.");

    return i.reply(
      `🏛️ **${data.alliance.name}**\n` +
      `👥 Members: ${data.alliance.members.length}\n` +
      `📊 Score: ${data.alliance.score}`
    );
  }
});

// LOGIN BOT
client.login(process.env.BOT_TOKEN);

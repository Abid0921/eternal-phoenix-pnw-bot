import { Client, GatewayIntentBits, Partials } from "discord.js";
import fetch from "node-fetch";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

// Keep-alive server for Render
const app = express();
app.get("/", (req, res) => res.send("Bot alive"));
app.listen(3000, () => console.log("Keep alive running"));

// Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

const PREFIX = process.env.PREFIX || "+";
const API_KEY = process.env.PNW_KEY;

// Warroom role storage
let warRoles = [];

// API helper
async function pnw(url) {
  try {
    const res = await fetch(`${url}&key=${API_KEY}`);
    return await res.json();
  } catch (err) {
    console.error("PNW API Error:", err);
    return null;
  }
}

client.on("ready", () => {
  console.log(`Bot online as ${client.user.tag}`);
});

// Message handler
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  try {

    // ------------------ NATION ------------------
    if (cmd === "nation") {
      const id = args[0];
      if (!id) return message.reply("Provide nation ID.");
      const data = await pnw(`https://api.politicsandwar.com/api/nation/id=${id}?`);
      if (!data || !data.name) return message.reply("Nation not found.");
      return message.reply(
        `🏳️ Nation: ${data.name}\n` +
        `👤 Leader: ${data.leadername}\n` +
        `🌆 Cities: ${data.cities}\n` +
        `📊 Score: ${data.score}`
      );
    }

    // ------------------ ALLIANCE ------------------
    if (cmd === "alliance") {
      const id = args[0];
      if (!id) return message.reply("Provide alliance ID.");
      const data = await pnw(`https://api.politicsandwar.com/api/alliance/id=${id}?`);
      if (!data || !data.name) return message.reply("Alliance not found.");
      return message.reply(
        `🏛️ Alliance: ${data.name}\n` +
        `👥 Members: ${data.members}\n` +
        `📊 Score: ${data.score}`
      );
    }

    // ------------------ WARROOM ------------------
    if (cmd === "warroom") {
      const id = args[0];
      if (!id) return message.reply("Provide nation ID.");
      const data = await pnw(`https://api.politicsandwar.com/api/nation/id=${id}?`);
      if (!data || !data.name) return message.reply("Nation not found.");

      const channel = await message.guild.channels.create({
        name: `war-${data.name}`.replace(/ /g,"-"),
        type: 0
      });

      // Apply warRoles
      for (const roleID of warRoles) {
        await channel.permissionOverwrites.create(roleID, {
          ViewChannel: true,
          SendMessages: true
        });
      }

      channel.send(
        `⚔ WAR ROOM CREATED\nNation: ${data.name}\nLeader: ${data.leadername}\nCities: ${data.cities}`
      );

      return message.reply(`War room created: ${channel}`);
    }

    // ------------------ WARROLE ------------------
    if (cmd === "warrole") {
      const role = message.mentions.roles.first();
      if (!role) return message.reply("Mention a role to add.");
      if (!warRoles.includes(role.id)) warRoles.push(role.id);
      return message.reply(`Role ${role.name} will now be added to all war rooms.`);
    }

    // ------------------ WARADD ------------------
    if (cmd === "waradd") {
      const user = message.mentions.users.first();
      if (!user) return message.reply("Mention a user to add.");
      await message.channel.permissionOverwrites.create(user.id, {
        ViewChannel: true,
        SendMessages: true
      });
      return message.reply(`${user.username} added to this war room.`);
    }

    // ------------------ WARCLOSE ------------------
    if (cmd === "warclose") {
      if (!message.channel.name.startsWith("war-")) return message.reply("Not a war room.");
      await message.channel.delete();
      return;
    }

    // ------------------ SPY TARGET ------------------
    if (cmd === "spytarget") {
      // grabs active wars
      const data = await pnw(`https://api.politicsandwar.com/api/wars/?`);
      if (!data || !data.wars) return message.reply("Could not fetch wars.");
      const wars = data.wars.filter(w => w.war_type === "raid");
      if (!wars.length) return message.reply("No spy targets.");
      const pick = wars[Math.floor(Math.random() * wars.length)];
      return message.reply(`🎯 Spy target nation ID: ${pick.defender_nation_id}`);
    }

    // ------------------ INACTIVE ------------------
    if (cmd === "inactive") {
      const members = await message.guild.members.fetch();
      const inactive = members.filter(m => m.presence?.status === "offline");
      return message.reply(
        `Inactive members:\n${inactive.map(m=>m.user.tag).join("\n") || "None"}`
      );
    }

    // ------------------ COLORBLOC ------------------
    if (cmd === "colorbloc") {
      return message.reply("Color bloc audit not configured yet.");
    }

    // ------------------ POLICY ------------------
    if (cmd === "policyaudit") {
      return message.reply("Policy audit not configured yet.");
    }

  } catch (err) {
    console.log(err);
    return message.reply("Command error.");
  }

});

client.login(process.env.BOT_TOKEN);

// --- KEEP RAILWAY RUNNING 24/7 ---
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Bot is alive!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));
// -----------------------------------


require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionsBitField,
    Collection
} = require("discord.js");

const TOKEN = process.env.TOKEN;

// CONFIG
const PREFIX = "?";
const REQUIRED_INVITES = 2;

// ENV IDs
const PUBLIC_MCFA_CHANNEL = process.env.MCFA_CHANNEL_ID;
const PRIVATE_STOCK_CHANNEL = process.env.PRIVATE_STOCK_CHANNEL_ID;
const SCREENSHOT_APPROVAL_CHANNEL = process.env.SCREENSHOT_APPROVAL_CHANNEL_ID;
const STAFF_LOG_CHANNEL = process.env.STAFF_PRIVATE_CHANNEL_ID;

// FILE
const MCFA_FILE = path.join(__dirname, "mcfa.json");
if (!fs.existsSync(MCFA_FILE)) fs.writeFileSync(MCFA_FILE, JSON.stringify({ stock: [] }, null, 2));

function loadStock() {
    return JSON.parse(fs.readFileSync(MCFA_FILE, "utf8"));
}
function saveStock(data) {
    fs.writeFileSync(MCFA_FILE, JSON.stringify(data, null, 2));
}

// Cooldown
const buttonCooldown = new Collection();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.once("ready", () => {
    console.log(`✅ BOT ONLINE AS ${client.user.tag}`);
});

// UTILS
async function getInviteUsesForUser(guild, userId) {
    try {
        const invites = await guild.invites.fetch();
        let total = 0;
        invites.forEach(inv => {
            if (inv.inviter && inv.inviter.id === userId) total += inv.uses ?? 0;
        });
        return total;
    } catch {
        return 0;
    }
}

function countClaims(userId) {
    return loadStock().stock.filter(i => i.takenBy === userId).length;
}
function getMaxClaims(invites) {
    return Math.floor(invites / REQUIRED_INVITES);
}

// Update stock embed
async function logToStock(item) {
    try {
        const ch = await client.channels.fetch(PRIVATE_STOCK_CHANNEL);

        const embed = new EmbedBuilder()
            .setColor(item.takenBy ? 0xff0000 : 0x00ff00)
            .setTitle("📦 MCFA Stock Update")
            .addFields(
                { name: "Email", value: item.email },
                { name: "Password", value: item.password },
                {
                    name: "Status",
                    value: item.takenBy ? `TAKEN by <@${item.takenBy}>` : "Available"
                }
            )
            .setTimestamp();

        if (!item.stockMessageId) {
            const msg = await ch.send({ embeds: [embed] });
            item.stockMessageId = msg.id;
            saveStock(loadStock());
        } else {
            const old = await ch.messages.fetch(item.stockMessageId);
            await old.edit({ embeds: [embed] });
        }
    } catch (e) {
        console.log("Stock update failed:", e);
    }
}


// ============================
// MESSAGE HANDLER
// ============================

client.on("messageCreate", async msg => {
    if (!msg.guild || msg.author.bot) return;
    if (!msg.content.startsWith(PREFIX)) return;

    const args = msg.content.slice(PREFIX.length).trim().split(" ");
    const cmd = args.shift().toLowerCase();

    // HELP
    if (cmd === "help") {
        return msg.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setTitle("📘 MCFA Bot Help")
                    .setDescription(
                        "**Commands:**\n" +
                        "• ?help\n" +
                        "• ?invite\n" +
                        "• ?stock\n" +
                        "• ?setupmcfa *(admin)*\n" +
                        "• ?addmcfa email:x password:y *(admin)*\n" +
                        "• ?givemcfa @user *(admin)*"
                    )
            ]
        });
    }

    // INVITE
    if (cmd === "invite") {
        const inv = await getInviteUsesForUser(msg.guild, msg.author.id);
        return msg.reply({
            embeds: [new EmbedBuilder().setColor(0x00ffff).setDescription(`🎉 You have **${inv} invites**`)]
        });
    }

    // STOCK
    if (cmd === "stock") {
        const d = loadStock();
        return msg.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setTitle("📦 MCFA Stock")
                    .addFields(
                        { name: "Total", value: `${d.stock.length}` },
                        { name: "Available", value: `${d.stock.filter(i => !i.takenBy).length}` }
                    )
            ]
        });
    }

    // SETUPMCFA (unchanged)
    if (cmd === "setupmcfa") {
        if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return msg.reply({ content: "❌ Admin only." });

        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("🌌 MCFA Premium Access System")
            .setDescription(
                "**Welcome to MCFA Auto Distribution**\n\n" +
                "### 🔥 Requirements\n" +
                `• **${REQUIRED_INVITES} invites = 1 MCFA account**\n` +
                "• Subscribe to our YouTube channel & upload screenshot\n\n" +
                "### 📥 Claim Steps\n" +
                "1. Press **Get MCFA** below\n" +
                "2. Bot will DM you\n" +
                "3. Upload your subscription screenshot\n" +
                "4. Wait for staff approval\n\n" +
                "### 🤖 Bot Handles\n" +
                "• Invite checking\n" +
                "• Screenshot verification\n" +
                "• Stock management\n" +
                "• Account delivery"
            )
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: "Made by IronWall" })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("get_mcfa")
                .setLabel("🚀 Get MCFA")
                .setStyle(ButtonStyle.Primary)
        );

        const channel = await client.channels.fetch(PUBLIC_MCFA_CHANNEL);
        await channel.send({ embeds: [embed], components: [row] });

        return msg.reply({ content: "✅ Posted MCFA embed." });
    }

    // ADDMCFA
    if (cmd === "addmcfa") {
        if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return msg.reply("❌ Admin only.");

        const email = msg.content.match(/email:([^ ]+)/i)?.[1];
        const pass = msg.content.match(/password:([^ ]+)/i)?.[1];
        if (!email || !pass) return msg.reply("❌ Use: `?addmcfa email:x password:y`");

        const data = loadStock();
        const item = { email, password: pass, takenBy: null, stockMessageId: null };
        data.stock.push(item);
        saveStock(data);
        await logToStock(item);

        return msg.reply("✅ Added to stock.");
    }

    // GIVEMCFA
    if (cmd === "givemcfa") {
        if (!msg.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return msg.reply("❌ Admin only.");

        const target = msg.mentions.users.first();
        if (!target) return msg.reply("Mention someone.");

        const data = loadStock();
        const item = data.stock.find(i => !i.takenBy);
        if (!item) return msg.reply("❌ No stock left.");

        item.takenBy = target.id;
        saveStock(data);
        await logToStock(item);

        await target.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle("🎁 Your Free MCFA")
                    .addFields(
                        { name: "Email", value: `||${item.email}||` },
                        { name: "Password", value: `||${item.password}||` }
                    )
            ]
        });

        return msg.reply(`Sent to <@${target.id}>`);
    }
});


// ============================
// BUTTON HANDLER
// ============================

client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return;

    // USER PRESSES "GET MCFA"
    if (interaction.customId === "get_mcfa") {
        const userId = interaction.user.id;

        if (buttonCooldown.has(userId))
            return interaction.reply({ content: "⌛ Wait 10 seconds.", ephemeral: true });

        buttonCooldown.set(userId, Date.now());
        setTimeout(() => buttonCooldown.delete(userId), 10000);

        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const user = interaction.user;

        const invites = await getInviteUsesForUser(guild, user.id);
        const claim = countClaims(user.id);
        const max = getMaxClaims(invites);

        if (invites < REQUIRED_INVITES)
            return interaction.editReply(`❌ Not enough invites.`);

        if (claim >= max)
            return interaction.editReply("❌ You used all your invites.");

        const dm = await user.createDM().catch(() => {});
        if (!dm) return interaction.editReply("❌ Enable DMs.");

        await dm.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setTitle("📸 Upload Screenshot")
                    .setDescription("Upload your YouTube subscription screenshot here.")
            ]
        });

        return interaction.editReply("📩 Check your DM.");
    }
});


// ============================
// DM SCREENSHOT HANDLER
// ============================

client.on("messageCreate", async msg => {
    if (msg.guild) return;
    if (msg.author.bot) return;

    if (!msg.attachments.first()) return;

    const user = msg.author;

    const approvalChannel = await client.channels.fetch(SCREENSHOT_APPROVAL_CHANNEL);

    const screenshot = msg.attachments.first().url;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`approve_${user.id}`)
            .setLabel("✅ Approve")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`deny_${user.id}`)
            .setLabel("❌ Deny")
            .setStyle(ButtonStyle.Danger)
    );

    await approvalChannel.send({
        embeds: [
            new EmbedBuilder()
                .setColor(0xffff00)
                .setTitle("📸 Screenshot Approval Needed")
                .setDescription(`User: <@${user.id}>`)
                .setImage(screenshot)
                .setTimestamp()
        ],
        components: [row]
    });

    await msg.reply("📤 Screenshot sent to staff. Wait for approval.");
});


// ============================
// STAFF APPROVAL HANDLER
// ============================

client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) return;

    const [action, userId] = interaction.customId.split("_");
    if (!["approve", "deny"].includes(action)) return;

    const user = await client.users.fetch(userId);

    const data = loadStock();

    if (action === "deny") {
        await user.send("❌ Your screenshot was denied. Upload again.");
        return interaction.reply({ content: "❌ Denied.", ephemeral: true });
    }

    // APPROVED
    const item = data.stock.find(i => !i.takenBy);
    if (!item) {
        await user.send("❌ No MCFA stock left.");
        return interaction.reply({ content: "❌ No stock left.", ephemeral: true });
    }

    item.takenBy = userId;
    saveStock(data);
    await logToStock(item);

    await user.send({
        embeds: [
            new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle("🎉 MCFA Approved!")
                .addFields(
                    { name: "Email", value: `||${item.email}||` },
                    { name: "Password", value: `||${item.password}||` }
                )
        ]
    });

    await interaction.reply({ content: "✅ Approved & sent.", ephemeral: true });
});


// LOGIN
client.login(TOKEN);

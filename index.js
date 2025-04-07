// bot.js
import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { readAllEnvValues, updateEscValue } from './pulumi/index.js'; // Reuse from previous setup
import { resolveSecret } from './1password/index.js';
dotenv.config();
import escapeStringRegexp from 'escape-string-regexp'; // npm i escape-string-regexp

const token = await resolveSecret(process.env.TELEGRAM_BOT_TOKEN);
const bot = new Telegraf(token);
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Load current secrets (flattened)
let escSecrets = {};

async function loadSecrets() {
    escSecrets = await readAllEnvValues(true);
    console.log("🔐 ESC Secrets loaded");
}
await loadSecrets();

// Generate a random string for rotating the secret
function generateRandomSecret(length = 24) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return [...Array(length)].map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// 🚨 Middleware: Watch for leaked secrets

bot.on('message', async (ctx, next) => {
    const text = ctx.message?.text;
    if (!text) return next(); // Let other commands proceed if no text

    for (const [keyPath, secretValue] of Object.entries(escSecrets)) {
        if (typeof secretValue !== 'string' || !secretValue.trim()) continue;

        // Create a safe regex to match the secret exactly
        const safeRegex = new RegExp(`\\b${escapeStringRegexp(secretValue)}\\b`, 'i');

        if (safeRegex.test(text)) {
            // 🔄 Rotate secret
            const newSecret = generateRandomSecret();
            await updateEscValue(keyPath, newSecret);
            await loadSecrets(); // refresh secret cache

            // 🧨 Notify admin
            await bot.telegram.sendMessage(ADMIN_CHAT_ID, `
🚨 *Leaked Secret Detected!*
📍 Chat: ${ctx.chat.id}
🔑 Key: ${keyPath}
🕵️ Old: \`${secretValue}\`
🔁 Secret has been rotated.
      `.trim(), { parse_mode: "Markdown" });

            // 🧹 Delete leaked message
            try {
                await ctx.deleteMessage();
            } catch (err) {
                console.error("❌ Failed to delete leaked message:", err.message);
            }

            return; // Don't call next(), leak was handled
        }
    }

    return next(); // No secret matched → allow other middleware
});


bot.start(async (ctx) => {
    const introMessage = `
  👋 Hello, I'm *AntiLeaked.io* — your secret-watching bot 🕵️‍♂️
  
  I'm here to monitor your group messages and _automatically detect leaked secrets_ 🔐 like API keys, credentials, and tokens.
  
  ✨ Integrated with:
  • [Pulumi ESC](https://www.pulumi.com/esc/) — for secret environment management
  • [1Password](https://1password.com) — for secure storage and rotation
  
  If a secret is leaked, I will:
  1️⃣ Alert the admin  
  2️⃣ Rotate the secret  
  3️⃣ Delete the leaked message (if possible)
  
  Use /env in private chat to view the current environment values.
  
  Let’s keep your infrastructure secure 🔒
  `;

    await ctx.replyWithMarkdown(introMessage, {
        disable_web_page_preview: true,
    });
});

// 📦 /env command (private only)
bot.command('env', async (ctx) => {
    if (ctx.chat.type !== 'private') {
        return ctx.reply('⚠️ This command can only be used in private chat.');
    }

    const data = await readAllEnvValues(true);
    const response = JSON.stringify(data, null, 2);

    if (response.length > 4000) {
        // Too long for Telegram message
        return ctx.reply('📦 Too many variables. Try filtering manually.');
    }

    return ctx.replyWithMarkdownV2(`Current ENV \n \`\`\`json\n${response}\n\`\`\``);
});

// Start bot
bot.launch();
console.log("🤖 Bot is running...");

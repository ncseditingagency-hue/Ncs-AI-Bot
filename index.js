require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const conversations = new Map();
const PAYPAL_EMAIL = process.env.PAYPAL_EMAIL;

const SYSTEM_PROMPT = `You are a professional video editing studio assistant.
Your job is to collect order information from clients, ONE question at a time.

IMPORTANT RULES:
- Always detect and reply in the same language the client uses
- Ask only ONE question at a time, never multiple together
- Be professional but friendly
- Never mention you are an AI

Collect this information in this exact order:
1. Video length (e.g. 30 seconds, 1 minute, 3 minutes)
2. Client's budget in euros (€)
3. Desired style (e.g. dynamic, elegant, minimal, cinematic, funny)
4. Whether they have footage/clips ready on Google Drive (if yes, ask for the Drive link)

After collecting all 4 pieces of information, show a recap in this exact format:

📋 **ORDER SUMMARY**
🎬 Video length: [length]
💶 Budget: [budget]€
🎨 Style: [style]
📁 Clips on Drive: [link or "Not provided"]

Then ask the client to confirm with yes/no.

After confirmation send this (translated to the client's language):
---
✅ Perfect! To confirm your order, please send the payment via PayPal:

📧 **PayPal: ${PAYPAL_EMAIL}**
⚠️ IMPORTANT: Send as **Friends & Family (F&F)** in **euros (€)**
💶 Amount: [budget]€

Once paid, write **PAGATO** (or PAID) here so the editor gets notified!
---

When the client writes "PAGATO" or "PAID":
- Thank them warmly
- Tell them the editor will contact them soon
- Write exactly: ORDINE_CONFERMATO`;

client.on('channelCreate', async (channel) => {
  if (!channel.isTextBased()) return;
  if (!channel.name.toLowerCase().includes('ticket')) return;

  console.log(`🎫 Nuovo ticket rilevato: ${channel.name}`);

  await new Promise(resolve => setTimeout(resolve, 200

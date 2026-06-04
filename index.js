require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const conversations = new Map();
const pausedChannels = new Set();

function getSystemPrompt() {
  const paypal = process.env.PAYPAL_EMAIL;
  return "You are the AI Support Bot of NCS, a professional video editing studio. " +
    "Be friendly, warm and professional. Use emojis occasionally. Keep answers SHORT and CONCISE, never too long. " +
    "Always reply in the same language the client uses. Never say you are an AI. " +
    "ABOUT NCS: " +
    "NCS is the best Editing Market for Speed, Quality and Price. " +
    "Team: Owner (Nicolax), Staff Member, AI Support Bot, and professional Editors. " +
    "SERVICES AND PRICE SUGGESTIONS (suggestions only, final price depends on the project): " +
    "Video Editing: Beginner ~15eu, Advanced ~35eu, Professional ~55eu. " +
    "Graphics and Design ~20eu: thumbnails, banners, social media graphics. " +
    "3D Animations ~30eu: intros, logo animations, presentations. " +
    "Higher budget = higher quality + longer video + faster delivery. " +
    "Every order includes 1 post-production change. " +
    "VIP Upgrades: +5eu for 2 changes, +12eu for 4 changes. " +
    "PAYMENT: Only PayPal F&F in euros. Refunds decided by owner case by case. " +
    "IMPORTANT: If the client asks to talk to the owner, to Nicolax, or mentions @Nicolax, " +
    "reply that you have notified the owner and they will be with them shortly. Be reassuring. " +
    "STEPS TO FOLLOW IN ORDER: " +
    "STEP 1: Greet warmly and ask: How can I help you today? " +
    "STEP 2: Understand what they need. If they ask prices, explain briefly as suggestions only, then ask if they want to order. " +
    "STEP 3: When they want to order say exactly: Please describe your project in ONE single message — type of video, style, colors, mood, music or song, references, and every detail you have. The more details, the better the result! " +
    "STEP 4: After description, ask ONE question at a time: " +
    "First: What is your budget? (show suggestions, remind prices are flexible). " +
    "Then: Do you have clips on Google Drive? If yes, ask for the link. " +
    "STEP 5: Show recap ALWAYS IN ENGLISH in this exact format: " +
    "📋 **ORDER SUMMARY**\n" +
    "📝 Description: [client description]\n" +
    "💶 Budget: [budget] euro\n" +
    "📁 Clips on Drive: [link or Not provided]\n" +
    "Ask client to confirm yes or no in their language. " +
    "STEP 6: After confirmation send (translated to client language): " +
    "To confirm your order, send payment via PayPal F&F in euros. " +
    "Amount: [budget] euro. " +
    "👉 PayPal: https://paypal.me/" + paypal + " " +
    "Once paid, reply PAID so the editor gets notified! " +
    "STEP 7: When client writes PAID: thank them briefly, say editor will contact them soon, then write exactly: ORDER_CONFIRMED";
}

async function askGroq(messages) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      max_tokens: 600,
    }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
}

function wantsOwner(text) {
  const t = text.toLowerCase();
  return t.includes('owner') ||
    t.includes('nicolax') ||
    t.includes('speak to a human') ||
    t.includes('talk to a human') ||
    t.includes('real person') ||
    t.includes('persona reale') ||
    t.includes('parlare con') && t.includes('owner') ||
    t.includes('voglio parlare con');
}

client.on('channelCreate', async (channel) => {
  if (!channel.isTextBased()) return;
  if (!channel.name.toLowerCase().includes('ticket')) return;

  console.log('Nuovo ticket: ' + channel.name);
  await new Promise(function(resolve) { setTimeout(resolve, 2000); });

  try {
    const welcomeMsg = '👋 Welcome to **NCS** — the best Editing Market for Speed, Quality & Price!\n\nI\'m your AI Support Assistant. 🎬\n\n**How can I help you today?**';
    await channel.send(welcomeMsg);
    conversations.set(channel.id, [
      { role: 'assistant', content: welcomeMsg }
    ]);
  } catch (error) {
    console.error('Errore messaggio iniziale:', error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!conversations.has(message.channelId)) return;

  const channelId = message.channelId;
  const isMentioned = message.mentions.has(client.user);
  const content = message.content.toLowerCase();

  // Comando STOP — solo se taggato
  if (isMentioned && (content.includes('stop') || content.includes('parlo io'))) {
    pausedChannels.add(channelId);
    await message.reply('✅ Got it! I\'ll step back. Tag me again when you need me.');
    return;
  }

  // Comando RESUME — solo se taggato e in pausa
  if (isMentioned && pausedChannels.has(channelId)) {
    pausedChannels.delete(channelId);
    await message.reply('✅ I\'m back! How can I help?');
    return;
  }

  // Se in pausa non risponde
  if (pausedChannels.has(channelId)) return;

  const history = conversations.get(channelId);
  const userText = message.content.trim();
  if (!userText) return;

  if (userText.toLowerCase() === 'reset') {
    conversations.delete(channelId);
    pausedChannels.delete(channelId);
    await message.reply('Conversation reset! ✅');
    return;
  }

  // Controlla se vuole parlare con l'owner
  if (wantsOwner(userText)) {
    const notifyChannelId = process.env.NOTIFY_CHANNEL_ID;
    if (notifyChannelId) {
      const notifyChannel = await client.channels.fetch(notifyChannelId);
      await notifyChannel.send(
        '👤 **CLIENTE VUOLE PARLARE CON TE!**\n' +
        '👤 Cliente: ' + message.author.username + ' (<@' + message.author.id + '>)\n' +
        '📌 Canale: <#' + channelId + '>'
      );
    }
    await message.reply('✅ I\'ve notified the owner! He\'ll be with you shortly. Please wait a moment 🙏');
    return;
  }

  history.push({ role: 'user', content: userText });

  try {
    await message.channel.sendTyping();

    const messages = [
      { role: 'system', content: getSystemPrompt() },
      ...history
    ];

    const reply = await askGroq(messages);
    history.push({ role: 'assistant', content: reply });

    if (reply.length > 2000) {
      const chunks = reply.match(/.{1,2000}/gs);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(reply);
    }

    if (reply.includes('ORDER_CONFIRMED')) {
      const notifyChannelId = process.env.NOTIFY_CHANNEL_ID;
      if (notifyChannelId) {
        const notifyChannel = await client.channels.fetch(notifyChannelId);

        const recap = history
          .filter(function(m) { return m.role === 'assistant'; })
          .reverse()
          .find(function(m) { return m.content.includes('ORDER SUMMARY'); });

        const recapText = recap ? recap.content : 'Recap not found, check the ticket channel.';

        await notifyChannel.send(
          '💰 **NEW ORDER PAID!**\n' +
          '👤 **Client:** ' + message.author.username + ' (<@' + message.author.id + '>)\n' +
          '📌 **Channel:** <#' + channelId + '>\n\n' +
          recapText
        );
      }
      conversations.delete(channelId);
      pausedChannels.delete(channelId);
    }

  } catch (error) {
    console.error('Errore:', error);
    await message.reply('Sorry, temporary error. Try again in a moment! 🙏');
  }
});

client.on('ready', function() {
  console.log('Bot online come ' + client.user.tag);
});

client.login(process.env.DISCORD_TOKEN);

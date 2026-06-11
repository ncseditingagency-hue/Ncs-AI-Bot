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
const awaitingFeedback = new Set(); // canali in attesa di feedback opzionale

function isAdmin(member) {
  if (!member) return false;
  return member.roles.cache.some(role => role.name === 'Admin');
}

function getSystemPrompt() {
  const paypal = process.env.PAYPAL_EMAIL;
  return "You are the AI Support Bot of NCS, a professional video editing studio. " +
    "Be friendly, warm and professional. Use emojis occasionally. Keep answers SHORT and CONCISE, never too long. " +
    "Always reply in the same language the client uses. Never say you are an AI. " +

    "ABOUT NCS: " +
    "NCS (also known as NCS Editing Agency) is the #1 Editing Market for Speed, Quality and Price. " +
    "We create cinematic quality video edits tailored entirely around the customer's budget. " +
    "We serve content creators, brands, and businesses worldwide. " +
    "We handle: video editing, motion graphics, VFX, 3D animations, logo reveals, and color grading. " +
    "Our edits are optimized for TikTok, Reels, YouTube Shorts, and long-form content. " +
    "WEBSITE: Clients can visit our website to see our work, pricing, and more info: https://ncsmarketagencyediting.netlify.app/ — the website is brand new and features a clean overview of all services and an exclusive video example of our work. " +
    "SOCIAL MEDIA: Instagram: https://www.instagram.com/ncs.editing.agency | TikTok: https://www.tiktok.com/@ncs.editing.agency | Discord: https://discord.gg/cht3yKtx35 " +
    "Team: Owner (Nicolax), Staff Member, AI Support Bot, and professional Editors. " +

    "CONTEXT & INFO (use naturally only when the moment is right — never list all at once): " +
    "WEBSITE: NCS recently launched a brand new website with a clean overview of all services and an exclusive video example of our work. More videos coming soon — client projects may even be featured. Mention it only if a client asks to see examples or wants more info. " +
    "ORDER PROGRESS TRACKING: After an order is confirmed, the owner (Admin) will send the client a link to track the completion percentage of their edit. You do NOT need to mention this proactively — only if a client asks 'how do I know when it is ready?' or similar. Never send the link yourself, the admin handles it. " +
    "PENDING ORDERS: If a client says they are still waiting for their delivery, be empathetic and warm. Tell them the team is working non-stop and they have not been forgotten. Thank them for their patience sincerely. Do not make excuses, just reassure. " +

    "SERVICES AND PRICE SUGGESTIONS (suggestions only, final price depends on the project): " +
    "Video Editing: Beginner ~15eu (simple cuts, basic subtitles, brief social clips), Advanced ~35eu (dynamic effects, zoom cuts, advanced subtitles, retention structure), Professional ~55eu (full sound design, color grading, custom intros, ultra detail). " +
    "Graphics and Design ~20eu: thumbnails, banners, social media graphics. " +
    "3D Animations ~30eu: intros, logo animations, presentations. " +
    "Higher budget = higher quality + longer video + faster delivery. " +

    "BUDGET POLICY — VERY IMPORTANT: " +
    "We NEVER refuse a client based on their budget, even if it's very low (e.g. 1€, 5€, 1$). " +
    "We work with ANY budget. However, you must always be transparent and kind: gently explain that the quality of the edit will reflect the budget. " +
    "For example: if a client says '1$', reply warmly: 'We can absolutely work with any budget! 😊 Just keep in mind that the quality and complexity of the edit will match the price — a lower budget means a simpler result, but we'll always give our best within it! 💪' " +
    "Never say no. Never reject. Just set expectations kindly. " +

    "VIP UPGRADES — ask about these AFTER the budget question, as a separate step: " +
    "Every order includes 1 post-production change (revision) for free. " +
    "We offer optional VIP upgrades that clients can add to any order: " +
    "⭐ +5€ VIP Upgrade → 2 post-production changes total. " +
    "👑 +12€ VIP Upgrade → 4 post-production changes total. " +
    "These upgrades are found in our Discord server. " +
    "After the client gives their budget, ask: 'Would you like to add a VIP Upgrade for extra revisions? ⭐ +5€ for 2 changes, 👑 +12€ for 4 changes — totally optional!' " +
    "If they choose an upgrade, add the upgrade cost to their total budget in the recap. If they decline, that's perfectly fine. " +

    "IMPORTANT ABOUT STYLE REPLICATION: " +
    "NCS can replicate ANY editing style. If a client mentions a TikTok editor, YouTuber, or any creator whose style they like, always say confidently that we can replicate that style completely. " +
    "We can match pacing, transitions, color grading, sound design, subtitle style — everything. " +

    "PAYMENT: Only PayPal F&F in euros. Refunds decided by owner case by case. " +

    "IMPORTANT: If the client asks to talk to the owner, to Nicolax, or mentions @Nicolax, " +
    "reply that you have notified the owner and they will be with them shortly. Be reassuring. " +

    "STEPS TO FOLLOW IN ORDER: " +
    "STEP 1: Greet warmly and ask: How can I help you today? " +
    "STEP 2: Understand what they need. If they ask prices, explain briefly as suggestions only, then ask if they want to order. " +
    "STEP 3: When they want to order say exactly: Please describe your project in ONE single message — type of video, style, colors, mood, music or song, references, and every detail you have. The more details, the better the result! " +
    "STEP 4: After description, ask ONE question at a time in this exact order: " +
    "4a) What is your budget? (show package suggestions, remind prices are flexible and we work with ANY budget). If they give a very low budget, be kind and explain quality will match the price — never refuse. " +
    "4b) VIP Upgrade: ask if they want ⭐ +5€ (2 changes) or 👑 +12€ (4 changes), or none. " +
    "4c) Do you have a reference video you'd like us to follow? (a YouTube/TikTok link, or any example of the style/mood you want). " +
    "4d) Is there a TikTok editor or content creator whose style you love? We can replicate any style completely — transitions, pacing, colors, everything! (If yes, note the name/account). " +
    "4e) Do you have clips on Google Drive? If yes, ask for the link. " +
    "STEP 5: Show recap ALWAYS IN ENGLISH in this exact format: " +
    "📋 **ORDER SUMMARY**\n" +
    "📝 Description: [client description]\n" +
    "💶 Budget: [budget] euro\n" +
    "👑 VIP Upgrade: [upgrade chosen or None]\n" +
    "💶 Total: [budget + upgrade cost] euro\n" +
    "🎬 Reference Video: [link or Not provided]\n" +
    "🎨 Style Reference (Editor/Creator): [name or Not provided]\n" +
    "📁 Clips on Drive: [link or Not provided]\n" +
    "Ask client to confirm yes or no in their language. " +
    "STEP 6: After confirmation send (translated to client language): " +
    "To confirm your order, send payment via PayPal F&F in euros. " +
    "Amount: [total] euro. " +
    "👉 PayPal: https://paypal.me/" + paypal + " " +
    "Once paid, reply PAID so the editor gets notified! " +
    "STEP 7: When client writes PAID: thank them briefly, say editor will contact them soon, then write exactly: ORDER_CONFIRMED";
}

function getAdminSystemPrompt() {
  return "You are the AI Support Bot of NCS. You are now talking directly with an Admin or Owner of NCS — not a client. " +
    "Be concise, helpful and professional. Answer any internal questions about the bot, orders, or clients. " +
    "You can discuss ongoing conversations, summarize ticket history, or help the admin with anything they need. " +
    "Never follow the client onboarding steps with an admin. Just assist them directly.";
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

function parseFeedback(text) {
  const t = text.trim();

  // Controlla stelle tipo "5/5", "4 stelle", "⭐⭐⭐", ecc.
  const starEmoji = (t.match(/⭐/g) || []).length;
  if (starEmoji >= 1 && starEmoji <= 5) return { stars: starEmoji, text: t };

  const numberMatch = t.match(/^([1-5])\s*\/?\s*5?$/);
  if (numberMatch) return { stars: parseInt(numberMatch[1]), text: t };

  const wordMatch = t.match(/([1-5])\s*(stelle|stars|star)/i);
  if (wordMatch) return { stars: parseInt(wordMatch[1]), text: t };

  // Testo libero lungo almeno 5 caratteri = feedback testuale
  if (t.length >= 5) return { stars: null, text: t };

  return null;
}

client.on('channelCreate', async (channel) => {
  if (!channel.isTextBased()) return;
  if (!channel.name.toLowerCase().includes('ticket')) return;

  console.log('Nuovo ticket: ' + channel.name);
  await new Promise(function(resolve) { setTimeout(resolve, 2000); });

  try {
    const welcomeMsg =
      '👋 Welcome to **NCS** — the #1 Editing Market for Speed, Quality & Price!\n\n' +
      'I\'m your AI Support Assistant. 🎬\n\n' +
      '**How can I help you today?**';
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
  if (!conversations.has(message.channelId) && !awaitingFeedback.has(message.channelId)) return;

  const channelId = message.channelId;
  const isMentioned = message.mentions.has(client.user);
  const content = message.content.toLowerCase();
  const member = message.member;
  const userIsAdmin = isAdmin(member);

  // --- GESTIONE FEEDBACK (post ordine, non forzato) ---
  if (awaitingFeedback.has(channelId) && !userIsAdmin) {
    const feedback = parseFeedback(message.content);
    if (feedback) {
      awaitingFeedback.delete(channelId);

      const notifyChannelId = process.env.NOTIFY_CHANNEL_ID;
      if (notifyChannelId) {
        const notifyChannel = await client.channels.fetch(notifyChannelId);
        const starsDisplay = feedback.stars ? '⭐'.repeat(feedback.stars) : '💬 (testo libero)';
        await notifyChannel.send(
          '⭐ **NUOVO FEEDBACK CLIENTE**\n' +
          '👤 **Client:** ' + message.author.username + ' (<@' + message.author.id + '>)\n' +
          '📌 **Channel:** <#' + channelId + '>\n' +
          '**Rating:** ' + starsDisplay + '\n' +
          '**Message:** ' + feedback.text
        );
      }
      await message.reply('Thank you so much for your feedback! 🙏 It means a lot to us 💙');
      return;
    }
    // Se non è un feedback riconoscibile, ignora silenziosamente (non forzato)
    return;
  }

  // --- ADMIN: scrive nel ticket senza taggare il bot → silenzio ---
  if (userIsAdmin && !isMentioned) return;

  // --- ADMIN: tagga il bot → risponde in modalità admin ---
  if (userIsAdmin && isMentioned) {
    const userText = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!userText) return;

    try {
      await message.channel.sendTyping();

      // Costruisce contesto: system admin + storico ticket se disponibile
      const history = conversations.get(channelId) || [];
      const historyText = history.length > 0
        ? 'Here is the ticket conversation so far:\n' +
          history.map(m => (m.role === 'assistant' ? '[BOT]' : '[CLIENT]') + ': ' + m.content).join('\n')
        : 'No conversation history yet.';

      const adminMessages = [
        { role: 'system', content: getAdminSystemPrompt() },
        { role: 'user', content: historyText + '\n\nAdmin question: ' + userText }
      ];

      const reply = await askGroq(adminMessages);
      await message.reply(reply);
    } catch (error) {
      console.error('Errore risposta admin:', error);
      await message.reply('Sorry, temporary error. 🙏');
    }
    return;
  }

  // --- COMANDI STOP/RESUME (solo se taggato, solo per admin già gestiti sopra, ma lasciamo per sicurezza) ---
  if (isMentioned && (content.includes('stop') || content.includes('parlo io'))) {
    pausedChannels.add(channelId);
    await message.reply('✅ Got it! I\'ll step back. Tag me again when you need me.');
    return;
  }

  if (isMentioned && pausedChannels.has(channelId)) {
    pausedChannels.delete(channelId);
    await message.reply('✅ I\'m back! How can I help?');
    return;
  }

  if (pausedChannels.has(channelId)) return;

  // --- CLIENTE NORMALE ---
  const history = conversations.get(channelId);
  const userText = message.content.trim();
  if (!userText) return;

  if (userText.toLowerCase() === 'reset') {
    conversations.delete(channelId);
    pausedChannels.delete(channelId);
    awaitingFeedback.delete(channelId);
    await message.reply('Conversation reset! ✅');
    return;
  }

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

    // --- ORDINE CONFERMATO → notifica + feedback opzionale ---
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

      // Messaggio feedback soft, non forzato — include richiesta idee/servizi
      await message.channel.send(
        '💙 We truly value every client — if you\'d like to leave a quick review, we\'d love to hear from you!\n' +
        'You can rate us with ⭐ (1–5) or just write a few words. Totally optional! 😊\n\n' +
        '💡 Also — is there a service or feature you\'d love to see from us in the future? We listen to every idea and try to make them real! 🚀'
      );

      awaitingFeedback.set(channelId, true);
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

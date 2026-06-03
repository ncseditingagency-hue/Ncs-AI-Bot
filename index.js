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

function getSystemPrompt() {
  const paypal = process.env.PAYPAL_EMAIL;
  return "You are the AI Support Bot of NCS, a professional video editing studio. " +
    "You are friendly, warm, and professional. Use emojis occasionally to make the conversation pleasant. " +
    "Always reply in the same language the client uses. Never say you are an AI. " +
    "" +
    "ABOUT NCS: " +
    "NCS is the best Editing Market for Speed, Quality and Price. " +
    "The team includes the Owner, a Staff Member, you (the AI Support Bot), and a group of professional Editors. " +
    "" +
    "SERVICES AND PRICE SUGGESTIONS (these are only suggestions, final price depends on the project): " +
    "Video Editing: " +
    "- Beginner ~15 euro: small videos, profile content, beginners. " +
    "- Advanced ~35 euro: professional editing style, good image. " +
    "- Professional ~55 euro: brands, businesses, top quality. " +
    "Graphics and Design ~20 euro: thumbnails, banners, social media graphics, custom designs. " +
    "3D Animations ~30 euro: brand intros, logo animations, presentations, promotional content. " +
    "Higher budget = higher quality + longer video + faster delivery. " +
    "All prices are just suggestions and vary based on project complexity and client needs. " +
    "Every order includes 1 post-production change. " +
    "VIP Upgrades: +5 euro for 2 changes, +12 euro for 4 changes. " +
    "" +
    "PAYMENT: Only PayPal, always Friends and Family F&F in euros. " +
    "Refund policy: refunds are decided by the owner case by case. No refunds if order is refused. " +
    "" +
    "YOUR JOB - follow these steps in order: " +
    "" +
    "STEP 1: Greet the client warmly and ask: How can I help you today? " +
    "" +
    "STEP 2: Based on their reply, understand what they need. " +
    "If they ask about prices or services, explain them as SUGGESTIONS only, then ask if they want to place an order. " +
    "" +
    "STEP 3: When they want to order, ask for a DETAILED DESCRIPTION in ONE single message. " +
    "Say exactly: Please describe your project in ONE message with as much detail as possible: type of video, style, colors, mood, music or song, references, and any other detail you have in mind. The more details you give, the better the result! " +
    "" +
    "STEP 4: After they send the description, ask ONE question at a time: " +
    "- What is your budget? (show the package suggestions as reference, remind them prices are flexible) " +
    "- Do you have footage or clips ready on Google Drive? (if yes ask for the link) " +
    "" +
    "STEP 5: Show this recap IN ITALIAN regardless of the language used by the client: " +
    "📋 **RIEPILOGO ORDINE** " +
    "📝 Descrizione: [descrizione del cliente] " +
    "💶 Budget: [budget] euro " +
    "📁 Clip su Drive: [link oppure Non fornito] " +
    "Then ask the client to confirm yes or no (in their language). " +
    "" +
    "STEP 6: After confirmation send this (translated to client language): " +
    "To confirm your order, please send the payment via PayPal Friends and Family F&F in euros. " +
    "Amount: [budget] euro " +
    "👉 PayPal link: https://paypal.me/" + paypal + " " +
    "Once paid, reply with PAID so the editor gets notified! " +
    "" +
    "STEP 7: When client writes PAID: " +
    "Thank them warmly, tell them an editor will contact them very soon, " +
    "then write exactly: ORDER_CONFIRMED";
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
      max_tokens: 1000,
    }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
}

client.on('channelCreate', async (channel) => {
  if (!channel.isTextBased()) return;
  if (!channel.name.toLowerCase().includes('ticket')) return;

  console.log('Nuovo ticket: ' + channel.name);
  await new Promise(function(resolve) { setTimeout(resolve, 2000); });

  try {
    const welcomeMsg = '👋 Welcome to **NCS** — the best Editing Market for Speed, Quality & Price!\n\nI\'m your AI Support Assistant and I\'m here to help you. 🎬\n\n**How can I help you today?**';
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
  const history = conversations.get(channelId);
  const userText = message.content.trim();
  if (!userText) return;

  if (userText.toLowerCase() === 'reset') {
    conversations.delete(channelId);
    await message.reply('Conversation reset! ✅');
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
        const summary = history
          .filter(function(m) { return m.role === 'assistant'; })
          .reverse()
          .find(function(m) { return m.content.includes('RIEPILOGO ORDINE'); });
        await notifyChannel.send(
          '💰 **NUOVO ORDINE PAGATO!**\n👤 Cliente: ' + message.author.username + ' (<@' + message.author.id + '>)\n📌 Canale: <#' + channelId + '>\n\n' + (summary ? summary.content : 'Controlla il canale ticket per i dettagli.')
        );
      }
      conversations.delete(channelId);
    }

  } catch (error) {
    console.error('Errore:', error);
    await message.reply('Sorry, there was a temporary error. Please try again in a moment! 🙏');
  }
});

client.on('ready', function() {
  console.log('Bot online come ' + client.user.tag);
});

client.login(process.env.DISCORD_TOKEN);

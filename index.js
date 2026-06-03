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

function getSystemPrompt() {
  const paypal = process.env.PAYPAL_EMAIL;
  return "You are a professional video editing studio assistant. " +
    "Your job is to collect order information from clients, ONE question at a time. " +
    "IMPORTANT RULES: " +
    "Always detect and reply in the same language the client uses. " +
    "Ask only ONE question at a time, never multiple together. " +
    "Be professional but friendly. " +
    "Never mention you are an AI. " +
    "You already sent a welcome message, so start collecting info directly. " +
    "Collect this information in this exact order: " +
    "1. Video length (e.g. 30 seconds, 1 minute, 3 minutes) " +
    "2. Client budget in euros " +
    "3. Desired style (e.g. dynamic, elegant, minimal, cinematic, funny) " +
    "4. Whether they have footage on Google Drive (if yes, ask for the link) " +
    "After collecting all 4, show this recap: " +
    "ORDER SUMMARY " +
    "Video length: [length] " +
    "Budget: [budget] euro " +
    "Style: [style] " +
    "Clips on Drive: [link or Not provided] " +
    "Then ask the client to confirm with yes or no. " +
    "After confirmation send this translated to the client language: " +
    "To confirm your order, please send the payment via PayPal. " +
    "PayPal email: " + paypal + " " +
    "IMPORTANT: Send as Friends and Family F&F in euros. " +
    "Amount: [budget] euro. " +
    "Once paid, write PAGATO or PAID here so the editor gets notified. " +
    "When the client writes PAGATO or PAID: " +
    "Thank them warmly, tell them the editor will contact them soon, " +
    "then write exactly: ORDINE_CONFERMATO";
}

client.on('channelCreate', async (channel) => {
  if (!channel.isTextBased()) return;
  if (!channel.name.toLowerCase().includes('ticket')) return;

  console.log('Nuovo ticket rilevato: ' + channel.name);

  await new Promise(function(resolve) { setTimeout(resolve, 2000); });

  try {
    const welcomeMsg = 'Hi! I\'m the assistant of a professional video editing studio.\n\nI\'m here to collect the information for your order. Let\'s get started!\n\nWhat is the desired length of your video? (e.g. 30 seconds, 1 minute, 3 minutes...)';

    await channel.send(welcomeMsg);

    // La storia inizia VUOTA — il primo messaggio sarà dell'utente
    conversations.set(channel.id, []);

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
    await message.reply('Conversation reset!');
    return;
  }

  const geminiHistory = history.map(function(m) {
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    };
  });

  history.push({ role: 'user', content: userText });

  try {
    await message.channel.sendTyping();

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: getSystemPrompt(),
    });

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(userText);
    const reply = result.response.text();

    history.push({ role: 'assistant', content: reply });

    if (reply.length > 2000) {
      const chunks = reply.match(/.{1,2000}/gs);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(reply);
    }

    if (reply.includes('ORDINE_CONFERMATO')) {
      const notifyChannelId = process.env.NOTIFY_CHANNEL_ID;
      if (notifyChannelId) {
        const notifyChannel = await client.channels.fetch(notifyChannelId);

        const summary = history
          .filter(function(m) { return m.role === 'assistant'; })
          .reverse()
          .find(function(m) { return m.content.includes('ORDER SUMMARY'); });

        await notifyChannel.send(
          '💰 NUOVO ORDINE PAGATO!\n👤 Cliente: ' + message.author.username + ' (<@' + message.author.id + '>)\n📌 Canale: <#' + channelId + '>\n\n' + (summary ? summary.content : 'Controlla il canale ticket per i dettagli.')
        );
      }
      conversations.delete(channelId);
    }

  } catch (error) {
    console.error('Errore:', error);
    await message.reply('Temporary error, please try again in a moment!');
  }
});

client.on('ready', function() {
  console.log('Bot online come ' + client.user.tag);
});

client.login(process.env.DISCORD_TOKEN);

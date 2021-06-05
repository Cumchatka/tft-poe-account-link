const Discord = require('discord.js');
const client = new Discord.Client();
const { v4 } = require('uuid');
const { createStateDiscordIdLink, getPoeTftStateLinkByDiscordId, getPoeTftStateLinkByPoeAccount, getAllUnassignedLinkedUserIds, updateUnassignedLinkedUser } = require('./database');
const dotenv = require('dotenv');

const BOT_CONTROL_CHANNEL_ID = process.env.botControlId;
const LINKED_TFT_POE_ROLE_ID = '848751148478758914';
const TFT_SERVER_ID = '645607528297922560';

if (process.env.NODE_ENV === 'dev' && process.env.testEnvProp === undefined) {
  dotenv.config({ path: __dirname + '/.env_dev' });
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async (message) => {
  // is private message
  if (message.author.dmChannel && message.channel.id == message.author.dmChannel.id) {
    if (message.content.toLowerCase().includes('link')) {
      const isLinked = await getPoeTftStateLinkByDiscordId(message.author.id);
      if (isLinked) {
        await message.author.dmChannel.send('You have already linked your POE account with the TFT-POE account linker!');
        return;
      }
      const generatedState = v4();
      await createStateDiscordIdLink(generatedState, message.author.id);
      await message.author.dmChannel.send(
        `Click here to authorize with the GGG oauth servers: ${buildAuthorizeURL(generatedState)}`
      );
    }
  }

  if (message.channel.id === BOT_CONTROL_CHANNEL_ID) {
    const lowerCaseContent = message.content.toLowerCase();
    if (lowerCaseContent.startsWith('#')) {
      const splitContent = lowerCaseContent.split(' ');

      if (splitContent[1].includes(' ') || splitContent[1].includes(';') || splitContent[1].includes('-')) {
        return
      }

      if (lowerCaseContent.includes(process.env.chkDiscCmd)) {
        if (isNaN(splitContent[1])) {
          await message.channel.send(`Given argument ${splitContent[1]} is not a valid discord id`);
          return;
        }
        const poeAccount = await getPoeTftStateLinkByDiscordId(splitContent[1]);
        if (poeAccount !== false && poeAccount > "") {
          await message.channel.send(`The POE account linked to discord id ${splitContent[1]} is ${poeAccount}`);
          return
        }
        await message.channel.send(`No POE account found for discord id ${splitContent[1]}`);
        return;
      }
      if (lowerCaseContent.includes(process.env.chkpoecmd)) {
        const discordId = await getPoeTftStateLinkByPoeAccount(splitContent[1]);
        if (discordId !== false && discordId > "") {
          await message.channel.send(`The discord id linked to the POE account ${splitContent[1]} is ${discordId}`);
          return;
        }
        await message.channel.send(`No discord id found for POE account ${splitContent[1]}`);
        return;
      }
    }
  }
});

client.login(process.env.botToken);

setInterval(async () => {
  const discordIds = await getAllUnassignedLinkedUserIds();
  await Promise.all(discordIds.map((id) => assignRoleThenUpdateUser(id)));
}, 30000);

const assignRoleThenUpdateUser = async (discordId) => {
  return assignTftVerifiedRole(discordId).then(async () => await updateUnassignedLinkedUser(discordId));
}

const assignTftVerifiedRole = async (discordUserId) => {
  const guild = await client.guilds.fetch(TFT_SERVER_ID, true);
  const guildMember = await guild.members.fetch({ user: String(discordUserId), cache: false });
  await guildMember.roles.add(LINKED_TFT_POE_ROLE_ID);
}

const buildAuthorizeURL = (state) => {
  const params = {
    client_id: process.env.clientId,
    response_type: 'code',
    scope: 'account:profile',
    state: state,
    redirect_uri: "https://theforbiddentrove.xyz/oauth_redirect",
    prompt: "consent"
  };

  const queryParamStr = Object.entries(params).map(([key, val]) => `${key}=${val}`).join('&');
  return `https://www.pathofexile.com/oauth/authorize?${queryParamStr}`;
}
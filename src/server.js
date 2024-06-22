/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
  verifyKey,
} from 'discord-interactions';
import { TL_COMMAND } from './commands.js';
import { parse } from '@formatjs/icu-messageformat-parser';

const ID_SEPARATOR = '/';
const FILENAME_SEPARATOR = '_';

class JsonResponse extends Response {
  constructor(body, init) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

const router = AutoRouter();

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get('/', (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    // Most user commands will come as `APPLICATION_COMMAND`.
    switch (interaction.data.name.toLowerCase()) {
      case TL_COMMAND.name.toLowerCase(): {
        const options = interaction.data.options;

        const languageOption = options.find(
          (option) => option.name === 'language',
        );
        const language = languageOption ? languageOption.value : null;
        if (!language) return errorResponse('Target language not found.');

        const attachments = interaction.data.resolved?.attachments;
        const attachment = attachments ? Object.values(attachments)[0] : null;
        if (!attachment) return errorResponse('Attachment not found.');

        const user = interaction.member?.user;
        if (!user) return errorResponse('User not found.');

        const filename = `${interaction.id}${FILENAME_SEPARATOR}${language}.json`;
        const response = await fetch(attachment.url);
        const fileContent = await response.text();

        // Validate the ICU Messages file
        try {
          const content = JSON.parse(fileContent);
          for (const key in content) {
            parse(content[key]);
          }
        } catch (error) {
          return errorResponse(
            `ICU Messages file is invalid: ${error.message}`,
          );
        }

        // Store the new file
        try {
          await env.TLRN_TODO_ICU.put(filename, fileContent);
        } catch (error) {
          return errorResponse(
            `ICU Messages file could not be stored: ${error.message}`,
          );
        }

        const message = `ICU Messages file is valid. Ready to translate!\n
**Username:** ${user.username}\n
**Filename:** ${attachment.filename}\n
**Target Language:** ${language}\n
**Date:** ${new Date(Date.now()).toLocaleString()}\n
**ID:** ${interaction.id}
`;

        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: message,
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.BUTTON,
                    style: ButtonStyleTypes.PRIMARY,
                    label: 'Queued. You will be notified when done.',
                    custom_id: `id${ID_SEPARATOR}${filename}${ID_SEPARATOR}${user.id}`,
                  },
                ],
              },
            ],
          },
        });
      }

      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const customId = interaction.data.custom_id;
    if (customId.startsWith('id')) {
      // Users can check the status queue of the translation request
      const kv = await env.TLRN_TODO_ICU.list();

      const fileKey = customId.split(ID_SEPARATOR)[1];
      const place = kv.keys.findIndex((key) => key.name === fileKey);
      const total = kv.keys.length;

      return new JsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Queued: ${place + 1}/${total}`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    }
  }

  console.error('Unknown Type');
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});
router.all('*', () => new Response('Not Found.', { status: 404 }));

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest = await verifyKey(
    body,
    signature,
    timestamp,
    env.DISCORD_PUBLIC_KEY,
  );
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

const errorResponse = (message) =>
  new JsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `Error: ${message}`,
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  });

export default server;

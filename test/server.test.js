import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { InteractionResponseType, InteractionType } from 'discord-interactions';
import { TL_COMMAND } from '../src/commands.js';
import sinon from 'sinon';
import server from '../src/server.js';

const MOCK_ATTACHMENT = {
  filename: 'base.json',
  url: 'https://raw.githubusercontent.com/formatjs/formatjs/main/website/lang/strings_fr-FR.json',
};

const MOCK_MEMBER = {
  user: {
    id: '123456789',
    username: 'username',
  },
};

const MOCK_OPTIONS = [
  {
    name: 'language',
    value: 'de',
  },
];

describe('Server', () => {
  describe('GET /', () => {
    it('should return a greeting message with the Discord application ID', async () => {
      const request = {
        method: 'GET',
        url: new URL('/', 'http://discordo.example'),
      };
      const env = { DISCORD_APPLICATION_ID: '123456789' };

      const response = await server.fetch(request, env);
      const body = await response.text();

      expect(body).to.equal('👋 123456789');
    });
  });

  describe('POST /', () => {
    let verifyDiscordRequestStub;

    beforeEach(() => {
      verifyDiscordRequestStub = sinon.stub(server, 'verifyDiscordRequest');
    });

    afterEach(() => {
      verifyDiscordRequestStub.restore();
    });

    const verifyTLInteraction = async (
      mockAttachment,
      mockMember,
      mockOptions,
      errorMessage,
    ) => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          name: TL_COMMAND.name,
          options: mockOptions,
          resolved: {
            attachments: {
              attachment1: mockAttachment,
            },
          },
        },
        member: mockMember,
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      const env = {
        ICU_FILES: {
          put: async (key, content) => {},
        },
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, env);
      const body = await response.json();

      expect(body.type).to.equal(
        InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      );

      if (errorMessage) {
        expect(body.data.content).to.equal(errorMessage);
      }
    };

    it('should handle a PING interaction', async () => {
      const interaction = {
        type: InteractionType.PING,
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      const env = {};

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, env);
      const body = await response.json();
      expect(body.type).to.equal(InteractionResponseType.PONG);
    });

    it('should handle a TL_COMMAND interaction with valid ICU file', async () => {
      await verifyTLInteraction(
        MOCK_ATTACHMENT,
        MOCK_MEMBER,
        MOCK_OPTIONS,
        undefined,
      );
    });

    it('should handle a TL_COMMAND interaction with missing attachment', async () => {
      await verifyTLInteraction(
        undefined,
        MOCK_MEMBER,
        MOCK_OPTIONS,
        'Error: Attachment not found.',
      );
    });

    it('should handle a TL_COMMAND interaction with missing user', async () => {
      await verifyTLInteraction(
        MOCK_ATTACHMENT,
        {},
        MOCK_OPTIONS,
        'Error: User not found.',
      );
    });

    it('should handle a TL_COMMAND interaction with missing language', async () => {
      await verifyTLInteraction(
        MOCK_ATTACHMENT,
        MOCK_MEMBER,
        [],
        'Error: Target language not found.',
      );
    });

    it('should handle an unknown command interaction', async () => {
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          name: 'unknown',
        },
      };

      const request = {
        method: 'POST',
        url: new URL('/', 'http://discordo.example'),
      };

      verifyDiscordRequestStub.resolves({
        isValid: true,
        interaction: interaction,
      });

      const response = await server.fetch(request, {});
      const body = await response.json();
      expect(response.status).to.equal(400);
      expect(body.error).to.equal('Unknown Type');
    });
  });

  describe('All other routes', () => {
    it('should return a "Not Found" response', async () => {
      const request = {
        method: 'GET',
        url: new URL('/unknown', 'http://discordo.example'),
      };
      const response = await server.fetch(request, {});
      expect(response.status).to.equal(404);
      const body = await response.text();
      expect(body).to.equal('Not Found.');
    });
  });
});

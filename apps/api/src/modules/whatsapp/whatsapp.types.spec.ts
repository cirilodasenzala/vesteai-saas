import { MsgType } from '@vesteai/shared';
import { parseEvolutionMessages, EvolutionWebhookBody } from './whatsapp.types';

describe('parseEvolutionMessages', () => {
  it('extrai mensagem de texto (conversation)', () => {
    const body: EvolutionWebhookBody = {
      event: 'messages.upsert',
      instance: 'vesteai',
      data: {
        key: { id: 'ABC123', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        pushName: 'David',
        messageTimestamp: 1700000000,
        message: { conversation: 'oi' },
      },
    };
    const msgs = parseEvolutionMessages(body);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({
      waMessageId: 'ABC123',
      from: '5511999999999',
      type: MsgType.TEXT,
      text: 'oi',
      profileName: 'David',
    });
  });

  it('extrai texto de extendedTextMessage', () => {
    const body: EvolutionWebhookBody = {
      event: 'messages.upsert',
      data: {
        key: { id: 'x', remoteJid: '5511888@s.whatsapp.net' },
        message: { extendedTextMessage: { text: 'tudo bem?' } },
      },
    };
    expect(parseEvolutionMessages(body)[0].text).toBe('tudo bem?');
  });

  it('extrai imagem com base64', () => {
    const body: EvolutionWebhookBody = {
      event: 'messages.upsert',
      data: {
        key: { id: 'img1', remoteJid: '5511777@s.whatsapp.net' },
        message: { imageMessage: { caption: 'minha roupa' }, base64: 'QUJD' },
      },
    };
    const m = parseEvolutionMessages(body)[0];
    expect(m).toMatchObject({
      type: MsgType.IMAGE,
      text: 'minha roupa',
      mediaBase64: 'QUJD',
    });
  });

  it('ignora ecos (fromMe) e grupos', () => {
    const echo: EvolutionWebhookBody = {
      event: 'messages.upsert',
      data: { key: { id: '1', remoteJid: '5511@s.whatsapp.net', fromMe: true }, message: { conversation: 'eco' } },
    };
    const group: EvolutionWebhookBody = {
      event: 'messages.upsert',
      data: { key: { id: '2', remoteJid: '123-456@g.us' }, message: { conversation: 'grupo' } },
    };
    expect(parseEvolutionMessages(echo)).toHaveLength(0);
    expect(parseEvolutionMessages(group)).toHaveLength(0);
  });

  it('aceita data como array', () => {
    const body: EvolutionWebhookBody = {
      event: 'messages.upsert',
      data: [
        { key: { id: 'a', remoteJid: '5511@s.whatsapp.net' }, message: { conversation: 'um' } },
        { key: { id: 'b', remoteJid: '5512@s.whatsapp.net' }, message: { conversation: 'dois' } },
      ],
    };
    expect(parseEvolutionMessages(body)).toHaveLength(2);
  });

  it('ignora eventos que não sejam messages.upsert', () => {
    const body: EvolutionWebhookBody = {
      event: 'connection.update',
      data: { key: { id: 'x', remoteJid: '5511@s.whatsapp.net' }, message: { conversation: 'x' } },
    };
    expect(parseEvolutionMessages(body)).toHaveLength(0);
  });
});

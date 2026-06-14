import { ConvState, Language } from '@vesteai/shared';
import { TryOnService } from './tryon.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageProvider } from '../../core/ports/storage.provider';
import { WhatsappSender } from '../whatsapp/whatsapp-sender.service';
import { TryOnQueue } from '../../queue/tryon.queue';
import { MsgType } from '@vesteai/shared';
import type { InboundMessage } from '../whatsapp/whatsapp.types';

describe('TryOnService', () => {
  let service: TryOnService;
  let enqueued: number;
  let photos: Array<{ kind: string; storageKey: string }>;

  beforeEach(() => {
    enqueued = 0;
    photos = [];
    const prisma = {
      photo: {
        create: jest.fn(async ({ data }: { data: { kind: string; storageKey: string } }) => {
          photos.push(data);
          return data;
        }),
        findFirst: jest.fn(async ({ where }: { where: { kind: string } }) => {
          const found = [...photos].reverse().find((p) => p.kind === where.kind);
          return found ?? null;
        }),
      },
      tryOnJob: { create: jest.fn(async () => ({ id: 'job1' })) },
    } as unknown as PrismaService;

    const storage = {
      put: jest.fn(async (key: string) => ({ key, url: `http://x/${key}` })),
    } as unknown as StorageProvider;

    const sender = {
      decodeMedia: jest.fn(() => null), // força placeholder (sem base64)
    } as unknown as WhatsappSender;

    const queue = {
      enqueue: jest.fn(async () => {
        enqueued++;
      }),
    } as unknown as TryOnQueue;

    service = new TryOnService(prisma, storage, sender, queue);
  });

  const imgMsg = (): InboundMessage => ({
    waMessageId: 'm1',
    from: '5511999',
    type: MsgType.IMAGE,
    timestamp: Date.now(),
  });

  it('promptBody pede a foto do corpo e entra em TRYON_BODY', () => {
    const r = service.promptBody(Language.PT);
    expect(r.state).toBe(ConvState.TRYON_BODY);
    expect(r.reply).toContain('corpo inteiro');
  });

  it('fluxo body -> garment enfileira o job', async () => {
    const body = await service.receiveBody('u1', Language.PT, imgMsg());
    expect(body.state).toBe(ConvState.TRYON_GARMENT);
    expect(photos.some((p) => p.kind === 'BODY')).toBe(true);

    const garment = await service.receiveGarment(
      'u1',
      'conv1',
      '5511999',
      Language.PT,
      imgMsg(),
    );
    expect(garment.state).toBe(ConvState.TRYON_PROCESSING);
    expect(enqueued).toBe(1);
  });
});

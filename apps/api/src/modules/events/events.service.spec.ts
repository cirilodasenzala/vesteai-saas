import { EventType, Language } from '@vesteai/shared';
import { EventsService } from './events.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { AIStylistProvider } from '../../core/ports/ai-stylist.provider';

describe('EventsService', () => {
  let service: EventsService;
  let recommended: number;

  beforeEach(() => {
    recommended = 0;
    const prisma = {
      event: { create: jest.fn(async () => ({ id: 'ev1' })) },
      look: { create: jest.fn(async () => ({ id: 'lk1' })) },
      history: { create: jest.fn(async () => ({ id: 'h1' })) },
    } as unknown as PrismaService;

    const memory = {
      snapshot: jest.fn(async () => ({ language: Language.PT })),
    } as unknown as MemoryService;

    const stylist = {
      recommendLook: jest.fn(async () => {
        recommended++;
        return { text: 'Look montado com justificativa.', items: { top: 'camisa' } };
      }),
    } as unknown as AIStylistProvider;

    service = new EventsService(prisma, memory, stylist);
  });

  it('evento sem detalhes (academia) entrega look direto', async () => {
    const r = await service.begin('u1', Language.PT, 'vou para academia');
    expect(r.done).toBe(true);
    expect(recommended).toBe(1);
    expect(r.reply).toContain('justificativa');
  });

  it('casamento coleta horário/local/clima antes de entregar', async () => {
    const start = await service.begin('u1', Language.PT, 'tenho um casamento');
    expect(start.done).toBe(false);
    expect(start.context.event?.step).toBe('when');

    const s1 = await service.handle('u1', Language.PT, 'à noite', start.context.event!);
    expect(s1.context.event?.step).toBe('place');

    const s2 = await service.handle('u1', Language.PT, 'salão fechado', s1.context.event!);
    expect(s2.context.event?.step).toBe('weather');

    const s3 = await service.handle('u1', Language.PT, 'ameno', s2.context.event!);
    expect(s3.done).toBe(true);
    expect(recommended).toBe(1);
  });
});

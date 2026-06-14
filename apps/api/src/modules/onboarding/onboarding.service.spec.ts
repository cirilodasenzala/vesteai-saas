import { Language, Sex, Style } from '@vesteai/shared';
import { OnboardingService } from './onboarding.service';
import { MemoryService } from '../memory/memory.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let updates: Array<Record<string, unknown>>;

  beforeEach(() => {
    updates = [];
    const memory = {
      updateProfile: jest.fn(async (_id: string, data: Record<string, unknown>) => {
        updates.push(data);
      }),
    } as unknown as MemoryService;
    service = new OnboardingService(memory);
  });

  it('start pergunta o nome em PT', () => {
    const r = service.start(Language.PT);
    expect(r.context.step).toBe('name');
    expect(r.reply.toLowerCase()).toContain('nome');
    expect(r.done).toBe(false);
  });

  it('percorre os passos até concluir', async () => {
    const name = await service.handle('u1', Language.PT, 'David', { step: 'name' });
    expect(name.context.step).toBe('age');

    const age = await service.handle('u1', Language.PT, '28', { step: 'age' });
    expect(age.context.step).toBe('sex');

    const sex = await service.handle('u1', Language.PT, 'masculino', { step: 'sex' });
    expect(sex.context.step).toBe('color');

    const color = await service.handle('u1', Language.PT, 'azul', { step: 'color' });
    expect(color.context.step).toBe('style');

    const style = await service.handle('u1', Language.PT, 'Old Money', { step: 'style' });
    expect(style.context.step).toBe('height');

    const height = await service.handle('u1', Language.PT, 'pular', { step: 'height' });
    expect(height.context.step).toBe('weight');

    const weight = await service.handle('u1', Language.PT, 'pular', { step: 'weight' });
    expect(weight.done).toBe(true);

    // Verifica que os dados foram gravados corretamente.
    expect(updates).toContainEqual({ name: 'David' });
    expect(updates).toContainEqual({ age: 28 });
    expect(updates).toContainEqual({ sex: Sex.MALE });
    expect(updates).toContainEqual({ favoriteColors: ['azul'] });
    expect(updates).toContainEqual({ favoriteStyle: Style.OLD_MONEY });
  });
});

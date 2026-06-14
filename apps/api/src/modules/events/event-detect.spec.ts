import { EventType } from '@vesteai/shared';
import { detectEventType, eventNeedsDetails } from './event-detect';

describe('detectEventType', () => {
  it('detecta casamento (PT) e wedding (EN)', () => {
    expect(detectEventType('tenho um casamento sábado')).toBe(EventType.WEDDING);
    expect(detectEventType('I have a wedding')).toBe(EventType.WEDDING);
  });

  it('detecta entrevista, academia, praia', () => {
    expect(detectEventType('tenho uma entrevista amanhã')).toBe(
      EventType.INTERVIEW,
    );
    expect(detectEventType('vou para academia')).toBe(EventType.GYM);
    expect(detectEventType('vou pra praia')).toBe(EventType.BEACH);
  });

  it('cai em OTHER quando não reconhece', () => {
    expect(detectEventType('me ajuda com algo')).toBe(EventType.OTHER);
  });
});

describe('eventNeedsDetails', () => {
  it('casamento pede detalhes; academia não', () => {
    expect(eventNeedsDetails(EventType.WEDDING)).toBe(true);
    expect(eventNeedsDetails(EventType.GYM)).toBe(false);
  });
});

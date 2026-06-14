import { Language } from '@vesteai/shared';
import { detectLanguageHeuristic } from './language-detect';

describe('detectLanguageHeuristic', () => {
  it('detecta português por acento', () => {
    expect(detectLanguageHeuristic('Olá, tudo bem?')).toBe(Language.PT);
  });

  it('detecta português por stopwords', () => {
    expect(detectLanguageHeuristic('quero experimentar uma roupa')).toBe(
      Language.PT,
    );
  });

  it('detecta inglês por stopwords', () => {
    expect(detectLanguageHeuristic('hello, I want to try an outfit')).toBe(
      Language.EN,
    );
  });

  it('cai no padrão PT quando ambíguo/vazio', () => {
    expect(detectLanguageHeuristic('')).toBe(Language.PT);
    expect(detectLanguageHeuristic('12345')).toBe(Language.PT);
  });
});

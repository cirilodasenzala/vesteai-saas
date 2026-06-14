import { validateImage } from './image-validation';

describe('validateImage', () => {
  it('aceita JPEG (magic bytes FF D8 FF)', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22]);
    expect(validateImage(buf)).toMatchObject({ ok: true, mime: 'image/jpeg' });
  });

  it('aceita PNG', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(validateImage(buf)).toMatchObject({ ok: true, mime: 'image/png' });
  });

  it('rejeita conteúdo não-imagem', () => {
    const buf = Buffer.from('isto não é uma imagem', 'utf8');
    expect(validateImage(buf).ok).toBe(false);
  });

  it('rejeita vazio', () => {
    expect(validateImage(Buffer.alloc(0)).ok).toBe(false);
  });
});

/**
 * Validação básica de imagem por "magic bytes" (assinatura do arquivo).
 * Evita confiar só no content-type. Rejeita não-imagens e arquivos grandes.
 */

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export interface ImageCheck {
  ok: boolean;
  mime?: string;
  reason?: string;
}

export function validateImage(buf: Buffer): ImageCheck {
  if (!buf || buf.length === 0) return { ok: false, reason: 'vazio' };
  if (buf.length > MAX_BYTES) return { ok: false, reason: 'muito grande' };

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ok: true, mime: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ok: true, mime: 'image/png' };
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ok: true, mime: 'image/webp' };
  }
  return { ok: false, reason: 'formato não suportado' };
}

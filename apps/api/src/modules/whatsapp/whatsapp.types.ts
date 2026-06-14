import { MsgType } from '@vesteai/shared';

/** Mensagem de entrada normalizada a partir do webhook da Evolution. */
export interface InboundMessage {
  waMessageId: string;
  from: string; // número (somente dígitos, ex.: 5511999999999)
  type: MsgType;
  text?: string;
  /** Bytes da mídia em base64 (com webhookBase64 ligado na Evolution). */
  mediaBase64?: string;
  timestamp: number;
  profileName?: string;
}

/**
 * Estrutura (parcial) do payload do webhook da Evolution API no evento
 * MESSAGES_UPSERT (formato Baileys). A Evolution pode enviar `data` como
 * um objeto único ou um array — tratamos os dois casos.
 */
export interface EvolutionWebhookBody {
  event?: string;
  instance?: string;
  data?: EvolutionMessageData | EvolutionMessageData[];
}

interface EvolutionMessageData {
  key?: {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
  };
  pushName?: string;
  messageType?: string;
  messageTimestamp?: number | string;
  /** Alguns modos da Evolution colocam o base64 da mídia aqui. */
  base64?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string; mimetype?: string };
    audioMessage?: { mimetype?: string };
    locationMessage?: { degreesLatitude?: number; degreesLongitude?: number };
    base64?: string;
  };
}

/** Remove o sufixo do JID (@s.whatsapp.net) deixando só os dígitos. */
function normalizeNumber(remoteJid: string | undefined): string {
  if (!remoteJid) return '';
  return remoteJid.split('@')[0].replace(/\D/g, '');
}

/** É mensagem de grupo? (ignoramos grupos no fluxo 1:1 do stylist) */
function isGroup(remoteJid: string | undefined): boolean {
  return !!remoteJid && remoteJid.endsWith('@g.us');
}

/**
 * Extrai mensagens normalizadas do payload da Evolution.
 * Ignora ecos (fromMe), grupos e eventos que não sejam de mensagem.
 */
export function parseEvolutionMessages(
  body: EvolutionWebhookBody,
): InboundMessage[] {
  if (body.event && body.event.toLowerCase().replace('.', '_') !== 'messages_upsert') {
    return [];
  }

  const items = Array.isArray(body.data)
    ? body.data
    : body.data
      ? [body.data]
      : [];

  const result: InboundMessage[] = [];

  for (const d of items) {
    const remoteJid = d.key?.remoteJid;
    if (d.key?.fromMe) continue; // eco das próprias mensagens
    if (isGroup(remoteJid)) continue; // ignora grupos

    const from = normalizeNumber(remoteJid);
    if (!from) continue;

    const base = {
      waMessageId: d.key?.id ?? `${from}-${Date.now()}`,
      from,
      timestamp: Number(d.messageTimestamp) * 1000 || Date.now(),
      profileName: d.pushName,
    };

    const msg = d.message ?? {};
    const mediaBase64 = msg.base64 ?? d.base64;

    if (msg.conversation || msg.extendedTextMessage?.text) {
      result.push({
        ...base,
        type: MsgType.TEXT,
        text: msg.conversation ?? msg.extendedTextMessage?.text ?? '',
      });
    } else if (msg.imageMessage) {
      result.push({
        ...base,
        type: MsgType.IMAGE,
        text: msg.imageMessage.caption,
        mediaBase64,
      });
    } else if (msg.audioMessage) {
      result.push({ ...base, type: MsgType.AUDIO, mediaBase64 });
    } else if (msg.locationMessage) {
      result.push({ ...base, type: MsgType.LOCATION });
    }
    // Outros tipos (sticker, contacts, etc.) são ignorados por ora.
  }

  return result;
}

import { Language } from '@vesteai/shared';

/**
 * Mensagens fixas do fluxo (i18n simples). As respostas dinâmicas do
 * stylist virão do LLM (Fase 3); aqui ficam apenas os textos de sistema.
 */
export const WELCOME: Record<Language, string> = {
  [Language.PT]: `Olá, meu lindo(a) 👋

Bem-vindo(a) ao *VesteAI* — seu Personal Stylist por Inteligência Artificial.

Comigo você poderá:

👔 Experimentar roupas virtualmente
🎯 Descobrir seu estilo
📍 Receber looks para qualquer ocasião
🧥 Combinar roupas do seu guarda-roupa
✨ Receber consultoria de imagem personalizada

Para começar, preciso verificar sua assinatura.`,

  [Language.EN]: `Hello, gorgeous 👋

Welcome to *VesteAI* — your AI-powered Personal Stylist.

With me you can:

👔 Try on clothes virtually
🎯 Discover your style
📍 Get looks for any occasion
🧥 Mix and match your wardrobe
✨ Receive personalized image consulting

To get started, I need to verify your subscription.`,

  [Language.OTHER]: `Hello 👋

Welcome to *VesteAI* — your AI Personal Stylist.

To get started, I need to verify your subscription.`,
};

/** Payload do job de provador enfileirado. */
export interface TryOnJobData {
  tryOnJobId: string;
  userId: string;
  whatsappNumber: string;
  conversationId: string;
  bodyKey: string;
  garmentKey: string;
}

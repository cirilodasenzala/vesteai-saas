import { SimulatedPaymentProvider } from './simulated-payment.provider';

describe('SimulatedPaymentProvider (estáticos)', () => {
  it('codifica e decodifica o token do número', () => {
    const number = '5511988887777';
    const provider = new SimulatedPaymentProvider({
      APP_BASE_URL: 'http://localhost:3000',
    } as never);
    return provider.createCheckoutLink({ whatsappNumber: number }).then((res) => {
      expect(res.url).toContain('/dev/pay/');
      const token = res.url.split('/dev/pay/')[1];
      expect(SimulatedPaymentProvider.decodeToken(token)).toBe(number);
    });
  });

  it('monta evento de checkout completo com período de 1 mês', () => {
    const ev = SimulatedPaymentProvider.buildSimulatedEvent('5511999');
    expect(ev.type).toBe('CHECKOUT_COMPLETED');
    expect(ev.whatsappNumber).toBe('5511999');
    expect(ev.currentPeriodEnd).toBeInstanceOf(Date);
    expect(ev.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now());
  });
});

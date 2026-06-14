import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type { AppConfig } from '../config/config.module';
import { TryOnProcessor } from './tryon.processor';
import type { TryOnJobData } from './tryon.types';

/**
 * TryOnQueue — abstrai o enfileiramento do provador.
 *  - QUEUE_DRIVER=redis: usa BullMQ (Queue + Worker) com backoff/attempts.
 *  - QUEUE_DRIVER=memory: processa inline (setImmediate), sem Redis — dev.
 *
 * Em ambos os casos o TryOnProcessor é o mesmo, então o comportamento de
 * geração/entrega não muda entre os modos.
 */
@Injectable()
export class TryOnQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TryOnQueue.name);
  private queue?: Queue<TryOnJobData>;
  private worker?: Worker<TryOnJobData>;
  private readonly useRedis: boolean;

  constructor(
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly processor: TryOnProcessor,
  ) {
    this.useRedis = config.QUEUE_DRIVER === 'redis';
  }

  onModuleInit(): void {
    if (!this.useRedis) {
      this.logger.warn('Fila em modo MEMÓRIA (sem Redis) — processamento inline.');
      return;
    }
    const connection = {
      host: this.config.REDIS_HOST,
      port: this.config.REDIS_PORT,
    };
    this.queue = new Queue<TryOnJobData>('tryon', { connection });
    this.worker = new Worker<TryOnJobData>(
      'tryon',
      async (job) => this.processor.process(job.data),
      {
        connection,
        concurrency: this.config.WORKER_CONCURRENCY,
      },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Job ${job?.id} falhou: ${err.message}`),
    );
    this.logger.log('Fila BullMQ (Redis) ativa para provador.');
  }

  async enqueue(data: TryOnJobData): Promise<void> {
    if (this.useRedis && this.queue) {
      await this.queue.add('generate', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 50,
      });
      return;
    }
    // Modo memória: processa fora do ciclo da request, sem bloquear o webhook.
    setImmediate(() => {
      this.processor
        .process(data)
        .catch((err) => this.logger.error('Processamento inline falhou', err));
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}

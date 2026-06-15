import { Inject, Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppConfig } from '../../../config/config.module';
import { PutResult, StorageProvider } from '../../../core/ports/storage.provider';

/**
 * Armazenamento S3-compatível (AWS S3 ou MinIO). Usa path-style para MinIO.
 * URLs públicas via S3_PUBLIC_URL; download via signed URL quando preciso.
 */
@Injectable()
export class S3StorageProvider extends StorageProvider {
  readonly driver = 's3';
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly publicIncludesBucket: boolean;

  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {
    super();
    this.bucket = config.S3_BUCKET;
    this.publicUrl = config.S3_PUBLIC_URL.replace(/\/$/, '');
    const endpoint = (config.S3_ENDPOINT || '').replace(/\/$/, '');
    // Path-style (com bucket no caminho) só quando a URL pública é o próprio
    // endpoint da API (MinIO/AWS). Domínio público dedicado (R2 pub-xxx.r2.dev
    // ou CDN próprio) já aponta para o bucket -> não repetir o bucket no path.
    this.publicIncludesBucket = this.publicUrl === endpoint;
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY,
        secretAccessKey: config.S3_SECRET_KEY,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<PutResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    const url = this.publicIncludesBucket
      ? `${this.publicUrl}/${this.bucket}/${key}`
      : `${this.publicUrl}/${key}`;
    return { key, url };
  }

  async getUrl(key: string, ttlSec = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: ttlSec },
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

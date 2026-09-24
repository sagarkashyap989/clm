import {
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.js';
import { AppError } from './errors.js';

const s3Configured = Boolean(config.storage.bucket && config.storage.accessKeyId);

const s3 = s3Configured
  ? new S3Client({
      region: config.storage.region,
      endpoint: config.storage.endpoint || undefined,
      forcePathStyle: config.storage.forcePathStyle,
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
    })
  : null;

let bucketReady: Promise<void> | null = null;

function localRoot() {
  return path.resolve(config.storage.localDir);
}

function assertSafeKey(key: string) {
  if (!key || key.includes('..') || path.isAbsolute(key)) {
    throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid file key');
  }
}

export async function ensureStorage(): Promise<void> {
  if (!s3) {
    await mkdir(localRoot(), { recursive: true });
    return;
  }
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        await s3.send(new CreateBucketCommand({ Bucket: config.storage.bucket }));
      } catch (error) {
        const name = (error as { name?: string }).name ?? '';
        if (
          name !== 'BucketAlreadyOwnedByYou' &&
          name !== 'BucketAlreadyExists' &&
          name !== 'NotImplemented'
        ) {
          console.warn('Could not create storage bucket', error);
        }
      }
    })();
  }
  await bucketReady;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  assertSafeKey(key);
  await ensureStorage();
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: config.storage.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return;
  }
  const fullPath = path.join(localRoot(), key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, body);
}

export async function getObject(key: string): Promise<{ body: Buffer; contentType?: string }> {
  assertSafeKey(key);
  if (s3) {
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: config.storage.bucket,
        Key: key,
      }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new AppError(404, 'FILE_NOT_FOUND', 'Original file is not available');
    }
    return {
      body: Buffer.from(bytes),
      contentType: result.ContentType,
    };
  }
  try {
    const body = await readFile(path.join(localRoot(), key));
    return { body };
  } catch {
    throw new AppError(404, 'FILE_NOT_FOUND', 'Original file is not available');
  }
}

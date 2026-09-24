import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { ensureStorage } from './utils/storage.js';

async function main() {
  mongoose.set('bufferCommands', false);
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('MongoDB connected');
  } catch {
    console.warn('MongoDB not connected — some features may not work');
  }
  try {
    await ensureStorage();
    console.log(config.storage.bucket ? 'File storage ready (S3/MinIO)' : 'File storage ready (local disk)');
  } catch (error) {
    console.warn('File storage not ready', error);
  }
  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`API listening on http://0.0.0.0:${config.port}`);
  });
}

main().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});

import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config/index.js';

async function main() {
  await mongoose.connect(config.mongodbUri);
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDirectory, '../../.env') });

function parsePort(value: string | undefined, defaultValue: number): number {
  const port = Number(value ?? defaultValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}

export const config = {
  port: parsePort(process.env.PORT, 3001),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV,
  seedDemoData:
    process.env.SEED_DEMO_DATA !== 'false' &&
    process.env.NODE_ENV !== 'production' &&
    process.env.NODE_ENV !== 'test',
  databasePath: path.resolve(
    currentDirectory,
    '../../',
    process.env.DATABASE_PATH ?? 'data/familygene.sqlite',
  ),
};

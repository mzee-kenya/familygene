import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config/env.js';
import { migrateDatabase } from './migrations.js';
import { seedDemoPatients } from './seed-demo.js';

mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const database = new Database(config.databasePath);
database.pragma('foreign_keys = ON');
migrateDatabase(database);

if (config.seedDemoData) {
  seedDemoPatients(database);
}

import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

// Load DATABASE_URL from .env if not in environment
const envPath = '/home/ubuntu/ai-business-report/.env';
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
} catch (_) { /* .env may not exist in production */ }

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await createConnection(url);
try {
  await conn.execute('ALTER TABLE `client_profiles` ADD COLUMN `activationChecklistDismissedAt` timestamp NULL');
  console.log('✓ Migration 0046 applied: activationChecklistDismissedAt added to client_profiles');
} catch (e) {
  if (e.code === 'ER_DUP_FIELDNAME') {
    console.log('✓ Column activationChecklistDismissedAt already exists — skipping');
  } else {
    console.error('✗ Migration failed:', e.message);
    process.exit(1);
  }
}
await conn.end();

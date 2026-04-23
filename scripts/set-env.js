const fs = require('fs');
const path = require('path');

const REQUIRED = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID',
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('\n[set-env] ERROR: faltan variables de entorno requeridas:');
  missing.forEach((k) => console.error('  - ' + k));
  console.error('\nSeteá las variables y volvé a correr `npm run config`.');
  console.error('No se modificaron los environment files.\n');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: process.env['FIREBASE_API_KEY'],
  authDomain: process.env['FIREBASE_AUTH_DOMAIN'],
  projectId: process.env['FIREBASE_PROJECT_ID'],
  storageBucket: process.env['FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: process.env['FIREBASE_MESSAGING_SENDER_ID'],
  appId: process.env['FIREBASE_APP_ID'],
  measurementId: process.env['FIREBASE_MEASUREMENT_ID'],
};

function generateEnvFile(production) {
  return `export const environment = {
  production: ${production},
  firebaseConfig: ${JSON.stringify(firebaseConfig, null, 4)},
};
`;
}

const envDir = path.join(__dirname, '..', 'src', 'environments');
fs.mkdirSync(envDir, { recursive: true });

fs.writeFileSync(path.join(envDir, 'environment.ts'), generateEnvFile(false));
fs.writeFileSync(path.join(envDir, 'environment.production.ts'), generateEnvFile(true));

console.log('Environment files generated successfully.');

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, 'src/environments/environment.prod.ts');
const apiUrl = process.env.NG_APP_API_URL || 'https://tamali.onrender.com/api';

const content = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}'
};
`;

fs.writeFileSync(envFile, content, 'utf8');
console.log(`Environment file updated with API URL: ${apiUrl}`);

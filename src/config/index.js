import path from 'path';
import { fileURLToPath } from 'url';

// Obter o diretório atual quando usar ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');

// Configurações da API
export default {
  // Servidor
  port: process.env.PORT || 3000,
  
  // Diretórios
  dataDir: path.join(ROOT_DIR, 'data'),
  cookiesFile: path.join(ROOT_DIR, 'data', 'linkedin_cookies.json'),
  pasteTxtFile: path.join(ROOT_DIR, 'paste.txt'),
  
  // Apify API
  apify: {
    apiEndpoint: process.env.APIFY_API_ENDPOINT,
    apiToken: process.env.APIFY_API_TOKEN,
    timeout: 120000 // 2 minutos
  },
  
  // OpenAI API
  openai: {
    apiKey: process.env.OPENAI_API_KEY, // Usar variável de ambiente em produção
    assistantId: process.env.OPENAI_ASSISTANT_ID,
    timeout: 180000 // 3 minutos
  }
};
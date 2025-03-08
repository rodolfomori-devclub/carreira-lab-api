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
    apiEndpoint: 'https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/run-sync-get-dataset-items',
    apiToken: 'apify_api_He4ovzomMQqpy7iIW4nnZZdFPXacCn3QrwXj',
    timeout: 120000 // 2 minutos
  },
  
  // OpenAI API
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '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', // Usar variável de ambiente em produção
    assistantId: 'asst_USPgvDfuLQtJJRFMnasNAotC',
    timeout: 180000 // 3 minutos
  }
};
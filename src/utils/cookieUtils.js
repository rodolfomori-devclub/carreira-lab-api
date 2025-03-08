import fs from 'fs';
import config from '../config/index.js';

/**
 * Lê cookies de um arquivo
 * @param {string} filename Caminho do arquivo de cookies
 * @returns {Array|null} Array de cookies ou null em caso de erro
 */
export const readCookiesFromFile = (filename) => {
  try {
    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erro ao ler cookies do arquivo: ${error.message}`);
    return null;
  }
};

/**
 * Salva cookies em um arquivo
 * @param {Array} cookies Array de cookies para salvar
 * @param {string} filename Caminho do arquivo onde os cookies serão salvos
 * @returns {boolean} True se os cookies foram salvos com sucesso
 */
export const saveCookiesToFile = (cookies, filename) => {
  try {
    // Garantir que o diretório existe
    const dir = filename.substring(0, filename.lastIndexOf('/'));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filename, JSON.stringify(cookies, null, 2));
    console.log(`Cookies salvos no arquivo: ${filename}`);
    return true;
  } catch (error) {
    console.error(`Erro ao salvar cookies no arquivo: ${error.message}`);
    return false;
  }
};

/**
 * Converte array de cookies para string de cookies
 * @param {Array} cookies Array de cookies
 * @returns {string} String de cookies formatada para requisições HTTP
 */
export const convertCookiesToString = (cookies) => {
  return cookies
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ');
};

/**
 * Inicializa os cookies do arquivo paste.txt
 * @returns {boolean} True se a inicialização foi bem-sucedida
 */
export const initializeCookies = () => {
  try {
    // Verificar se o diretório de dados existe
    if (!fs.existsSync(config.dataDir)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
    }
    
    // Verificar se o arquivo paste.txt existe
    if (!fs.existsSync(config.pasteTxtFile)) {
      console.error('Arquivo paste.txt não encontrado.');
      return false;
    }
    
    // Ler e salvar os cookies
    const cookiesRaw = fs.readFileSync(config.pasteTxtFile, 'utf8');
    const cookies = JSON.parse(cookiesRaw);
    saveCookiesToFile(cookies, config.cookiesFile);
    console.log('Cookies iniciais salvos com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao inicializar cookies:', error.message);
    return false;
  }
};
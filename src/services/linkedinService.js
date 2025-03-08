import fs from 'fs';
import axios from 'axios';
import path from 'path';
import config from '../config/index.js';
import cookiesData from '../data/cookies.js';
import { readCookiesFromFile, convertCookiesToString } from '../utils/cookieUtils.js';

/**
 * Realiza o scraping de um perfil do LinkedIn
 * @param {string} profileUrl URL do perfil do LinkedIn
 * @returns {Promise<Object>} Dados do perfil ou erro
 */
export const scrapeLinkedInProfile = async (profileUrl) => {
  try {
    // Ler os cookies do arquivo
    const cookies = readCookiesFromFile(config.cookiesFile);
    
    if (!cookies) {
      throw new Error('Não foi possível ler os cookies. Verifique se o arquivo existe.');
    }

    // Converter os cookies para formato de string
    const cookieString = convertCookiesToString(cookies);

    // Preparar diferentes formatos de payload para aumentar as chances de sucesso
    const payloads = [
      // Formato 1: Usando input.urls e cookieString
      {
        input: {
          urls: [profileUrl],
          cookie: cookiesData,
          proxy: { useApifyProxy: true }
        }
      },
      
      // Formato 2: URLs direto no payload
      {
        urls: [profileUrl],
        cookie: cookiesData,
        proxy: { useApifyProxy: true }
      },

      // Formato 3: profileUrls em vez de urls
      {
        input: {
          profileUrls: [profileUrl],
          cookie: cookiesData,
          proxy: { useApifyProxy: true }
        }
      }
    ];

    let response = null;
    let error = null;
    
    // Tentar cada formato de payload
    for (const payload of payloads) {
      try {
        console.log(`Tentando scraping com payload: ${JSON.stringify(payload)}`);
        
        // Fazer a requisição para o Apify
        const result = await axios({
          method: 'POST',
          url: `${config.apify.apiEndpoint}?token=${config.apify.apiToken}`,
          headers: {
            'Content-Type': 'application/json'
          },
          data: payload,
          timeout: config.apify.timeout
        });
        
        // Se encontrar uma resposta válida, usar essa
        if (result.data && isValidResponse(result.data)) {
          response = result;
          console.log('Scraping realizado com sucesso!');
          break;
        }
      } catch (err) {
        console.error(`Erro na tentativa: ${err.message}`);
        error = err;
      }
    }
    
    // Se nenhuma tentativa teve sucesso, lançar o último erro
    if (!response) {
      throw error || new Error('Todas as tentativas de scraping falharam.');
    }

    // Processar e salvar os dados do perfil
    const resultFilename = `linkedin_profile_${Date.now()}.json`;
    const resultPath = path.join(config.dataDir, resultFilename);
    
    // Salvar a resposta bruta para debugging
    fs.writeFileSync(path.join(config.dataDir, 'last_api_response_raw.json'), 
      JSON.stringify(response.data, null, 2));
    
    // Extrair e processar os dados do perfil para o formato desejado
    const profileData = processProfileData(response.data);
    
    // Salvar os dados do perfil
    fs.writeFileSync(resultPath, JSON.stringify(profileData, null, 2));
    console.log(`Dados do perfil salvos em ${resultFilename}`);
    
    return {
      success: true,
      data: profileData,
      filename: resultFilename
    };
  } catch (error) {
    console.error('Erro ao fazer scraping do perfil:', error.message);
    
    // Capturar mais detalhes do erro
    if (error.response) {
      console.error('Status da resposta:', error.response.status);
      console.error('Detalhes do erro:', JSON.stringify(error.response.data, null, 2));
      
      // Salvar detalhes do erro para debugging
      fs.writeFileSync(path.join(config.dataDir, 'last_error_details.json'), 
        JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  }
};

/**
 * Lista todos os resultados de scraping
 * @returns {Array} Lista de resultados anteriores
 */
export const listScrapingResults = () => {
  try {
    const files = fs.readdirSync(config.dataDir)
      .filter(file => file.startsWith('linkedin_profile_') && file.endsWith('.json'));
      
    const results = files.map(file => {
      const filePath = path.join(config.dataDir, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        createdAt: stats.birthtime,
        size: stats.size
      };
    }).sort((a, b) => b.createdAt - a.createdAt);
    
    return results;
  } catch (error) {
    console.error('Erro ao listar resultados:', error.message);
    throw error;
  }
};

/**
 * Obtém um resultado específico pelo nome do arquivo
 * @param {string} filename Nome do arquivo
 * @returns {Object} Conteúdo do arquivo
 */
export const getScrapingResult = (filename) => {
  try {
    const filePath = path.join(config.dataDir, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo '${filename}' não encontrado`);
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
  } catch (error) {
    console.error(`Erro ao obter resultado '${filename}':`, error.message);
    throw error;
  }
};

/**
 * Verifica se a resposta da API contém dados válidos
 * @param {*} data Dados retornados pela API
 * @returns {boolean} True se a resposta for válida
 */
const isValidResponse = (data) => {
  // Se for um array não vazio
  if (Array.isArray(data) && data.length > 0) {
    return true;
  }
  
  // Se for um objeto com propriedade 'items' que é um array não vazio
  if (data && data.items && Array.isArray(data.items) && data.items.length > 0) {
    return true;
  }
  
  // Se for um objeto com pelo menos algumas propriedades esperadas de perfil
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data);
    const expectedKeys = ['profileId', 'firstName', 'lastName', 'headline', 'summary'];
    if (expectedKeys.some(key => keys.includes(key))) {
      return true;
    }
  }
  
  return false;
};

/**
 * Processa os dados do perfil para o formato desejado
 * @param {*} data Dados retornados pela API
 * @returns {Object} Dados processados
 */
const processProfileData = (data) => {
  // Se for um array, pegar o primeiro item
  if (Array.isArray(data)) {
    return data;
  }
  
  // Se tiver uma propriedade 'items', pegar o array items
  if (data && data.items && Array.isArray(data.items)) {
    return data.items;
  }
  
  // Caso contrário, retornar os dados como estão
  return data;
};
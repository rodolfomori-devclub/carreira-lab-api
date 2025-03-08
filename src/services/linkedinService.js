// services/linkedinService.js
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import config from '../config/index.js';
import { getRandomCookies, getAllCookies } from './firebaseService.js';

/**
 * Realiza o scraping de um perfil do LinkedIn
 * @param {string} profileUrl URL do perfil do LinkedIn
 * @returns {Promise<Object>} Dados do perfil ou erro
 */
export const scrapeLinkedInProfile = async (profileUrl) => {
  try {
    // Tentar com até 3 conjuntos de cookies diferentes
    const MAX_RETRY = 3;
    let triedCookieSets = [];
    let lastError = null;
    
    for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
      try {
        console.log(`Tentativa ${attempt}/${MAX_RETRY} de scraping do perfil...`);
        
        // Obter cookies aleatórios do Firebase (diferentes dos já tentados)
        const cookies = await getNextCookies(triedCookieSets);
        triedCookieSets.push(cookies); // Marcar como tentado
        
        // Converter os cookies para formato de string
        const cookieString = convertCookiesToString(cookies);

        // Preparar diferentes formatos de payload para aumentar as chances de sucesso
        const payloads = [
          // Formato 1: Usando input.urls e cookieString
          {
            input: {
              urls: [profileUrl],
              cookie: cookies,
              proxy: { useApifyProxy: true }
            }
          },
          
          // Formato 2: URLs direto no payload
          {
            urls: [profileUrl],
            cookie: cookies,
            proxy: { useApifyProxy: true }
          },

          // Formato 3: profileUrls em vez de urls
          {
            input: {
              profileUrls: [profileUrl],
              cookie: cookies,
              proxy: { useApifyProxy: true }
            }
          }
        ];

        let response = null;
        
        // Tentar cada formato de payload
        for (const payload of payloads) {
          try {
            console.log(`Tentando scraping com formato de payload: ${JSON.stringify(payload, null, 2)}`);
            
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
            console.error(`Erro no formato: ${err.message}`);
            lastError = err;
          }
        }
        
        // Se encontrou uma resposta válida, retornar
        if (response) {
          // Processar e retornar os dados do perfil
          const profileData = processProfileData(response.data);
          
          return {
            success: true,
            data: profileData
          };
        }
        
        // Se chegou aqui, nenhum formato de payload funcionou com este cookie
        throw new Error("Nenhum formato de payload funcionou com este conjunto de cookies");
        
      } catch (error) {
        console.error(`Falha na tentativa ${attempt}: ${error.message}`);
        lastError = error;
        
        // Continuar para a próxima tentativa com outro conjunto de cookies
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    throw new Error(`Falha ao fazer scraping após ${MAX_RETRY} tentativas. Última mensagem de erro: ${lastError?.message}`);
    
  } catch (error) {
    console.error('Erro ao fazer scraping do perfil:', error.message);
    
    // Fornecer uma mensagem de erro específica dizendo para contatar o suporte
    throw {
      message: 'Não foi possível acessar seu perfil do LinkedIn. Por favor, contate o suporte.',
      originalError: error,
      contactSupport: true
    };
  }
};

/**
 * Obtém o próximo conjunto de cookies para tentar (diferente dos já tentados)
 * @param {Array} triedCookieSets Conjuntos de cookies já tentados
 * @returns {Promise<Array>} Próximo conjunto de cookies para tentar
 */
const getNextCookies = async (triedCookieSets) => {
  try {
    // Se for a primeira tentativa, simplesmente pegar cookies aleatórios
    if (triedCookieSets.length === 0) {
      return await getRandomCookies();
    }
    
    // Obter todos os conjuntos de cookies
    const allCookieSets = await getAllCookies();
    
    // Filtrar os conjuntos ainda não tentados
    const availableSets = allCookieSets.filter(cookieSet => 
      !triedCookieSets.some(tried => 
        JSON.stringify(tried) === JSON.stringify(cookieSet.cookies)
      )
    );
    
    // Se não houver mais conjuntos disponíveis, pegar um aleatório (pode repetir)
    if (availableSets.length === 0) {
      console.log('Todos os conjuntos de cookies já foram tentados. Escolhendo um aleatório...');
      return await getRandomCookies();
    }
    
    // Escolher um dos conjuntos restantes aleatoriamente
    const randomIndex = Math.floor(Math.random() * availableSets.length);
    return availableSets[randomIndex].cookies;
    
  } catch (error) {
    console.error('Erro ao obter próximo conjunto de cookies:', error);
    throw error;
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
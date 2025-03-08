// services/firebaseService.js
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDi4qVqaFsfu053lJGL5KeuAuEwDHe-tww",
  authDomain: "linkedin-devclub.firebaseapp.com",
  projectId: "linkedin-devclub",
  storageBucket: "linkedin-devclub.firebasestorage.app",
  messagingSenderId: "981896576923",
  appId: "1:981896576923:web:5956ca183c3d1c78f1ab3e"
};

// Inicializar o app Firebase
console.log('Inicializando Firebase com configuração:', JSON.stringify(firebaseConfig, null, 2));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Parseia uma string de cookies para um array de objetos de cookie
 * @param {string} cookieStr String contendo os cookies em formato JSON
 * @returns {Array} Array de objetos de cookie
 */
const parseCookieString = (cookieStr) => {
  try {
    // Remover espaços extras e caracteres não desejados
    const cleanedStr = cookieStr.trim().replace(/^'|'$/g, '');
    
    // Tentar converter a string para JSON
    // Primeiro temos que envolver em colchetes para formar um array válido
    const jsonStr = `[${cleanedStr}]`;
    
    // Tentar fazer o parse direto
    try {
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.warn('Erro no parse direto, tentando método alternativo:', parseError.message);
      
      // Método alternativo: verificar se a string já é um array
      if (cleanedStr.startsWith('[') && cleanedStr.endsWith(']')) {
        // Já é um array, tentar parse
        return JSON.parse(cleanedStr);
      }
      
      // Método ainda mais alternativo: regex para extrair objetos
      const cookieObjects = [];
      const cookiePattern = /\{\s*"domain":[^}]+\}/g;
      let match;
      
      while ((match = cookiePattern.exec(cleanedStr)) !== null) {
        try {
          cookieObjects.push(JSON.parse(match[0]));
        } catch (objError) {
          console.warn('Erro ao parsear cookie individual:', objError.message);
        }
      }
      
      if (cookieObjects.length > 0) {
        return cookieObjects;
      }
      
      throw new Error('Não foi possível parsear os cookies');
    }
  } catch (error) {
    console.error('Erro ao parsear string de cookies:', error);
    return [];
  }
};

/**
 * Recupera todos os conjuntos de cookies do Firebase
 * @returns {Promise<Array>} Array de conjuntos de cookies
 */
export const getAllCookieSets = async () => {
  try {
    console.log('Buscando todos os conjuntos de cookies do Firebase...');
    
    // Referência à coleção
    const cookiesCollection = collection(db, 'linkedin_cookies');
    
    // Buscar todos os documentos
    const querySnapshot = await getDocs(cookiesCollection);
    
    console.log(`Encontrados ${querySnapshot.size} documentos na coleção`);
    
    if (querySnapshot.empty) {
      throw new Error('Nenhum documento encontrado na coleção');
    }
    
    // Array para armazenar todos os conjuntos de cookies
    const allCookieSets = [];
    
    // Para cada documento
    querySnapshot.forEach((docSnapshot) => {
      const docId = docSnapshot.id;
      const docData = docSnapshot.data();
      
      console.log(`Processando documento: ${docId}`);
      console.log('Chaves no documento:', Object.keys(docData));
      
      // Para cada chave no documento (cada email/usuário)
      Object.keys(docData).forEach((email) => {
        console.log(`Processando cookies para: ${email}`);
        
        // Obter o valor associado à chave
        const cookieStr = docData[email];
        
        // Se o valor for uma string, tentar parsear
        if (typeof cookieStr === 'string') {
          try {
            const cookiesArray = parseCookieString(cookieStr);
            if (cookiesArray && cookiesArray.length > 0) {
              console.log(`Adicionando ${cookiesArray.length} cookies de ${email}`);
              allCookieSets.push({
                source: email,
                cookies: cookiesArray
              });
            }
          } catch (parseError) {
            console.warn(`Erro ao processar cookies de ${email}:`, parseError.message);
          }
        }
      });
    });
    
    console.log(`Total de conjuntos de cookies encontrados: ${allCookieSets.length}`);
    
    return allCookieSets;
  } catch (error) {
    console.error('Erro ao buscar cookies do Firebase:', error);
    throw error;
  }
};

/**
 * Obtém um conjunto aleatório de cookies do Firebase
 * @returns {Promise<Array>} Array de objetos de cookie
 */
export const getRandomCookies = async () => {
  try {
    // Obter todos os conjuntos
    const allSets = await getAllCookieSets();
    
    if (allSets.length === 0) {
      throw new Error('Nenhum conjunto de cookies encontrado');
    }
    
    // Escolher um conjunto aleatoriamente
    const randomIndex = Math.floor(Math.random() * allSets.length);
    const selectedSet = allSets[randomIndex];
    
    console.log(`Escolhido aleatoriamente conjunto de cookies de: ${selectedSet.source}`);
    console.log(`Este conjunto tem ${selectedSet.cookies.length} cookies`);
    
    return selectedSet.cookies;
  } catch (error) {
    console.error('Erro ao obter cookies aleatórios:', error);
    throw error;
  }
};

/**
 * Busca todos os conjuntos de cookies e retorna no formato esperado
 * @returns {Promise<Array>} Array onde cada posição é um conjunto completo de cookies
 */
export const getAllCookies = async () => {
  try {
    const cookieSets = await getAllCookieSets();
    return cookieSets.map(set => set.cookies);
  } catch (error) {
    console.error('Erro ao buscar todos os cookies:', error);
    throw error;
  }
};

export default {
  getAllCookies,
  getRandomCookies,
  getAllCookieSets
};
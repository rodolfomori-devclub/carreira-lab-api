import fs from 'fs';
import path from 'path';
import config from '../config/index.js';
import { readCookiesFromFile, saveCookiesToFile } from '../utils/cookieUtils.js';
import { scrapeLinkedInProfile, listScrapingResults, getScrapingResult } from '../services/linkedinService.js';
import { analyzeProfileWithGPT } from '../services/openaiService.js';

/**
 * Verifica o status da API
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const healthCheck = (req, res) => {
  res.json({ 
    status: 'online', 
    message: 'LinkedIn Scraper API está funcionando!',
    version: '1.0.0'
  });
};

/**
 * Retorna os cookies atuais
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getCookies = (req, res) => {
  try {
    if (fs.existsSync(config.cookiesFile)) {
      const cookies = readCookiesFromFile(config.cookiesFile);
      res.json({ success: true, cookies });
    } else {
      res.status(404).json({ 
        success: false, 
        message: 'Arquivo de cookies não encontrado'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Atualiza os cookies com os fornecidos
 * @param {Object} req - Request object com {cookies} no body
 * @param {Object} res - Response object
 */
export const updateCookies = (req, res) => {
  try {
    const { cookies } = req.body;
    
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cookies inválidos. Forneça um array de objetos de cookie.'
      });
    }
    
    const saved = saveCookiesToFile(cookies, config.cookiesFile);
    
    if (saved) {
      res.json({ 
        success: true, 
        message: 'Cookies atualizados com sucesso'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Erro ao salvar cookies' 
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Realiza o scraping de um perfil do LinkedIn e a análise com GPT
 * @param {Object} req - Request object com {profileUrl, objective} no body
 * @param {Object} res - Response object
 */
export const scrapeProfile = async (req, res) => {
  try {
    const { profileUrl, objective } = req.body;
    
    // Validações
    if (!profileUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL do perfil é obrigatória' 
      });
    }
    
    if (!objective) {
      return res.status(400).json({ 
        success: false, 
        message: 'Objetivo da análise é obrigatório' 
      });
    }
    
    // Verificar se o arquivo de cookies existe
    if (!fs.existsSync(config.cookiesFile)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cookies não encontrados. Por favor, atualize os cookies primeiro.' 
      });
    }
    
    // 1. Realizar o scraping do perfil LinkedIn
    console.log(`Iniciando scraping para: ${profileUrl}`);
    const scrapingResult = await scrapeLinkedInProfile(profileUrl);
    
    // 2. Analisar o perfil com GPT
    console.log(`Iniciando análise do perfil com GPT para objetivo: ${objective}`);
    const analysis = await analyzeProfileWithGPT(scrapingResult.data, objective);
    
    // 3. Salvar resultado completo da análise (inclui ambos scraping e análise GPT)
    const analysisFilename = `analysis_${Date.now()}.json`;
    const analysisPath = path.join(config.dataDir, analysisFilename);
    
    const fullResult = {
      success: true,
      profileUrl,
      objective,
      scrapedData: scrapingResult.data,
      analysis: analysis.analysis,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync(analysisPath, JSON.stringify(fullResult, null, 2));
    
    // 4. Responder com os resultados
    res.json({
      success: true,
      message: 'Análise realizada com sucesso',
      data: {
        profile: {
          name: extractName(scrapingResult.data),
          headline: extractHeadline(scrapingResult.data),
          location: extractLocation(scrapingResult.data),
          profileUrl: profileUrl
        },
        objective: objective,
        analysis: analysis.analysis,
        timestamp: new Date().toISOString()
      },
      resultFile: analysisFilename
    });
    
  } catch (error) {
    console.error('Erro ao analisar perfil:', error.message);
    
    // Capturar detalhes do erro da resposta da API
    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: 'Erro ao analisar perfil',
        error: error.message,
        apiError: error.response.data
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro ao analisar perfil',
      error: error.message
    });
  }
};

/**
 * Lista todos os resultados de scraping anteriores
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getResults = (req, res) => {
  try {
    const results = listScrapingResults();
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtém um resultado específico pelo nome do arquivo
 * @param {Object} req - Request object com params.filename
 * @param {Object} res - Response object
 */
export const getResult = (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nome do arquivo é obrigatório' 
      });
    }
    
    const data = getScrapingResult(filename);
    res.json({ success: true, data });
  } catch (error) {
    // Se o arquivo não for encontrado, retornar 404
    if (error.message.includes('não encontrado')) {
      return res.status(404).json({ 
        success: false, 
        message: error.message 
      });
    }
    
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Extrai o nome do usuário dos dados de perfil
 * @param {Object} profileData - Dados do perfil do LinkedIn
 * @returns {string} Nome do usuário
 */
const extractName = (profileData) => {
  // Verificar diferentes formatos possíveis dos dados
  if (Array.isArray(profileData) && profileData.length > 0) {
    const profile = profileData[0];
    
    // Formato 1: firstName e lastName como propriedades separadas
    if (profile.firstName && profile.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    
    // Formato 2: Nome completo em uma única propriedade
    if (profile.name) {
      return profile.name;
    }
    
    // Formato 3: Nome no título do perfil
    if (profile.title) {
      return profile.title;
    }
  } else if (typeof profileData === 'object' && profileData !== null) {
    // Verificar mesmos formatos para objeto não-array
    if (profileData.firstName && profileData.lastName) {
      return `${profileData.firstName} ${profileData.lastName}`;
    }
    
    if (profileData.name) {
      return profileData.name;
    }
    
    if (profileData.title) {
      return profileData.title;
    }
  }
  
  // Retorno padrão se não encontrar
  return "Usuário LinkedIn";
};

/**
 * Extrai o headline/título do usuário dos dados de perfil
 * @param {Object} profileData - Dados do perfil do LinkedIn
 * @returns {string} Headline do usuário
 */
const extractHeadline = (profileData) => {
  // Verificar diferentes formatos possíveis dos dados
  if (Array.isArray(profileData) && profileData.length > 0) {
    const profile = profileData[0];
    
    // Várias possibilidades de nomes de campos para o headline
    if (profile.headline) {
      return profile.headline;
    }
    
    if (profile.subTitle) {
      return profile.subTitle;
    }
    
    if (profile.occupation) {
      return profile.occupation;
    }
  } else if (typeof profileData === 'object' && profileData !== null) {
    if (profileData.headline) {
      return profileData.headline;
    }
    
    if (profileData.subTitle) {
      return profileData.subTitle;
    }
    
    if (profileData.occupation) {
      return profileData.occupation;
    }
  }
  
  // Retorno padrão se não encontrar
  return "Profissional no LinkedIn";
};

/**
 * Extrai a localização do usuário dos dados de perfil
 * @param {Object} profileData - Dados do perfil do LinkedIn
 * @returns {string} Localização do usuário
 */
const extractLocation = (profileData) => {
  // Verificar diferentes formatos possíveis dos dados
  if (Array.isArray(profileData) && profileData.length > 0) {
    const profile = profileData[0];
    
    if (profile.location) {
      return profile.location;
    }
    
    if (profile.locationName) {
      return profile.locationName;
    }
    
    if (profile.geoLocation) {
      return profile.geoLocation;
    }
  } else if (typeof profileData === 'object' && profileData !== null) {
    if (profileData.location) {
      return profileData.location;
    }
    
    if (profileData.locationName) {
      return profileData.locationName;
    }
    
    if (profileData.geoLocation) {
      return profileData.geoLocation;
    }
  }
  
  // Retorno padrão se não encontrar
  return "Localização não especificada";
};
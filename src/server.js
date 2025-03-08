import express from 'express';
import axios from 'axios';
import cors from 'cors';
import cookieData from './data/cookies.js';
import { analyzeProfileWithGPT } from './services/openaiService.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar CORS para permitir solicitações do frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para processar JSON
app.use(express.json({ limit: '50mb' }));

// Rota para scraping e análise do LinkedIn
app.post('/scrape', async (req, res) => {
  try {
    // Extrair dados do body
    const { profileUrl, cookies, objective } = req.body;
    
    // Validar entradas
    if (!profileUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL do perfil é obrigatória' 
      });
    }
    
    // Se cookies não forem fornecidos, usar os padrão
    const cookiesToUse = cookies && Array.isArray(cookies) && cookies.length > 0 
      ? cookies 
      : cookieData;
    
    // Configuração da API Apify
    const apiEndpoint = 'https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/run-sync-get-dataset-items';
    const apiToken = 'apify_api_He4ovzomMQqpy7iIW4nnZZdFPXacCn3QrwXj';
    
    console.log(`Iniciando scraping para: ${profileUrl}`);
    
    // Definir os possíveis formatos de payload
    const payloads = [
      // Formato 1: Usando input.urls
      {
        input: {
          urls: [profileUrl],
          cookie: cookieData,
          proxy: { useApifyProxy: true }
        }
      },
      // Formato 2: Usando profileUrls
      {
        input: {
          profileUrls: [profileUrl],
          cookie: cookieData,
          proxy: { useApifyProxy: true }
        }
      },
      // Formato 3: URLs direto no payload
      {
        urls: [profileUrl],
        cookie: cookieData,
        proxy: { useApifyProxy: true }
      }
    ];
    
    let profileData = null;
    let lastError = null;
    
    // Tentar cada formato de payload até ter sucesso
    for (const payload of payloads) {
      try {
        console.log(`Tentando com payload: ${JSON.stringify(payload, null, 2)}`);
        
        // Fazer requisição para Apify
        const response = await axios({
          method: 'POST',
          url: `${apiEndpoint}?token=${apiToken}`,
          headers: {
            'Content-Type': 'application/json'
          },
          data: payload,
          timeout: 120000 // 2 minutos
        });
        
        // Verificar se a resposta tem dados válidos
        if (response.data) {
          // Processar resposta
          if (Array.isArray(response.data) && response.data.length > 0) {
            profileData = response.data;
            break;
          } else if (response.data.items && Array.isArray(response.data.items) && response.data.items.length > 0) {
            profileData = response.data.items;
            break;
          } else if (response.data && typeof response.data === 'object') {
            profileData = response.data;
            break;
          }
        }
        
        console.log('Resposta sem dados válidos, tentando próximo formato');
      } catch (error) {
        console.error(`Erro na tentativa: ${error.message}`);
        lastError = error;
      }
    }
    
    // Se nenhum dos formatos funcionou
    if (!profileData) {
      throw lastError || new Error('Não foi possível obter dados do perfil com nenhum dos métodos tentados');
    }
    
    // Integração com o GPT para análise real do perfil
    console.log('Perfil obtido com sucesso. Iniciando análise com GPT...');
    
    try {
      // Chamar o serviço de análise GPT com os dados do perfil e o objetivo
      const analysisResult = await analyzeProfileWithGPT(profileData, objective || 'general');
      
      // Extrair informações básicas do perfil para o frontend
      const profileInfo = {
        name: extractName(profileData),
        headline: extractHeadline(profileData),
        location: extractLocation(profileData),
        profileUrl: profileUrl
      };
      
      // Responder com os dados completos
      res.json({
        success: true,
        data: {
          profile: profileInfo,
          objective: objective || 'general',
          analysis: analysisResult.analysis,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (gptError) {
      console.error('Erro na análise com GPT:', gptError.message);
      
      // Ainda retornar os dados do perfil mesmo se a análise falhar
      res.status(207).json({
        success: true,
        partialSuccess: true,
        message: 'Perfil obtido com sucesso, mas ocorreu um erro na análise com GPT',
        data: {
          profile: {
            name: extractName(profileData),
            headline: extractHeadline(profileData),
            location: extractLocation(profileData),
            profileUrl: profileUrl
          },
          objective: objective || 'general',
          profileData: profileData,
          error: gptError.message
        }
      });
    }
    
  } catch (error) {
    console.error('Erro no scraping:', error.message);
    
    // Tratar detalhes do erro para resposta
    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: 'Erro ao realizar scraping',
        error: error.message,
        statusCode: error.response.status,
        apiError: error.response.data
      });
    }
    
    // Erro genérico
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar scraping',
      error: error.message
    });
  }
});

// Rota para listar objetivos disponíveis
app.get('/api/objectives', (req, res) => {
  const objectives = [
    {
      id: 'first_job',
      name: 'Primeiro Emprego',
      description: 'Otimizar seu perfil para conseguir seu primeiro emprego como desenvolvedor'
    },
    {
      id: 'career_upgrade',
      name: 'Upgrade de Carreira',
      description: 'Melhorar seu perfil para conseguir uma posição senior ou gerencial'
    },
    {
      id: 'international',
      name: 'Mercado Internacional',
      description: 'Adaptar seu perfil para oportunidades no mercado global'
    },
    {
      id: 'ssi_improvement',
      name: 'Melhorar SSI',
      description: 'Aumentar seu Social Selling Index e visibilidade no LinkedIn'
    }
  ];
  
  res.json(objectives);
});

// Funções auxiliares para extrair informações do perfil
function extractName(profileData) {
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
}

function extractHeadline(profileData) {
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
}

function extractLocation(profileData) {
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
}

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
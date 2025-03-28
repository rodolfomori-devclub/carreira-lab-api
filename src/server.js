import express from 'express'
import axios from 'axios'
import cors from 'cors'
import { analyzeProfileWithGPT } from './services/openaiService.js'
import { getRandomCookies, getAllCookies } from './services/firebaseService.js'
import chatRoutes from './routes/chatRoutes.js'
import 'dotenv/config'

const app = express()
const PORT = process.env.PORT || 3001

// Configurar CORS para permitir solicitações do frontend
app.use(cors())
app.use(cors({
  // origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'],
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para processar JSON
app.use(express.json({ limit: '50mb' }))

// Rotas do chat
app.use(chatRoutes)

// Rota para scraping e análise do LinkedIn
app.post('/scrape', async (req, res) => {
  try {
    // Extrair dados do body
    const { profileUrl, objective } = req.body

    // Validar entradas
    if (!profileUrl) {
      return res.status(400).json({
        success: false,
        message: 'URL do perfil é obrigatória',
      })
    }

    // Configuração da API Apify
    const apiEndpoint =
      'https://api.apify.com/v2/acts/curious_coder~linkedin-profile-scraper/run-sync-get-dataset-items'
    const apiToken =
      process.env.APIFY_API_TOKEN ||
      'apify_api_He4ovzomMQqpy7iIW4nnZZdFPXacCn3QrwXj'

    console.log(`Iniciando scraping para: ${profileUrl}`)

    // Sistema de retry com diferentes conjuntos de cookies
    const MAX_RETRY = 3
    let profileData = null
    let lastError = null
    let cookieSource = 'local' // Para tracking

    // Tentar até MAX_RETRY vezes
    for (let retryAttempt = 1; retryAttempt <= MAX_RETRY; retryAttempt++) {
      try {
        console.log(`Tentativa ${retryAttempt}/${MAX_RETRY} de scraping...`)

        // Tentar obter cookies do Firebase ou usar local como fallback
        let cookiesToUse = []
        try {
          // Tentar obter cookies do Firebase
          cookiesToUse = await getRandomCookies()
          cookieSource = 'firebase'
          console.log(`Usando cookies do Firebase na tentativa ${retryAttempt}`)
        } catch (cookieError) {
          console.warn(
            `Erro ao obter cookies do Firebase: ${cookieError.message}`,
          )

          console.log(`Usando cookies locais na tentativa ${retryAttempt}`)
        }

        // Verificar se temos cookies válidos
        if (
          !cookiesToUse ||
          !Array.isArray(cookiesToUse) ||
          cookiesToUse.length === 0
        ) {
          console.warn('Nenhum cookie válido disponível para esta tentativa.')
          if (retryAttempt === MAX_RETRY) {
            throw new Error(
              'Não foi possível obter cookies válidos após múltiplas tentativas',
            )
          }
          continue // Tentar novamente
        }

        // Definir os possíveis formatos de payload
        const payloads = [
          // Formato 1: Usando input.urls
          {
            input: {
              urls: [profileUrl],
              cookie: cookiesToUse,
              proxy: { useApifyProxy: true },
            },
          },
          // Formato 2: Usando profileUrls
          {
            input: {
              profileUrls: [profileUrl],
              cookie: cookiesToUse,
              proxy: { useApifyProxy: true },
            },
          },
          // Formato 3: URLs direto no payload
          {
            urls: [profileUrl],
            cookie: cookiesToUse,
            proxy: { useApifyProxy: true },
          },
        ]

        // Tentar cada formato de payload até ter sucesso
        for (const payload of payloads) {
          try {
            console.log(
              `Tentando com payload (formato ${
                payloads.indexOf(payload) + 1
              })...`,
            )

            // Fazer requisição para Apify
            const response = await axios({
              method: 'POST',
              url: `${apiEndpoint}?token=${apiToken}`,
              headers: {
                'Content-Type': 'application/json',
              },
              data: payload,
              timeout: 120000, // 2 minutos
            })

            console.log('response', response.data)

            // Verificar se a resposta tem dados válidos
            if (response.data) {
              // Processar resposta
              if (Array.isArray(response.data) && response.data.length > 0) {
                profileData = response.data
                break
              } else if (
                response.data.items &&
                Array.isArray(response.data.items) &&
                response.data.items.length > 0
              ) {
                profileData = response.data.items
                break
              } else if (response.data && typeof response.data === 'object') {
                profileData = response.data
                break
              }
            }

            console.log('Resposta sem dados válidos, tentando próximo formato')
          } catch (error) {
            console.error(`Erro na tentativa: ${error.message}`)
            lastError = error
          }
        }

        // Se encontrou dados válidos, sair do loop de retry
        if (profileData) {
          console.log(
            `Scraping bem-sucedido na tentativa ${retryAttempt} usando cookies ${cookieSource}`,
          )
          break
        }
      } catch (retryError) {
        console.error(
          `Erro na tentativa ${retryAttempt}: ${retryError.message}`,
        )
        lastError = retryError
      }
    }

    // Se todas as tentativas falharam
    if (!profileData) {
      // Responder com erro e flag para contatar suporte
      return res.status(500).json({
        success: false,
        message:
          'Não foi possível acessar seu perfil do LinkedIn após várias tentativas',
        error: lastError?.message || 'Erro desconhecido',
        contactSupport: true,
      })
    }

    // Integração com o GPT para análise real do perfil
    console.log('Perfil obtido com sucesso. Iniciando análise com GPT...')

    // Trecho completo a ser atualizado no arquivo src/server.js (parte do endpoint /scrape)

    // Integração com o GPT para análise real do perfil
    console.log('Perfil obtido com sucesso. Iniciando análise com GPT...')

    try {
      // Chamar o serviço de análise GPT com os dados do perfil e o objetivo
      const analysisResult = await analyzeProfileWithGPT(
        profileData,
        objective || 'general',
      )

      // Extrair informações básicas do perfil para o frontend
      const profileInfo = {
        name: extractName(profileData),
        headline: extractHeadline(profileData),
        location: extractLocation(profileData),
        profileUrl: profileUrl,
      }

      // Responder com os dados completos
      res.json({
        success: true,
        data: {
          profile: profileInfo,
          objective: objective || 'general',
          analysis: analysisResult.analysis,
          analysisJson: analysisResult.analysisJson || null, // Adicionar o objeto JSON se disponível
          isJsonFormat: analysisResult.isJsonFormat || false, // Flag para indicar se está em formato JSON
          scores: getScoresFromAnalysis(analysisResult), // Usar função helper para extrair scores
          timestamp: new Date().toISOString(),
          cookieSource: cookieSource, // Apenas para referência
        },
      })
    } catch (gptError) {
      console.error('Erro na análise com GPT:', gptError.message)

      // Ainda retornar os dados do perfil mesmo se a análise falhar
      res.status(207).json({
        success: true,
        partialSuccess: true,
        message:
          'Perfil obtido com sucesso, mas ocorreu um erro na análise com GPT',
        note:
          'A análise automática falhou, mas ainda podemos mostrar seu perfil.',
        noteType: 'warning',
        data: {
          profile: {
            name: extractName(profileData),
            headline: extractHeadline(profileData),
            location: extractLocation(profileData),
            profileUrl: profileUrl,
          },
          objective: objective || 'general',
          profileData: profileData,
          error: gptError.message,
        },
      })
    }

    // Função auxiliar para extrair scores da análise
    function getScoresFromAnalysis(analysisResult) {
      // Tentar extrair notas do analysisJson
      try {
        if (analysisResult.isJsonFormat && analysisResult.analysisJson) {
          // Verificar várias possíveis estruturas para as notas
          if (analysisResult.analysisJson.análise?.nota) {
            // Formato antigo
            return {
              profile_completeness:
                analysisResult.analysisJson.análise.nota.score_geral || 8,
              headline_quality:
                analysisResult.analysisJson.análise.nota.score_apresentação ||
                7,
              experience_details:
                analysisResult.analysisJson.análise.nota.score_profissional ||
                8,
              skills_relevance:
                analysisResult.analysisJson.análise.nota.score_habilidades || 7,
              overall_impression:
                analysisResult.analysisJson.análise.nota.score_linkedin || 8,
            }
          } else if (analysisResult.analysisJson.nota_perfil) {
            // Formato novo mapeado
            return {
              profile_completeness:
                analysisResult.analysisJson.nota_perfil || 8,
              headline_quality: analysisResult.analysisJson.nota_titulo || 7,
              experience_details:
                analysisResult.analysisJson.nota_experiencia || 8,
              skills_relevance:
                analysisResult.analysisJson.nota_habilidades || 7,
              overall_impression: analysisResult.analysisJson.nota_perfil || 8,
            }
          } else if (
            analysisResult.analysisJson.resumo_geral &&
            typeof analysisResult.analysisJson.resumo_geral
              .impressao_inicial === 'string'
          ) {
            // Tentar extrair nota do texto de impressão inicial (se contiver um número)
            const notaMatch = analysisResult.analysisJson.resumo_geral.impressao_inicial.match(
              /(\d+(\.\d+)?)/,
            )
            const notaPerfil = notaMatch ? parseFloat(notaMatch[1]) : 8

            return {
              profile_completeness: notaPerfil,
              headline_quality: 7,
              experience_details: 8,
              skills_relevance: 7,
              overall_impression: notaPerfil,
            }
          } else if (analysisResult.analysisJson['Nota Geral']) {
            // Formato com objeto "Nota Geral"
            const notasObj = analysisResult.analysisJson['Nota Geral']
            return {
              profile_completeness: notasObj.notaPerfil || 8,
              headline_quality: notasObj.notaTitulo || 7,
              experience_details:
                notasObj.notaExperiencia ||
                notasObj.notaOportunidadesMelhoria ||
                8,
              skills_relevance: notasObj.notaHabilidades || 7,
              overall_impression:
                notasObj.notaPerfil || notasObj.notaGeral || 8,
            }
          } else if (
            analysisResult.analysisJson.resumoGeral &&
            analysisResult.analysisJson.resumoGeral.notaTotal
          ) {
            // Formato com resumoGeral.notaTotal
            const nota = analysisResult.analysisJson.resumoGeral.notaTotal
            return {
              profile_completeness: nota,
              headline_quality: nota - 1,
              experience_details: nota,
              skills_relevance: nota - 1.5,
              overall_impression: nota,
            }
          }
        }
      } catch (error) {
        console.log('Erro ao extrair notas do objeto JSON:', error)
      }

      // Valores padrão caso não consiga extrair notas
      return {
        profile_completeness: 8,
        headline_quality: 7,
        experience_details: 8,
        skills_relevance: 7,
        overall_impression: 8,
      }
    }
  } catch (error) {
    console.error('Erro no scraping:', error.message)

    // Tratar detalhes do erro para resposta
    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: 'Erro ao realizar scraping',
        error: error.message,
        statusCode: error.response.status,
        apiError: error.response.data,
      })
    }

    // Erro genérico
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar scraping',
      error: error.message,
    })
  }
})

// Rota para listar objetivos disponíveis
app.get('/objectives', (req, res) => {
  const objectives = [
    {
      id: 'first_job',
      name: 'Primeiro Emprego',
      description:
        'Otimizar seu perfil para conseguir seu primeiro emprego como desenvolvedor',
    },
    {
      id: 'career_upgrade',
      name: 'Upgrade de Carreira',
      description:
        'Melhorar seu perfil para conseguir uma posição senior ou gerencial',
    },
    {
      id: 'international',
      name: 'Mercado Internacional',
      description: 'Adaptar seu perfil para oportunidades no mercado global',
    },
    {
      id: 'ssi_improvement',
      name: 'Melhorar SSI',
      description:
        'Aumentar seu Social Selling Index e visibilidade no LinkedIn',
    },
  ]

  res.json(objectives)
})


// Funções auxiliares para extrair informações do perfil
function extractName(profileData) {
  // Verificar diferentes formatos possíveis dos dados
  if (Array.isArray(profileData) && profileData.length > 0) {
    const profile = profileData[0]

    // Formato 1: firstName e lastName como propriedades separadas
    if (profile.firstName && profile.lastName) {
      return `${profile.firstName} ${profile.lastName}`
    }

    // Formato 2: Nome completo em uma única propriedade
    if (profile.name) {
      return profile.name
    }

    // Formato 3: Nome no título do perfil
    if (profile.title) {
      return profile.title
    }
  } else if (typeof profileData === 'object' && profileData !== null) {
    // Verificar mesmos formatos para objeto não-array
    if (profileData.firstName && profileData.lastName) {
      return `${profileData.firstName} ${profileData.lastName}`
    }

    if (profileData.name) {
      return profileData.name
    }

    if (profileData.title) {
      return profileData.title
    }
  }

  // Retorno padrão se não encontrar
  return 'Usuário LinkedIn'
}

function extractHeadline(profileData) {
  // Verificar diferentes formatos possíveis dos dados
  if (Array.isArray(profileData) && profileData.length > 0) {
    const profile = profileData[0]

    // Várias possibilidades de nomes de campos para o headline
    if (profile.headline) {
      return profile.headline
    }

    if (profile.subTitle) {
      return profile.subTitle
    }

    if (profile.occupation) {
      return profile.occupation
    }
  } else if (typeof profileData === 'object' && profileData !== null) {
    if (profileData.headline) {
      return profileData.headline
    }

    if (profileData.subTitle) {
      return profileData.subTitle
    }

    if (profileData.occupation) {
      return profileData.occupation
    }
  }

  // Retorno padrão se não encontrar
  return 'Profissional no LinkedIn'
}

function extractLocation(profileData) {
  // Verificar diferentes formatos possíveis dos dados
  if (Array.isArray(profileData) && profileData.length > 0) {
    const profile = profileData[0]

    if (profile.location) {
      return profile.location
    }

    if (profile.locationName) {
      return profile.locationName
    }

    if (profile.geoLocation) {
      return profile.geoLocation
    }
  } else if (typeof profileData === 'object' && profileData !== null) {
    if (profileData.location) {
      return profileData.location
    }

    if (profileData.locationName) {
      return profileData.locationName
    }

    if (profileData.geoLocation) {
      return profileData.geoLocation
    }
  }

  // Retorno padrão se não encontrar
  return 'Localização não especificada'
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`)
  console.log(`Acesse: http://localhost:${PORT}`)
})

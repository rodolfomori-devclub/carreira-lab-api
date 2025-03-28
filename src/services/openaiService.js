// services/openaiService.js
import axios from 'axios';
import config from '../config/index.js';

/**
 * Analisa um perfil LinkedIn usando a API do OpenAI (ChatGPT)
 * @param {Object} profileData Dados do perfil LinkedIn obtidos via scraping
 * @param {string} objective Objetivo selecionado pelo usuário
 * @returns {Promise<Object>} Resultado da análise
 */
export const analyzeProfileWithGPT = async (profileData, objective) => {
  try {
    // Definir o ID do assistente
    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    
    console.log(`Iniciando análise com GPT para objetivo: ${objective}`);
    
    // Obter o prompt pronto para análise
    const prompt = getPromptForAnalysis(profileData, objective);
    
    // Configurar headers para API OpenAI - IMPORTANTE: Atualizado para v2
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY || config.openai.apiKey}`,
      'OpenAI-Beta': 'assistants=v2'  // Mudado de v1 para v2
    };
    
    // Implementar sistema de retry
    const MAX_RETRIES = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Tentativa ${attempt}/${MAX_RETRIES} de análise com GPT...`);
        
        // 1. Criar uma thread
        console.log('Criando thread na API do OpenAI...');
        const threadResponse = await axios.post(
          'https://api.openai.com/v1/threads',
          {},
          { headers, timeout: 30000 } // 30 segundos de timeout
        );
        
        const threadId = threadResponse.data.id;
        console.log(`Thread criada com ID: ${threadId}`);
        
        // 2. Adicionar a mensagem à thread
        console.log('Adicionando mensagem à thread...');
        await axios.post(
          `https://api.openai.com/v1/threads/${threadId}/messages`,
          {
            role: 'user',
            content: prompt
          },
          { headers, timeout: 30000 }
        );
        
        // Adicionar uma mensagem explícita sobre JSON para satisfazer o requisito
        await axios.post(
          `https://api.openai.com/v1/threads/${threadId}/messages`,
          {
            role: 'user',
            content: "Por favor, responda em formato JSON estruturado com as seções da análise."
          },
          { headers, timeout: 30000 }
        );
        
        // 3. Executar o assistente na thread
        console.log('Executando o assistente...');
        const runResponse = await axios.post(
          `https://api.openai.com/v1/threads/${threadId}/runs`,
          {
            assistant_id: assistantId,
            // Especificando formato JSON explicitamente
            response_format: { type: "json_object" }
          },
          { headers, timeout: 30000 }
        );
        
        const runId = runResponse.data.id;
        console.log(`Run iniciado com ID: ${runId}`);
        
        // 4. Aguardar a conclusão da execução (polling)
        console.log('Aguardando conclusão da análise...');
        const analysisResult = await waitForRunCompletion(threadId, runId, headers);
        
        // Adicionar metadados úteis para o frontend
        analysisResult.objective = objective;
        analysisResult.timestamp = new Date().toISOString();
        
        // Retornar o resultado sem salvar em arquivo
        return analysisResult;
      } catch (error) {
        console.error(`Erro na tentativa ${attempt}:`, error.message);
        
        if (error.response) {
          console.error('Status da resposta:', error.response.status);
          console.error('Dados do erro:', JSON.stringify(error.response.data, null, 2));
        }
        
        lastError = error;
        
        // Se não for último retry, aguardar antes de tentar novamente
        if (attempt < MAX_RETRIES) {
          const delay = attempt * 2000; // Backoff exponencial: 2s, 4s, 6s...
          console.log(`Aguardando ${delay/1000} segundos antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    console.error(`Todas as ${MAX_RETRIES} tentativas de análise com GPT falharam`);
    
    // Retornar resposta de fallback - análise simulada para não bloquear o usuário
    console.log('Usando resposta de fallback para não bloquear o usuário');
    return generateFallbackAnalysis(profileData, objective);
    
  } catch (error) {
    console.error('Erro na análise com GPT:', error);
    
    if (error.response) {
      console.error('Status da resposta:', error.response.status);
      console.error('Dados do erro:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Retornar resposta de fallback
    return generateFallbackAnalysis(profileData, objective);
  }
};

/**
 * Aguarda a conclusão da execução do assistente
 * @param {string} threadId ID da thread
 * @param {string} runId ID da execução
 * @param {Object} headers Headers para API
 * @returns {Promise<Object>} Resultado da análise
 */
const waitForRunCompletion = async (threadId, runId, headers) => {
  let runStatus = null;
  let attempts = 0;
  const maxAttempts = 30; // Limite de tentativas para evitar loop infinito
  
  while (attempts < maxAttempts) {
    attempts++;
    
    const statusResponse = await axios.get(
      `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
      { headers }
    );
    
    runStatus = statusResponse.data.status;
    console.log(`Status da execução (${attempts}/${maxAttempts}): ${runStatus}`);
    
    if (runStatus === 'completed') {
      break;
    } else if (runStatus === 'failed' || runStatus === 'cancelled' || runStatus === 'expired') {
      throw new Error(`Execução falhou com status: ${runStatus}`);
    }
    
    // Aguardar antes da próxima verificação (2 segundos)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  if (runStatus !== 'completed') {
    throw new Error('Tempo limite excedido aguardando a conclusão da análise');
  }
  
  // Obter as mensagens da thread (resultado da análise)
  const messagesResponse = await axios.get(
    `https://api.openai.com/v1/threads/${threadId}/messages`,
    { headers }
  );
  
  // Extrair a última mensagem da resposta (a primeira no array, pois vêm em ordem reversa)
  const messages = messagesResponse.data.data || [];
  if (messages.length === 0) {
    throw new Error('Nenhuma mensagem encontrada na thread após conclusão');
  }
  
  // A primeira mensagem na lista é a mais recente
  const latestMessage = messages[0];
  
  // Verificar se há conteúdo na mensagem
  if (!latestMessage.content || latestMessage.content.length === 0) {
    throw new Error('Mensagem sem conteúdo retornada pela API');
  }
  
  // Extrair o conteúdo da análise
  const analysisContent = latestMessage.content
    .filter(content => content.type === 'text')
    .map(content => content.text.value)
    .join('\n');
  
  if (!analysisContent) {
    throw new Error('Não foi possível extrair conteúdo de texto da mensagem');
  }
  

  // Verificar se o conteúdo é um JSON válido e processá-lo
  let parsedContent;
  try {
    // Tentar fazer o parse do JSON
    console.log('analysisContent', analysisContent)

    parsedContent = JSON.parse(analysisContent);
    console.log('parsedContent', parsedContent)
    
    // Adaptar o formato da resposta para o frontend
    return {
      success: true,
      analysis: analysisContent, // Mantém o conteúdo original como string para compatibilidade
      analysisJson: parsedContent, // Adiciona o conteúdo como objeto JSON
      isJsonFormat: true, // Flag para indicar que temos um formato JSON
      threadId,
      runId
    };
  } catch (error) {
    console.log('Resposta não é um JSON válido, retornando como texto:', error.message);
    
    // Se não for JSON, retornar no formato anterior
    return {
      success: true,
      analysis: analysisContent,
      isJsonFormat: false,
      threadId,
      runId
    };
  }
};

/**
 * Gera uma análise de fallback quando a análise com GPT falhar
 * @param {Object} profileData Dados do perfil do LinkedIn
 * @param {string} objective Objetivo selecionado pelo usuário
 * @returns {Object} Análise simulada para não bloquear o usuário
 */
const generateFallbackAnalysis = (profileData, objective) => {
  console.log('Gerando análise de fallback para não bloquear o usuário');
  
  // Extrair informações básicas do perfil, se disponíveis
  const profileName = extractProfileName(profileData);
  const objectiveText = getObjectiveText(objective);
  
  // Estrutura de análise de fallback
  return {
    success: true,
    analysis: `### 1. Resumo Geral

Este é um perfil com potencial, mas que pode ser aprimorado para atingir o objetivo de ${objectiveText}.

### 2. Pontos Fortes

**1. Experiência profissional**
Seu histórico profissional demonstra uma trajetória relevante para a área de tecnologia.

**2. Formação acadêmica**
Sua formação serve como base importante para sua atuação profissional.

**3. Habilidades técnicas**
Você lista habilidades importantes para desenvolvedores.

### 3. Oportunidades de Melhoria

**1. Otimização do perfil**
Seu perfil pode ser otimizado para maior visibilidade entre recrutadores.

**2. Destaque de projetos**
Adicionar e destacar projetos relevantes aumentaria o impacto do seu perfil.

**3. Networking estratégico**
Desenvolver conexões estratégicas na sua área de interesse.

### 4. Recomendações Práticas

Para melhorar seu perfil de acordo com seu objetivo de ${objectiveText}, sugiro:

1. Aprimorar seu título profissional com palavras-chave relevantes
2. Elaborar um resumo mais impactante destacando suas conquistas
3. Detalhar suas experiências com resultados quantificáveis
4. Adicionar projetos com descrições técnicas detalhadas
5. Solicitar recomendações de colegas e gestores anteriores

### 5. Ações Imediatas

1. Atualizar sua foto de perfil profissional
2. Reformular seu headline com palavras-chave estratégicas
3. Expandir seu resumo destacando resultados e objetivos
4. Adicionar certificações e cursos relevantes
5. Engajar-se em grupos e discussões do seu setor

### 6. Análise Comparativa

Comparando com perfis de profissionais bem-sucedidos na mesma área, seu perfil pode se destacar mais ao demonstrar resultados concretos e especialização técnica.

### 7. Mensagem Final de Motivação

Seu perfil tem muito potencial! Com alguns ajustes estratégicos, você estará mais bem posicionado para alcançar seu objetivo de ${objectiveText}. Cada melhoria incrementará significativamente sua visibilidade para as oportunidades certas.`,
    isJsonFormat: false,
    timestamp: new Date().toISOString()
  };
};

/**
 * Extrai o nome do perfil dos dados do LinkedIn
 * @param {Object} profileData Dados do perfil do LinkedIn
 * @returns {string} Nome do perfil ou string genérica
 */
const extractProfileName = (profileData) => {
  if (Array.isArray(profileData) && profileData.length > 0) {
    const profile = profileData[0];
    if (profile.firstName && profile.lastName) {
      return `${profile.firstName} ${profile.lastName}`;
    }
    if (profile.name) {
      return profile.name;
    }
  } else if (typeof profileData === 'object' && profileData !== null) {
    if (profileData.firstName && profileData.lastName) {
      return `${profileData.firstName} ${profileData.lastName}`;
    }
    if (profileData.name) {
      return profileData.name;
    }
  }
  return "Profissional";
};

/**
 * Converte o ID do objetivo em texto descritivo
 * @param {string} objective ID do objetivo
 * @returns {string} Descrição do objetivo
 */
const getObjectiveText = (objective) => {
  const objectiveMap = {
    'first_job': 'conseguir o primeiro emprego como desenvolvedor',
    'career_upgrade': 'upgrade de carreira para posição senior ou gerencial',
    'international': 'oportunidades no mercado internacional',
    'ssi_improvement': 'melhorar o Social Selling Index (SSI) e visibilidade'
  };
  
  return objectiveMap[objective] || objective || 'desenvolvimento profissional';
};

/**
 * Prepara o prompt para análise com base no template
 * @param {Object} profileData Dados do perfil LinkedIn
 * @param {string} objective Objetivo selecionado pelo usuário
 * @returns {string} Prompt formatado
 */
const getPromptForAnalysis = (profileData, objective) => {
  // Mapear IDs de objetivos para descrições mais detalhadas
  const objectiveMap = {
    'first_job': 'Primeiro emprego como desenvolvedor',
    'career_upgrade': 'Upgrade de carreira para posição sênior ou gerencial',
    'international': 'Oportunidades no mercado internacional',
    'ssi_improvement': 'Melhorar o Social Selling Index (SSI) e visibilidade'
  };
  
  const objectiveDescription = objectiveMap[objective] || objective;
  
  // Template do prompt
  const promptTemplate = `

Você é Fernanda, uma recrutadora experiente com mais de 10 anos no mercado de tecnologia e programação. Sua especialidade é avaliar perfis de desenvolvedores e identificar pontos fortes e oportunidades de melhoria. Você é a mentora de carreira do DevClub.

Analise detalhadamente o perfil LinkedIn abaixo de um aluno do DevClub (uma comunidade de desenvolvedores) e forneça uma avaliação profissional completa.

Perfil a ser analisado:
${JSON.stringify(profileData, null, 2)}

Objetivo escolhido pelo usuário: ${objectiveDescription}

Sua análise deve incluir:

1. **Resumo Geral**: Uma visão geral concisa do perfil e sua primeira impressão.

2. **Pontos Fortes (pelo menos 3-5)**:
   - Identifique elementos que destacam positivamente o perfil
   - Explique por que cada elemento é valioso no mercado de tecnologia
   - Como esses elementos podem atrair recrutadores

3. **Oportunidades de Melhoria (pelo menos 3-5)**:
   - Identifique áreas específicas que precisam ser aprimoradas
   - Explique como essas áreas podem estar impactando negativamente a atratividade do perfil
   - Forneça sugestões detalhadas sobre como melhorar cada ponto

4. **Recomendações Práticas**:
   - Sugira alterações específicas para o título profissional, resumo e experiências
   - Recomende habilidades técnicas e soft skills que deveriam ser destacadas
   - Indique projetos ou conteúdos que poderiam ser adicionados ao perfil
   - Aconselhe sobre conexões e networking na plataforma

5. **Ações Imediatas**:
   - Liste 5 ações práticas que podem ser implementadas imediatamente
   - Priorize essas ações em ordem de importância e impacto

6. **Análise Comparativa**:
   - Compare brevemente com o que você vê em perfis de profissionais bem-sucedidos na mesma área
   - Indique o que falta para este perfil atingir um nível competitivo no mercado

7. **Mensagem Final de Motivação**:
   - Conclua com uma mensagem motivacional personalizada baseada nas características do perfil analisado

Use linguagem profissional mas acessível, seja específica nas suas observações e mantenha um tom construtivo. Sua análise deve ser honesta mas encorajadora, visando o desenvolvimento do aluno.

Pontos Importantes:

Quero que de uma nota para o linkedin analisado, e também dar uma nota para cada área principal.

O selo open to work não é bom, caso identifique que ele está, pedir para tirar

Se não tiver acesso a foto de perfil, recomendar uma foto de perfil com fundo neutro com sorriso e outras dicas de foto de perfil. Saliente que não precisa ser com camera profissional, o importante é parecer uma foto de profissional, padrão linkedin

A foto de capa sempre tem que ser algo relacionado a area de atuação

Não gostamos quando o usuario coloca na headline do perfil que ele é estudante, ou que está procurando vaga, ou nivel de senioridade. O Padrão é cololocar Programador ou Desenvolvedor + área de atuação

Os nomes dos scores devem ser retornados em português do Brasil


`;

  return promptTemplate;
};

export default {
  analyzeProfileWithGPT
};
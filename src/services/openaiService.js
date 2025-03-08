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
    const assistantId = 'asst_USPgvDfuLQtJJRFMnasNAotC';
    
    console.log(`Iniciando análise com GPT para objetivo: ${objective}`);
    
    // Obter o prompt pronto para análise
    const prompt = getPromptForAnalysis(profileData, objective);
    
    // Configurar headers para API OpenAI - IMPORTANTE: Atualizado para v2
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY || config.openai.apiKey}`,
      'OpenAI-Beta': 'assistants=v2'  // Mudado de v1 para v2
    };
    
    // 1. Criar uma thread
    console.log('Criando thread na API do OpenAI...');
    const threadResponse = await axios.post(
      'https://api.openai.com/v1/threads',
      {},
      { headers }
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
      { headers }
    );
    
    // 3. Executar o assistente na thread
    console.log('Executando o assistente...');
    const runResponse = await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/runs`,
      {
        assistant_id: assistantId
      },
      { headers }
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
    console.error('Erro na análise com GPT:', error);
    
    if (error.response) {
      console.error('Status da resposta:', error.response.status);
      console.error('Dados do erro:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw new Error(`Falha na análise do perfil: ${error.message}`);
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
  
  // Extrair a resposta do assistente (última mensagem)
  const assistantMessages = messagesResponse.data.data.filter(
    msg => msg.role === 'assistant'
  );
  
  if (!assistantMessages.length) {
    throw new Error('Nenhuma resposta recebida do assistente');
  }
  
  // Pegar a mensagem mais recente
  const latestMessage = assistantMessages[0];
  
  // Extrair o conteúdo da análise
  const analysisContent = latestMessage.content.map(content => 
    content.type === 'text' ? content.text.value : ''
  ).join('\n');
  
  return {
    success: true,
    analysis: analysisContent,
    threadId,
    runId
  };
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
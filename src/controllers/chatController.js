// controllers/chatController.js
import axios from 'axios';
import config from '../config/index.js';
import { getFallbackResponse } from '../utils/chatResponses.js';

/**
 * Processa mensagens de chat e obtém resposta do ChatGPT
 * @param {Object} req - Request object com {message, role, history} no body
 * @param {Object} res - Response object
 */
export const processChat = async (req, res) => {
  try {
    const { message, role = 'recruiter', history = [] } = req.body;
    
    // Validações
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mensagem é obrigatória' 
      });
    }
    
    console.log(`Processando mensagem de chat: "${message.substring(0, 30)}..."`);
    
    // Obter a chave da API do OpenAI
    const apiKey = process.env.OPENAI_API_KEY || config.openai.apiKey;
    
    // Se não tiver chave de API ou estiver em modo de desenvolvimento, use respostas de fallback
    if (!apiKey || process.env.NODE_ENV === 'development') {
      console.log('Usando resposta de fallback (modo desenvolvimento ou sem chave API)');
      
      return res.json({
        success: true,
        message: getFallbackResponse(message),
        fallback: true,
        timestamp: new Date().toISOString()
      });
    }
    
    // Configurar prompt inicial baseado no papel (role)
    let systemPrompt = '';
    
    switch (role) {
      case 'recruiter':
        systemPrompt = `Você é Fernanda, uma recrutadora experiente com mais de 10 anos no mercado de tecnologia e programação. 
        Sua especialidade é avaliar perfis de desenvolvedores, orientar sobre carreira, currículo, LinkedIn e entrevistas.
        Você é a mentora de carreira do DevClub (uma comunidade de desenvolvedores).
        
        Mantenha suas respostas objetivas, práticas e úteis. Use exemplos concretos e dicas acionáveis.
        Seja encorajadora, mas honesta. Use um tom profissional e amigável.
        
        Quando der dicas sobre:
        - Currículo: Enfatize clareza, relevância e adaptação para cada vaga
        - LinkedIn: Destaque visibilidade para recrutadores e consistência
        - Entrevistas: Foque em preparação técnica e soft skills
        - Portfólio: Enfatize qualidade sobre quantidade
        - GitHub: Destaque organização e documentação de código
        
        Use formatação markdown para organizar sua resposta quando apropriado.
        
        Nota: Você pode responder em formato json se necessário.`;
        break;
      default:
        systemPrompt = 'Você é um assistente útil e informativo.';
    }
    
    // Preparar mensagens para a API do OpenAI
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Adicionar histórico de conversas (limitado aos últimos 10 para evitar exceder tokens)
    if (Array.isArray(history) && history.length > 0) {
      const limitedHistory = history.slice(-10);
      messages.push(...limitedHistory);
    }
    
    // Adicionar a mensagem atual do usuário
    messages.push({ role: 'user', content: message });
    
    // Fazer requisição para a API do OpenAI (modelo mais recente disponível)
    const response = await axios({
      method: 'POST',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      data: {
        model: 'gpt-4o', // Usar o modelo mais recente - ajustar conforme necessário
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
        // Remover response_format se estiver presente
      }
    });
    
    // Extrair a resposta do assistente
    if (response.data && 
        response.data.choices && 
        response.data.choices.length > 0 && 
        response.data.choices[0].message) {
      
      const assistantMessage = response.data.choices[0].message.content;
      
      // Retornar a resposta formatada
      return res.json({
        success: true,
        message: assistantMessage,
        responseId: response.data.id,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Formato de resposta inválido da API OpenAI');
    }
    
  } catch (error) {
    console.error('Erro no processamento do chat:', error);
    
    // Capturar detalhes do erro da resposta da API
    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: 'Erro ao processar mensagem',
        error: error.message,
        apiError: error.response.data
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro ao processar mensagem',
      error: error.message
    });
  }
};

export default {
  processChat
};
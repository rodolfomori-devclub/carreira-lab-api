// utils/chatResponses.js

/**
 * Respostas pré-definidas para o modo de desenvolvimento
 * Usado como fallback quando a API do ChatGPT não está disponível
 */
export const getFallbackResponse = (message) => {
    const lowerMessage = message.toLowerCase();
    
    // Respostas pré-definidas para tópicos comuns
    if (lowerMessage.includes('currículo') || lowerMessage.includes('curriculo') || lowerMessage.includes('resume')) {
      return `Para criar um currículo eficaz como programador, inclua estas seções:
  
  1. **Cabeçalho**: Nome, contato, LinkedIn, GitHub, portfolio.
  2. **Resumo profissional**: 2-3 frases sobre suas habilidades e objetivos.
  3. **Habilidades técnicas**: Linguagens, frameworks, ferramentas que você domina.
  4. **Experiência**: Destaque projetos relevantes, responsabilidades e resultados.
  5. **Formação**: Educação formal e cursos relevantes.
  6. **Projetos pessoais**: Links para o GitHub com descrições curtas.
  
  Dicas extras:
  - Personalize para cada vaga
  - Use palavras-chave da descrição da vaga
  - Quantifique resultados sempre que possível
  - Mantenha-o conciso (máximo 2 páginas)
  - Formate de forma clean e consistente
  
  Quer que eu detalhe alguma dessas seções específicas?`;
    } 
    
    if (lowerMessage.includes('entrevista')) {
      return `Para se destacar em entrevistas como programador:
  
  **Antes da entrevista:**
  1. Pesquise a empresa e seus produtos/tecnologias
  2. Revise conceitos fundamentais de programação
  3. Pratique algoritmos e estruturas de dados
  4. Prepare exemplos de projetos anteriores (STAR method)
  5. Teste seu setup técnico para entrevistas remotas
  
  **Durante a entrevista:**
  1. Verbalize seu raciocínio ao resolver problemas
  2. Faça perguntas para clarificar requisitos antes de começar
  3. Discuta complexidade e trade-offs de suas soluções
  4. Seja honesto quando não souber algo
  5. Demonstre paixão por aprender e resolver problemas
  
  **Para testes técnicos:**
  - Leia o problema completamente antes de começar
  - Explique sua abordagem antes de codificar
  - Considere casos extremos e tratamento de erros
  - Refatore seu código se tiver tempo
  
  Posso detalhar mais algum tópico específico?`;
    }
    
    if (lowerMessage.includes('linkedin') || lowerMessage.includes('perfil')) {
      return `Para destacar suas habilidades técnicas no LinkedIn:
  
  1. **Seção de destaque**: Coloque suas 3-5 habilidades mais relevantes logo no topo do perfil.
  
  2. **Headline otimizada**: Além do cargo, inclua 2-3 tecnologias principais (ex: "Desenvolvedor React | Node.js | TypeScript").
  
  3. **Seção de habilidades**: Adicione habilidades técnicas relevantes e organize-as por ordem de proficiência.
  
  4. **Validações**: Peça recomendações específicas das habilidades para colegas e gestores.
  
  5. **Projetos**: Adicione projetos com descrições técnicas e links.
  
  6. **Certificações**: Inclua cursos e certificações técnicas relevantes.
  
  7. **Conteúdo**: Compartilhe ou crie posts sobre tecnologias que domina.
  
  8. **Consistência**: Garanta que suas habilidades apareçam também nas descrições de experiências.
  
  Um perfil bem construído aumenta em até 30% suas chances de ser encontrado por recrutadores. Precisa de ajuda com algum desses pontos específicos?`;
    }
    
    // Resposta genérica para qualquer outra consulta
    return `Obrigada pela sua mensagem! Posso ajudar com diversas áreas da sua carreira em programação:
  
  - Criação e otimização de currículo
  - Dicas para entrevistas técnicas e comportamentais
  - Melhorias no seu perfil do LinkedIn
  - Orientação sobre portfólio e projetos
  - Estratégias para negociação salarial
  - Preparação para testes técnicos
  - Conselhos para transição de carreira
  - Otimização de perfil no GitHub
  
  Poderia me contar mais especificamente o que você precisa? Estou aqui para ajudar!`;
  };
  
  export default {
    getFallbackResponse
  };
# Usando uma imagem oficial do Node.js como base
FROM node:18-alpine

# Definir diretório de trabalho dentro do contêiner
WORKDIR /app

# Copiar arquivos do projeto para dentro do contêiner
COPY package*.json ./
RUN npm install --production

# Copiar restante do código
COPY . .

# Expor a porta da aplicação (exemplo: 3001)
EXPOSE 3001

# Comando para rodar a aplicação
CMD ["node", "src/server.js"]

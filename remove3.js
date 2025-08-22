// Função para remover palavras com menos de 3 letras de um arquivo de texto
const fs = require('fs');

function removeShortWordsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const filtered = lines.filter(word => word.trim().length >= 3);
  fs.writeFileSync(filePath, filtered.join('\n'), 'utf8');
}

// Exemplo de uso: referenciando o arquivo
removeShortWordsFromFile('words-pt.txt');

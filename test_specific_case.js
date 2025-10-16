// Teste para caso específico com "De:" e "Por:"
const GLOBAL_PRICE_MULTIPLIER = 2.5;

function testPriceRecognition(testLine) {
    let line = testLine;
    
    const priceRegex = /(?::?\s*)?(R\$|\$\$?)\s*(\d+(?:[.,]\d{2})?)|\b(\d+(?:[.,]\d{2})?)\s*(R\$|\$\$?)|\b(\d+[.,]\d{2})\b/gi;
    
    let hasMatch = false;
    
    line = line.replace(priceRegex, (fullMatch, symbolBefore, priceBefore, priceAfter, symbolAfter, priceAlone) => {
        hasMatch = true;
        
        let priceString;
        if (priceBefore) {
            priceString = priceBefore;
        } else if (priceAfter) {
            priceString = priceAfter;
        } else if (priceAlone) {
            priceString = priceAlone;
        }
        
        if (!priceString) return fullMatch;
        
        priceString = priceString.replace(',', '.');
        const originalPrice = parseFloat(priceString);

        if (!isNaN(originalPrice) && originalPrice > 0) {
            const multipliedPrice = (originalPrice * GLOBAL_PRICE_MULTIPLIER).toFixed(2).replace('.', ',');
            return `R$${multipliedPrice}`;
        }
        
        return fullMatch;
    });
    
    return { original: testLine, processed: line, matched: hasMatch };
}

// Teste do caso específico
const message = `New New New 

Tênis Adidas Gazelle 💚🩷🤎
• Premium
• ⁠couro legítimo 
 
Numeração disponível: 34/36/37/39/40 🚨

R$170,00 - Atacado 📲
R$190,00 - Varejo 📲🤎`;

console.log("=== TESTE DO CASO ESPECÍFICO ===\n");
console.log(`Multiplicador: ${GLOBAL_PRICE_MULTIPLIER}x\n`);
console.log("MENSAGEM ORIGINAL:");
console.log(message);
console.log("\n" + "=".repeat(50) + "\n");

const lines = message.split(/\r?\n/);
const processedLines = [];

lines.forEach((originalLine, index) => {
    let line = originalLine;
    
    // Verificar se a linha contém "Atacado" (aceitar apenas linhas com Atacado)
    const hasAtacado = /atacado/gi.test(line);
    const hasVarejo = /varejo/gi.test(line);
    
    console.log(`Linha ${index + 1}:`);
    console.log(`  Original:   "${originalLine}"`);
    console.log(`  Tem Atacado: ${hasAtacado ? '✅' : '❌'} | Tem Varejo: ${hasVarejo ? '✅' : '❌'}`);
    
    // Se tem "Varejo" mas não tem "Atacado", manter linha vazia para preservar espaçamento
    if (hasVarejo && !hasAtacado) {
        console.log(`  Processado: "" (linha com Varejo removida)`);
        console.log('');
        processedLines.push(''); // Linha vazia para manter estrutura
        return;
    }
    
    // Primeiro, remover "Atacado" da linha ANTES de processar preços
    if (hasAtacado) {
        line = line.replace(/\s*-?\s*Atacado\s*:?\s*/gi, '').trim();
        console.log(`  Após remover "Atacado": "${line}"`);
    }
    
    const result = testPriceRecognition(line);
    console.log(`  Processado: "${result.processed}"`);
    console.log(`  Preço encontrado: ${result.matched ? '✅' : '❌'}`);
    console.log('');
    processedLines.push(result.processed);
});

console.log("=".repeat(50));
console.log("\nMENSAGEM PROCESSADA COMPLETA:");
console.log(processedLines.join('\n'));

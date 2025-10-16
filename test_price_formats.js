// Teste rápido para validar reconhecimento de formatos de preço
// Execute com: node test_price_formats.js

const GLOBAL_PRICE_MULTIPLIER = 3;

function testPriceRecognition(testLine) {
    let line = testLine;
    
    // Regex expandida para capturar múltiplos formatos de preço (com flag 'g' para global)
    const priceRegex = /(?::?\s*)?(R\$|\$\$?)\s*(\d+(?:[.,]\d{2})?)|\b(\d+(?:[.,]\d{2})?)\s*(R\$|\$\$?)|\b(\d+[.,]\d{2})\b/gi;
    
    let hasMatch = false;
    
    // Processar TODOS os preços na linha usando replace com função callback
    line = line.replace(priceRegex, (fullMatch, symbolBefore, priceBefore, priceAfter, symbolAfter, priceAlone) => {
        hasMatch = true;
        
        // Determinar qual grupo capturou o número
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
            // Multiplicar CADA preço encontrado
            const multipliedPrice = (originalPrice * GLOBAL_PRICE_MULTIPLIER).toFixed(2).replace('.', ',');
            return `R$${multipliedPrice}`;
        }
        
        return fullMatch;
    });
    
    return { original: testLine, processed: line, matched: hasMatch };
}

// Casos de teste
const testCases = [
    "R$ 90,00",
    "R$90,00",
    "R$90",
    "$90,00",
    "$90",
    "$$90,00",
    "$$90",
    "90,00$$",
    "90$$",
    "90,00$",
    "90$",
    "90,00",
    "90.00",
    "Produto - R$ 45,50",
    "Preço: $120",
    "Valor 75,00 em estoque",
    "Custa 99.99 reais",
    "Item $$150,00 disponível",
    "Promoção 80,00$$ hoje",
    // Novos casos: múltiplos preços na mesma linha
    "Atacado: R$50,00 Varejo: R$100,00",
    "Preço 1: $30 Preço 2: $60",
    "Atacado 25,00 e Varejo 50,00",
    "Kit com R$15,00 + R$20,00 + R$10,00",
    "Opção A: 45,50 ou Opção B: 89,90",
];

console.log("=== TESTE DE RECONHECIMENTO DE PREÇOS ===\n");
console.log(`Multiplicador configurado: ${GLOBAL_PRICE_MULTIPLIER}x\n`);

testCases.forEach((testCase, index) => {
    const result = testPriceRecognition(testCase);
    console.log(`Teste ${index + 1}:`);
    console.log(`  Original:   "${result.original}"`);
    console.log(`  Processado: "${result.processed}"`);
    console.log(`  Reconhecido: ${result.matched ? '✅' : '❌'}`);
    console.log('');
});

console.log("=== FIM DOS TESTES ===");

// Teste para confirmar TODOS os formatos de preço
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

// TODOS os formatos que você mencionou
const formats = [
    "R$ 90,00",
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
    "90.00"
];

console.log("=== TESTE DE TODOS OS FORMATOS ===\n");
console.log(`Multiplicador: ${GLOBAL_PRICE_MULTIPLIER}x\n`);
console.log("Valor original: 90 → Esperado: R$225,00 (90 × 2.5)\n");
console.log("=".repeat(60) + "\n");

let allPassed = true;

formats.forEach((format, index) => {
    const result = testPriceRecognition(format);
    const passed = result.matched;
    
    if (!passed) allPassed = false;
    
    console.log(`${index + 1}. Formato: "${format}"`);
    console.log(`   Resultado: "${result.processed}"`);
    console.log(`   Status: ${passed ? '✅ RECONHECIDO' : '❌ NÃO RECONHECIDO'}`);
    console.log('');
});

console.log("=".repeat(60));
console.log(`\n${allPassed ? '✅ TODOS OS FORMATOS FORAM RECONHECIDOS!' : '❌ ALGUNS FORMATOS NÃO FORAM RECONHECIDOS'}`);

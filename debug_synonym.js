// Quick debug test for synonyms
const { rewriteSentence } = require('./src/grammarEngine.ts');

async function test() {
  const sentence = 'The large building is beautiful.';
  console.log('Input:', sentence);
  
  const rewrites = await rewriteSentence(sentence);
  console.log('Rewrites:', rewrites);
  
  rewrites.forEach((rewrite, i) => {
    console.log(`${i + 1}: ${rewrite}`);
    console.log(`Contains synonyms: ${rewrite.includes('big') || rewrite.includes('huge') || rewrite.includes('structure') || rewrite.includes('lovely')}`);
  });
}

test().catch(console.error);
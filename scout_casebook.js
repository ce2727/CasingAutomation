import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// Polyfill DOMMatrix for Node.js if pdfjs-dist expects it
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}

const PDF_PATH = '/Users/cemmel/Downloads/NYU Stern Casebook 2025-26 (2).pdf';

async function scout() {
  console.log('--- ProCase Scout Pass ---');
  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
    stopAtErrors: true
  });
  
  const pdf = await loadingTask.promise;
  const cases = [];
  let currentCase = null;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => (item.str || '')).join(' ');

    if (i === 50 || i === 100 || i === 150) {
      console.log(`\n--- Page ${i} Sample ---`);
      console.log(text.substring(0, 500));
      console.log('------------------------\n');
    }

    // Match "Case 1: Apple of my Eye"
    const caseMatch = text.match(/Case\s+(\d+)[:\.]\s+([A-Z][A-Za-z0-9'\s\&]+)/);
    
    if (caseMatch && !text.includes('......')) {
      const number = caseMatch[1];
      const title = caseMatch[2].trim().split('  ')[0];

      if (currentCase) {
        currentCase.endPage = i - 1;
        cases.push(currentCase);
      }
      
      currentCase = {
        number,
        title,
        startPage: i,
        type: 'Other',
        difficulty: 3,
        tags: []
      };

      const types = ['M&A', 'Profitability', 'Market Entry', 'Opportunity Assessment', 'Industry Analysis', 'Growth Strategy', 'Pricing'];
      for (const t of types) {
        if (text.toLowerCase().includes(t.toLowerCase())) {
          currentCase.type = t;
          break;
        }
      }
    }
    if (i % 100 === 0) console.log(`Scanned ${i}/${pdf.numPages} pages...`);
  }

  if (currentCase) {
    currentCase.endPage = pdf.numPages;
    cases.push(currentCase);
  }

  console.log(`\nFound ${cases.length} cases.`);
  fs.writeFileSync('case_map.json', JSON.stringify(cases, null, 2));
}

scout().catch(err => {
  console.error('Scout failed:', err);
});

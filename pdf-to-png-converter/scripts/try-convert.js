const { resolve } = require('node:path');
const { pdfToPng } = require('../out');

(async () => {
    try {
        const pdfPath = resolve('./test-data/sample.pdf');
        const outputFolder = resolve('./test-results/demo');

        const pages = await pdfToPng(pdfPath, {
            viewportScale: 2.0,
            outputFolder,
            outputFileMaskFunc: (n) => `page_${n}.png`,
            verbosityLevel: 0,
        });

        console.log(`Converted ${pages.length} pages:`);
        for (const p of pages) {
            console.log(`- ${p.name} -> ${p.path} (${p.width}x${p.height})`);
        }
    } catch (err) {
        console.error('Conversion failed:', err && err.stack ? err.stack : err);
        process.exit(1);
    }
})();



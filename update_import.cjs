const fs = require('fs');
let content = fs.readFileSync('src/components/ImportScreen.tsx', 'utf8');

content = content.replace(/colWidths: sheet\.colWidths \|\| \{\},/, "colWidths: sheet.colWidths || {},\n            frozenCols: sheet.frozenCols || 0,\n            styles: sheet.styles || [],");

content = content.replace(/В базе данных нет вкладок\. Пожалуйста, выделите 9 JSON-файлов \(manifest\.json и 8 файлов вкладок\) и перетащите их сюда\./, "Пожалуйста, выделите JSON-файлы (manifest.json и файлы вкладок) и перетащите их сюда.");

fs.writeFileSync('src/components/ImportScreen.tsx', content);

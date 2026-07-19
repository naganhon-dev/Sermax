const fs = require('fs');
let content = fs.readFileSync('src/components/TabView.tsx', 'utf8');

content = content.replace(/const \{ sheets, loading, isCalculating, error, hf, hfVersion, sheetMatrices, updateCell, addRow \} = useTabEngine\(tabId\);/, "const { sheets, loading, isCalculating, error, hf, hfVersion, sheetMatrices, updateCell, batchUpdate, undo, redo, addRow } = useTabEngine(tabId);");

content = content.replace(/onCellEdit=\{\(row, col, value\) => updateCell\(activeSheet\.id, activeSheet\.name, row, col, value\)\}/, "onCellEdit={(row, col, value) => updateCell(activeSheet.id, activeSheet.name, row, col, value)}\n          onCellsEdit={(updates) => batchUpdate(activeSheet.id, activeSheet.name, updates)}\n          undo={undo}\n          redo={redo}");

fs.writeFileSync('src/components/TabView.tsx', content);

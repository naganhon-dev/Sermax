const fs = require('fs');
let content = fs.readFileSync('src/components/Grid.tsx', 'utf8');

// replace rawVal={sheetMatrix[r]?.[c]} with logic to extract value and style
content = content.replace(/import \{ parseMerges, getExcludedCells, indexToA1 \} from '\.\.\/lib\/gridUtils';/, "import { parseMerges, getExcludedCells, indexToA1, getCellValueAndStyle } from '../lib/gridUtils';");

const cellMapReplacement = `
                    const { value, styleIndex } = getCellValueAndStyle(sheetMatrix[r], c);
                    const cellStyle = styleIndex !== undefined ? sheet.styles?.[styleIndex] : undefined;
                    return (
                      <Cell
                        key={c}
                        r={r}
                        c={c}
                        sheetId={sheetId}
                        hf={hf}
                        hfVersion={hfVersion}
                        rawVal={value}
                        cellStyle={cellStyle}
`;
content = content.replace(/return \(\s*<Cell\s*key=\{c\}\s*r=\{r\}\s*c=\{c\}\s*sheetId=\{sheetId\}\s*hf=\{hf\}\s*hfVersion=\{hfVersion\}\s*rawVal=\{sheetMatrix\[r\]\?\.\[c\]\}/, cellMapReplacement);

// Fix the formula bar raw value
const formulaRawRepl = `
      const { value } = getCellValueAndStyle(sheetMatrix[activeCell.row], activeCell.col);
      const raw = value;
`;
content = content.replace(/const raw = sheetMatrix\[activeCell\.row\]\?\.\[activeCell\.col\];/, formulaRawRepl);

// Fix the startEdit raw value
const startEditRawRepl = `
    const { value } = getCellValueAndStyle(sheetMatrix[row], col);
    const raw = value;
`;
content = content.replace(/const raw = sheetMatrix\[row\]\?\.\[col\];/, startEditRawRepl);

fs.writeFileSync('src/components/Grid.tsx', content);

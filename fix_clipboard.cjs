const fs = require('fs');
let content = fs.readFileSync('src/components/Grid.tsx', 'utf8');

const clipboardHandlers = `
  const copyToClipboard = useEvent(async (cut = false) => {
    if (!selectionBounds) return;
    const { r1, r2, c1, c2 } = selectionBounds;
    const rows = [];
    for (let r = r1; r <= r2; r++) {
      const row = [];
      for (let c = c1; c <= c2; c++) {
        const { value } = getCellValueAndStyle(sheetMatrix[r], c);
        let text = '';
        if (value !== null && value !== undefined) {
           if (typeof value === 'object' && 'f' in value) text = value.f;
           else if (typeof value === 'object' && 'v' in value) text = String(value.v);
           else text = String(value);
        }
        // TSV escaping
        if (text.includes('\\t') || text.includes('\\n')) {
          text = '"' + text.replace(/"/g, '""') + '"';
        }
        row.push(text);
      }
      rows.push(row.join('\\t'));
    }
    await navigator.clipboard.writeText(rows.join('\\n'));
    if (cut) {
       // Batch update logic
    }
  });

  const pasteFromClipboard = useEvent(async () => {
    if (!activeCell) return;
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split('\\n').map(r => r.split('\\t'));
      // We need to implement batchUpdateCell which accepts multiple cells
      const updates: {r: number, c: number, v: string}[] = [];
      rows.forEach((row, i) => {
        row.forEach((cell, j) => {
           let val = cell;
           if (val.startsWith('"') && val.endsWith('"')) {
             val = val.slice(1, -1).replace(/""/g, '"');
           }
           updates.push({r: activeCell.row + i, c: activeCell.col + j, v: val});
        });
      });
      // Need a prop for batch updating
      if (typeof (props as any).onCellsEdit === 'function') {
         (props as any).onCellsEdit(updates);
      } else {
         updates.forEach(u => onCellEdit(u.r, u.c, u.v));
      }
    } catch(err) {}
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
`;

content = content.replace(/const handleKeyDown = \(e: React\.KeyboardEvent\) => \{/, clipboardHandlers);

// Also bind ctrl+c, ctrl+v, ctrl+x
const kbRepl = `
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c' || e.key === 'C') {
        copyToClipboard(false);
        return;
      }
      if (e.key === 'x' || e.key === 'X') {
        copyToClipboard(true);
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        pasteFromClipboard();
        return;
      }
    }
`;
content = content.replace(/const handleKeyDown = \(e: React\.KeyboardEvent\) => \{\n/, kbRepl);

fs.writeFileSync('src/components/Grid.tsx', content);

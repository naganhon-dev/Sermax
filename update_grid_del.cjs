const fs = require('fs');
let content = fs.readFileSync('src/components/Grid.tsx', 'utf8');

content = content.replace(/if \(selectionBounds\) \{\n\s*for \(let r = selectionBounds\.r1; r <= selectionBounds\.r2; r\+\+\) \{\n\s*for \(let c = selectionBounds\.c1; c <= selectionBounds\.c2; c\+\+\) \{\n\s*onCellEdit\(r, c, null\);\n\s*\}\n\s*\}\n\s*\} else \{\n\s*onCellEdit\(activeCell\.row, activeCell\.col, null\);\n\s*\}/, `if (selectionBounds) {
        if (onCellsEdit) {
           const updates = [];
           for (let r = selectionBounds.r1; r <= selectionBounds.r2; r++) {
             for (let c = selectionBounds.c1; c <= selectionBounds.c2; c++) {
               updates.push({r, c, v: null});
             }
           }
           onCellsEdit(updates);
        } else {
           for (let r = selectionBounds.r1; r <= selectionBounds.r2; r++) {
             for (let c = selectionBounds.c1; c <= selectionBounds.c2; c++) {
               onCellEdit(r, c, null);
             }
           }
        }
      } else {
        onCellEdit(activeCell.row, activeCell.col, null);
      }`);

fs.writeFileSync('src/components/Grid.tsx', content);

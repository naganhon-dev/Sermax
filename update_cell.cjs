const fs = require('fs');
let content = fs.readFileSync('src/components/Cell.tsx', 'utf8');

// Use literal strings for replacement instead of complex regex
const oldClassName = "className={`border-b border-r border-slate-200 p-1 truncate relative ${isActive ? 'ring-2 ring-blue-500 ring-inset ring-opacity-100 z-10 bg-blue-50' : ''} ${isNumber ? 'font-mono' : ''} ${isFormula && !isActive ? 'bg-blue-50/30' : ''}`}";
const newClassName = "className={`border-b border-r border-slate-300 p-1 ${cellStyle?.w ? 'break-words' : 'truncate'} relative ${isActive ? 'ring-2 ring-blue-500 ring-inset ring-opacity-100 z-10 bg-blue-50' : ''} ${isNumber && !cellStyle?.b ? 'font-mono' : ''} ${isFormula && !isActive ? 'bg-blue-50/30' : ''}`} style={customStyles}";

content = content.replace(oldClassName, newClassName);

fs.writeFileSync('src/components/Cell.tsx', content);

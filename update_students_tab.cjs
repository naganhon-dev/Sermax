const fs = require('fs');
let content = fs.readFileSync('src/components/StudentsTab.tsx', 'utf8');

content = content.replace(/export default function StudentsTab\(\) \{/, 'export default function StudentsTab({ targetStudent }: { targetStudent?: any }) {');
content = content.replace(/\{subTab === 'registry' && <RegistryView \/>\}/, '{subTab === \'registry\' && <RegistryView targetStudent={targetStudent} />}');

content = content.replace(/function RegistryView\(\) \{/, 'function RegistryView({ targetStudent }: { targetStudent?: any }) {');
content = content.replace(/const \[selectedStudent, setSelectedStudent\] = useState<any>\(null\);/, 'const [selectedStudent, setSelectedStudent] = useState<any>(targetStudent || null);');

fs.writeFileSync('src/components/StudentsTab.tsx', content);

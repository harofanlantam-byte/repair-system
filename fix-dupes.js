const fs = require('fs');
let text = fs.readFileSync('script.js.clean', 'utf8');
let lines = text.split('\n');
let seen = new Set();
let result = [];
let i = 0;

while (i < lines.length) {
    let line = lines[i];
    let trimmed = line.trim();
    let match = trimmed.match(/^(async\s+)?function\s+(\w+)\s*\(/);
    
    if (match) {
        let funcName = match[2];
        if (seen.has(funcName)) {
            // Skip this function - find the closing brace
            i++;
            let braceCount = 0;
            // Find opening brace
            while (i < lines.length) {
                let opens = (lines[i-1] || '').split('{').length - 1 + lines[i].split('{').length - 1;
                let closes = (lines[i-1] || '').split('}').length - 1 + lines[i].split('}').length - 1;
                braceCount += opens - closes;
                if (braceCount > 0) break;
                i++;
            }
            // Now find matching closing brace
            i++;
            while (i < lines.length && braceCount > 0) {
                let opens = (lines[i].split('{').length - 1);
                let closes = (lines[i].split('}').length - 1);
                braceCount += opens - closes;
                i++;
            }
            continue;
        }
        seen.add(funcName);
    }
    
    result.push(line);
    i++;
}

fs.writeFileSync('script.js', result.join('\n'), 'utf8');
console.log('✅ Done. Lines:', result.length);

// Verify
let content = fs.readFileSync('script.js', 'utf8');
let funcs = new Set();
let dupes = [];
let re = /(?:async\s+)?function\s+(\w+)\s*\(/g;
let m;
while ((m = re.exec(content)) !== null) {
    if (funcs.has(m[1])) dupes.push(m[1]);
    funcs.add(m[1]);
}
if (dupes.length) console.log('❌ Still has dupes:', dupes.join(', '));
else console.log('✅ No duplicates! Total functions:', funcs.size);
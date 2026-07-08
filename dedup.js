// Deduplicate functions in script.js
const fs = require('fs');
let content = fs.readFileSync('script.js', 'utf8');
let seen = new Set();
let result = [];
let i = 0;
let lines = content.split('\n');

while (i < lines.length) {
    let line = lines[i];
    let m = line.match(/^function (\w+)\s*\(/);
    if (m) {
        let name = m[1];
        if (seen.has(name)) {
            // Skip this function body
            i++;
            let braceCount = 1; // we already saw opening { from this line or next
            // Find opening brace
            while (!lines[i-1].includes('{') && i < lines.length) {
                if (lines[i].includes('{')) {
                    braceCount = 1;
                    i++;
                    break;
                }
                i++;
            }
            // Count braces until we close the function
            while (braceCount > 0 && i < lines.length) {
                let opens = (lines[i].match(/\{/g) || []).length;
                let closes = (lines[i].match(/\}/g) || []).length;
                braceCount += opens - closes;
                i++;
            }
            continue;
        }
        seen.add(name);
    }
    result.push(line);
    i++;
}

fs.writeFileSync('script.js', result.join('\n'), 'utf8');
console.log('✅ Done. Lines:', result.length);
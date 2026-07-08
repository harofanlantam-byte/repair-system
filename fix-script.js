// Safe dedup - remove only 2nd occurrences of duplicate functions
const fs = require('fs');
let content = fs.readFileSync('script.js.clean', 'utf8');
let lines = content.split('\n');

// Find the exact line numbers of the 2nd occurrences
function findFunc2(name) {
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().match(new RegExp('^(async\\s+)?function\\s+' + name + '\\s*\\('))) {
            count++;
            if (count === 2) return i;
        }
    }
    return -1;
}

let funcsToRemove = ['selectEquipment', 'loadHistory'];
let removals = [];

funcsToRemove.forEach(name => {
    let start = findFunc2(name);
    if (start > 0) {
        let end = start;
        let braceCount = 0;
        let foundOpen = false;
        while (end < lines.length) {
            let line = lines[end];
            if (!foundOpen) {
                if (line.includes('{')) {
                    let opens = (line.match(/\{/g) || []).length;
                    let closes = (line.match(/\}/g) || []).length;
                    braceCount = opens - closes;
                    foundOpen = true;
                }
            } else {
                let opens = (line.match(/\{/g) || []).length;
                let closes = (line.match(/\}/g) || []).length;
                braceCount += opens - closes;
                if (braceCount <= 0) {
                    removals.push({ start, end });
                    break;
                }
            }
            end++;
        }
    }
});

// Remove from end to start to preserve indices
removals.sort((a, b) => b.start - a.start);
removals.forEach(r => {
    console.log(`Removing lines ${r.start+1}-${r.end+1}: ${lines[r.start].trim()}`);
    lines.splice(r.start, r.end - r.start + 1);
});

// Also remove the 2nd occurrences of the 6 other duplicates (initDarkMode, etc.)
// These were removed by the bad dedup already, but let's check if they still exist
let otherFuncs = ['initDarkMode', 'toggleDarkMode', 'initMenuByRole', 'checkPageAccess', 'displayEquipmentInfo', 'showEquipmentList'];
otherFuncs.forEach(name => {
    let start = findFunc2(name);
    if (start > 0) {
        let end = start;
        let braceCount = 0;
        let foundOpen = false;
        while (end < lines.length) {
            let line = lines[end];
            if (!foundOpen) {
                if (line.includes('{')) {
                    let opens = (line.match(/\{/g) || []).length;
                    let closes = (line.match(/\}/g) || []).length;
                    braceCount = opens - closes;
                    foundOpen = true;
                }
            } else {
                let opens = (line.match(/\{/g) || []).length;
                let closes = (line.match(/\}/g) || []).length;
                braceCount += opens - closes;
                if (braceCount <= 0) {
                    removals.push({ start, end });
                    break;
                }
            }
            end++;
        }
    }
});

// Remove from end to start
removals.sort((a, b) => b.start - a.start);
removals.forEach(r => {
    console.log(`Removing lines ${r.start+1}-${r.end+1}: ${lines[r.start].trim()}`);
    lines.splice(r.start, r.end - r.start + 1);
});

let result = lines.join('\n');
fs.writeFileSync('script.js', result, 'utf8');
console.log('Script fixes applied. Lines:', lines.length);

// Verify no duplicates
let seen = new Set();
let dupes = [];
let re = /(?:async\s+)?function\s+(\w+)\s*\(/g;
let m;
while ((m = re.exec(result)) !== null) {
    if (seen.has(m[1])) dupes.push(m[1]);
    seen.add(m[1]);
}
if (dupes.length) console.log('Still has dupes:', dupes.join(', '));
else console.log('No duplicates! Total functions:', seen.size);
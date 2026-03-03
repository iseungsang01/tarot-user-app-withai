const fs = require('fs');
const path = require('path');

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.tsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('useCallback')) {
                const importMatch = content.match(/import\s+.*\{[^}]*useCallback[^}]*\}.*from\s+['"]react['"]/);
                const reactNamespaceMatch = content.match(/import\s+\*\s+as\s+React\s+from\s+['"]react['"]/);
                const reactDefaultMatch = content.match(/import\s+React\s+from\s+['"]react['"]/);
                const reactNoImport = !importMatch && !reactNamespaceMatch && !reactDefaultMatch;

                // If it uses plain 'useCallback' (not React.useCallback)
                const usesPlain = content.match(/(?<!\.)useCallback/);

                if (usesPlain && !importMatch) {
                    console.log(`Potential issue in ${fullPath}: uses plain useCallback but doesn't import it.`);
                }
            }
        }
    }
}

walk('c:/tarot-user-app-withai/src');

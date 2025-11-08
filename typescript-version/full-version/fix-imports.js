const fs = require('fs');
const path = require('path');

// Function to recursively find all .ts and .tsx files
function findFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findFiles(fullPath, files);
    } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }

  return files;
}

// Function to update imports in a file
function updateImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Update getInitials imports
  if (content.includes("from '@/utils/getInitials'")) {
    content = content.replace(/from '@\/utils\/getInitials'/g, "from '@/utils/formatting/getInitials'");
    changed = true;
  }

  // Update i18n imports
  if (content.includes("from '@/utils/i18n'")) {
    content = content.replace(/from '@\/utils\/i18n'/g, "from '@/utils/formatting/i18n'");
    changed = true;
  }

  // Update permissions imports
  if (content.includes("from '@/utils/permissions'")) {
    content = content.replace(/from '@\/utils\/permissions'/g, "from '@/utils/permissions/permissions'");
    changed = true;
  }

  // Update auth imports
  if (content.includes("from '@/utils/auth'")) {
    content = content.replace(/from '@\/utils\/auth'/g, "from '@/utils/auth/auth'");
    changed = true;
  }

  // Update getDictionary imports
  if (content.includes("from '@/utils/getDictionary'")) {
    content = content.replace(/from '@\/utils\/getDictionary'/g, "from '@/utils/formatting/getDictionary'");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

// Main execution
const srcDir = path.join(__dirname, 'src');
const files = findFiles(srcDir);

console.log(`Found ${files.length} TypeScript files`);

for (const file of files) {
  updateImports(file);
}

console.log('Import updates completed!');
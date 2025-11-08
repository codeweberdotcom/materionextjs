const fs = require('fs');
const path = require('path');

function findFiles(dir, pattern) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files.push(...findFiles(fullPath, pattern));
    } else if (stat.isFile() && pattern.test(item)) {
      files.push(fullPath);
    }
  }

  return files;
}

function fixTanstackImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace @tanstack/table-core with @tanstack/react-table in declare module
    content = content.replace(
      /declare module '@tanstack\/table-core'/g,
      "declare module '@tanstack/react-table'"
    );

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

const srcDir = path.join(__dirname, 'src');
const tsxFiles = findFiles(srcDir, /\.tsx$/);

console.log(`Found ${tsxFiles.length} .tsx files`);

tsxFiles.forEach(fixTanstackImports);

console.log('Done fixing TanStack imports');
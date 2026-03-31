import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
const templatesDir = path.join(distDir, 'templates');

fs.mkdirSync(templatesDir, { recursive: true });
fs.copyFileSync(path.resolve('src/reader.html'), path.join(distDir, 'reader.html'));
fs.copyFileSync(path.resolve('src/templates/content.opf.ejs'), path.join(templatesDir, 'content.opf.ejs'));

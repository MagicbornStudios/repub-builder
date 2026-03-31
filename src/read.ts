import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getReaderHtml(): string {
  const htmlPath = path.join(__dirname, 'reader.html');
  return fs.readFileSync(htmlPath, 'utf8');
}

export function runRead(repubPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(repubPath)) {
      reject(new Error(`File not found: ${repubPath}`));
      return;
    }

    const port = 3456;
    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getReaderHtml());
        return;
      }
      if (req.url === '/book.repub') {
        const stream = fs.createReadStream(repubPath);
        res.writeHead(200, { 'Content-Type': 'application/zip' });
        stream.pipe(res);
        return;
      }
      res.writeHead(404);
      res.end();
    });

    server.listen(port, () => {
      const url = `http://127.0.0.1:${port}/`;
      console.log('Reader at', url);
      console.log('Press Ctrl+C to stop');
      openBrowser(url);
    });

    server.on('error', reject);
  });
}

function openBrowser(url: string): void {
  const plat = process.platform;
  const cmd = plat === 'darwin' ? 'open' : plat === 'win32' ? 'start' : 'xdg-open';
  spawn(cmd, [url], { stdio: 'ignore', shell: true });
}

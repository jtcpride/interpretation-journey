import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4177);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!/^(index\.html|style\.css|src\/(app|art|story|state)\.js)$/.test(name)) {
      response.writeHead(404); response.end('Not found'); return;
    }
    const body = await readFile(path.join(root, name));
    response.writeHead(200, {'Content-Type':types[path.extname(name)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(body);
  } catch { response.writeHead(500); response.end('Unable to read game file'); }
});
server.on('error', error => { console.error(`起動できません: ${error.message}\n他のポートを使う場合: PORT=4178 node server.mjs`); process.exitCode=1; });
server.listen(port, host, () => console.log(`解釈の旅路: http://${host}:${port}\n終了: Ctrl+C`));

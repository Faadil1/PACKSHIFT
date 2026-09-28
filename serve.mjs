import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
http.createServer(async (req,res)=>{
  try {
    let path = decodeURIComponent((req.url||'/').split('?')[0]); if(path === '/') path='/index.html';
    path = normalize(path).replace(/^([.][.][/\\])+/, '');
    let full = join(root, path);
    const s = await stat(full); if(s.isDirectory()) full=join(full,'index.html');
    const data = await readFile(full); res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream','Cache-Control':'no-store'}); res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port,'0.0.0.0',()=>console.log(`PACKSHIFT dev server http://127.0.0.1:${port}`));

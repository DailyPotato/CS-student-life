const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const allowed = new Set(['index.html','style.css','data.js','engine.js','app.js','assets/favicon.svg']);
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  let pathname;
  try {pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/CS-student-life\/?/,'/').replace(/^\//,'')||'index.html';}catch{res.writeHead(400).end();return;}
  if(!allowed.has(pathname)){res.writeHead(404).end('Not found');return;}
  res.writeHead(200,{'Content-Type':types[path.extname(pathname)],'Cache-Control':'no-store'});
  fs.createReadStream(path.join(root,pathname)).pipe(res);
});
server.listen(4173,'127.0.0.1',()=>console.log('CS Life preview: http://127.0.0.1:4173/CS-student-life/'));

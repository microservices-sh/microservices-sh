// Dev preview server for the marketing-research module. Runs the REAL module
// (runResearch + the /last30days SocialListenPort adapter) behind a tiny local
// UI so you can see cite-or-refuse + coverage-honesty live. Dogfood tool, not
// part of the deployed Workers module.
//
//   L30_SKILL_DIR=<...>/skills/last30days npx tsx modules/marketing-research/dev/server.ts
//   open http://localhost:5390
//
// The synthesizer is a deterministic dev stand-in (no ai-gateway key in dev):
// it cites the top signals verbatim. cite-or-refuse + coverage are REAL.

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { runResearch, createMemoryMarketingStore, type Synthesizer } from "../src/index.ts";
import { createLast30daysListenPort, type Last30daysRunner } from "../src/adapters/last30days-listen.ts";

const PORT = Number(process.env.PORT ?? 5390);
const SKILL_DIR =
  process.env.L30_SKILL_DIR ?? "/home/ubuntu/.claude/plugins/cache/last30days-skill/last30days/3.6.0/skills/last30days";
const PYTHON = process.env.L30_PYTHON ?? "python3";

const runner: Last30daysRunner = ({ topic, channels }) =>
  new Promise((resolve, reject) => {
    const args = [`${SKILL_DIR}/scripts/last30days.py`, topic, "--emit=compact"];
    if (channels?.length) args.push(`--subreddits=${channels.join(",")}`);
    const p = spawn(PYTHON, args, { env: { ...process.env, LAST30DAYS_NATIVE_SEARCH: "0" } });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", () => {});
    p.on("error", reject);
    p.on("close", () => (out.includes("EVIDENCE FOR SYNTHESIS") ? resolve(out) : reject(new Error("engine returned no evidence block"))));
  });

// Deterministic stand-in for the ai-gateway synthesizer (no LLM key in dev).
const devSynth: Synthesizer = {
  async synthesize({ signals }) {
    const top = signals.slice(0, 6);
    return {
      summary: `Surfaced ${signals.length} grounded signals; citing the top ${top.length}.`,
      implications: top.map((s) => `[${s.source}] ${s.title}`),
      citedSourceUrls: top.map((s) => s.sourceUrl)
    };
  }
};

const store = createMemoryMarketingStore();
const listen = createLast30daysListenPort({ run: runner });

async function research(topic: string, channels?: string[]) {
  return runResearch(
    { topic, channels },
    { store, listen, synthesizer: devSynth, now: () => Date.now(), actor: { id: "founder", scopes: ["marketing.run"] } }
  );
}

const HTML = /* html */ `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>marketing-research · dev preview</title>
<style>
  :root{--bg:#070a08;--surface:#0f1511;--green:#38ff88;--amber:#ffc857;--danger:#ff6b5e;--text:#eafbf1;--muted:#91a89a;--dim:#5e7568;--border:#2a3c30;}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 ui-sans-serif,system-ui,sans-serif;}
  .mono{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace}
  .wrap{max-width:820px;margin:0 auto;padding:32px 20px 80px}
  h1{font-size:20px;margin:0 0 4px} .sub{color:var(--dim);font-size:12px;margin:0 0 24px}
  form{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:8px}
  label{display:block;font-size:11px;color:var(--dim);margin-bottom:4px;letter-spacing:.04em;text-transform:uppercase}
  input{background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:10px 12px;font-size:14px}
  input#topic{min-width:280px;flex:1} input#channels{min-width:200px}
  button{background:var(--green);color:#04130a;border:0;border-radius:8px;padding:11px 18px;font-weight:650;cursor:pointer}
  button:disabled{opacity:.5;cursor:wait}
  .hint{color:var(--dim);font-size:11px;margin:6px 0 22px}
  .panel{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-top:18px}
  .refused{border-color:var(--danger)} .refused .tag{color:var(--danger)}
  .tag{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.04em;color:var(--green);text-transform:uppercase}
  h2{font-size:15px;margin:14px 0 8px} ul{margin:6px 0;padding-left:18px} li{margin:3px 0}
  a{color:var(--green);text-decoration:none} a:hover{text-decoration:underline}
  .cite{display:block;padding:6px 0;border-bottom:1px solid var(--border)} .cite .src{color:var(--dim);font-size:11px}
  .coverage{margin-top:14px;font-size:13px} .ok{color:var(--green)} .zero{color:var(--amber)}
  .empty{color:var(--muted)}
</style></head><body><div class="wrap">
  <h1>marketing-research <span class="mono" style="color:var(--dim)">· dev preview</span></h1>
  <p class="sub">runs the real module: /last30days listen → cite-or-refuse → coverage-honest brief</p>
  <form id="f">
    <div><label>Topic</label><input id="topic" placeholder="e.g. Cloudflare Workers" value="Cloudflare Workers"></div>
    <div><label>Subreddits (optional, comma)</label><input id="channels" placeholder="CloudFlare,webdev"></div>
    <button id="go" type="submit">Run research</button>
  </form>
  <p class="hint">synthesizer = dev stand-in (no LLM key) — but cite-or-refuse &amp; coverage are real. Live engine run ~20–60s.</p>
  <div id="out"></div>
<script>
const f=document.getElementById('f'),out=document.getElementById('out'),go=document.getElementById('go');
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
f.addEventListener('submit',async e=>{
  e.preventDefault();go.disabled=true;out.innerHTML='<div class="panel empty">running the live engine…</div>';
  const topic=document.getElementById('topic').value.trim();
  const channels=document.getElementById('channels').value.split(',').map(s=>s.trim()).filter(Boolean);
  try{
    const r=await fetch('/api/research',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topic,channels})});
    const j=await r.json();out.innerHTML=render(j);
  }catch(err){out.innerHTML='<div class="panel refused"><span class="tag">error</span><p>'+esc(err.message)+'</p></div>';}
  go.disabled=false;
});
function cov(c){if(!c)return'';const ret=c.returned.map(s=>'<span class="ok">'+esc(s)+'</span>').join(', ')||'<span class="zero">none</span>';
  const note=c.note?'<div class="zero">⚠ '+esc(c.note)+'</div>':'';
  return '<div class="coverage"><span class="tag">coverage (honest)</span><div>searched: '+c.searched.map(esc).join(', ')+'</div><div>returned: '+ret+'</div>'+note+'</div>';}
function render(j){
  if(j.status!==201){
    return '<div class="panel refused"><span class="tag">refused · '+esc(j.error&&j.error.code||j.status)+'</span><p>'+esc(j.error&&j.error.message||'')+'</p>'+cov(j.error&&j.error.coverage)+'</div>';
  }
  const b=j.brief;
  const cites=b.citations.map(c=>'<a class="cite" href="'+esc(c.sourceUrl)+'" target="_blank"><span class="src">'+esc(new URL(c.sourceUrl).hostname)+'</span>'+esc(c.title)+'</a>').join('');
  return '<div class="panel"><span class="tag">brief · '+esc(b.id)+'</span><h2>'+esc(b.summary)+'</h2>'
    +'<h2>Implications</h2><ul>'+b.implications.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>'
    +'<h2>Citations ('+b.citations.length+')</h2>'+cites
    +cov(b.coverage)+'</div>';
}
</script></div></body></html>`;

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(HTML);
  }
  if (req.method === "POST" && req.url === "/api/research") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const { topic, channels } = JSON.parse(body || "{}");
        const result = await research(String(topic ?? ""), Array.isArray(channels) ? channels : undefined);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result.ok ? { status: 201, brief: (result.data as any).brief } : { status: result.status, error: (result as any).error }));
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: 500, error: { code: "DEV_ERROR", message: (err as Error).message } }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`marketing-research dev preview → http://localhost:${PORT}  (skill: ${SKILL_DIR})`);
});

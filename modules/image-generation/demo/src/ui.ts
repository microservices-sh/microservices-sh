export const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>image-generation · playground</title>
<style>
  :root { color-scheme: dark; --bg:#0b0d12; --panel:#151922; --line:#262c3a; --txt:#e7ebf3; --mut:#8b94a7; --acc:#6ea8fe; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.5 ui-sans-serif,system-ui,sans-serif; background:var(--bg); color:var(--txt); }
  .wrap { max-width:880px; margin:0 auto; padding:32px 20px 64px; }
  h1 { font-size:20px; margin:0 0 2px; }
  .sub { color:var(--mut); margin:0 0 24px; font-size:13px; }
  code { background:#0f131b; padding:1px 5px; border-radius:5px; color:var(--acc); }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  @media (max-width:720px){ .grid{ grid-template-columns:1fr; } }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:18px; }
  label { display:block; font-size:12px; color:var(--mut); margin:14px 0 5px; }
  label:first-child { margin-top:0; }
  input,select,textarea { width:100%; background:#0f131b; border:1px solid var(--line); color:var(--txt); border-radius:9px; padding:9px 11px; font:inherit; outline:none; }
  input:focus,select:focus,textarea:focus { border-color:var(--acc); }
  button { margin-top:18px; width:100%; background:var(--acc); color:#06101f; border:0; border-radius:9px; padding:11px; font-weight:600; cursor:pointer; }
  button:disabled { opacity:.5; cursor:default; }
  .hint { font-size:11px; color:var(--mut); margin-top:5px; }
  .result-img { width:100%; border-radius:10px; border:1px solid var(--line); background:#0f131b; min-height:160px; object-fit:contain; }
  pre { background:#0f131b; border:1px solid var(--line); border-radius:9px; padding:12px; overflow:auto; font-size:12px; color:var(--mut); white-space:pre-wrap; word-break:break-word; }
  .err { color:#ff8a8a; }
  .hidden { display:none; }
</style>
</head>
<body>
<div class="wrap">
  <h1>image-generation playground</h1>
  <p class="sub">Standalone demo of the <code>@microservices-sh/image-generation</code> module. Pick a provider, paste your API key, prompt, optionally add a reference image to edit. Key is used only for this request, never stored. Choose <code>stub</code> to try the flow with no key.</p>
  <div class="grid">
    <form class="panel" id="f">
      <label>Provider</label>
      <select id="provider">
        <option value="stub">stub (no key, fake image)</option>
        <option value="kie-ai">kie.ai (nano-banana)</option>
        <option value="gemini">Gemini</option>
        <option value="gpt-image">GPT-image (OpenAI)</option>
      </select>

      <div id="keyRow">
        <label>API key</label>
        <input id="apiKey" type="password" placeholder="sk-… / kie key / gemini token" autocomplete="off" />
      </div>

      <div id="geminiRow" class="hidden">
        <label>Gemini endpoint (generateContent URL)</label>
        <input id="geminiEndpoint" placeholder="https://…/models/…:generateContent" />
      </div>

      <label>Prompt</label>
      <textarea id="prompt" rows="3" placeholder="A red fox in a snowy forest, cinematic lighting"></textarea>

      <label>Aspect ratio</label>
      <select id="aspectRatio">
        <option>1:1</option><option>3:4</option><option>4:3</option><option>9:16</option><option>16:9</option>
      </select>

      <label>Negative prompt (optional)</label>
      <input id="negativePrompt" placeholder="blurry, low quality" />

      <label>Reference image (optional → edit mode)</label>
      <input id="ref" type="file" accept="image/*" />
      <div class="hint">With a reference image, the prompt edits it (uses the module's edit use-case).</div>

      <button id="go" type="submit">Generate</button>
    </form>

    <div class="panel">
      <label>Result</label>
      <img id="out" class="result-img" alt="" />
      <label style="margin-top:14px">Result envelope</label>
      <pre id="env">—</pre>
    </div>
  </div>
</div>
<script>
const $ = (id) => document.getElementById(id);
$('provider').addEventListener('change', () => {
  const p = $('provider').value;
  $('geminiRow').classList.toggle('hidden', p !== 'gemini');
  $('keyRow').classList.toggle('hidden', p === 'stub');
});
function fileToDataUrl(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
$('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const go = $('go'); go.disabled = true; go.textContent = 'Generating…';
  $('env').textContent = '…'; $('env').classList.remove('err'); $('out').removeAttribute('src');
  try {
    const refFile = $('ref').files[0];
    const body = {
      provider: $('provider').value,
      apiKey: $('apiKey').value || undefined,
      geminiEndpoint: $('geminiEndpoint').value || undefined,
      prompt: $('prompt').value,
      aspectRatio: $('aspectRatio').value,
      negativePrompt: $('negativePrompt').value || undefined,
      referenceImage: refFile ? await fileToDataUrl(refFile) : undefined,
    };
    const r = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const j = await r.json();
    $('env').textContent = JSON.stringify(j, null, 2);
    if (j.ok && j.data && j.data.id) {
      $('out').src = '/img/' + j.data.id + '?t=' + Date.now();
    } else {
      $('env').classList.add('err');
    }
  } catch (err) {
    $('env').textContent = String(err); $('env').classList.add('err');
  } finally {
    go.disabled = false; go.textContent = 'Generate';
  }
});
</script>
</body>
</html>`;

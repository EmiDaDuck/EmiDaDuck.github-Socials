(function(){
  function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e }
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) }

  function init(root){
    const initial = root.getAttribute('data-raw') || 'dispatch.txt'
    const interval = Math.max(1, parseInt(root.getAttribute('data-interval')||'1',10) || 1)
    const history = Math.max(1, parseInt(root.getAttribute('data-history')||'20',10) || 20)

    if(!document.getElementById('dlp-style')){
      const style = document.createElement('style'); style.id='dlp-style'; style.textContent = `
        .dlp{position:relative;border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}
        .dlp-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
        .dlp-row>*{flex:1 1 200px}
        .dlp-input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#11161f;color:inherit}
        .dlp-btn{padding:10px 12px;border-radius:10px;border:0;background:linear-gradient(180deg,#5865f2,#4752c4);color:#fff;cursor:pointer}
        .dlp-btn.secondary{background:#232832;border:1px solid rgba(255,255,255,.1)}
        .dlp-status{opacity:.8;margin-bottom:6px}
        .dlp-feed{display:grid;gap:10px}
        .dlp-item{padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:#0f1420}
        .dlp-meta{font-size:.875rem;opacity:.8;margin-bottom:4px}
        .dlp-badge{display:inline-block;padding:3px 8px;border-radius:999px;background:#232734;border:1px solid rgba(255,255,255,.08);font-size:.75rem}
        .dlp-title{margin:0 0 6px;font-size:1rem}
        .dlp-pre{margin:0;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Consolas,Menlo,monospace}
        .dlp-pulse{animation:dlpPulse 700ms ease-out 1}
        @keyframes dlpPulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.45)}100%{box-shadow:0 0 0 24px rgba(239,68,68,0)}}
      `; document.head.appendChild(style)
    }

    const box = el('section','dlp'), status = el('div','dlp-status','Idle.')
    const row = el('div','dlp-row')
    const urlIn = el('input','dlp-input'); urlIn.type='text'; urlIn.placeholder='dispatch.txt oder vollständige RAW-URL'; urlIn.value = initial
    const startBtn = el('button','dlp-btn','Start'); const copyBtn = el('button','dlp-btn secondary','Copy')
    row.append(urlIn, startBtn, copyBtn)
    const feed = el('div','dlp-feed')
    box.append(status,row,feed); root.append(box)

    let etag=null, lastModified=null, lastPayload=null, lastId=null, timer=null, running=false, fetching=false

    startBtn.addEventListener('click', ()=>{ running=true; status.textContent='Listening…'; clearTimeout(timer); tick(true) })
    copyBtn.addEventListener('click', ()=>{
      const first = feed.querySelector('.dlp-pre'); if(!first) return
      navigator.clipboard.writeText(first.textContent||'')
    })

    running = true; status.textContent='Listening…'; tick(true)

    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && running) tick(true) })

    async function tick(immediate){
      if(!running || fetching) return
      fetching = true
      try{
        const abs = new URL(urlIn.value.trim() || 'dispatch.txt', location.href).href
        const headers = { 'Cache-Control':'no-cache', 'Pragma':'no-cache' }
        if(etag) headers['If-None-Match']=etag
        if(lastModified) headers['If-Modified-Since']=lastModified

        const res = await fetch(abs, { headers, cache:'no-store', keepalive:true })
        if(res.status===200){
          etag = res.headers.get('ETag'); lastModified = res.headers.get('Last-Modified')
          const text = await res.text()
          if(text !== lastPayload){ lastPayload = text; onNew(text) }
          status.textContent = 'Live'
        }else if(res.status===304){
          status.textContent = 'Live'
        }else{
          status.textContent = 'HTTP '+res.status
        }
      }catch(e){
        status.textContent = 'Error: ' + (e && e.message || e)
      }finally{
        fetching = false
        schedule(immediate)
      }
    }
    function schedule(immediate){
      clearTimeout(timer)
      const wait = immediate ? 0 : Math.max(1, parseInt(root.getAttribute('data-interval')||'1',10) || 1) * 1000
      timer = setTimeout(()=>tick(false), wait)
    }

    function parse(text){
      const lines=text.split(/\r?\n/); let id=null, utc=null, bodyStart=0
      for(let i=0;i<Math.min(4,lines.length);i++){
        const L=lines[i]
        if(/^MSG-ID\s*:/.test(L)){ id=(L.split(':')[1]||'').trim(); bodyStart=i+1 }
        if(/^UTC\s*:/.test(L)){ utc=L.split(':').slice(1).join(':').trim(); bodyStart=i+1 }
      }
      const body = lines.slice(bodyStart).join('\n').trim()
      const title = body.split('\n')[0]?.slice(0,80) || ''
      return { id, utc, title, body }
    }

    function onNew(text){
      const p = parse(text)
      if(p.id && p.id===lastId) return; lastId = p.id || null
      const item = el('article','dlp-item')
      item.innerHTML = `<div class="dlp-meta"><span class="dlp-badge">MSG ${escapeHtml(p.id||'—')}</span>${p.utc?` <span>${escapeHtml(p.utc)}</span>`:''}</div>
                        <h3 class="dlp-title">${escapeHtml(p.title||'Dispatch')}</h3>
                        <pre class="dlp-pre">${escapeHtml(p.body||'')}</pre>`
      feed.prepend(item)
      while(feed.children.length > history) feed.lastChild.remove()
      box.classList.remove('dlp-pulse'); void box.offsetWidth; box.classList.add('dlp-pulse')
    }
  }

  window.DispatchPages = { mount: (sel)=>{
    const nodes = typeof sel==='string' ? document.querySelectorAll(sel) : [sel]
    nodes.forEach(n=> n && init(n))
  }}

  document.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('[data-dispatch-pages]').forEach(init)
  })
})();

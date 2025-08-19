(function(){
  function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e }
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) }

  function injectCSS(){
    if(document.getElementById('motd-style')) return
    const style = document.createElement('style'); style.id='motd-style'; style.textContent = `
      .motd-wrap{position:relative;border-radius:14px;padding:14px 16px;background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(6px);color:inherit}
      .motd-status{opacity:.75;margin-bottom:8px;font-size:.95rem}
      .motd-body{white-space:pre-wrap;word-break:break-word;margin:0;font-size:1.05rem}
      .motd-badge{display:inline-block;margin-right:8px;padding:4px 8px;border-radius:999px;background:#222734;border:1px solid rgba(255,255,255,.08);font-size:.8rem}
      .motd-meta{opacity:.8;margin-bottom:6px}
      .motd-pulse{animation:motdPulse 700ms ease-out 1}
      @keyframes motdPulse{0%{box-shadow:0 0 0 0 rgba(88,101,242,.45)}100%{box-shadow:0 0 0 28px rgba(88,101,242,0)}}
    `; document.head.appendChild(style)
  }

  function init(root){
    injectCSS()
    const src = root.getAttribute('data-json') || 'config.json'
    const key = root.getAttribute('data-key') || 'motd'   // dot-path supported later if needed
    const interval = Math.max(1, parseInt(root.getAttribute('data-interval')||'1',10) || 1)

    const box = el('section','motd-wrap')
    const status = el('div','motd-status','Listening…')
    const meta = el('div','motd-meta','')
    const pre = el('pre','motd-body','')
    box.append(status, meta, pre)
    root.append(box)

    let etag=null, lastModified=null, lastValue=null, timer=null, fetching=false

    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) tick(true) })
    tick(true)

    async function tick(immediate){
      if(fetching) return
      fetching = true
      try{
        const url = new URL(src, location.href).href
        const headers = { 'Cache-Control':'no-cache', 'Pragma':'no-cache' }
        if(etag) headers['If-None-Match']=etag
        if(lastModified) headers['If-Modified-Since']=lastModified

        const res = await fetch(url, { headers, cache:'no-store', keepalive:true })
        if(res.status===200){
          etag = res.headers.get('ETag'); lastModified = res.headers.get('Last-Modified')
          let text = await res.text()
          // Try remove BOM
          if(text.charCodeAt(0)===0xFEFF){ text = text.slice(1) }
          let obj=null
          try{ obj = JSON.parse(text) }catch(e){
            status.textContent = 'JSON parse error'; meta.textContent=''; pre.textContent=text
            schedule(immediate); fetching=false; return
          }
          // Simple key lookup (support shallow dot path: "a.b.c")
          let val=obj, path=key.split('.')
          for(const k of path){ if(val && Object.prototype.hasOwnProperty.call(val, k)){ val=val[k] } else { val=null; break } }
          const motd = (val==null ? '' : String(val))

          if(motd !== lastValue){
            lastValue = motd
            render(motd, obj)
          }
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
      const wait = immediate ? 0 : interval*1000
      timer = setTimeout(()=>tick(false), wait)
    }

    function render(motd, full){
      const utc = full && (full.UTC || full.updatedAt || full.updated_at)
      meta.innerHTML = `<span class="motd-badge">MOTD</span>${utc ? escapeHtml(utc) : ''}`
      pre.textContent = motd || ''
      box.classList.remove('motd-pulse'); void box.offsetWidth; box.classList.add('motd-pulse')
    }
  }

  window.MotdListener = { mount: (sel)=>{
    const nodes = typeof sel==='string' ? document.querySelectorAll(sel) : [sel]
    nodes.forEach(n=> n && init(n))
  }}

  document.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('[data-motd]').forEach(init)
  })
})();

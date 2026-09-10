const list=document.getElementById("fileRecoveryList"),status=document.getElementById("fileRecoveryStatus"),count=document.getElementById("fileRecoveryCount");
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function label(v){return String(v||"file").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());}
function niceDate(v){if(!v)return "";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString();}
async function load(){
  status.hidden=true;
  const r=await fetch("/api/file-recovery",{cache:"no-store"}),d=await r.json().catch(()=>({}));
  if(!r.ok||d.ok===false){status.hidden=false;status.textContent=d.error||"Unable to load file recovery.";count.textContent="Recovery status unavailable";return;}
  const items=d.items||[],available=items.filter(x=>x.status==="available").length;
  count.textContent=`${available} available ${available===1?"copy":"copies"}`;
  if(!items.length){list.innerHTML='<div class="es-empty-state"><strong>No protected files yet</strong><span>Recovery copies will appear here after a protected file is deleted.</span></div>';return;}
  list.innerHTML=items.map(x=>`<article class="es-recovery-card"><div class="es-recovery-main"><div class="es-recovery-name">${esc(x.original_name||x.source_type||"Protected file")}</div><div class="es-recovery-meta"><span>${esc(label(x.source_type))}</span><span>·</span><span>${esc(niceDate(x.created_at))}</span><span class="es-recovery-status">${esc(x.status)}</span>${x.protected_until&&x.status==="available"?`<span>Protected until ${esc(niceDate(x.protected_until))}</span>`:""}</div></div><div class="es-recovery-actions">${x.status==="available"?`<button class="es-button" data-restore="${esc(x.id)}">Restore file</button>`:`<span class="es-muted-copy">${x.restored_at?`Restored ${esc(niceDate(x.restored_at))}`:"Recovery completed"}</span>`}</div></article>`).join("");
}
list.addEventListener("click",async e=>{const b=e.target.closest("[data-restore]");if(!b)return;if(!confirm("Restore this protected file to its original location?"))return;const typed=prompt("Type RESTORE to confirm");if(String(typed||"").trim().toUpperCase()!=="RESTORE")return;b.disabled=true;b.textContent="Restoring…";const r=await fetch("/api/file-recovery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({recovery_id:b.dataset.restore,confirmation:"RESTORE"})}),d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false){alert(d.error||"Unable to restore file.");b.disabled=false;b.textContent="Restore file";return;}await load();});
load();

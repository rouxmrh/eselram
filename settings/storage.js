const title=document.getElementById("storageTitle");
const message=document.getElementById("storageMessage");
const button=document.getElementById("setupStorageButton");
const status=document.getElementById("storageStatus");
const recovery=document.getElementById("fileRecoveryLink");

function showStatus(text,isError=false){status.hidden=false;status.className=`es-status ${isError?"error":"success"}`;status.textContent=text;}

async function load(){
  try{
    const r=await fetch("/api/setup-health",{cache:"no-store",headers:{Accept:"application/json"}});
    if(r.status===401){location.href="/auth/login.html";return;}
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.ok===false)throw new Error(d.error||"Unable to check storage status.");
    const connected=d.environment?.form_uploads_bound===true;
    title.textContent=connected?"Photo & file storage is connected":"Photo & file storage is optional";
    message.textContent=connected?"Secure R2 storage is connected to this Eselram installation. Protected file recovery is available.":"Eselram can run normally without R2. Set this up when you want to use photos or file uploads.";
    button.hidden=connected;
    recovery.hidden=!connected;
  }catch(e){title.textContent="Storage status unavailable";message.textContent=e.message||"Unable to check storage status.";}
}

button.addEventListener("click",async()=>{
  button.disabled=true;status.hidden=true;
  try{
    const r=await fetch("/api/storage/handoff",{method:"POST",headers:{Accept:"application/json"}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||d.ok===false)throw new Error(d.error||"Unable to start secure storage setup.");
    if(d.already_configured){showStatus("Photo & file storage is already connected.");await load();return;}
    if(!d.setup_url)throw new Error("Secure storage setup did not return a handoff URL.");
    location.href=d.setup_url;
  }catch(e){showStatus(e.message||"Unable to start secure storage setup.",true);button.disabled=false;}
});

load();

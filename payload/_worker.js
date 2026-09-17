var hc=Object.defineProperty;var c=(s,e)=>hc(s,"name",{value:e,configurable:!0});var Ps=new TextEncoder;function xs(s){let e="";for(let t of s)e+=String.fromCharCode(t);return btoa(e)}c(xs,"bytesToBase64");async function Gt(s){let e=crypto.getRandomValues(new Uint8Array(16)),t=await crypto.subtle.importKey("raw",Ps.encode(s),"PBKDF2",!1,["deriveBits"]),i=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:e,iterations:1e5},t,256),n=new Uint8Array(i);return["pbkdf2-sha256",1e5,xs(e),xs(n)].join("$")}c(Gt,"hashPassword");async function D(s){let e=await crypto.subtle.digest("SHA-256",Ps.encode(s));return Array.from(new Uint8Array(e)).map(t=>t.toString(16).padStart(2,"0")).join("")}c(D,"hashSessionToken");function kt(){let s=crypto.getRandomValues(new Uint8Array(32));return xs(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")}c(kt,"createSessionToken");function Yt(s,e=604800){return[`eselram_session=${s}`,"Path=/","HttpOnly","Secure","SameSite=Lax",`Max-Age=${e}`].join("; ")}c(Yt,"createSessionCookie");function ji(s){let e=atob(s),t=new Uint8Array(e.length);for(let i=0;i<e.length;i++)t[i]=e.charCodeAt(i);return t}c(ji,"base64ToBytes");function yc(s,e){if(s.length!==e.length)return!1;let t=0;for(let i=0;i<s.length;i++)t|=s[i]^e[i];return t===0}c(yc,"constantTimeEqual");async function Hi(s,e){try{let[t,i,n,r]=e.split("$");if(t!=="pbkdf2-sha256")return!1;let a=Number(i),o=ji(n),u=ji(r),d=await crypto.subtle.importKey("raw",Ps.encode(s),"PBKDF2",!1,["deriveBits"]),l=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:o,iterations:a},d,256),p=new Uint8Array(l);return yc(p,u)}catch(t){return console.error("Password verification failed:",t),!1}}c(Hi,"verifyPassword");function C(s){let t=(s.headers.get("Cookie")||"").split(";");for(let i of t){let[n,...r]=i.trim().split("=");if(n==="eselram_session")return r.join("=").trim()}return null}c(C,"readSessionToken");function Fi(){return["eselram_session=","Path=/","HttpOnly","Secure","SameSite=Lax","Max-Age=0"].join("; ")}c(Fi,"clearSessionCookie");var Ji=new TextEncoder,kc=new TextDecoder;function Wi(s){let e="";for(let t of s)e+=String.fromCharCode(t);return btoa(e)}c(Wi,"bytesToBase64");function $i(s){let e=atob(s),t=new Uint8Array(e.length);for(let i=0;i<e.length;i+=1)t[i]=e.charCodeAt(i);return t}c($i,"base64ToBytes");async function Gi(s){let e=String(s||"").trim();if(!e)throw new Error("ESELRAM_ENCRYPTION_KEY is not configured.");let t=await crypto.subtle.digest("SHA-256",Ji.encode(e));return await crypto.subtle.importKey("raw",t,{name:"AES-GCM"},!1,["encrypt","decrypt"])}c(Gi,"getKey");async function Ze(s,e){let t=String(s||"");if(!t)return null;let i=await Gi(e),n=crypto.getRandomValues(new Uint8Array(12)),r=await crypto.subtle.encrypt({name:"AES-GCM",iv:n},i,Ji.encode(t));return["v1",Wi(n),Wi(new Uint8Array(r))].join(":")}c(Ze,"encryptIntegrationSecret");async function we(s,e){let t=String(s||"");if(!t)return"";let[i,n,r]=t.split(":");if(i!=="v1"||!n||!r)throw new Error("Unsupported encrypted integration credential.");let a=await Gi(e),o=await crypto.subtle.decrypt({name:"AES-GCM",iv:$i(n)},a,$i(r));return kc.decode(o)}c(we,"decryptIntegrationSecret");var Sc="https://auth.eselram.com",Rc="https://www.googleapis.com/auth/gmail.send";function Nc(s){return String(s||"").split(/\s+/).map(e=>e.trim()).filter(Boolean).includes(Rc)}c(Nc,"hasRequiredGmailScope");function Tc(s){let e=String(s||"").toLowerCase();return e.includes("insufficient authentication scopes")||e.includes("insufficient permission")||e.includes("insufficientpermissions")||e.includes("insufficient_scope")}c(Tc,"isInsufficientGmailScopeError");async function Ac(s,e,t){try{await s.DB.prepare(`
        UPDATE business_email_connections
        SET
          status = 'reconnect_required',
          last_error = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE business_id = ? AND provider = 'gmail'
      `).bind(t,e).run()}catch{}}c(Ac,"markGmailReconnectRequired");function zt(s,e={}){try{return s?JSON.parse(s):e}catch{return e}}c(zt,"parseJson");async function wc(s,e,t){let i=await s.DB.prepare(`
      SELECT setting_value
      FROM business_settings
      WHERE business_id = ? AND setting_key = ?
      LIMIT 1
    `).bind(e,t).first();return String(i?.setting_value||"").trim()}c(wc,"setting");async function pt(s,e,t){if(!["resend","gmail"].includes(t))throw new Error("Unsupported email provider.");await s.DB.prepare(`
      INSERT INTO business_settings (
        id,
        business_id,
        setting_key,
        setting_value,
        value_type
      )
      VALUES (?, ?, 'email_active_provider', ?, 'string')
      ON CONFLICT(business_id, setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        value_type = 'string',
        updated_at = CURRENT_TIMESTAMP
    `).bind(`setting_${crypto.randomUUID()}`,e,t).run()}c(pt,"setActiveEmailProvider");async function Dc(s,e){return await s.DB.prepare(`
      SELECT name, email
      FROM businesses
      WHERE id = ?
      LIMIT 1
    `).bind(e).first()}c(Dc,"business");async function vc(s,e){let t=await s.DB.prepare(`
      SELECT encrypted_credentials, config_json, status
      FROM business_integrations
      WHERE
        business_id = ?
        AND integration_type = 'email'
        AND provider = 'resend'
      LIMIT 1
    `).bind(e).first();if(!t?.encrypted_credentials)return null;let i=zt(await we(t.encrypted_credentials,s.ESELRAM_ENCRYPTION_KEY),{}),n=zt(t.config_json,{}),r=String(i.api_key||"").trim(),a=String(n.from_name||"").trim(),o=String(n.from_email||"").trim();return{provider:"resend",status:t.status,ready:!!(r&&a&&o),apiKey:r,fromName:a,fromEmail:o}}c(vc,"resendConnection");async function Cc(s,e){return await s.DB.prepare(`
      SELECT
        id,
        encrypted_credentials,
        config_json,
        status,
        last_tested_at,
        last_error
      FROM business_email_connections
      WHERE business_id = ? AND provider = 'gmail'
      LIMIT 1
    `).bind(e).first()}c(Cc,"gmailRow");async function Oc(s,e,t,i){let n=Number(i.expires_at||0),r=Math.floor(Date.now()/1e3);if(i.access_token&&n>r+120)return i;let a=String(i.refresh_token||"").trim();if(!a)throw new Error("Reconnect Gmail. Google did not provide a refresh token for this connection.");let o=String(s.ESELRAM_OAUTH_BROKER_URL||Sc).replace(/\/$/,""),u=await fetch(`${o}/api/gmail/refresh`,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({refresh_token:a})}),d=await u.json().catch(()=>({}));if(!u.ok||!d?.access_token)throw new Error(d?.error||"Gmail authorization expired. Reconnect Gmail in Settings \u2192 Email provider.");let l={...i,access_token:d.access_token,expires_at:r+Number(d.expires_in||3600),scope:d.scope||i.scope||""},p=await Ze(JSON.stringify(l),s.ESELRAM_ENCRYPTION_KEY);return await s.DB.prepare(`
      UPDATE business_email_connections
      SET
        encrypted_credentials = ?,
        status = 'verified',
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(p,t.id).run(),l}c(Oc,"refreshGmailToken");async function Yi(s,e){let t=await Cc(s,e);if(!t?.encrypted_credentials)return null;let i=zt(await we(t.encrypted_credentials,s.ESELRAM_ENCRYPTION_KEY),{});i=await Oc(s,e,t,i);let n=zt(t.config_json,{}),r=String(n.email||i.email||"").trim(),a=t.status==="reconnect_required"||!Nc(i.scope);return{provider:"gmail",status:t.status,permissionRequired:a,ready:!!(r&&i.access_token&&!a),email:r,accessToken:i.access_token,senderName:String(n.sender_name||"").trim()}}c(Yi,"gmailConnection");async function _t(s,e){if(!String(s.ESELRAM_ENCRYPTION_KEY||"").trim())return{error:"ESELRAM_ENCRYPTION_KEY is not configured."};if((await wc(s,e,"email_active_provider")||"gmail")==="gmail"){let r=await Yi(s,e);return r?.ready?r:r?.permissionRequired?{error:"Email permission required. Reconnect Google in Settings \u2192 Email provider and allow Eselram to send email on your behalf."}:{error:"Gmail is selected but is not connected. Reconnect Gmail in Settings \u2192 Email provider."}}let i=await vc(s,e);if(i?.ready)return i;let n=await Yi(s,e).catch(()=>null);return n?.ready?n:{error:"Automated email is not ready. Connect Gmail in Settings \u2192 Email provider."}}c(_t,"getActiveEmailConnection");function Kt(s){return String(s||"").replace(/[\r\n]+/g," ").trim()}c(Kt,"cleanHeader");function Ki(s){let e=new TextEncoder().encode(String(s||"")),t="";for(let i of e)t+=String.fromCharCode(i);return btoa(t)}c(Ki,"base64Utf8");function Ic(s){return Ki(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}c(Ic,"base64UrlUtf8");function Lc(s){return`=?UTF-8?B?${Ki(s)}?=`}c(Lc,"encodedSubject");function Mc({fromName:s,fromEmail:e,to:t,replyTo:i,subject:n,html:r,text:a}){let o=`eselram_${crypto.randomUUID().replaceAll("-","")}`,d=[...[`From: ${Kt(s)} <${Kt(e)}>`,`To: ${Kt(t)}`,i?`Reply-To: ${Kt(i)}`:null,`Subject: ${Lc(n)}`,"MIME-Version: 1.0",`Content-Type: multipart/alternative; boundary="${o}"`].filter(Boolean),"",`--${o}`,'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: 8bit","",String(a||""),"",`--${o}`,'Content-Type: text/html; charset="UTF-8"',"Content-Transfer-Encoding: 8bit","",String(r||""),"",`--${o}--`,""].join(`\r
`);return Ic(d)}c(Mc,"gmailRawMessage");async function De(s,e,{to:t,subject:i,html:n,text:r,replyTo:a=""}){let o=String(t||"").trim();if(!o)throw new Error("Email recipient is missing.");let u=await _t(s,e);if(u?.error)throw new Error(u.error);let d=await Dc(s,e),l=String(d?.name||"Eselram").trim(),p=String(a||d?.email||"").trim();if(u.provider==="gmail"){let g=u.senderName||l,E=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{Authorization:`Bearer ${u.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({raw:Mc({fromName:g,fromEmail:u.email,to:o,replyTo:p,subject:i,html:n,text:r})})}),f=await E.json().catch(()=>({}));if(!E.ok){let b=f?.error?.message||"Gmail rejected the email.";if(Tc(b)){let N="Email permission required. Reconnect Google in Settings \u2192 Email provider and allow Eselram to send email on your behalf.";throw await Ac(s,e,N),new Error(N)}throw new Error(b)}return{provider:"gmail",id:f?.id||null}}let m=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${u.apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:`${u.fromName} <${u.fromEmail}>`,to:[o],subject:i,html:n,text:r,...p?{reply_to:p}:{}})}),_=await m.json().catch(()=>({}));if(!m.ok)throw new Error(_?.message||_?.error||"Resend rejected the email.");return{provider:"resend",id:_?.id||null}}c(De,"sendBusinessEmail");async function xc(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.business_id,
        b.name AS business_name,
        b.email AS business_email
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN businesses b ON b.id = u.business_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(xc,"userContext");function Pc(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Pc,"unauthorized");function Uc(s){let e=new URL(s.url),t=String(s.headers.get("X-Eselram-Admin-Origin")||"").trim();if(t)try{let i=new URL(t);if(i.protocol==="https:"&&i.hostname.endsWith(".eselram.com"))return i.origin}catch{}return e.origin}c(Uc,"adminOrigin");var Bc="https://auth.eselram.com",qc="https://www.googleapis.com/auth/gmail.send";function jc(s){return String(s||"").split(/\s+/).map(e=>e.trim()).filter(Boolean).includes(qc)}c(jc,"hasRequiredGmailScope");async function zi({request:s,env:e}){let t=await xc(s,e);if(!t)return Pc();let i=new URL(s.url),n=Uc(s),r=String(i.searchParams.get("claim")||"").trim();if(i.searchParams.get("error")==="missing_gmail_send_scope")return Response.redirect(`${n}/settings/?tab=email&gmail=permission`,302);if(!r)return Response.redirect(`${n}/settings/?tab=email&gmail=error`,302);try{let a=String(e.ESELRAM_OAUTH_BROKER_URL||Bc).replace(/\/$/,""),o=await fetch(`${a}/api/gmail/claim`,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({claim:r,audience:n})}),u=await o.json().catch(()=>({}));if(!o.ok||!u?.ok)throw new Error(u?.error||"Unable to complete Gmail authorization.");let d=u.gmail||{};if(!jc(d.scope))return Response.redirect(`${n}/settings/?tab=email&gmail=permission`,302);let l=await Ze(JSON.stringify({access_token:d.access_token,refresh_token:d.refresh_token,expires_at:Math.floor(Date.now()/1e3)+Number(d.expires_in||3600),scope:d.scope||"",email:d.email||""}),e.ESELRAM_ENCRYPTION_KEY);return await e.DB.prepare(`
        INSERT INTO business_email_connections (
          id,
          business_id,
          provider,
          encrypted_credentials,
          config_json,
          status
        )
        VALUES (?, ?, 'gmail', ?, ?, 'verified')
        ON CONFLICT(business_id, provider) DO UPDATE SET
          encrypted_credentials = excluded.encrypted_credentials,
          config_json = excluded.config_json,
          status = 'verified',
          last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
      `).bind(`email_${crypto.randomUUID()}`,t.business_id,l,JSON.stringify({email:d.email||"",sender_name:t.business_name||""})).run(),await pt(e,t.business_id,"gmail"),Response.redirect(`${n}/settings/?tab=email&gmail=connected`,302)}catch(a){return console.error("Gmail OAuth callback failed:",a),Response.redirect(`${n}/settings/?tab=email&gmail=error`,302)}}c(zi,"onRequestGet");async function Hc(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.business_id,
        b.name AS business_name,
        b.email AS business_email
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN businesses b ON b.id = u.business_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(Hc,"userContext");function Fc(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Fc,"unauthorized");function Wc(s){let e=new URL(s.url),t=String(s.headers.get("X-Eselram-Admin-Origin")||"").trim();if(t)try{let i=new URL(t);if(i.protocol==="https:"&&i.hostname.endsWith(".eselram.com"))return i.origin}catch{}return e.origin}c(Wc,"adminOrigin");var $c="https://auth.eselram.com";async function Vi({request:s,env:e}){if(!await Hc(s,e))return Fc();let n=`${Wc(s)}/api/integrations/email/gmail/callback`,a=`${String(e.ESELRAM_OAUTH_BROKER_URL||$c).replace(/\/$/,"")}/api/gmail/start?return_url=${encodeURIComponent(n)}`;return Response.redirect(a,302)}c(Vi,"onRequestGet");var Jc="https://api.resend.com";async function Xi(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.business_id,
        b.name AS business_name,
        b.email AS business_email
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN businesses b ON b.id = u.business_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(Xi,"getUserContext");function Zi(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Zi,"unauthorized");function Vt(s){return Response.json({ok:!1,error:s},{status:400})}c(Vt,"badRequest");function Qi(s,e={}){try{return s?JSON.parse(s):e}catch{return e}}c(Qi,"parseJson");function Gc(s){return String(s||"").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").replace(/\/.*$/,"").replace(/\.$/,"")}c(Gc,"normaliseDomain");function Yc(s){return/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(s)}c(Yc,"validDomain");async function en(s,e){return await s.DB.prepare(`
      SELECT
        id,
        encrypted_credentials,
        config_json,
        status
      FROM business_integrations
      WHERE business_id = ?
        AND integration_type = 'email'
        AND provider = 'resend'
      LIMIT 1
    `).bind(e).first()}c(en,"getIntegration");async function St(s,e,t={}){let i=await fetch(`${Jc}${e}`,{...t,headers:{Authorization:`Bearer ${s}`,Accept:"application/json",...t.body?{"Content-Type":"application/json"}:{},...t.headers||{}}}),n=await i.json().catch(()=>({}));if(!i.ok){let r=n?.message||n?.error||`Resend request failed (${i.status}).`,a=new Error(r);throw a.status=i.status,a}return n}c(St,"resendRequest");async function tn(s,e){return e?.encrypted_credentials?JSON.parse(await we(e.encrypted_credentials,s.ESELRAM_ENCRYPTION_KEY)):{}}c(tn,"credentialsFor");async function Us(s,e,t,i=null){await s.DB.prepare(`
      UPDATE business_integrations
      SET
        config_json = ?,
        status = COALESCE(?, status),
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE business_id = ?
        AND integration_type = 'email'
        AND provider = 'resend'
    `).bind(JSON.stringify(t),i,e).run()}c(Us,"saveConfig");function Xt(s,e=null,t=!1){let i=e?.name||s.sending_domain_name||"",n=e?.status||s.sending_domain_status||"not_configured",r=e?.records||s.sending_domain_records||[];return{configured:!!i,automation_available:t,domain_id:e?.id||s.sending_domain_id||null,domain_name:i,domain_status:n,records:r,verified:n==="verified",suggested_sending_email:n==="verified"&&i?`notifications@${i}`:""}}c(Xt,"domainResponse");async function sn({request:s,env:e}){try{let t=await Xi(s,e);if(!t)return Zi();let i=await en(e,t.business_id);if(!i)return Response.json({ok:!0,domain:Xt({},null,!1)});let n=Qi(i.config_json,{}),r=await tn(e,i).catch(()=>({})),a=String(r.management_api_key||"").trim(),o=null;if(a&&n.sending_domain_id)try{o=await St(a,`/domains/${encodeURIComponent(n.sending_domain_id)}`),n.sending_domain_status=o?.status||n.sending_domain_status,n.sending_domain_records=o?.records||n.sending_domain_records||[],o?.status==="verified"&&o?.name&&!n.from_email&&(n.from_email=`notifications@${o.name}`),await Us(e,t.business_id,n)}catch(u){console.error("Unable to refresh Resend domain:",u)}return Response.json({ok:!0,domain:Xt(n,o,!!a)})}catch(t){return console.error("Email domain GET failed:",t),Response.json({ok:!1,error:"Unable to load the sending-domain setup."},{status:500})}}c(sn,"onRequestGet");async function nn({request:s,env:e}){try{let t=await Xi(s,e);if(!t)return Zi();let i=await en(e,t.business_id);if(!i)return Vt("Connect Resend before setting up a sending domain.");let n=await tn(e,i),r=String(n.management_api_key||"").trim();if(!r)return Response.json({ok:!1,error:"This existing installation does not yet have the guided-domain credential. Add and verify the domain in Resend manually for this test installation. New installations created after the provisioner update can complete the full domain setup inside Eselram."},{status:409});let a=Qi(i.config_json,{}),o=await s.json().catch(()=>({})),u=String(o.action||"").trim();if(u==="create"){let d=Gc(o.domain);if(!Yc(d))return Vt("Enter a domain you own, for example yourclinic.co.uk.");let l;try{l=await St(r,"/domains",{method:"POST",body:JSON.stringify({name:d})})}catch(p){let m=await St(r,"/domains").catch(()=>null),_=Array.isArray(m?.data)?m.data.find(g=>String(g?.name||"").toLowerCase()===d):null;if(!_)throw p;l=await St(r,`/domains/${encodeURIComponent(_.id)}`)}return a.sending_domain_id=l.id,a.sending_domain_name=l.name||d,a.sending_domain_status=l.status||"pending",a.sending_domain_records=l.records||[],a.from_email=l.status==="verified"?`notifications@${l.name||d}`:"",await Us(e,t.business_id,a,"configured"),Response.json({ok:!0,domain:Xt(a,l,!0)})}if(u==="verify"){let d=String(o.domain_id||a.sending_domain_id||"").trim();if(!d)return Vt("Set up a sending domain first.");await St(r,`/domains/${encodeURIComponent(d)}/verify`,{method:"POST"});let l=await St(r,`/domains/${encodeURIComponent(d)}`);return a.sending_domain_id=l.id||d,a.sending_domain_name=l.name||a.sending_domain_name||"",a.sending_domain_status=l.status||"pending",a.sending_domain_records=l.records||a.sending_domain_records||[],a.sending_domain_status==="verified"&&a.sending_domain_name&&(a.from_email=a.from_email||`notifications@${a.sending_domain_name}`),await Us(e,t.business_id,a,"configured"),Response.json({ok:!0,domain:Xt(a,l,!0)})}return Vt("Unknown domain setup action.")}catch(t){return console.error("Resend domain setup failed:",t),Response.json({ok:!1,error:t?.message||"Unable to update the Resend sending domain."},{status:t?.status&&t.status<500?t.status:500})}}c(nn,"onRequestPost");async function Bs(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.business_id,
        b.name AS business_name,
        b.email AS business_email
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN businesses b ON b.id = u.business_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(Bs,"userContext");function qs(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(qs,"unauthorized");function rn(s,e={}){try{return s?JSON.parse(s):e}catch{return e}}c(rn,"parseJson");var Kc="https://www.googleapis.com/auth/gmail.send";function zc(s){return String(s||"").split(/\s+/).map(e=>e.trim()).filter(Boolean).includes(Kc)}c(zc,"hasRequiredGmailScope");async function Zt(s){return!!await s.DB.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = 'business_email_connections'
        LIMIT 1
      `).first()}c(Zt,"gmailTableReady");async function an(s,e){return await Zt(s)?await s.DB.prepare(`
      SELECT
        encrypted_credentials,
        config_json,
        status,
        last_tested_at,
        last_error
      FROM business_email_connections
      WHERE business_id = ? AND provider = 'gmail'
      LIMIT 1
    `).bind(e).first():null}c(an,"row");async function on({request:s,env:e}){let t=await Bs(s,e);if(!t)return qs();if(!await Zt(e))return Response.json({ok:!0,gmail:{connected:!1,email:"",sender_name:t.business_name||"",status:"migration_required",active:!1,migration_required:!0,last_tested_at:null,last_error:null}});let n=await an(e,t.business_id),r="",a=t.business_name||"",o=!1;if(n?.encrypted_credentials)try{let l=rn(await we(n.encrypted_credentials,e.ESELRAM_ENCRYPTION_KEY),{}),p=rn(n.config_json,{});r=String(p.email||l.email||"").trim(),a=String(p.sender_name||a).trim(),o=zc(l.scope)}catch{}let u=!!(n?.encrypted_credentials&&(n?.status==="reconnect_required"||!o)),d=await e.DB.prepare(`
      SELECT setting_value
      FROM business_settings
      WHERE business_id = ?
        AND setting_key = 'email_active_provider'
      LIMIT 1
    `).bind(t.business_id).first();return Response.json({ok:!0,gmail:{connected:!!(n?.encrypted_credentials&&r&&o&&n?.status!=="reconnect_required"),permission_required:u,email:r,sender_name:a,status:n?.status||"not_configured",active:d?.setting_value==="gmail",last_tested_at:n?.last_tested_at||null,last_error:n?.last_error||null}})}c(on,"onRequestGet");async function cn({request:s,env:e}){let t=await Bs(s,e);if(!t)return qs();if(!await Zt(e))return Response.json({ok:!1,error:"Gmail support is not ready in this installation yet. Apply database migration 036, then try again."},{status:409});let i=await s.json().catch(()=>({}));return String(i.action||"").trim()!=="use"?Response.json({ok:!1,error:"Unknown Gmail action."},{status:400}):(await an(e,t.business_id))?.encrypted_credentials?(await pt(e,t.business_id,"gmail"),Response.json({ok:!0})):Response.json({ok:!1,error:"Connect Gmail first."},{status:409})}c(cn,"onRequestPost");async function un({request:s,env:e}){let t=await Bs(s,e);return t?await Zt(e)?(await e.DB.prepare(`
      DELETE FROM business_email_connections
      WHERE business_id = ? AND provider = 'gmail'
    `).bind(t.business_id).run(),Response.json({ok:!0})):Response.json({ok:!0}):qs()}c(un,"onRequestDelete");async function dn(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT u.business_id
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(dn,"userContext");async function ln({request:s,env:e}){let t=await dn(s,e);if(!t)return Response.json({ok:!1,error:"Authentication required."},{status:401});let i=await e.DB.prepare(`
      SELECT setting_value
      FROM business_settings
      WHERE business_id = ?
        AND setting_key = 'email_active_provider'
      LIMIT 1
    `).bind(t.business_id).first();return Response.json({ok:!0,active_provider:i?.setting_value||"gmail"})}c(ln,"onRequestGet");async function pn({request:s,env:e}){let t=await dn(s,e);if(!t)return Response.json({ok:!1,error:"Authentication required."},{status:401});let i=await s.json().catch(()=>({})),n=String(i.provider||"").trim().toLowerCase();return["resend","gmail"].includes(n)?(await pt(e,t.business_id,n),Response.json({ok:!0,active_provider:n})):Response.json({ok:!1,error:"Choose Gmail or Resend."},{status:400})}c(pn,"onRequestPost");async function Bt(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id,
        b.currency

      FROM user_sessions s

      JOIN users u
        ON u.id =
           s.user_id

      JOIN businesses b
        ON b.id =
           u.business_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(
          s.expires_at
        ) > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(Bt,"getUserContext");function qt(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(qt,"unauthorized");function Qe(s){return Response.json({ok:!1,error:s},{status:400})}c(Qe,"badRequest");function Hs(s,e={}){if(!s)return e;try{return JSON.parse(s)}catch{return e}}c(Hs,"parseJson");async function Fs(s,e){return await s.DB.prepare(`
      SELECT
        id,
        provider,
        encrypted_credentials,
        config_json,
        status,
        last_tested_at,
        last_error,
        created_at,
        updated_at

      FROM business_integrations

      WHERE
        business_id = ?
        AND integration_type =
            'payments'

      LIMIT 1
    `).bind(e).first()}c(Fs,"getIntegration");async function js({env:s,businessId:e,connectionStatus:t,environment:i,externalAccountReference:n=null,webhookStatus:r="not_configured",makeDefault:a=!1}){a&&await s.DB.prepare(`
        UPDATE business_payment_providers

        SET
          is_default = 0,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE business_id = ?
      `).bind(e).run(),await s.DB.prepare(`
      INSERT INTO business_payment_providers (
        id,
        business_id,
        provider_key,
        is_enabled,
        is_default,
        connection_status,
        environment,
        external_account_reference,
        webhook_status,
        last_sync_at
      )

      VALUES (
        ?,
        ?,
        'stripe',
        1,
        ?,
        ?,
        ?,
        ?,
        ?,
        CURRENT_TIMESTAMP
      )

      ON CONFLICT(
        business_id,
        provider_key
      )

      DO UPDATE SET
        is_enabled = 1,
        is_default =
          excluded.is_default,
        connection_status =
          excluded.connection_status,
        environment =
          excluded.environment,
        external_account_reference =
          excluded.external_account_reference,
        webhook_status =
          excluded.webhook_status,
        last_sync_at =
          CURRENT_TIMESTAMP,
        updated_at =
          CURRENT_TIMESTAMP
    `).bind(`payprov_${crypto.randomUUID()}`,e,a?1:0,t,i,n,r).run()}c(js,"upsertStripeProvider");async function _n({request:s,env:e}){try{let t=await Bt(s,e);if(!t)return qt();let n=`${new URL(s.url).origin}/api/payments/stripe/webhook?business_id=${encodeURIComponent(t.business_id)}`,r=await Fs(e,t.business_id),a=await e.DB.prepare(`
          SELECT
            is_enabled,
            is_default,
            connection_status,
            environment,
            external_account_reference,
            webhook_status,
            last_sync_at

          FROM business_payment_providers

          WHERE
            business_id = ?
            AND provider_key =
                'stripe'

          LIMIT 1
        `).bind(t.business_id).first(),o=await e.DB.prepare(`
          SELECT
            is_enabled,
            is_default,
            connection_status
          FROM business_payment_providers
          WHERE
            business_id = ?
            AND provider_key = 'manual'
          LIMIT 1
        `).bind(t.business_id).first();if(!r)return Response.json({ok:!0,integration:{provider:"stripe",status:"not_configured",has_secret_key:!1,has_webhook_secret:!1,publishable_key:"",currency:t.currency||"GBP",mode:"unknown",is_default:o?.is_enabled===1&&o?.is_default===1?!1:a?.is_default===1,default_provider:o?.is_enabled===1&&o?.is_default===1?"manual":a?.is_default===1?"stripe":null,manual_enabled:o?.is_enabled===1,manual_is_default:o?.is_default===1,connection_status:a?.connection_status||"not_connected",webhook_status:a?.webhook_status||"not_configured",last_tested_at:null,last_error:null,webhook_url:n},encryption_ready:!!String(e.ESELRAM_ENCRYPTION_KEY||"").trim()});let u=Hs(r.config_json,{});return Response.json({ok:!0,integration:{provider:"stripe",status:r.status,has_secret_key:!!r.encrypted_credentials,has_webhook_secret:!!u.has_webhook_secret,publishable_key:u.publishable_key||"",currency:u.currency||t.currency||"GBP",mode:u.mode||a?.environment||"unknown",is_default:o?.is_enabled===1&&o?.is_default===1?!1:a?.is_default===1,default_provider:o?.is_enabled===1&&o?.is_default===1?"manual":a?.is_default===1?"stripe":null,manual_enabled:o?.is_enabled===1,manual_is_default:o?.is_default===1,connection_status:a?.connection_status||"not_connected",webhook_status:a?.webhook_status||"not_configured",last_tested_at:r.last_tested_at,last_error:r.last_error,webhook_url:n,connected_account_id:u.connected_account_id||a?.external_account_reference||null,connected_via:u.connected_via||null,provisioned_connection:!!(r.encrypted_credentials&&(a?.connection_status==="connected"||u.connected_via==="provisioner"))},encryption_ready:!!String(e.ESELRAM_ENCRYPTION_KEY||"").trim()})}catch(t){return console.error("Stripe integration GET failed:",t),Response.json({ok:!1,error:"Unable to load Stripe settings."},{status:500})}}c(_n,"onRequestGet");async function mn({request:s,env:e}){try{let t=await Bt(s,e);if(!t)return qt();let i=await s.json();return String(i.default_provider||"")!=="manual"?Qe("Only Pay in person can be selected here without connecting Stripe."):(await e.DB.prepare(`
      UPDATE business_payment_providers
      SET is_default = 0
      WHERE business_id = ?
    `).bind(t.business_id).run(),(await e.DB.prepare(`
      UPDATE business_payment_providers
      SET is_enabled = 1,
          is_default = 1,
          connection_status = 'connected',
          environment = 'live',
          webhook_status = 'configured'
      WHERE business_id = ? AND provider_key = 'manual'
    `).bind(t.business_id).run())?.meta?.changes||await e.DB.prepare(`
        INSERT INTO business_payment_providers (
          id, business_id, provider_key, is_enabled, is_default,
          connection_status, environment, webhook_status
        ) VALUES (?, ?, 'manual', 1, 1, 'connected', 'live', 'configured')
      `).bind(`payprov_${crypto.randomUUID()}`,t.business_id).run(),Response.json({ok:!0,default_provider:"manual"}))}catch(t){return console.error("Manual payment default update failed:",t),Response.json({ok:!1,error:"Unable to set Pay in person as the default payment method."},{status:500})}}c(mn,"onRequestPatch");async function fn({request:s,env:e}){try{let t=await Bt(s,e);if(!t)return qt();if(!String(e.ESELRAM_ENCRYPTION_KEY||"").trim())return Response.json({ok:!1,error:"This Eselram installation does not have ESELRAM_ENCRYPTION_KEY configured."},{status:503});let i=await s.json(),n=String(i.secret_key||"").trim(),r=String(i.publishable_key||"").trim(),a=String(i.webhook_secret||"").trim(),o=String(i.currency||t.currency||"GBP").trim().toUpperCase(),u=i.make_default===!0;if(r&&!r.startsWith("pk_"))return Qe("The Stripe publishable key does not look valid.");if(n&&!(n.startsWith("sk_test_")||n.startsWith("sk_live_")||n.startsWith("rk_test_")||n.startsWith("rk_live_")))return Qe("The Stripe secret or restricted key does not look valid.");if(a&&!a.startsWith("whsec_"))return Qe("The Stripe webhook signing secret does not look valid.");let d=await Fs(e,t.business_id),l={};if(d?.encrypted_credentials)try{l=JSON.parse(await we(d.encrypted_credentials,e.ESELRAM_ENCRYPTION_KEY))}catch(b){if(console.error("Unable to decrypt existing Stripe credentials:",b),!n)return Response.json({ok:!1,error:"The saved Stripe credentials cannot be read. Paste the Stripe key again."},{status:503})}let p=n||String(l.secret_key||"").trim(),m=a||String(l.webhook_secret||"").trim();if(!p)return Qe("A Stripe secret or restricted API key is required.");let _=p.includes("_live_")?"live":"sandbox",g=await Ze(JSON.stringify({secret_key:p,webhook_secret:m||null}),e.ESELRAM_ENCRYPTION_KEY),E=JSON.stringify({publishable_key:r||Hs(d?.config_json,{}).publishable_key||"",currency:o,mode:_,has_webhook_secret:!!m});d?await e.DB.prepare(`
          UPDATE business_integrations

          SET
            provider = 'stripe',
            encrypted_credentials = ?,
            config_json = ?,
            status = 'configured',
            last_error = NULL,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            business_id = ?
            AND integration_type =
                'payments'
        `).bind(g,E,t.business_id).run():await e.DB.prepare(`
          INSERT INTO business_integrations (
            id,
            business_id,
            integration_type,
            provider,
            encrypted_credentials,
            config_json,
            status
          )

          VALUES (
            ?,
            ?,
            'payments',
            'stripe',
            ?,
            ?,
            'configured'
          )
        `).bind(`bi_${crypto.randomUUID()}`,t.business_id,g,E).run();let f=await e.DB.prepare(`
          SELECT connection_status
          FROM business_payment_providers
          WHERE business_id = ?
            AND provider_key = 'stripe'
          LIMIT 1
        `).bind(t.business_id).first();return await js({env:e,businessId:t.business_id,connectionStatus:f?.connection_status==="connected"?"connected":"not_connected",environment:_,webhookStatus:m?"configured":"not_configured",makeDefault:u}),Response.json({ok:!0,integration:{provider:"stripe",status:"configured",has_secret_key:!0,has_webhook_secret:!!m,publishable_key:r,currency:o,mode:_}})}catch(t){return console.error("Stripe integration PUT failed:",t),Response.json({ok:!1,error:"Unable to save Stripe settings."},{status:500})}}c(fn,"onRequestPut");async function bn({request:s,env:e}){try{let t=await Bt(s,e);if(!t)return qt();let i=await s.json();if(String(i.action||"")!=="test")return Qe("Invalid Stripe integration action.");let n=await Fs(e,t.business_id);if(!n||!n.encrypted_credentials)return Qe("Save the Stripe settings before testing the connection.");let r;try{r=JSON.parse(await we(n.encrypted_credentials,e.ESELRAM_ENCRYPTION_KEY))}catch(p){return console.error("Stripe credential decrypt failed:",p),Response.json({ok:!1,error:"The stored Stripe credentials cannot be read. Save the Stripe key again."},{status:503})}let a=String(r.secret_key||"").trim();if(!a)return Qe("The stored Stripe API key is missing.");let o=await fetch("https://api.stripe.com/v1/balance",{method:"GET",headers:{Authorization:`Bearer ${a}`}}),u={};try{u=await o.json()}catch{u={}}if(!o.ok){let p=String(u?.error?.message||"Stripe rejected the API key.");return await e.DB.prepare(`
          UPDATE business_integrations

          SET
            status = 'error',
            last_tested_at =
              CURRENT_TIMESTAMP,
            last_error = ?,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            business_id = ?
            AND integration_type =
                'payments'
        `).bind(p.slice(0,1e3),t.business_id).run(),await js({env:e,businessId:t.business_id,connectionStatus:"error",environment:a.includes("_live_")?"live":"sandbox",webhookStatus:r.webhook_secret?"configured":"not_configured",makeDefault:!1}),Response.json({ok:!1,error:p},{status:502})}let d=Hs(n.config_json,{}),l=u.livemode?"live":"sandbox";return await e.DB.prepare(`
        UPDATE business_integrations

        SET
          status = 'verified',
          config_json = ?,
          last_tested_at =
            CURRENT_TIMESTAMP,
          last_error = NULL,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          business_id = ?
          AND integration_type =
              'payments'
      `).bind(JSON.stringify({...d,mode:l,last_balance_currency:u.available?.[0]?.currency?.toUpperCase?.()||d.currency||t.currency||"GBP"}),t.business_id).run(),await js({env:e,businessId:t.business_id,connectionStatus:"connected",environment:l,webhookStatus:r.webhook_secret?"configured":"not_configured",makeDefault:!0}),Response.json({ok:!0,message:`Stripe connection verified in ${l==="live"?"live":"test"} mode.`,stripe:{livemode:!!u.livemode,available_currencies:[...new Set((u.available||[]).map(p=>String(p.currency||"").toUpperCase()).filter(Boolean))]}})}catch(t){return console.error("Stripe integration test failed:",t),Response.json({ok:!1,error:t?.message||"Unable to test Stripe connection."},{status:500})}}c(bn,"onRequestPost");async function gn({request:s,env:e}){try{let t=await Bt(s,e);return t?(await e.DB.prepare(`
        DELETE FROM business_integrations

        WHERE
          business_id = ?
          AND integration_type =
              'payments'
      `).bind(t.business_id).run(),await e.DB.prepare(`
        UPDATE business_payment_providers

        SET
          is_enabled = 0,
          is_default = 0,
          connection_status =
            'not_connected',
          external_account_reference =
            NULL,
          webhook_status =
            'not_configured',
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          business_id = ?
          AND provider_key =
              'stripe'
      `).bind(t.business_id).run(),await e.DB.prepare(`
        INSERT INTO business_payment_providers (
          id,
          business_id,
          provider_key,
          is_enabled,
          is_default,
          connection_status,
          environment,
          webhook_status
        )

        VALUES (
          ?,
          ?,
          'manual',
          1,
          1,
          'connected',
          'live',
          'configured'
        )

        ON CONFLICT(
          business_id,
          provider_key
        )

        DO UPDATE SET
          is_enabled = 1,
          is_default = 1,
          connection_status =
            'connected',
          webhook_status =
            'configured',
          updated_at =
            CURRENT_TIMESTAMP
      `).bind(`payprov_${crypto.randomUUID()}`,t.business_id).run(),Response.json({ok:!0})):qt()}catch(t){return console.error("Stripe integration DELETE failed:",t),Response.json({ok:!1,error:"Unable to disconnect Stripe."},{status:500})}}c(gn,"onRequestDelete");async function Q(s,e){let t=await s.DB.prepare(`
        SELECT
          id,
          provider,
          encrypted_credentials,
          config_json,
          status,
          last_tested_at,
          last_error

        FROM business_integrations

        WHERE
          business_id = ?
          AND integration_type = 'payments'
          AND provider = 'stripe'

        LIMIT 1
      `).bind(e).first();if(!t||!t.encrypted_credentials)return{error:"Stripe is not configured for this business."};if(!String(s.ESELRAM_ENCRYPTION_KEY||"").trim())return{error:"ESELRAM_ENCRYPTION_KEY is not configured."};let i,n={};try{i=JSON.parse(await we(t.encrypted_credentials,s.ESELRAM_ENCRYPTION_KEY)),n=JSON.parse(t.config_json||"{}")}catch(a){return console.error("Unable to decrypt Stripe integration:",a),{error:"The Stripe integration could not be read. Reconnect Stripe in Settings."}}let r=String(i.secret_key||"").trim();return r?{row:t,credentials:i,config:n,secretKey:r,webhookSecret:String(i.webhook_secret||"").trim()}:{error:"The saved Stripe server-side key is missing."}}c(Q,"getBusinessStripeIntegration");async function X({secretKey:s,path:e,method:t="GET",body:i=null}){let n={method:t,headers:{Authorization:`Bearer ${s}`}};i&&(n.headers["Content-Type"]="application/x-www-form-urlencoded",n.body=i instanceof URLSearchParams?i.toString():String(i));let r=await fetch(`https://api.stripe.com${e}`,n),a={};try{a=await r.json()}catch{a={}}return{response:r,data:a}}c(X,"stripeRequest");function be(s,e="Stripe rejected the request."){return String(s?.error?.message||s?.message||e)}c(be,"stripeErrorMessage");var En="payment_vouchers";function Qt(s){return String(s||"").trim().toUpperCase().replace(/\s+/g,"")}c(Qt,"cleanCode");async function Ws(s,e){let t=await s.DB.prepare(`
    SELECT setting_value
    FROM business_settings
    WHERE business_id = ? AND setting_key = ?
    LIMIT 1
  `).bind(e,En).first();if(!t?.setting_value)return[];try{let i=JSON.parse(t.setting_value);return Array.isArray(i)?i:[]}catch{return[]}}c(Ws,"getPaymentVouchers");async function hn(s,e,t){let i=(Array.isArray(t)?t:[]).map(r=>({id:String(r.id||`vch_${crypto.randomUUID()}`),code:Qt(r.code),name:String(r.name||r.code||"Voucher").trim().slice(0,80),discount_type:r.discount_type==="percent"?"percent":"amount",value:Math.max(0,Number(r.value||0)),is_active:r.is_active!==!1})).filter(r=>r.code&&r.value>0),n=new Set;for(let r of i){if(n.has(r.code))throw new Error(`Voucher code ${r.code} is duplicated.`);if(n.add(r.code),r.discount_type==="percent"&&r.value>100)throw new Error(`Voucher ${r.code} cannot exceed 100%.`)}return await s.DB.prepare(`
    INSERT INTO business_settings (
      id, business_id, setting_key, setting_value, value_type
    ) VALUES (?, ?, ?, ?, 'json')
    ON CONFLICT(business_id, setting_key)
    DO UPDATE SET
      setting_value = excluded.setting_value,
      value_type = 'json',
      updated_at = CURRENT_TIMESTAMP
  `).bind(`set_${crypto.randomUUID()}`,e,En,JSON.stringify(i)).run(),i}c(hn,"savePaymentVouchers");async function mt({env:s,businessId:e,baseAmountMinor:t,deduction:i}){let n=Math.max(0,Math.round(Number(t||0))),r=i&&typeof i=="object"?i:{},a=String(r.type||"none").trim().toLowerCase();if(!n||a==="none"||!a)return{discountMinor:0,type:"none",label:"",voucher:null};let o=0,u="",d=null;if(a==="amount")o=Math.max(0,Math.round(Number(r.amount_minor||0))),u=r.label?String(r.label).trim().slice(0,120):"Manual deduction";else if(a==="percent"){let l=Number(r.percent||0);if(!Number.isFinite(l)||l<=0||l>100)throw new Error("Enter a discount percentage between 0 and 100.");o=Math.round(n*l/100),u=`${l}% discount`}else if(a==="voucher"){let l=await Ws(s,e),p=String(r.voucher_id||"").trim(),m=Qt(r.voucher_code);if(d=l.find(_=>_.is_active!==!1&&(p&&_.id===p||m&&Qt(_.code)===m)),!d)throw new Error("Choose an active voucher.");d.discount_type==="percent"?(o=Math.round(n*Number(d.value||0)/100),u=`${d.code} \xB7 ${d.value}% voucher`):(o=Math.round(Number(d.value||0)*100),u=`${d.code} \xB7 voucher`)}else throw new Error("Choose a valid deduction type.");if(o=Math.min(o,n),o<=0)return{discountMinor:0,type:"none",label:"",voucher:null};if(o>=n)throw new Error("The deduction must leave an amount to collect. For a fully discounted balance, record it manually instead.");return{discountMinor:o,type:a,label:u,voucher:d}}c(mt,"calculatePaymentDeduction");async function Rt({env:s,businessId:e,paymentId:t,appointmentId:i=null,customerId:n,customerPackageId:r=null,paymentType:a,currency:o,discountMinor:u,deductionType:d,label:l,voucher:p=null,status:m="pending"}){let _=Math.max(0,Math.round(Number(u||0)));if(!_)return null;let g=String(o||"GBP").toUpperCase(),E=new Intl.NumberFormat("en-GB",{style:"currency",currency:g}).format(_/100),f=String(l||"").replace(/[\r\n]+/g," ").trim(),b=p?.code?Qt(p.code):"",N=p?.discount_type==="percent"?"percent":"amount",v=Number(p?.value||0),h=[d==="voucher"?`${E} voucher discount${b?` \xB7 ${b}`:""}${N==="percent"?` \xB7 ${v}%`:""}`:d==="percent"?`${E} discount${f?` \xB7 ${f}`:""}`:`${E} deduction${f?` \xB7 ${f}`:""}`,`discount_minor=${_}`,`deduction_type=${String(d||"amount")}`,b?`voucher=${b}`:"",f?`label=${f}`:""].filter(Boolean).join(" \xB7 ");return await s.DB.prepare(`
    UPDATE payments
    SET
      notes = CASE
        WHEN COALESCE(notes, '') = '' THEN ?
        WHEN instr(COALESCE(notes, ''), 'discount_minor=') > 0 THEN notes
        ELSE notes || ' \xB7 ' || ?
      END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND business_id = ?
  `).bind(h,h,t,e).run(),t}c(Rt,"createDiscountAdjustment");function Vc(s){let e=String(s||"").match(/discount_minor=(\d+)/);return Math.max(0,Number(e?.[1]||0))}c(Vc,"readDiscountMinor");async function ge({env:s,businessId:e,paymentId:t,status:i,customerPackageId:n=null}){if(await s.DB.prepare(`
    DELETE FROM payments
    WHERE business_id = ?
      AND provider = 'none'
      AND payment_method = 'discount'
      AND notes LIKE ?
  `).bind(e,`Discount adjustment for payment=${t}%`).run(),i!=="paid")return;let r=await s.DB.prepare(`
    SELECT id, appointment_id, notes
    FROM payments
    WHERE id = ? AND business_id = ?
    LIMIT 1
  `).bind(t,e).first(),a=Vc(r?.notes);a&&(String(r?.notes||"").includes("discount_balance_applied=1")||(n?await s.DB.prepare(`
      UPDATE customer_packages
      SET
        price_minor = MAX(price_minor - ?, 0),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(a,n,e).run():r?.appointment_id&&await s.DB.prepare(`
      UPDATE appointments
      SET
        price_minor = MAX(price_minor - ?, 0),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(a,r.appointment_id,e).run(),await s.DB.prepare(`
    UPDATE payments
    SET
      notes = COALESCE(notes, '') || ' \xB7 discount_balance_applied=1',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND business_id = ?
  `).bind(t,e).run()))}c(ge,"setDiscountAdjustmentStatus");async function Xc(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id,
        b.name AS business_name,
        b.currency,
        b.website

      FROM user_sessions s

      JOIN users u
        ON u.id =
           s.user_id

      JOIN businesses b
        ON b.id =
           u.business_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(
          s.expires_at
        ) > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(Xc,"getUserContext");function Zc(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Zc,"unauthorized");function et(s){return Response.json({ok:!1,error:s},{status:400})}c(et,"badRequest");async function Qc(s,e,t){return await s.DB.prepare(`
      SELECT
        a.id,
        a.business_id,
        a.customer_id,
        a.service_id,
        a.status,
        a.start_at,
        a.price_minor,
        a.deposit_due_minor,
        a.consultation_credit_minor,

        c.first_name,
        c.last_name,
        c.email,

        s.name AS service_name,
        s.payment_timing,
        s.deposit_minor

      FROM appointments a

      JOIN customers c
        ON c.id =
           a.customer_id

      JOIN services s
        ON s.id =
           a.service_id

      WHERE
        a.id = ?
        AND a.business_id = ?

      LIMIT 1
    `).bind(t,e).first()}c(Qc,"getAppointment");async function yn(s,e,t){let i=await s.DB.prepare(`
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN
                  payment_type = 'refund'
                  AND status = 'paid'
                THEN -ABS(amount_minor)

                WHEN
                  payment_type != 'refund'
                  AND status IN (
                    'paid',
                    'refunded',
                    'partially_refunded'
                  )
                THEN amount_minor

                ELSE 0
              END
            ),
            0
          ) AS net_paid

        FROM payments

        WHERE
          business_id = ?
          AND appointment_id = ?
      `).bind(e,t).first();return Math.max(0,Number(i?.net_paid||0))}c(yn,"getNetPaid");async function eu({env:s,integration:e,businessId:t,appointmentId:i,plan:n}){let r=await s.DB.prepare(`
        SELECT
          id,
          payment_type,
          amount_minor,
          currency,
          provider_reference

        FROM payments

        WHERE
          business_id = ?
          AND appointment_id = ?
          AND provider = 'stripe'
          AND status = 'pending'
          AND provider_reference IS NOT NULL
          AND provider_reference != ''

        ORDER BY
          datetime(created_at) DESC

        LIMIT 1
      `).bind(t,i).first();if(!r)return{checkout:null,paymentStateChanged:!1};let a=await X({secretKey:e.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(r.provider_reference)}`});if(a.response.ok&&a.data?.status==="open"&&a.data?.url){let o=Number(r.amount_minor||0)===Number(n.amountMinor||0),u=String(r.payment_type||"")===String(n.paymentType||"");if(o&&u)return{checkout:{payment_id:r.id,session_id:a.data.id,url:a.data.url,amount_minor:Number(r.amount_minor||0),currency:String(r.currency||"GBP").toUpperCase(),payment_type:r.payment_type},paymentStateChanged:!1};try{await X({secretKey:e.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(r.provider_reference)}/expire`,method:"POST",body:new URLSearchParams})}catch(d){console.error("Unable to expire superseded Stripe Checkout:",d)}return await s.DB.prepare(`
        UPDATE payments

        SET
          status = 'failed',
          notes = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
          AND status = 'pending'
      `).bind(`Superseded Stripe Checkout. Previous ${String(r.payment_type||"payment")} ${Number(r.amount_minor||0)}; current ${String(n.paymentType||"payment")} ${Number(n.amountMinor||0)}.`,r.id,t).run(),await ge({env:s,businessId:t,paymentId:r.id,status:"failed"}),{checkout:null,paymentStateChanged:!0}}if(a.response.ok&&(a.data?.status==="expired"||a.data?.status==="complete")){let o=a.data.status==="complete"&&a.data.payment_status==="paid";return await s.DB.prepare(`
        UPDATE payments

        SET
          status =
            CASE
              WHEN ?
              THEN 'paid'
              ELSE 'failed'
            END,

          paid_at =
            CASE
              WHEN ?
              THEN COALESCE(
                paid_at,
                CURRENT_TIMESTAMP
              )
              ELSE paid_at
            END,

          notes =
            CASE
              WHEN ?
              THEN CASE
                WHEN instr(COALESCE(notes, ''), 'Stripe Checkout payment confirmed while checking existing session') > 0
                  THEN notes
                WHEN COALESCE(notes, '') = ''
                  THEN 'Stripe Checkout payment confirmed while checking existing session'
                ELSE notes || ' \xB7 Stripe Checkout payment confirmed while checking existing session'
              END
              ELSE CASE
                WHEN COALESCE(notes, '') = ''
                  THEN 'Stripe Checkout session is no longer payable'
                ELSE notes || ' \xB7 Stripe Checkout session is no longer payable'
              END
            END,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
          AND status = 'pending'
      `).bind(o?1:0,o?1:0,o?1:0,r.id,t).run(),await ge({env:s,businessId:t,paymentId:r.id,status:o?"paid":"failed"}),{checkout:null,paymentStateChanged:!0}}return await s.DB.prepare(`
      UPDATE payments

      SET
        status = 'failed',
        notes =
          'Stripe Checkout could not be verified and was superseded.',
        updated_at =
          CURRENT_TIMESTAMP

      WHERE
        id = ?
        AND business_id = ?
        AND status = 'pending'
    `).bind(r.id,t).run(),await ge({env:s,businessId:t,paymentId:r.id,status:"failed"}),{checkout:null,paymentStateChanged:!0}}c(eu,"getReusablePendingCheckout");function kn(s,e){let t=Math.max(0,Number(s.price_minor||0)),i=Math.max(0,Number(s.consultation_credit_minor||0)),n=Math.max(0,Number(s.deposit_due_minor??s.deposit_minor??0));if(s.payment_timing==="free"||t<=0)return{error:"This appointment does not require payment."};if(s.payment_timing==="online_deposit"&&e<n)return{paymentType:"deposit",amountMinor:Math.max(0,n-e),label:`${s.service_name} deposit`};let r=Math.max(0,t-i-e);return r<=0?{error:"This appointment has already been paid in full."}:{paymentType:e>0||i>0?"balance":"full",amountMinor:r,label:e>0||i>0?`${s.service_name} balance`:s.service_name}}c(kn,"getChargePlan");function tu(s){let e=String(s||"").trim();if(!e)return"";let t;try{t=new URL(e)}catch{try{t=new URL(`https://${e}`)}catch{return""}}return["http:","https:"].includes(t.protocol)?t.toString():""}c(tu,"safeBusinessWebsite");async function Sn({request:s,env:e}){try{let t=await Xc(s,e);if(!t)return Zc();let i=await s.json(),n=String(i.appointment_id||"").trim();if(!n)return et("Appointment id is required.");let r=await Qc(e,t.business_id,n);if(!r)return Response.json({ok:!1,error:"Appointment not found."},{status:404});if(r.status==="cancelled")return et("A payment link cannot be created for a cancelled appointment.");if(!r.email)return et("Add an email address to the customer before creating a Stripe Checkout link.");let a=await Q(e,t.business_id);if(a.error)return Response.json({ok:!1,error:a.error},{status:503});if(a.row.status!=="verified")return et("Test the Stripe connection in Settings \u2192 Payments before creating Checkout links.");let o=await yn(e,t.business_id,r.id),u=kn(r,o);if(u.error)return et(u.error);let d;try{d=await mt({env:e,businessId:t.business_id,baseAmountMinor:u.amountMinor,deduction:i.deduction})}catch(h){return et(h.message||"Unable to apply deduction.")}let l=u.amountMinor,p={...u,amountMinor:Math.max(0,u.amountMinor-d.discountMinor)},m=await eu({env:e,integration:a,businessId:t.business_id,appointmentId:r.id,plan:p});if(m.checkout)return Response.json({ok:!0,reused:!0,checkout:{...m.checkout,customer_email:r.email}});if(m.paymentStateChanged){if(o=await yn(e,t.business_id,r.id),u=kn(r,o),u.error)return et(u.error);try{d=await mt({env:e,businessId:t.business_id,baseAmountMinor:u.amountMinor,deduction:i.deduction})}catch(h){return et(h.message||"Unable to apply deduction.")}p={...u,amountMinor:Math.max(0,u.amountMinor-d.discountMinor)}}let _=`pay_${crypto.randomUUID()}`,g=String(a.config.currency||t.currency||"GBP").toLowerCase();await e.DB.prepare(`
        INSERT INTO payments (
          id,
          business_id,
          appointment_id,
          customer_id,
          provider,
          payment_type,
          amount_minor,
          currency,
          status,
          payment_method,
          notes
        )

        VALUES (
          ?,
          ?,
          ?,
          ?,
          'stripe',
          ?,
          ?,
          ?,
          'pending',
          'card',
          'Stripe Checkout session created'
        )
      `).bind(_,t.business_id,r.id,r.customer_id,u.paymentType,p.amountMinor,g.toUpperCase()).run(),await Rt({env:e,businessId:t.business_id,paymentId:_,appointmentId:r.id,customerId:r.customer_id,paymentType:u.paymentType,currency:g,discountMinor:d.discountMinor,deductionType:d.type,label:d.label,voucher:d.voucher,status:"pending"});let E=new URL(s.url).origin,f=new URLSearchParams;f.set("mode","payment");let b=tu(t.website),N=new URLSearchParams({business:t.business_name||"the business",website:b});f.set("success_url",`${E}/payment-result/?status=success&session_id={CHECKOUT_SESSION_ID}&${N.toString()}`),f.set("cancel_url",`${E}/payment-result/?status=cancelled&${N.toString()}`),f.set("customer_email",r.email),f.set("client_reference_id",r.id),f.set("line_items[0][price_data][currency]",g),f.set("line_items[0][price_data][unit_amount]",String(p.amountMinor)),f.set("line_items[0][price_data][product_data][name]",d.discountMinor>0?`${u.label} (after deduction)`:u.label),f.set("line_items[0][quantity]","1"),f.set("metadata[payment_id]",_),f.set("metadata[business_id]",t.business_id),f.set("metadata[appointment_id]",r.id),d.discountMinor>0&&(f.set("metadata[discount_minor]",String(d.discountMinor)),f.set("metadata[discount_type]",d.type),d.voucher?.code&&f.set("metadata[voucher_code]",d.voucher.code)),f.set("payment_intent_data[metadata][payment_id]",_),f.set("payment_intent_data[metadata][business_id]",t.business_id),f.set("payment_intent_data[metadata][appointment_id]",r.id);let{response:v,data:S}=await X({secretKey:a.secretKey,path:"/v1/checkout/sessions",method:"POST",body:f});if(!v.ok||!S?.id||!S?.url){let h=be(S,"Unable to create Stripe Checkout.");return await e.DB.prepare(`
          UPDATE payments

          SET
            status = 'failed',
            notes = ?,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id = ?
            AND business_id = ?
        `).bind(h.slice(0,1e3),_,t.business_id).run(),Response.json({ok:!1,error:h},{status:502})}return await e.DB.prepare(`
        UPDATE payments

        SET
          provider_reference = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `).bind(S.id,_,t.business_id).run(),Response.json({ok:!0,checkout:{payment_id:_,session_id:S.id,url:S.url,amount_minor:p.amountMinor,original_amount_minor:l,discount_minor:d.discountMinor,currency:g.toUpperCase(),payment_type:u.paymentType,customer_email:r.email}})}catch(t){return console.error("Stripe Checkout creation failed:",t),Response.json({ok:!1,error:"Unable to create the Stripe Checkout link."},{status:500})}}c(Sn,"onRequestPost");async function Rn({request:s,env:e}){try{let t=new URL(s.url),i=String(t.searchParams.get("payment_id")||"").trim();if(!i.startsWith("pay_"))return new Response("Invalid payment link.",{status:400});let n=await e.DB.prepare(`
        SELECT
          id, business_id, provider_reference, status
        FROM payments
        WHERE id = ?
          AND provider = 'stripe'
          AND provider_reference IS NOT NULL
          AND provider_reference != ''
        LIMIT 1
      `).bind(i).first();if(!n)return new Response("Payment link not found.",{status:404});let r=await Q(e,n.business_id);if(r.error)return new Response("Payment link is temporarily unavailable.",{status:503});let a=await X({secretKey:r.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(n.provider_reference)}`});return!a.response.ok||!a.data?.url?new Response("Payment link has expired or is unavailable.",{status:410}):Response.redirect(a.data.url,302)}catch(t){return console.error("Stripe QR redirect failed:",t),new Response("Payment link is temporarily unavailable.",{status:500})}}c(Rn,"onRequestGet");async function su(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
    SELECT
      u.business_id,
      b.name AS business_name,
      b.website,
      b.currency
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN businesses b ON b.id = u.business_id
    WHERE
      s.token_hash = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now')
      AND u.is_active = 1
    LIMIT 1
  `).bind(i).first()}c(su,"getUserContext");function ft(s){return Response.json({ok:!1,error:s},{status:400})}c(ft,"badRequest");function iu(s){let e=String(s||"").trim();if(!e)return"";let t;try{t=new URL(e)}catch{try{t=new URL(`https://${e}`)}catch{return""}}return["http:","https:"].includes(t.protocol)?t.toString():""}c(iu,"safeBusinessWebsite");async function Nn({request:s,env:e}){try{let t=await su(s,e);if(!t)return Response.json({ok:!1,error:"Authentication required."},{status:401});let i=await s.json(),n=String(i.customer_package_id||"").trim();if(!n)return ft("Customer package is required.");let r=await e.DB.prepare(`
        SELECT
          cp.id,
          cp.customer_id,
          cp.name_snapshot,
          cp.price_minor,
          cp.status,
          c.email,

          COALESCE(
            (
              SELECT SUM(
                CASE
                  WHEN p.payment_type='refund'
                       AND p.status='paid'
                    THEN -ABS(p.amount_minor)
                  WHEN p.payment_type!='refund'
                       AND p.status IN (
                         'paid',
                         'partially_refunded',
                         'refunded'
                       )
                    THEN ABS(p.amount_minor)
                  ELSE 0
                END
              )
              FROM customer_package_payments cpp
              JOIN payments p
                ON p.id=cpp.payment_id
              WHERE cpp.customer_package_id=cp.id
                AND COALESCE(p.payment_method, '') != 'discount'
            ),
            0
          ) AS paid_minor,

          COALESCE(
            (
              SELECT SUM(ps.consultation_credit_minor)
              FROM package_sales ps
              WHERE
                ps.business_id=cp.business_id
                AND ps.customer_package_id=cp.id
                AND ps.status='paid'
            ),
            0
          ) AS consultation_credit_minor

        FROM customer_packages cp
        JOIN customers c
          ON c.id=cp.customer_id
        WHERE
          cp.id=?
          AND cp.business_id=?
        LIMIT 1
      `).bind(n,t.business_id).first();if(!r)return ft("Customer package was not found.");if(["cancelled","expired"].includes(String(r.status||"")))return ft("This package cannot accept payment.");if(!r.email)return ft("Add an email address to the customer before creating a payment link.");let a=Math.max(Number(r.price_minor||0)-Number(r.paid_minor||0)-Number(r.consultation_credit_minor||0),0);if(a<=0)return ft("This package is already fully paid.");let o;try{o=await mt({env:e,businessId:t.business_id,baseAmountMinor:a,deduction:i.deduction})}catch(b){return ft(b.message||"Unable to apply deduction.")}let u=Math.max(0,a-o.discountMinor),d=await Q(e,t.business_id);if(d.error)return Response.json({ok:!1,error:d.error},{status:503});if(d.row.status!=="verified")return ft("Test the Stripe connection in Settings \u2192 Payments before creating Checkout links.");let l=`pay_${crypto.randomUUID()}`,p=String(d.config.currency||t.currency||"GBP").toUpperCase();await e.DB.prepare(`
      INSERT INTO payments (
        id,
        business_id,
        appointment_id,
        customer_id,
        provider,
        payment_type,
        amount_minor,
        currency,
        status,
        payment_method,
        notes
      )
      VALUES (
        ?, ?, NULL, ?, 'stripe',
        'balance', ?, ?, 'pending',
        'card', ?
      )
    `).bind(l,t.business_id,r.customer_id,u,p,`Package balance: ${r.name_snapshot}${o.discountMinor>0?` \xB7 discount_minor=${o.discountMinor} \xB7 deduction_type=${o.type}${o.voucher?.code?` \xB7 voucher=${o.voucher.code}`:""}${o.label?` \xB7 label=${o.label}`:""}`:""}`).run(),await Rt({env:e,businessId:t.business_id,paymentId:l,customerId:r.customer_id,customerPackageId:n,paymentType:"balance",currency:p,discountMinor:o.discountMinor,deductionType:o.type,label:o.label,voucher:o.voucher,status:"pending"});let m=new URL(s.url).origin,_=new URLSearchParams;_.set("mode","payment");let g=iu(t.website),E=new URLSearchParams({business:t.business_name||"the business",website:g});_.set("success_url",`${m}/payment-result/?status=success&session_id={CHECKOUT_SESSION_ID}&${E.toString()}`),_.set("cancel_url",`${m}/payment-result/?status=cancelled&${E.toString()}`),_.set("customer_email",r.email),_.set("client_reference_id",n),_.set("line_items[0][price_data][currency]",p.toLowerCase()),_.set("line_items[0][price_data][unit_amount]",String(u)),_.set("line_items[0][price_data][product_data][name]",`${r.name_snapshot} balance`),_.set("line_items[0][quantity]","1"),_.set("metadata[payment_id]",l),_.set("metadata[business_id]",t.business_id),_.set("metadata[customer_package_id]",n),o.discountMinor>0&&(_.set("metadata[discount_minor]",String(o.discountMinor)),_.set("metadata[discount_type]",o.type),o.voucher?.code&&_.set("metadata[voucher_code]",o.voucher.code)),_.set("payment_intent_data[metadata][payment_id]",l),_.set("payment_intent_data[metadata][business_id]",t.business_id),_.set("payment_intent_data[metadata][customer_package_id]",n);let f=await X({secretKey:d.secretKey,path:"/v1/checkout/sessions",method:"POST",body:_});if(!f.response.ok||!f.data?.id||!f.data?.url){let b=be(f.data,"Unable to create Stripe Checkout.");return await e.DB.prepare(`
        UPDATE payments
        SET
          status='failed',
          notes=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE
          id=?
          AND business_id=?
      `).bind(b.slice(0,1e3),l,t.business_id).run(),await ge({env:e,businessId:t.business_id,paymentId:l,status:"failed"}),Response.json({ok:!1,error:b},{status:502})}return await e.DB.prepare(`
      UPDATE payments
      SET
        provider_reference=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE
        id=?
        AND business_id=?
    `).bind(f.data.id,l,t.business_id).run(),Response.json({ok:!0,checkout:{payment_id:l,session_id:f.data.id,url:f.data.url,amount_minor:u,original_amount_minor:a,discount_minor:o.discountMinor,currency:p,payment_type:"balance"}})}catch(t){return console.error("Package Stripe Checkout failed:",t),Response.json({ok:!1,error:"Unable to create package payment link."},{status:500})}}c(Nn,"onRequestPost");var $s="communications.email_templates",Tn="communications.public_booking_copy",An="communications.public_booking_patch_test_copy",Tt={booking_confirmation:{label:"Booking confirmed",description:"Sent when an appointment is confirmed.",subject:"Booking confirmed \xB7 {{service_name}}",title:"Your appointment is confirmed",intro:"Hi {{customer_name}}, your booking with {{business_name}} is confirmed.",closing:"{{default_closing}}"},appointment_reminder:{label:"Appointment reminder",description:"Sent before an upcoming appointment.",subject:"Appointment reminder \xB7 {{service_name}}",title:"A reminder about your appointment",intro:"Hi {{customer_name}}, this is a reminder about your upcoming appointment with {{business_name}}.",closing:"If you need to make a change, please contact the business."},cancellation_confirmation:{label:"Cancellation confirmation",description:"Sent when an appointment is cancelled.",subject:"Appointment cancelled \xB7 {{service_name}}",title:"Your appointment has been cancelled",intro:"Hi {{customer_name}}, your appointment with {{business_name}} has been cancelled.",closing:"Any payment or refund is handled separately and remains visible in the business payment record."},reschedule_confirmation:{label:"Appointment updated",description:"Sent when an appointment is rescheduled or updated.",subject:"Appointment updated \xB7 {{service_name}}",title:"Your appointment has been updated",intro:"Hi {{customer_name}}, your appointment with {{business_name}} has been updated.",closing:"Please keep this email for your records."},payment_receipt:{label:"Payment received",description:"Sent after a payment for an appointment is recorded.",subject:"{{default_subject}}",title:"{{default_title}}",intro:"Hi {{customer_name}}, thank you. We have received your payment.",closing:"Please keep this email for your records."},package_payment_confirmation:{label:"Package payment received",description:"Sent after a package or course payment is recorded.",subject:"{{default_subject}}",title:"{{default_title}}",intro:"Hi {{customer_name}}, thank you. We have received your payment.",closing:"Please keep this email for your records."},payment_link:{label:"Payment link",description:"Sent when the business emails a secure Stripe payment link.",subject:"Payment link \xB7 {{service_name}}",title:"Payment link",intro:"Hi {{customer_name}}, {{business_name}} has sent you a secure payment link for {{service_name}}.",closing:"Payment is processed securely by Stripe. If you have already paid, you can ignore this email."},client_form_request:{label:"Client form",description:"Sent when a customer is asked to complete a form.",subject:"{{business_name}} \u2014 {{form_name}}",title:"Please complete your form",intro:"{{business_name}} has sent you a secure {{form_name}} to complete before your appointment.",closing:"This unique link expires after 30 days and cannot be reused after submission."},client_form_reminder:{label:"Form reminder",description:"Sent as the automatic or manual reminder for any outstanding client form.",subject:"Reminder \xB7 {{business_name}} \u2014 {{form_name}}",title:"A reminder to complete your form",intro:"{{business_name}} has sent you a secure {{form_name}} to complete before your appointment.",closing:"This unique link expires after 30 days and cannot be reused after submission."}},Js={consultation:"New clients start with a consultation. The consultation is {{consultation_duration}} minutes and {{consultation_payment}}. {{consultation_credit_sentence}} {{patch_test_sentence}} {{post_consultation_sentence}}",standard:"Choose the service you would like to book."},wn="A patch test is required before the first treatment. The business will confirm the patch-test requirements with you.",Gs={booking_confirmation:{allowed:["customer_name","business_name","service_name","default_closing"],required:{intro:["customer_name","business_name"]}},appointment_reminder:{allowed:["customer_name","business_name","service_name"],required:{intro:["customer_name","business_name"]}},cancellation_confirmation:{allowed:["customer_name","business_name","service_name"],required:{intro:["customer_name","business_name"]}},reschedule_confirmation:{allowed:["customer_name","business_name","service_name"],required:{intro:["customer_name","business_name"]}},payment_receipt:{allowed:["customer_name","business_name","service_name","amount","default_subject","default_title"],required:{subject:["default_subject"],title:["default_title"],intro:["customer_name"]}},package_payment_confirmation:{allowed:["customer_name","business_name","service_name","amount","default_subject","default_title"],required:{subject:["default_subject"],title:["default_title"],intro:["customer_name"]}},payment_link:{allowed:["customer_name","business_name","service_name","amount"],required:{intro:["customer_name","business_name","service_name"]}},client_form_request:{allowed:["customer_name","business_name","service_name","form_name"],required:{subject:["business_name","form_name"],intro:["business_name","form_name"]}},client_form_reminder:{allowed:["customer_name","business_name","service_name","form_name"],required:{subject:["business_name","form_name"],intro:["business_name","form_name"]}}};function Ys(s,e){try{let t=JSON.parse(String(s||""));return t&&typeof t=="object"?t:e}catch{return e}}c(Ys,"parseJson");function Nt(s,e=3e3){return String(s??"").trim().slice(0,e)}c(Nt,"cleanText");function Ks(s,e){let t=Tt[s];if(!t)return null;let i=e&&typeof e=="object"?e:{};return{...t,subject:Nt(i.subject??t.subject,240)||t.subject,title:Nt(i.title??t.title,240)||t.title,intro:Nt(i.intro??t.intro,3e3)||t.intro,closing:Nt(i.closing??t.closing,3e3)||t.closing}}c(Ks,"mergeEmailTemplate");function Dn(s,e){return Ks(s,e)}c(Dn,"cleanEmailTemplate");async function zs(s,e,t){return(await s.DB.prepare(`
        SELECT setting_value
        FROM business_settings
        WHERE
          business_id = ?
          AND setting_key = ?
        LIMIT 1
      `).bind(e,t).first())?.setting_value||null}c(zs,"getSetting");async function vn(s,e){let t=Ys(await zs(s,e,$s),{}),i={};for(let n of Object.keys(Tt))i[n]=Ks(n,t[n]);return i}c(vn,"getBusinessEmailTemplates");async function jt(s,e){return Ys(await zs(s,e,$s),{})}c(jt,"getBusinessEmailOverrides");async function Cn(s,e,t){let i=Ys(await zs(s,e,t),{}),n={};for(let[r,a]of Object.entries(i)){let o=Nt(r,160),u=Nt(a,4e3);o&&u&&(n[o]=u)}return n}c(Cn,"getTextMapSetting");async function At(s,e){return await Cn(s,e,Tn)}c(At,"getPublicBookingCopyOverrides");async function wt(s,e){return await Cn(s,e,An)}c(wt,"getPublicBookingPatchTestCopyOverrides");function es(s,e={}){return String(s??"").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi,(i,n)=>Object.prototype.hasOwnProperty.call(e,n)?String(e[n]??""):i)}c(es,"interpolateContent");async function Dt({env:s,businessId:e,key:t,fallback:i,variables:n={}}){let a=(await jt(s,e))[t];if(!a||typeof a!="object")return i;let o=Ks(t,a);if(!o)return i;let u={...n,default_subject:i.subject||"",default_title:i.title||"",default_intro:i.intro||"",default_closing:i.closing||""};return{...i,subject:es(o.subject,u),title:es(o.title,u),intro:es(o.intro,u),closing:es(o.closing,u)}}c(Dt,"resolveEmailContent");function Vs(){return $s}c(Vs,"emailTemplateSettingKey");function Xs(){return Tn}c(Xs,"publicBookingSettingKey");function Zs(){return An}c(Zs,"publicBookingPatchTestSettingKey");var nu=new TextEncoder;function ru(s){return Array.from(new Uint8Array(s)).map(e=>e.toString(16).padStart(2,"0")).join("")}c(ru,"bytesToHex");function au(){let s=new Uint8Array(32);crypto.getRandomValues(s);let e="";return s.forEach(t=>{e+=String.fromCharCode(t)}),btoa(e).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")}c(au,"randomToken");async function On(s){let e=await crypto.subtle.digest("SHA-256",nu.encode(String(s||"")));return ru(e)}c(On,"hashManageToken");async function ts({env:s,businessId:e,appointmentId:t,customerId:i,daysValid:n=180}){let r=`amt_${crypto.randomUUID()}`,a=au(),o=await On(a),u=Math.min(Math.max(Number(n||180),7),365);return await s.DB.prepare(`
      INSERT INTO appointment_manage_tokens (
        id,
        business_id,
        appointment_id,
        customer_id,
        token_hash,
        expires_at
      )
      VALUES (
        ?, ?, ?, ?, ?,
        datetime(
          'now',
          '+' || ? || ' days'
        )
      )
    `).bind(r,e,t,i,o,u).run(),`${r}.${a}`}c(ts,"issueManageToken");async function Ht({env:s,token:e,touch:t=!0}){let i=String(e||"").trim();if(!i)return null;let n=null,r=i,a=i.indexOf(".");a>0&&i.slice(0,a).startsWith("amt_")&&(n=i.slice(0,a),r=i.slice(a+1));let o=await On(r),u=n?`
          mt.id = ?
          AND mt.token_hash = ?
        `:`
          mt.token_hash = ?
        `,d=s.DB.prepare(`
      SELECT
        mt.id AS token_id,
        mt.business_id,
        mt.appointment_id,
        mt.customer_id,
        mt.expires_at,

        a.service_id,
        a.status,
        a.start_at,
        a.end_at,
        a.price_minor,
        a.deposit_due_minor,
        a.consultation_credit_minor,
        a.booking_source,
        a.booking_kind,
        a.customer_notes,
        a.cancellation_reason,

        c.first_name,
        c.last_name,
        c.email,
        c.phone,

        s.name AS service_name,
        s.duration_minutes,
        s.requires_consultation,
        s.requires_patch_test,

        b.name AS business_name,
        b.timezone,
        b.currency,
        b.locale,

        bb.logo_data_url,
        bb.primary_colour,
        bb.background_colour,
        bb.surface_colour,
        bb.text_colour

      FROM appointment_manage_tokens mt

      JOIN appointments a
        ON a.id =
           mt.appointment_id
       AND a.business_id =
           mt.business_id

      JOIN customers c
        ON c.id =
           a.customer_id
       AND c.business_id =
           mt.business_id

      JOIN services s
        ON s.id =
           a.service_id
       AND s.business_id =
           mt.business_id

      JOIN businesses b
        ON b.id =
           mt.business_id

      LEFT JOIN business_branding bb
        ON bb.business_id =
           mt.business_id

      WHERE
        ${u}
        AND mt.revoked_at IS NULL
        AND datetime(
          mt.expires_at
        ) > datetime('now')

      LIMIT 1
    `),l=n?await d.bind(n,o).first():await d.bind(o).first();return l&&t&&await s.DB.prepare(`
        UPDATE appointment_manage_tokens
        SET
          last_used_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(l.token_id).run(),l||null}c(Ht,"resolveManageToken");async function In({env:s,businessId:e,appointmentId:t}){let n=(await s.DB.prepare(`
      SELECT
        payment_type,
        amount_minor,
        currency,
        status
      FROM payments
      WHERE business_id = ?
        AND appointment_id = ?
      ORDER BY datetime(created_at) ASC
    `).bind(e,t).all()).results||[],r=0,a=0,o="GBP";n.forEach(l=>{o=String(l.currency||o).toUpperCase();let p=Math.abs(Number(l.amount_minor||0));if(l.payment_type==="refund"){l.status==="paid"&&(a+=p);return}["paid","partially_refunded","refunded"].includes(String(l.status||""))&&(r+=p)});let u=await s.DB.prepare(`
    SELECT consultation_credit_minor
    FROM appointments
    WHERE id = ? AND business_id = ?
    LIMIT 1
  `).bind(t,e).first(),d=Math.max(0,Number(u?.consultation_credit_minor||0));return{currency:o,paid_minor:r,refunded_minor:a,net_paid_minor:Math.max(r-a,0),consultation_credit_minor:d,credited_paid_minor:Math.max(r-a,0)+d,transactions:n.length}}c(In,"getAppointmentPaymentSummary");async function Ln({env:s,businessId:e,appointmentId:t}){return((await s.DB.prepare(`
      SELECT
        r.id,
        r.request_token,
        r.status,
        r.expires_at,
        t.name AS template_name
      FROM clinical_form_requests r
      JOIN clinical_templates t
        ON t.id = r.template_id
      WHERE
        r.business_id = ?
        AND r.appointment_id = ?
        AND r.status IN ('created', 'opened', 'submitted')
      ORDER BY datetime(r.created_at) ASC
    `).bind(e,t).all()).results||[]).map(n=>({id:n.id,name:n.template_name||"Form",status:n.status,expires_at:n.expires_at,url:n.status==="submitted"?null:`/forms/view.html?request_token=${encodeURIComponent(n.request_token)}`}))}c(Ln,"getAppointmentForms");function K(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}c(K,"escapeHtml");function tt(s,e){let t=String(s||"").trim();return/^#[0-9a-fA-F]{6}$/.test(t)?t:e}c(tt,"normaliseHex");function xn(s,e,t="en-GB"){if(!s)return"";let i=String(s).replace(" ","T");try{let n=new Date(`${i}Z`),[r,a=""]=i.split("T"),[o,u,d]=r.split("-").map(Number),[l,p]=a.split(":").map(Number),m=new Date(Date.UTC(o,u-1,d,l||0,p||0));return new Intl.DateTimeFormat(t||"en-GB",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"UTC"}).format(m)}catch{return String(s)}}c(xn,"formatAppointment");function Ge(s,e="GBP",t="en-GB"){try{return new Intl.NumberFormat(t||"en-GB",{style:"currency",currency:String(e||"GBP").toUpperCase()}).format(Number(s||0)/100)}catch{return`${e} ${(Number(s||0)/100).toFixed(2)}`}}c(Ge,"money");async function gt(s,e){let t=await s.DB.prepare(`
        SELECT
          setting_key,
          setting_value

        FROM business_settings

        WHERE
          business_id = ?
          AND setting_key IN (
            'notifications_booking_confirmation_enabled',
            'notifications_reminder_enabled',
            'notifications_reminder_hours_before',
            'notifications_cancellation_enabled',
            'notifications_reschedule_enabled',
            'notifications_form_reminder_enabled',
            'notifications_form_reminder_hours_after',
            'notifications_payment_receipt_enabled'
          )
      `).bind(e).all(),i=Object.fromEntries((t.results||[]).map(r=>[r.setting_key,r.setting_value])),n=c((r,a=!0)=>{let o=i[r];return o==null?a:String(o)==="1"||String(o).toLowerCase()==="true"},"bool");return{booking_confirmation_enabled:n("notifications_booking_confirmation_enabled",!0),reminder_enabled:n("notifications_reminder_enabled",!0),reminder_hours_before:Math.max(1,Number(i.notifications_reminder_hours_before??24)||24),cancellation_enabled:n("notifications_cancellation_enabled",!0),reschedule_enabled:n("notifications_reschedule_enabled",!0),form_reminder_enabled:n("notifications_form_reminder_enabled",!0),form_reminder_hours_after:Math.max(1,Number(i.notifications_form_reminder_hours_after??48)||48),payment_receipt_enabled:n("notifications_payment_receipt_enabled",!0)}}c(gt,"getCommunicationSettings");async function ou(s,e,t){return await s.DB.prepare(`
      SELECT
        a.id,
        a.business_id,
        a.customer_id,
        a.status,
        a.start_at,
        a.end_at,
        a.price_minor,
        a.deposit_due_minor,
        a.consultation_credit_minor,
        a.booking_source,
        a.booking_kind,
        a.cancellation_reason,

        c.first_name,
        c.last_name,
        c.email,
        c.phone,

        s.id AS service_id,
        s.name AS service_name,
        s.booking_group,
        s.service_type,

        b.name AS business_name,
        b.email AS business_email,
        b.phone AS business_phone,
        b.website AS business_website,
        b.timezone,
        b.currency,
        b.locale,

        bb.logo_data_url,
        bb.primary_colour,
        bb.background_colour,
        bb.surface_colour,
        bb.text_colour,
        bb.footer_text

      FROM appointments a

      JOIN customers c
        ON c.id = a.customer_id

      JOIN services s
        ON s.id = a.service_id

      JOIN businesses b
        ON b.id = a.business_id

      LEFT JOIN business_branding bb
        ON bb.business_id = a.business_id

      WHERE
        a.id = ?
        AND a.business_id = ?

      LIMIT 1
    `).bind(t,e).first()}c(ou,"getAppointmentContext");async function cu(s,e,t){let i=await s.DB.prepare(`
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN
                  payment_type = 'refund'
                  AND status = 'paid'
                THEN -ABS(amount_minor)

                WHEN
                  payment_type != 'refund'
                  AND status IN (
                    'paid',
                    'partially_refunded',
                    'refunded'
                  )
                THEN amount_minor

                ELSE 0
              END
            ),
            0
          ) AS net_paid_minor

        FROM payments

        WHERE
          business_id = ?
          AND appointment_id = ?
      `).bind(e,t).first();return Math.max(0,Number(i?.net_paid_minor||0))}c(cu,"getPaymentSummary");async function ti(s,e){return await _t(s,e)}c(ti,"getEmailIntegration");function Pe(s){let e=String(s||"").trim().toLowerCase();return e.includes("tattoo")?{key:"tattoo_removal",serviceLabel:"Laser Tattoo Removal",sections:[["First 24 Hours",["Keep the treated area clean, cool, and dry.","Use a cold compress if needed to ease heat or swelling.","Avoid touching the area unnecessarily.","Once advised, gently cleanse with a fragrance-free cleanser.","Apply only the recommended healing ointment or a fragrance-free moisturiser.","Do not apply perfumed products, retinoids, acids or other active skincare to the treated area until fully healed."]],["What to Avoid",["Do not pick, scratch, rub, or burst any blistering or scabbing.","Avoid hot baths, saunas, steam rooms, swimming, and intense exercise for 48 hours.","Avoid fake tan, exfoliants, retinoids, or active skincare on the area until healed.","Do not shave over the area if the skin feels sore or irritated."]],["Healing & Skin Protection",["Allow the skin to heal naturally.","Wear loose clothing if the area is irritated.","Keep the treated area out of direct sun exposure.","Once the skin is fully intact, use SPF 50 on exposed areas."]],["Normal Reactions",["Redness and swelling","Frosting immediately after treatment","Tenderness or warmth","Mild blistering or light scabbing","Pinpoint bleeding","Temporary darkening of the tattoo","Itching during healing"]],["When to Contact Your Practitioner",["Excessive swelling or worsening pain","Spreading redness or heat after the initial reaction should be settling","Discharge, unpleasant smell, or signs of infection","Any reaction that feels unusual or causes concern"]]],note:"Laser tattoo removal carries risks including blistering, scarring, and pigmentation changes. Healing varies from person to person, and multiple sessions are usually required for best results."}:e.includes("carbon")?{key:"carbon_facial",serviceLabel:"Carbon Laser Facial",sections:[["First 24 Hours",["Keep the skin clean and avoid touching the face unnecessarily.","Cleanse with a gentle, fragrance-free cleanser.","Hydrating products containing hyaluronic acid and a ceramide-rich moisturiser may be used.","Avoid makeup for the rest of the day where possible and drink plenty of water."]],["What to Avoid",["Avoid retinoids, AHAs, BHAs, benzoyl peroxide, exfoliating scrubs and other active skincare for at least 48 hours, or until the skin feels settled.","Avoid fake tan on the face until the skin has fully settled.","Avoid hot baths, saunas, steam rooms, and intense exercise for 24 to 48 hours.","Do not pick, scratch, or aggressively cleanse the skin."]],["Skin Protection",["Use SPF 50 daily after treatment.","Avoid direct sun exposure and sunbeds.","Keep the skin moisturised with a gentle, fragrance-free or ceramide-rich product.","Niacinamide, glycerin, panthenol (Vitamin B5) and squalane are also suitable once the skin feels comfortable."]],["Normal Reactions",["Mild redness","Warmth or tightness","Slight sensitivity","Mild dryness or flaking","Temporary breakouts as the skin clears"]],["When to Contact Your Practitioner",["Redness, heat, or swelling that worsens instead of settling","Blistering, broken skin, or unusual irritation","Any reaction that feels unexpected or causes concern"]]],note:"Carbon laser facial treatment can leave the skin temporarily more sensitive. Sun protection and gentle skincare are especially important after treatment."}:e.includes("fungal")?{key:"fungal_nail",serviceLabel:"Fungal Nail Laser Treatment",sections:[["After Treatment",["Keep the feet clean and dry.","Put on clean socks after treatment.","Wear breathable footwear where possible.","Allow nails to grow out naturally over time."]],["Footwear & Hygiene",["Change socks daily and after exercise.","Avoid sharing towels, socks, shoes, or nail tools.","Disinfect or replace old footwear where possible to reduce reinfection risk.","Keep nail clippers and files clean and separate."]],["What to Avoid",["Avoid nail varnish, gel polish, or acrylic overlays unless advised it is suitable.","Avoid tight, sweaty footwear for long periods.","Do not pick or cut the nail too aggressively.","Avoid walking barefoot in communal wet areas."]],["Normal Expectations",["The nail may look unchanged immediately after treatment.","Healthy nail growth can take several months.","Multiple sessions may be recommended.","Good foot hygiene supports the best outcome."]],["When to Contact Your Practitioner",["Pain, swelling, or redness around the nail","Discharge, bleeding, or signs of infection","Any reaction that feels unusual or causes concern"]]],note:"Fungal nail laser treatment supports improvement over time, but nail growth is slow. Results vary depending on the nail, the severity of the infection, footwear habits, and ongoing hygiene."}:null}c(Pe,"aftercareContentFor");function uu(s){return`communications.aftercare.${s}`}c(uu,"aftercareSettingKey");function Qs(s){return JSON.parse(JSON.stringify(s))}c(Qs,"cloneAftercare");function ei(s,e){let t=s&&typeof s=="object"?s:{},i=Array.isArray(t.sections)?t.sections:e.sections;return{key:e.key,serviceLabel:String(t.serviceLabel||e.serviceLabel).trim().slice(0,120)||e.serviceLabel,sections:i.slice(0,12).map((n,r)=>{let a=e.sections[r]||["Section",[]],o=Array.isArray(n)?n:[n?.title,n?.items],u=String(o[0]||a[0]||"Section").trim().slice(0,120),d=(Array.isArray(o[1])?o[1]:[]).map(l=>String(l||"").trim().slice(0,600)).filter(Boolean).slice(0,30);return[u||"Section",d]}),note:String(t.note??e.note??"").trim().slice(0,3e3)}}c(ei,"normaliseAftercareTemplate");function si(){return{tattoo_removal:Qs(Pe("Tattoo Removal")),carbon_facial:Qs(Pe("Carbon Facial")),fungal_nail:Qs(Pe("Fungal Nail Treatment"))}}c(si,"defaultAftercareTemplates");function bt(s="Treatment"){return{key:"custom_service",serviceLabel:String(s||"Treatment").trim().slice(0,120)||"Treatment",sections:[["After Treatment",["Follow the aftercare advice provided by your practitioner.","Keep the treated area clean and avoid unnecessary touching.","Use only products your practitioner has advised are suitable."]],["What to Avoid",["Avoid activities or products your practitioner has advised against while the area settles.","Do not pick, scratch or irritate the treated area."]],["When to Contact Your Practitioner",["Contact the business if you have any concerns about your recovery or reaction after treatment."]]],note:"These are general aftercare instructions. Your practitioner may provide additional advice specific to your treatment."}}c(bt,"genericAftercareTemplate");function du(s){return`communications.aftercare.service.${s}`}c(du,"serviceAftercareSettingKey");function Pn(s){return`communications.aftercare.group.${encodeURIComponent(String(s||"").trim().slice(0,160))}`}c(Pn,"groupAftercareSettingKey");async function lu(s,e,t){if(!t)return null;let i=await s.DB.prepare(`
        SELECT setting_value
        FROM business_settings
        WHERE
          business_id = ?
          AND setting_key = ?
        LIMIT 1
      `).bind(e,Pn(t)).first();if(!i?.setting_value)return null;try{let n=JSON.parse(i.setting_value);return n&&typeof n=="object"?n:null}catch{return null}}c(lu,"getGroupAftercareSetting");async function pu(s,e,t){if(!t)return null;let i=await s.DB.prepare(`
        SELECT setting_value
        FROM business_settings
        WHERE
          business_id = ?
          AND setting_key = ?
        LIMIT 1
      `).bind(e,du(t)).first();if(!i?.setting_value)return null;try{let n=JSON.parse(i.setting_value);return n&&typeof n=="object"?n:null}catch{return null}}c(pu,"getServiceAftercareSetting");async function _u(s,e,t,i,n=""){let r=String(n||i||"").trim(),a=await lu(s,e,r);if(a){if(a.enabled===!1)return null;let l=Pe(r)||bt(r);return ei(a.template||a,l)}let o=await pu(s,e,t);if(o){if(o.enabled===!1)return null;let l=Pe(r)||bt(r);return ei(o.template||o,l)}let u=Pe(r);return u?(await ss(s,e))[u.key]||u:null}c(_u,"getBusinessAftercareForService");function ii(s){return Pn(s)}c(ii,"groupAftercareKey");async function ss(s,e){let t=si(),i=await s.DB.prepare(`
        SELECT
          setting_key,
          setting_value

        FROM business_settings

        WHERE
          business_id = ?
          AND setting_key IN (
            'communications.aftercare.tattoo_removal',
            'communications.aftercare.carbon_facial',
            'communications.aftercare.fungal_nail'
          )
      `).bind(e).all(),n=Object.fromEntries((i.results||[]).map(a=>[a.setting_key,a.setting_value])),r={};for(let[a,o]of Object.entries(t)){let u=null;try{u=JSON.parse(n[uu(a)]||"null")}catch{u=null}r[a]=ei(u,o)}return r}c(ss,"getBusinessAftercareTemplates");function mu({appointment:s,aftercareContent:e=null}){let t=e;if(!t)return null;let i=s.business_name||"your practitioner";return{subject:`Aftercare instructions \xB7 ${t.serviceLabel}`,title:`${t.serviceLabel} Aftercare`,intro:`Hi ${s.first_name||"there"}, please follow the aftercare instructions below for the treatment you received from ${i}.`,rows:[],closing:`These instructions are general aftercare guidance. If you feel unwell, experience severe pain, or notice signs of infection, seek appropriate medical advice. If you are unsure whether a reaction is normal, please contact ${i}.`,aftercare:t}}c(mu,"aftercareTemplateFor");function fu({type:s,appointment:e,paidMinor:t,aftercareContent:i=null}){let n=e.business_name||"Your business",r=e.first_name||"there",a=xn(e.start_at,e.timezone,e.locale),o=e.booking_kind==="consultation"?`Consultation \xB7 ${e.service_name||"Appointment"}`:e.service_name||"Appointment",u=Ge(t,e.currency,e.locale),d=Math.max(0,Number(e.consultation_credit_minor||0)),l=Math.max(Number(e.price_minor||0)-t-d,0),p=Ge(l,e.currency,e.locale);return s==="treatment_aftercare"?mu({appointment:e,aftercareContent:i}):s==="booking_confirmation"?{subject:`Booking confirmed \xB7 ${o}`,title:"Your appointment is confirmed",intro:`Hi ${r}, your booking with ${n} is confirmed.`,rows:[["Service",o],["Date & time",a],["Paid",u],...d>0?[["Consultation credit",Ge(d,e.currency,e.locale)]]:[],["Remaining balance",p]],closing:e.booking_kind==="service"&&Number(e.deposit_due_minor||0)>0&&d===0&&t>0?"Your booking deposit secures your appointment and is deducted from your treatment total. If you cancel less than 24 hours before your appointment, the deposit is non-refundable. We look forward to seeing you.":"We look forward to seeing you."}:s==="appointment_reminder"?{subject:`Appointment reminder \xB7 ${o}`,title:"A reminder about your appointment",intro:`Hi ${r}, this is a reminder about your upcoming appointment with ${n}.`,rows:[["Service",o],["Date & time",a]],closing:"If you need to make a change, please contact the business."}:s==="cancellation_confirmation"?{subject:`Appointment cancelled \xB7 ${o}`,title:"Your appointment has been cancelled",intro:`Hi ${r}, your appointment with ${n} has been cancelled.`,rows:[["Service",o],["Original date & time",a],["Reason",e.cancellation_reason||"Not provided"]],closing:"Any payment or refund is handled separately and remains visible in the business payment record."}:{subject:`Appointment updated \xB7 ${o}`,title:"Your appointment has been updated",intro:`Hi ${r}, your appointment with ${n} has been updated.`,rows:[["Service",o],["New date & time",a]],closing:"Please keep this email for your records."}}c(fu,"templateFor");function bu({appointment:s,template:e,manageUrl:t=null,logoUrl:i=null}){let n=tt(s.primary_colour,"#365c50"),r=tt(s.background_colour,"#f5f4ef"),a=tt(s.surface_colour,"#ffffff"),o=tt(s.text_colour,"#18221f"),u=i?`<img src="${K(i)}" alt="${K(s.business_name)}" style="display:block;max-width:180px;max-height:64px;width:auto;height:auto;margin:0 0 20px;">`:"",d=e.rows.map(([_,g])=>`
          <tr>
            <td style="padding:8px 10px 8px 0;color:#66706b;font-size:13px;vertical-align:top;">
              ${K(_)}
            </td>
            <td style="padding:8px 0;font-size:14px;font-weight:600;color:${o};">
              ${K(g)}
            </td>
          </tr>
        `).join(""),l=e.aftercare?e.aftercare.sections.map(([_,g])=>`
              <div style="margin:0 0 14px;padding:16px;border:1px solid rgba(24,34,31,.12);border-radius:14px;background:${r};">
                <div style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${n};">
                  ${K(_)}
                </div>
                <ul style="margin:0;padding-left:20px;color:${o};">
                  ${g.map(E=>`<li style="margin:0 0 7px;line-height:1.5;">${K(E)}</li>`).join("")}
                </ul>
              </div>
            `).join(""):"",p=e.aftercare?.note?`
        <div style="margin:18px 0 0;padding:14px 16px;border-left:4px solid ${n};border-radius:4px 12px 12px 4px;background:${r};line-height:1.55;">
          <strong>Important</strong><br>
          ${K(e.aftercare.note)}
        </div>
      `:"",m=s.footer_text||`Sent by ${s.business_name}`;return`<!doctype html>
<html>
<body style="margin:0;padding:0;background:${r};font-family:Arial,sans-serif;color:${o};">
  <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
    <div style="background:${a};border:1px solid rgba(24,34,31,.14);border-radius:18px;padding:30px;">
      ${u}
      <div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:${n};text-transform:uppercase;">
        ${K(s.business_name)}
      </div>
      <h1 style="margin:10px 0 14px;font-size:28px;line-height:1.15;">
        ${K(e.title)}
      </h1>
      <p style="margin:0 0 22px;line-height:1.6;color:#66706b;">
        ${K(e.intro)}
      </p>
      ${l}
      ${p}
      ${d?`
            <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;">
              ${d}
            </table>
          `:""}
      <p style="margin:${e.aftercare?"18px 0 0":"0"};line-height:1.6;">
        ${K(e.closing)}
      </p>

      ${t?`
            <div style="margin-top:24px;">
              <a
                href="${K(t)}"
                style="display:inline-block;background:${n};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;"
              >
                Manage appointment
              </a>

              <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#66706b;">
                If the button above does not work,
                <a
                  href="${K(t)}"
                  style="color:${n};text-decoration:underline;font-weight:600;"
                >
                  click here to manage your appointment
                </a>.
              </p>
            </div>
          `:""}
    </div>
    <p style="margin:14px 0 0;text-align:center;color:#7b837f;font-size:12px;">
      ${K(m)}
    </p>
  </div>
</body>
</html>`}c(bu,"buildHtml");function gu({appointment:s,template:e,manageUrl:t=null}){return[e.title,"",e.intro,"",...e.rows.map(([i,n])=>`${i}: ${n}`),...e.aftercare?[...e.aftercare.sections.flatMap(([i,n])=>["",i,...n.map(r=>`- ${r}`)]),"","Important",e.aftercare.note]:[],"",e.closing,...t?["",`Manage appointment: ${t}`]:[],"",s.footer_text||`Sent by ${s.business_name}`].join(`
`)}c(gu,"buildText");async function le({env:s,businessId:e,appointmentId:t,type:i,uniqueKey:n,baseUrl:r=null}){let a=await gt(s,e);if({booking_confirmation:a.booking_confirmation_enabled,appointment_reminder:a.reminder_enabled,cancellation_confirmation:a.cancellation_enabled,reschedule_confirmation:a.reschedule_enabled}[i]===!1)return{ok:!0,skipped:!0,reason:"disabled"};let u=await ou(s,e,t);if(!u)return{ok:!1,skipped:!0,reason:"appointment_not_found"};let d=String(u.email||"").trim().toLowerCase();if(!d)return{ok:!0,skipped:!0,reason:"no_email"};let l=null,p=String(r||s.ESELRAM_BASE_URL||"").trim().replace(/\/+$/,""),m=p&&u.logo_data_url?`${p}/api/public-branding/logo`:null;if(p&&u.customer_id)try{let h=await ts({env:s,businessId:e,appointmentId:t,customerId:u.customer_id});l=`${p}/manage-booking/#token=${encodeURIComponent(h)}`}catch(h){console.error("Unable to create manage-booking link:",h)}let _=await cu(s,e,t);if(i==="treatment_aftercare"&&(String(u.booking_kind||"")==="consultation"||String(u.service_type||"")==="consultation"))return{ok:!0,skipped:!0,reason:"consultation_not_treatment"};let g=String(u.service_name||""),E=i==="treatment_aftercare"?await _u(s,e,u.service_id,g,u.booking_group):null,f=fu({type:i,appointment:u,paidMinor:_,aftercareContent:E});if(!f)return{ok:!0,skipped:!0,reason:"unsupported_service"};i!=="treatment_aftercare"&&(f=await Dt({env:s,businessId:e,key:i,fallback:f,variables:{customer_name:u.first_name||"there",business_name:u.business_name||"Your business",service_name:u.booking_kind==="consultation"?`Consultation \xB7 ${u.service_name||"Appointment"}`:u.service_name||"Appointment",appointment_date:xn(u.start_at,u.timezone,u.locale)}}));let b=String(n||`${i}:${t}`).slice(0,500),N=`com_${crypto.randomUUID()}`;if(!(await s.DB.prepare(`
        INSERT OR IGNORE INTO customer_communications (
          id,
          business_id,
          appointment_id,
          customer_id,
          communication_type,
          recipient,
          subject,
          status,
          provider,
          unique_key
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          'pending',
          'resend',
          ?
        )
      `).bind(N,e,t,u.customer_id,i,d,f.subject,b).run()).meta?.changes){let h=await s.DB.prepare(`
          SELECT id, status
          FROM customer_communications
          WHERE
            business_id = ?
            AND unique_key = ?
          LIMIT 1
        `).bind(e,b).first();if(String(h?.status||"")!=="failed")return{ok:!0,duplicate:!0};N=h.id,await s.DB.prepare(`
        UPDATE customer_communications
        SET
          recipient = ?,
          subject = ?,
          status = 'pending',
          provider_reference = NULL,
          error_details = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(d,f.subject,N).run()}let S=await ti(s,e);if(S.error)return await s.DB.prepare(`
        UPDATE customer_communications
        SET
          status = 'failed',
          error_details = ?,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(S.error,N).run(),{ok:!1,error:S.error};try{let h=await De(s,e,{to:d,subject:f.subject,html:bu({appointment:u,template:f,manageUrl:l,logoUrl:m}),text:gu({appointment:u,template:f,manageUrl:l})});return await s.DB.prepare(`
        UPDATE customer_communications
        SET
          status = 'sent',
          provider = ?,
          provider_reference = ?,
          sent_at =
            CURRENT_TIMESTAMP,
          error_details = NULL,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(h?.provider||S.provider||"resend",h?.id||null,N).run(),{ok:!0,provider_id:h?.id||null}}catch(h){return await s.DB.prepare(`
        UPDATE customer_communications
        SET
          status = 'failed',
          error_details = ?,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(String(h?.message||"Unable to send email.").slice(0,1e3),N).run(),{ok:!1,error:h?.message||"Unable to send email."}}}c(le,"sendAppointmentCommunication");async function ye({env:s,businessId:e,paymentId:t}){if((await gt(s,e)).payment_receipt_enabled===!1)return{ok:!0,skipped:!0,reason:"disabled"};let n=await s.DB.prepare(`
        SELECT
          p.id,
          p.appointment_id,
          p.customer_id,
          p.amount_minor,
          p.currency,
          p.payment_type,
          p.payment_method,
          p.status,
          p.paid_at,

          (
            SELECT COALESCE(SUM(d.amount_minor), 0)
            FROM payments d
            WHERE d.business_id = p.business_id
              AND d.provider = 'none'
              AND d.payment_method = 'discount'
              AND d.status = 'paid'
              AND d.notes LIKE 'Discount adjustment for payment=' || p.id || '%'
          ) AS discount_minor,

          c.first_name,
          c.last_name,
          c.email,

          b.name AS business_name,
          b.email AS business_email,

          a.start_at AS appointment_start_at,
          a.booking_kind AS appointment_booking_kind,
          s.name AS service_name,

          cp.id AS customer_package_id,
          cp.name_snapshot AS package_name,
          cp.price_minor AS package_price_minor,

          (
            SELECT COALESCE(
              SUM(
                CASE
                  WHEN p2.payment_type = 'refund'
                       AND p2.status = 'paid'
                    THEN -ABS(p2.amount_minor)
                  WHEN p2.payment_type != 'refund'
                       AND p2.status IN (
                         'paid',
                         'partially_refunded',
                         'refunded'
                       )
                    THEN ABS(p2.amount_minor)
                  ELSE 0
                END
              ),
              0
            )
            FROM customer_package_payments cpp2
            JOIN payments p2
              ON p2.id = cpp2.payment_id
            WHERE cpp2.customer_package_id = cp.id
          ) AS package_paid_minor,

          (
            SELECT COALESCE(
              SUM(ps.consultation_credit_minor),
              0
            )
            FROM package_sales ps
            WHERE
              ps.business_id = cp.business_id
              AND ps.customer_package_id = cp.id
              AND ps.status = 'paid'
          ) AS package_consultation_credit_minor

        FROM payments p

        JOIN customers c
          ON c.id = p.customer_id

        JOIN businesses b
          ON b.id = p.business_id

        LEFT JOIN appointments a
          ON a.id = p.appointment_id

        LEFT JOIN services s
          ON s.id = a.service_id

        LEFT JOIN customer_package_payments cpp
          ON cpp.payment_id = p.id

        LEFT JOIN customer_packages cp
          ON cp.id = cpp.customer_package_id

        WHERE
          p.id = ?
          AND p.business_id = ?

        LIMIT 1
      `).bind(t,e).first();if(!n||!["paid","partially_refunded","refunded"].includes(String(n.status||""))||n.payment_type==="refund")return{ok:!0,skipped:!0,reason:"not_paid"};let r=String(n.email||"").trim().toLowerCase();if(!r)return{ok:!0,skipped:!0,reason:"no_email"};let a=!!n.customer_package_id,o=Ge(n.amount_minor,n.currency||"GBP"),u=a?Math.max(0,Number(n.package_consultation_credit_minor||0)):0,d=a?Math.max(Number(n.package_price_minor||0)-Number(n.package_paid_minor||0)-u,0):0,l=a?`Package payment received \xB7 ${n.package_name||"Package"}`:`Payment received \xB7 ${n.appointment_booking_kind==="consultation"?`Consultation \xB7 ${n.service_name||n.business_name}`:n.service_name||n.business_name}`,p=a?"Your package payment is confirmed":"Your payment is confirmed",m=a?[["Package",n.package_name||"Package"],["Payment received",o],...Number(n.discount_minor||0)>0?[["Deduction applied",Ge(Number(n.discount_minor||0),n.currency||"GBP")]]:[],...u>0?[["Consultation credit",Ge(u,n.currency||"GBP")]]:[],["Remaining package balance",Ge(d,n.currency||"GBP")]]:[["Service",n.appointment_booking_kind==="consultation"?`Consultation \xB7 ${n.service_name||"Payment"}`:n.service_name||"Payment"],["Payment received",o],...Number(n.discount_minor||0)>0?[["Deduction applied",Ge(Number(n.discount_minor||0),n.currency||"GBP")]]:[]],_=a?"package_payment_confirmation":"payment_receipt",g=await Dt({env:s,businessId:e,key:_,fallback:{subject:l,title:p,intro:`Hi ${n.first_name||"there"}, thank you. We have received your payment.`,closing:"Please keep this email for your records."},variables:{customer_name:n.first_name||"there",business_name:n.business_name||"Your business",service_name:n.appointment_booking_kind==="consultation"?`Consultation \xB7 ${n.service_name||"Payment"}`:n.service_name||"Payment",package_name:n.package_name||"Package",amount:o}}),E=g.subject,f=g.title,b=`com_${crypto.randomUUID()}`,N=`${_}:${t}`;if(!(await s.DB.prepare(`
        INSERT OR IGNORE INTO customer_communications (
          id,
          business_id,
          appointment_id,
          customer_id,
          payment_id,
          customer_package_id,
          communication_type,
          recipient,
          subject,
          status,
          provider,
          unique_key
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          'pending',
          'resend',
          ?
        )
      `).bind(b,e,n.appointment_id||null,n.customer_id,t,n.customer_package_id||null,_,r,E,N).run()).meta?.changes){let T=await s.DB.prepare(`
          SELECT id, status
          FROM customer_communications
          WHERE
            business_id = ?
            AND unique_key = ?
          LIMIT 1
        `).bind(e,N).first();if(String(T?.status||"")!=="failed")return{ok:!0,duplicate:!0};b=T.id,await s.DB.prepare(`
        UPDATE customer_communications
        SET
          recipient = ?,
          subject = ?,
          status = 'pending',
          provider_reference = NULL,
          error_details = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(r,E,b).run()}let S=await ti(s,e);if(S.error)return await s.DB.prepare(`
        UPDATE customer_communications
        SET
          status = 'failed',
          error_details = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(S.error,b).run(),{ok:!1,error:S.error};let h="";try{let T=await s.DB.prepare(`
        SELECT logo_data_url
        FROM business_branding
        WHERE business_id = ?
        LIMIT 1
      `).bind(e).first();if(String(T?.logo_data_url||"").trim()){let O=String(s.ESELRAM_BASE_URL||"").trim().replace(/\/+$/,"");if(O){let w=`${O}/api/public-branding/logo`;h=`<img src="${K(w)}" alt="${K(n.business_name)}" style="display:block;max-width:180px;max-height:64px;width:auto;height:auto;margin:0 0 20px;">`}}}catch(T){console.error("Payment confirmation logo lookup failed; sending email without logo:",T)}let I=m.map(([T,O])=>`
          <tr>
            <td style="padding:7px 10px 7px 0;color:#66706b;font-size:13px;">
              ${K(T)}
            </td>
            <td style="padding:7px 0;font-size:14px;font-weight:700;">
              ${K(O)}
            </td>
          </tr>
        `).join(""),R=`<!doctype html><html><body style="margin:0;padding:0;background:#f5f4ef;font-family:Arial,sans-serif;color:#18221f;">
      <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
        <div style="background:#fff;border-radius:18px;padding:30px;">
          ${h}
          <div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#365c50;">
            ${K(n.business_name)}
          </div>
          <h1 style="margin:10px 0 14px;font-size:27px;">
            ${K(f)}
          </h1>
          <p style="line-height:1.6;">
            ${K(g.intro)}
          </p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:18px 0;">
            ${I}
          </table>
          <p style="margin:20px 0 0;line-height:1.6;color:#66706b;">
            ${K(g.closing)}
          </p>
        </div>
      </div>
    </body></html>`,L=[f,"",g.intro,"",...m.map(([T,O])=>`${T}: ${O}`),"",g.closing].join(`
`);try{let T=await De(s,e,{to:r,subject:E,html:R,text:L,replyTo:n.business_email||""});return await s.DB.prepare(`
        UPDATE customer_communications
        SET
          status = 'sent',
          provider = ?,
          provider_reference = ?,
          sent_at = CURRENT_TIMESTAMP,
          error_details = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(T?.provider||S.provider||"resend",T?.id||null,b).run(),{ok:!0,provider_id:T?.id||null}}catch(T){return await s.DB.prepare(`
        UPDATE customer_communications
        SET
          status = 'failed',
          error_details = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(String(T?.message||"Unable to send payment receipt.").slice(0,1e3),b).run(),{ok:!1,error:T?.message||"Unable to send payment receipt."}}}c(ye,"sendPaymentReceipt");function Eu(s){let e=new Intl.DateTimeFormat("en-CA",{timeZone:s||"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}),t=Object.fromEntries(e.formatToParts(new Date).filter(i=>i.type!=="literal").map(i=>[i.type,i.value]));return`${t.year}-${t.month}-${t.day}T${t.hour}:${t.minute}:${t.second}`}c(Eu,"localNowString");function Mn(s){let e=String(s||"").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);if(!e)return null;let[,t,i,n,r,a]=e.map(Number);return Math.floor(Date.UTC(t,i-1,n)/6e4)+r*60+a}c(Mn,"localIsoToMinuteNumber");async function is({env:s,businessId:e=null}){let t=await s.DB.prepare(`
        SELECT
          id,
          timezone

        FROM businesses

        WHERE
          status = 'active'
          ${e?"AND id = ?":""}
      `).bind(...e?[e]:[]).all(),i=0,n=0,r=0;for(let a of t.results||[]){let o=await gt(s,a.id);if(!o.reminder_enabled)continue;let u=Eu(a.timezone),d=Mn(u),l=await s.DB.prepare(`
          SELECT id, start_at

          FROM appointments

          WHERE
            business_id = ?
            AND status = 'confirmed'
            AND COALESCE(reminders_enabled, 1) = 1
            AND datetime(start_at) >
                datetime(?)
            AND datetime(start_at) <
                datetime(?, '+4 days')

          ORDER BY
            datetime(start_at) ASC
        `).bind(a.id,u,u).all();for(let p of l.results||[]){i+=1;let m=Mn(p.start_at);if(m===null||d===null)continue;let _=m-d,g=Number(o.reminder_hours_before||24)*60;if(_<=g||_>g+60)continue;let E=await le({env:s,businessId:a.id,appointmentId:p.id,type:"appointment_reminder",uniqueKey:`appointment_reminder:${p.id}`,baseUrl:s.ESELRAM_BASE_URL||null});E.ok?E.duplicate||(n+=1):r+=1}}return{checked:i,sent:n,failed:r}}c(is,"runDueReminders");async function Un({env:s,businessId:e,appointmentId:t=null,packageSaleId:i=null,paymentId:n,checkoutUrl:r}){let a=String(r||"").trim(),o;try{o=new URL(a)}catch{return{ok:!1,error:"The Stripe Checkout link is invalid."}}if(o.protocol!=="https:"||o.hostname!=="checkout.stripe.com")return{ok:!1,error:"Only secure Stripe Checkout links can be emailed."};let u=await s.DB.prepare(`
        SELECT
          p.id AS payment_id,
          p.amount_minor,
          p.currency,
          p.status AS payment_status,
          p.provider,

          a.id AS appointment_id,
          a.booking_kind,

          ps.id AS package_sale_id,

          c.id AS customer_id,
          c.first_name,
          c.last_name,
          c.email,

          s.name AS service_name,

          CASE
            WHEN pv.id IS NOT NULL
              THEN pt.name || ' \xB7 ' || pv.name
            ELSE pt.name
          END AS package_name,

          b.id AS business_id,
          b.name AS business_name,

          bb.primary_colour,
          bb.background_colour,
          bb.surface_colour,
          bb.text_colour

        FROM payments p

        JOIN customers c
          ON c.id = p.customer_id

        JOIN businesses b
          ON b.id = p.business_id

        LEFT JOIN appointments a
          ON a.id = p.appointment_id

        LEFT JOIN services s
          ON s.id = a.service_id

        LEFT JOIN package_sales ps
          ON ps.payment_id = p.id
         AND ps.business_id = p.business_id

        LEFT JOIN package_templates pt
          ON pt.id = ps.package_template_id

        LEFT JOIN package_variants pv
          ON pv.id = ps.package_variant_id

        LEFT JOIN business_branding bb
          ON bb.business_id = b.id

        WHERE
          p.id = ?
          AND p.business_id = ?
          AND (
            (? IS NOT NULL AND a.id = ?)
            OR
            (? IS NOT NULL AND ps.id = ?)
          )

        LIMIT 1
      `).bind(n,e,t,t,i,i).first();if(!u)return{ok:!1,error:"The payment link could not be matched to this booking or package sale."};if(u.provider!=="stripe"||u.payment_status!=="pending")return{ok:!1,error:"Only a pending Stripe payment link can be emailed."};let d=String(u.email||"").trim().toLowerCase();if(!d)return{ok:!1,error:"This customer does not have an email address."};let l=await ti(s,e);if(l.error)return{ok:!1,error:l.error};let p=u.package_name||(u.booking_kind==="consultation"?`Consultation \xB7 ${u.service_name}`:u.service_name)||"Payment",m=Ge(u.amount_minor,u.currency),_=await Dt({env:s,businessId:e,key:"payment_link",fallback:{subject:`Payment link \xB7 ${p}`,title:"Payment link",intro:`Hi ${u.first_name||"there"}, ${u.business_name} has sent you a secure payment link for ${p}.`,closing:"Payment is processed securely by Stripe. If you have already paid, you can ignore this email."},variables:{customer_name:u.first_name||"there",business_name:u.business_name||"Your business",service_name:p,amount:m}}),g=_.subject,E=`com_${crypto.randomUUID()}`;await s.DB.prepare(`
      INSERT INTO customer_communications (
        id,
        business_id,
        appointment_id,
        customer_id,
        payment_id,
        communication_type,
        recipient,
        subject,
        status,
        provider,
        unique_key
      )
      VALUES (
        ?, ?, ?, ?, ?,
        'payment_link',
        ?, ?,
        'pending',
        'resend',
        ?
      )
    `).bind(E,e,t,u.customer_id,n,d,g,`payment_link:${n}:${crypto.randomUUID()}`).run();let f=tt(u.primary_colour,"#365c50"),b=tt(u.background_colour,"#f5f4ef"),N=tt(u.surface_colour,"#ffffff"),v=tt(u.text_colour,"#202a26"),S=u.first_name||"there",h=`
    <div style="margin:0;padding:32px;background:${K(b)};font-family:Arial,sans-serif;color:${K(v)}">
      <div style="max-width:560px;margin:0 auto;background:${K(N)};border-radius:16px;padding:28px">
        <p style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.12em">
          Secure payment
        </p>

        <h1 style="margin:0 0 18px;font-size:26px">
          ${K(_.title)}
        </h1>

        <p>
          ${K(_.intro)}
        </p>

        <p>
          <strong>
            Amount due:
            ${K(m)}
          </strong>
        </p>

        <p style="margin:26px 0">
          <a
            href="${K(a)}"
            target="_blank"
            rel="noopener noreferrer"
            style="display:inline-block;background:${K(f)};color:#ffffff !important;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700"
          >
            Pay securely
          </a>
        </p>

        <p style="margin:0 0 18px;font-size:14px;line-height:1.5">
          If the button above does not open, use this secure payment link:
          <br>
          <a
            href="${K(a)}"
            target="_blank"
            rel="noopener noreferrer"
            style="color:${K(f)};text-decoration:underline;font-weight:600"
          >
            Open secure payment page
          </a>
        </p>

        <p style="font-size:13px;opacity:.75">
          ${K(_.closing)}
        </p>
      </div>
    </div>
  `,I=[_.title,"",_.intro,`Amount due: ${m}`,"","Open secure payment page:",a,"",_.closing].join(`
`);try{let R=await De(s,e,{to:d,subject:g,html:h,text:I});return await s.DB.prepare(`
        UPDATE customer_communications
        SET
          status = 'sent',
          provider_reference = ?,
          sent_at =
            CURRENT_TIMESTAMP,
          error_details = NULL,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(R?.id||null,E).run(),{ok:!0,recipient:d,provider_id:R?.id||null}}catch(R){return await s.DB.prepare(`
        UPDATE customer_communications
        SET
          status = 'failed',
          error_details = ?,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(String(R?.message||"Unable to send payment link.").slice(0,1e3),E).run(),{ok:!1,error:R?.message||"Unable to send payment link."}}}c(Un,"sendPaymentLinkEmail");function hu(s){return Response.json({ok:!1,error:s},{status:400})}c(hu,"badRequest");async function yu({env:s,payment:e,session:t}){let i=Math.max(0,Number(t?.metadata?.discount_minor||0)),n=String(t?.metadata?.discount_type||"").trim().toLowerCase(),r=String(t?.metadata?.voucher_code||"").trim().toUpperCase(),a=[];if(i>0&&(a.push(`discount_minor=${Math.round(i)}`),a.push(`deduction_type=${n||"amount"}`),r&&a.push(`voucher=${r}`),n==="percent")){let u=Number(e.amount_minor||0)+i,d=u>0?Math.round(i/u*1e4)/100:null;d&&a.push(`label=${d}% discount`)}let o=a.join(" \xB7 ");await s.DB.prepare(`
      UPDATE payments

      SET
        status = 'paid',
        provider_reference = ?,
        payment_method = ?,
        paid_at =
          COALESCE(
            paid_at,
            CURRENT_TIMESTAMP
          ),
        notes =
          CASE
            WHEN ? != ''
              AND instr(COALESCE(notes, ''), 'discount_minor=') = 0
              AND COALESCE(notes, '') = ''
            THEN ? || ' \xB7 Stripe Checkout payment confirmed'

            WHEN ? != ''
              AND instr(COALESCE(notes, ''), 'discount_minor=') = 0
            THEN notes || ' \xB7 ' || ? || ' \xB7 Stripe Checkout payment confirmed'

            WHEN instr(COALESCE(notes, ''), 'Stripe Checkout payment confirmed') > 0
            THEN notes

            WHEN COALESCE(notes, '') = ''
            THEN 'Stripe Checkout payment confirmed'

            ELSE notes || ' \xB7 Stripe Checkout payment confirmed'
          END,
        updated_at =
          CURRENT_TIMESTAMP

      WHERE
        id = ?
        AND business_id = ?
    `).bind(t.id,String(t.payment_method_types?.[0]||"card"),o,o,o,o,e.id,e.business_id).run(),await ge({env:s,businessId:e.business_id,paymentId:e.id,status:"paid",customerPackageId:String(t?.metadata?.customer_package_id||"").trim()||null})}c(yu,"markPaid");async function Bn({request:s,env:e}){try{let t=new URL(s.url),i=String(t.searchParams.get("session_id")||"").trim();if(!i.startsWith("cs_"))return hu("A valid Stripe Checkout Session id is required.");let n=await e.DB.prepare(`
          SELECT
            id,
            business_id,
            appointment_id,
            customer_id,
            amount_minor,
            currency,
            status,
            provider_reference

          FROM payments

          WHERE
            provider = 'stripe'
            AND provider_reference = ?

          LIMIT 1
        `).bind(i).first();if(!n)return Response.json({ok:!1,error:"Payment record not found."},{status:404});let r=await Q(e,n.business_id);if(r.error)return Response.json({ok:!1,error:"Stripe verification is temporarily unavailable."},{status:503});let{response:a,data:o}=await X({secretKey:r.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(i)}`});if(!a.ok)return Response.json({ok:!1,error:be(o,"Unable to verify the Stripe Checkout Session.")},{status:502});if(o.payment_status==="paid"){await yu({env:e,payment:n,session:o});try{await ye({env:e,businessId:n.business_id,paymentId:n.id})}catch(u){console.error("Stripe status receipt email failed:",u)}}return Response.json({ok:!0,payment:{status:o.payment_status==="paid"?"paid":n.status,amount_minor:n.amount_minor,currency:n.currency,appointment_id:n.appointment_id},stripe:{payment_status:o.payment_status,status:o.status}},{headers:{"Cache-Control":"no-store"}})}catch(t){return console.error("Stripe Checkout status failed:",t),Response.json({ok:!1,error:"Unable to verify payment status."},{status:500})}}c(Bn,"onRequestGet");function ve(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}c(ve,"escapeHtml");function ns(s,e){let t=String(s||"").trim();return/^#[0-9a-fA-F]{6}$/.test(t)?t:e}c(ns,"normaliseHex");function jn(s){if(!s)return"";let e=String(s).replace(" ","T"),[t,i=""]=e.split("T"),[n,r,a]=t.split("-").map(Number),[o,u]=i.split(":").map(Number);try{let d=new Date(Date.UTC(n,r-1,a,o||0,u||0));return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"UTC"}).format(d)}catch{return String(s)}}c(jn,"formatAppointment");async function ku(s,e){return await _t(s,e)}c(ku,"getEmailIntegration");async function Su(s,e,t){return await s.DB.prepare(`
    SELECT r.id,r.business_id,r.template_id,r.customer_id,r.appointment_id,r.request_token,r.status,r.expires_at,r.email_status,r.email_send_count,
      t.name AS template_name,t.template_type,t.is_client_sendable,
      c.first_name,c.last_name,c.email AS customer_email,
      b.name AS business_name,b.email AS business_email,
      bb.logo_data_url,bb.primary_colour,bb.background_colour,bb.surface_colour,bb.text_colour,bb.footer_text,
      a.start_at AS appointment_start_at,a.booking_kind,s.name AS service_name
    FROM clinical_form_requests r
    JOIN clinical_templates t ON t.id=r.template_id
    JOIN customers c ON c.id=r.customer_id
    JOIN businesses b ON b.id=r.business_id
    LEFT JOIN business_branding bb ON bb.business_id=r.business_id
    LEFT JOIN appointments a ON a.id=r.appointment_id
    LEFT JOIN services s ON s.id=a.service_id
    WHERE r.id=? AND r.business_id=? LIMIT 1`).bind(t,e).first()}c(Su,"getContext");function Ru(s,e,t=null,i=null){let n=ve(s.business_name||"Your practitioner"),r=ve(s.first_name||"there"),a=ve(s.template_name||"Client form"),o=ns(s.primary_colour,"#365c50"),u=ns(s.background_colour,"#f5f4ef"),d=ns(s.surface_colour,"#ffffff"),l=ns(s.text_colour,"#18221f"),p=s.booking_kind==="consultation"?`Consultation \xB7 ${s.service_name||"Appointment"}`:s.service_name||"Appointment",m=s.appointment_id?`${ve(p)} \xB7 ${ve(jn(s.appointment_start_at))}`:"",_=s.footer_text?ve(s.footer_text):`Sent by ${n}`,g=t?`<img src="${ve(t)}" alt="${n}" style="display:block;max-width:180px;max-height:64px;width:auto;height:auto;margin:0 0 20px;">`:"";return`<!doctype html>
<html>
<body style="margin:0;padding:0;background:${u};font-family:Arial,sans-serif;color:${l};">
  <div style="max-width:620px;margin:0 auto;padding:28px 18px;">
    <div style="background:${d};border:1px solid rgba(24,34,31,.14);border-radius:18px;padding:30px;">
      ${g}

      <div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:${o};text-transform:uppercase;">
        ${a}
      </div>

      <h1 style="margin:10px 0 14px;font-size:28px;line-height:1.15;">
        ${ve(i?.title||"Please complete your form")}
      </h1>

      <p style="margin:0 0 18px;line-height:1.6;">
        Hi ${r},
      </p>

      <p style="margin:0 0 20px;line-height:1.6;color:#66706b;">
        ${ve(i?.intro||`${s.business_name||"Your practitioner"} has sent you a secure ${s.template_name||"client form"} to complete before your appointment.`)}
      </p>

      ${m?`
            <div style="margin:0 0 22px;padding:14px 16px;background:${u};border-radius:12px;font-size:14px;line-height:1.6;">
              <strong>${m}</strong>
            </div>
          `:""}

      <div style="margin-top:24px;">
        <a
          href="${ve(e)}"
          style="display:inline-block;background:${o};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;"
        >
          Complete ${a}
        </a>

        <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#66706b;">
          If the button above does not work,
          <a
            href="${ve(e)}"
            style="color:${o};text-decoration:underline;font-weight:600;"
          >
            click here to complete your form
          </a>.
        </p>
      </div>

      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#66706b;">
        ${ve(i?.closing||"This unique link expires after 30 days and cannot be reused after submission.")}
      </p>
    </div>

    <p style="margin:14px 0 0;text-align:center;color:#7b837f;font-size:12px;">
      ${_}
    </p>
  </div>
</body>
</html>`}c(Ru,"buildHtml");function Nu(s,e,t=null){let i=s.booking_kind==="consultation"?`Consultation \xB7 ${s.service_name||"Appointment"}`:s.service_name||"Appointment",n=s.appointment_id?`
Appointment: ${i} \xB7 ${jn(s.appointment_start_at)}
`:"";return[t?.title||"Please complete your form","",`Hi ${s.first_name||"there"},`,"",t?.intro||`${s.business_name||"Your practitioner"} has sent you a secure ${s.template_name||"client form"} to complete before your appointment.`,n,`Complete your form: ${e}`,"",t?.closing||"This unique link expires after 30 days and cannot be reused after submission."].join(`
`)}c(Nu,"buildText");async function Tu({env:s,businessId:e,templateId:t,customerId:i,appointmentId:n,createdByUserId:r=null}){if(!await s.DB.prepare("SELECT id,name,template_type,is_client_sendable FROM clinical_templates WHERE id=? AND business_id=? AND is_active=1 AND is_published=1 AND is_client_sendable=1 LIMIT 1").bind(t,e).first())return{ok:!1,error:"The assigned client form template is unavailable."};let o=await s.DB.prepare("SELECT id,request_token,status,expires_at,email_status FROM clinical_form_requests WHERE business_id=? AND template_id=? AND customer_id=? AND appointment_id=? AND status IN ('created','opened','submitted') ORDER BY datetime(created_at) DESC LIMIT 1").bind(e,t,i,n).first();if(o){if(o.status==="submitted")return{ok:!0,reused:!0,completed:!0,request:o};if(new Date(String(o.expires_at||"").replace(" ","T")+"Z").getTime()>Date.now())return{ok:!0,reused:!0,completed:!1,request:o}}let u=`cfr_${crypto.randomUUID()}`,d=`frq_${crypto.randomUUID().replaceAll("-","")}${crypto.randomUUID().replaceAll("-","")}`;return await s.DB.prepare("INSERT INTO clinical_form_requests (id,business_id,template_id,customer_id,appointment_id,request_token,status,created_by_user_id,expires_at) VALUES (?,?,?,?,?,?,'created',?,datetime('now','+30 days'))").bind(u,e,t,i,n,d,r).run(),{ok:!0,reused:!1,completed:!1,request:{id:u,request_token:d,status:"created",email_status:"not_sent"}}}c(Tu,"ensureClientFormRequest");async function qn({env:s,row:e,type:t,subject:i,status:n,providerReference:r=null,errorDetails:a=null,forceUnique:o=!1}){let u=t==="client_form_reminder"?`client_form_reminder:${e.id}`:`client_form_request:${e.id}`,d=o?`${u}:${crypto.randomUUID()}`:u,l=`com_${crypto.randomUUID()}`;await s.DB.prepare(`
      INSERT INTO customer_communications (
        id,
        business_id,
        appointment_id,
        customer_id,
        form_request_id,
        communication_type,
        recipient,
        subject,
        status,
        provider,
        provider_reference,
        unique_key,
        sent_at,
        error_details
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'resend',
        ?,
        ?,
        CASE
          WHEN ? = 'sent'
            THEN CURRENT_TIMESTAMP
          ELSE NULL
        END,
        ?
      )
      ON CONFLICT(unique_key)
      DO UPDATE SET
        status =
          excluded.status,
        provider_reference =
          excluded.provider_reference,
        sent_at =
          CASE
            WHEN excluded.status = 'sent'
              THEN CURRENT_TIMESTAMP
            ELSE customer_communications.sent_at
          END,
        error_details =
          excluded.error_details,
        updated_at =
          CURRENT_TIMESTAMP
    `).bind(l,e.business_id,e.appointment_id||null,e.customer_id,e.id,t,String(e.customer_email||"").trim().toLowerCase(),i,n,r||null,d,n,a||null).run()}c(qn,"logFormCommunication");async function rs({env:s,businessId:e,formRequestId:t,baseUrl:i,reminder:n=!1,force:r=!1}){let a=await Su(s,e,t);if(!a)return{ok:!1,error:"Form request not found."};if(Number(a.is_client_sendable||0)!==1)return{ok:!1,error:"This form is not available for clients."};if(!["created","opened"].includes(String(a.status||"")))return{ok:!0,skipped:!0,reason:"inactive"};if(!r&&!n&&a.email_status==="sent")return{ok:!0,duplicate:!0};if(n&&!r){let v=await s.DB.prepare(`
          SELECT id, status
          FROM customer_communications
          WHERE
            business_id = ?
            AND form_request_id = ?
            AND communication_type =
                'client_form_reminder'
          LIMIT 1
        `).bind(e,t).first();if(v&&v.status==="sent")return{ok:!0,duplicate:!0}}let o=String(a.customer_email||"").trim();if(!o)return{ok:!1,error:"This customer does not have an email address."};let u=await ku(s,e);if(u.error)return{ok:!1,error:u.error};let d=String(i||s.ESELRAM_BASE_URL||"").trim().replace(/\/+$/,"");if(!d)return{ok:!1,error:"Unable to build the secure client form URL."};let l=`${d}/forms/view.html#request_token=${encodeURIComponent(a.request_token)}`,p=n?"client_form_reminder":"client_form_request",m=n?{subject:`Reminder \xB7 ${a.business_name} \u2014 ${a.template_name}`,title:"A reminder to complete your form",intro:`${a.business_name||"Your practitioner"} has sent you a secure ${a.template_name||"client form"} to complete before your appointment.`,closing:"This unique link expires after 30 days and cannot be reused after submission."}:{subject:`${a.business_name} \u2014 ${a.template_name}`,title:"Please complete your form",intro:`${a.business_name||"Your practitioner"} has sent you a secure ${a.template_name||"client form"} to complete before your appointment.`,closing:"This unique link expires after 30 days and cannot be reused after submission."},_=await Dt({env:s,businessId:e,key:p,fallback:m,variables:{customer_name:a.first_name||"there",business_name:a.business_name||"Your practitioner",form_name:a.template_name||"Client form",service_name:a.booking_kind==="consultation"?`Consultation \xB7 ${a.service_name||"Appointment"}`:a.service_name||"Appointment"}}),g=_.subject,E=a.logo_data_url?`${d}/api/public-branding/logo`:null,f=Ru(a,l,E,_),b=Nu(a,l,_),N={from:`${u.fromName} <${u.fromEmail}>`,to:[o],subject:g,html:f,text:b};a.business_email&&(N.reply_to=a.business_email);try{let v=await De(s,e,{to:o,subject:g,html:f,text:b,replyTo:a.business_email||""});return await s.DB.prepare(`
        UPDATE clinical_form_requests

        SET
          email_status = 'sent',
          email_to = ?,
          email_sent_at =
            CASE
              WHEN ? = 0
                THEN CURRENT_TIMESTAMP
              ELSE email_sent_at
            END,
          email_provider_id = ?,
          email_error = NULL,
          email_send_count =
            email_send_count + 1

        WHERE
          id = ?
          AND business_id = ?
      `).bind(o,n?1:0,String(v?.id||"")||null,t,e).run(),await qn({env:s,row:a,type:p,subject:g,status:"sent",providerReference:v?.id||null,forceUnique:r}),{ok:!0,provider_id:v?.id||null}}catch(v){let S=String(v?.message||"Unable to send client form email.").slice(0,1e3);return await s.DB.prepare(`
        UPDATE clinical_form_requests

        SET
          email_status = 'failed',
          email_to = ?,
          email_error = ?,
          email_send_count =
            email_send_count + 1

        WHERE
          id = ?
          AND business_id = ?
      `).bind(o,S,t,e).run(),await qn({env:s,row:a,type:p,subject:g,status:"failed",errorDetails:S,forceUnique:r}),{ok:!1,error:S}}}c(rs,"sendClientFormRequestEmail");async function as({env:s,businessId:e=null,baseUrl:t=null}){let i=await s.DB.prepare(`
        SELECT id
        FROM businesses
        WHERE
          status = 'active'
          ${e?"AND id = ?":""}
      `).bind(...e?[e]:[]).all(),n=0,r=0,a=0;for(let o of i.results||[]){let u=await s.DB.prepare(`
          SELECT
            setting_key,
            setting_value
          FROM business_settings
          WHERE
            business_id = ?
            AND setting_key IN (
              'notifications_form_reminder_enabled',
              'notifications_form_reminder_hours_after'
            )
        `).bind(o.id).all(),d=Object.fromEntries((u.results||[]).map(g=>[g.setting_key,g.setting_value])),l=d.notifications_form_reminder_enabled;if(!(l==null||String(l)==="1"||String(l).toLowerCase()==="true"))continue;let m=Math.max(1,Number(d.notifications_form_reminder_hours_after??48)||48),_=await s.DB.prepare(`
          SELECT
            r.id

          FROM clinical_form_requests r

          WHERE
            r.business_id = ?
            AND r.status IN (
              'created',
              'opened'
            )
            AND r.email_status = 'sent'
            AND r.email_sent_at IS NOT NULL
            AND datetime(
              r.email_sent_at
            ) <= datetime(
              'now',
              '-' || ? || ' hours'
            )
            AND datetime(
              r.expires_at
            ) > datetime('now')
            AND NOT EXISTS (
              SELECT 1
              FROM customer_communications cc
              WHERE
                cc.business_id =
                  r.business_id
                AND cc.form_request_id =
                  r.id
                AND cc.communication_type =
                  'client_form_reminder'
                AND cc.status = 'sent'
            )

          ORDER BY
            datetime(
              r.email_sent_at
            ) ASC

          LIMIT 100
        `).bind(o.id,m).all();for(let g of _.results||[]){n+=1;let E=await rs({env:s,businessId:o.id,formRequestId:g.id,baseUrl:t||s.ESELRAM_BASE_URL||null,reminder:!0});E.ok?!E.duplicate&&!E.skipped&&(r+=1):a+=1}}return{checked:n,sent:r,failed:a}}c(as,"runDueFormReminders");async function Ce({env:s,businessId:e,appointmentId:t,triggerEvent:i,baseUrl:n,createdByUserId:r=null}){let a=String(i||"").trim();if(!["payment_received","booking_confirmed"].includes(a))return{ok:!0,created:0,sent:0,skipped:0,failed:0};let o=await s.DB.prepare(`
    SELECT
      a.id,
      a.customer_id,
      a.service_id,
      a.status,
      a.booking_kind,
      s.service_type
    FROM appointments a
    JOIN services s
      ON s.id=a.service_id
     AND s.business_id=a.business_id
    WHERE
      a.id=?
      AND a.business_id=?
    LIMIT 1
  `).bind(t,e).first();if(!o)return{ok:!1,error:"Appointment not found."};let d=[...(await s.DB.prepare("SELECT r.template_id,t.name AS template_name,t.template_type FROM service_form_rules r JOIN clinical_templates t ON t.id=r.template_id AND t.business_id=r.business_id WHERE r.business_id=? AND r.service_id=? AND r.trigger_event=? AND r.is_active=1 AND t.is_active=1 AND t.is_published=1 AND t.is_client_sendable=1 ORDER BY t.name COLLATE NOCASE ASC").bind(e,o.service_id,a).all()).results||[]],l=o.booking_kind==="consultation"||o.service_type==="consultation";if(l&&a==="booking_confirmed"&&!await s.DB.prepare("SELECT 1 AS found FROM service_form_rules r JOIN clinical_templates t ON t.id=r.template_id AND t.business_id=r.business_id WHERE r.business_id=? AND r.service_id=? AND r.trigger_event IN ('booking_confirmed','payment_received') AND r.is_active=1 AND t.template_type='consultation' AND t.is_active=1 AND t.is_published=1 AND t.is_client_sendable=1 LIMIT 1").bind(e,o.service_id).first()){let f=await s.DB.prepare("SELECT id AS template_id,name AS template_name,template_type FROM clinical_templates WHERE business_id=? AND template_type='consultation' AND is_active=1 AND is_published=1 AND is_client_sendable=1 ORDER BY is_default DESC, name COLLATE NOCASE ASC LIMIT 1").bind(e).first();f&&!d.some(b=>b.template_id===f.template_id)&&d.push(f)}let p=0,m=0,_=0,g=0;for(let E of d){if(String(E.template_type||"").toLowerCase()==="consultation"&&!l&&await s.DB.prepare(`
          SELECT
            r.id,
            r.submission_id,
            r.submitted_at
          FROM clinical_form_requests r
          JOIN clinical_templates t
            ON t.id = r.template_id
           AND t.business_id = r.business_id
          JOIN appointments prior_appointment
            ON prior_appointment.id = r.appointment_id
           AND prior_appointment.business_id = r.business_id
          WHERE
            r.business_id = ?
            AND r.customer_id = ?
            AND prior_appointment.service_id = ?
            AND t.template_type = 'consultation'
            AND r.status = 'submitted'
          ORDER BY
            datetime(
              COALESCE(
                r.submitted_at,
                r.created_at
              )
            ) DESC
          LIMIT 1
        `).bind(e,o.customer_id,o.service_id).first()){_++;continue}let f=await Tu({env:s,businessId:e,templateId:E.template_id,customerId:o.customer_id,appointmentId:t,createdByUserId:r});if(!f.ok){g++,console.error("Automatic client form request failed:",t,E.template_id,f.error);continue}if(f.completed){_++;continue}f.reused||p++;let b=await rs({env:s,businessId:e,formRequestId:f.request.id,baseUrl:n});b.ok?b.duplicate||b.skipped?_++:m++:(g++,console.error("Automatic client form email failed:",t,E.template_id,b.error))}return{ok:g===0,created:p,sent:m,skipped:_,failed:g}}c(Ce,"runServiceFormAutomation");async function Ye({env:s,session:e,paid:t}){let i=String(e?.metadata?.package_sale_id||"").trim(),n=String(e?.metadata?.business_id||"").trim();if(!i||!n)return{ok:!1,skipped:!0,reason:"missing_metadata"};let r=await s.DB.prepare(`
    SELECT
      ps.id,
      ps.customer_id,
      ps.package_template_id,
      ps.payment_id,
      ps.customer_package_id,
      ps.status,
      ps.consultation_credit_minor,
      ps.package_variant_id,
      COALESCE(pv.service_id, pt.service_id) AS service_id,
      CASE
        WHEN pv.id IS NOT NULL
          THEN pt.name || ' \xB7 ' || pv.name
        ELSE pt.name
      END AS name,
      pt.sessions_total,
      COALESCE(pv.price_minor, pt.price_minor) AS price_minor,
      pt.validity_days
    FROM package_sales ps
    JOIN package_templates pt
      ON pt.id = ps.package_template_id
    LEFT JOIN package_variants pv
      ON pv.id = ps.package_variant_id
     AND pv.package_template_id = pt.id
    WHERE
      ps.id = ?
      AND ps.business_id = ?
    LIMIT 1
  `).bind(i,n).first();if(!r)return{ok:!1,skipped:!0,reason:"sale_not_found"};if(!t)return await s.DB.prepare(`
      UPDATE package_sales
      SET
        status = 'failed',
        updated_at = CURRENT_TIMESTAMP
      WHERE
        id = ?
        AND business_id = ?
        AND status = 'pending'
    `).bind(i,n).run(),{ok:!0,paid:!1,sale_id:i};let a=String(r.customer_package_id||"").trim();if(!a){a=`cpk_${crypto.randomUUID()}`;let o=Number(r.validity_days||0);await s.DB.prepare(`
      INSERT INTO customer_packages (
        id,
        business_id,
        customer_id,
        package_template_id,
        package_variant_id,
        service_id,
        name_snapshot,
        sessions_total,
        price_minor,
        status,
        starts_on,
        expires_on,
        notes
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active',
        date('now'),
        CASE
          WHEN ? > 0
            THEN date('now', '+' || ? || ' days')
          ELSE NULL
        END,
        'Created automatically from paid package sale'
      )
    `).bind(a,n,r.customer_id,r.package_template_id,r.package_variant_id||null,r.service_id,r.name,r.sessions_total,Math.max(0,Number(r.price_minor||0)),o,o).run()}return r.payment_id&&await s.DB.prepare(`
      INSERT OR IGNORE INTO customer_package_payments (
        customer_package_id,
        payment_id
      )
      VALUES (?, ?)
    `).bind(a,r.payment_id).run(),await s.DB.prepare(`
    UPDATE package_sales
    SET
      status = 'paid',
      customer_package_id = ?,
      paid_at =
        COALESCE(
          paid_at,
          CURRENT_TIMESTAMP
        ),
      updated_at =
        CURRENT_TIMESTAMP
    WHERE
      id = ?
      AND business_id = ?
  `).bind(a,i,n).run(),{ok:!0,paid:!0,sale_id:i,payment_id:r.payment_id||null,customer_package_id:a}}c(Ye,"finalizePackageSale");var Hn=new TextEncoder;function Au(s){return Array.from(new Uint8Array(s)).map(e=>e.toString(16).padStart(2,"0")).join("")}c(Au,"bytesToHex");function wu(s,e){let t=String(s||""),i=String(e||"");if(t.length!==i.length)return!1;let n=0;for(let r=0;r<t.length;r+=1)n|=t.charCodeAt(r)^i.charCodeAt(r);return n===0}c(wu,"safeEqual");function Du(s){let e={timestamp:null,signatures:[]};return String(s||"").split(",").forEach(t=>{let[i,n]=t.trim().split("=",2);i==="t"&&(e.timestamp=Number(n)),i==="v1"&&n&&e.signatures.push(n)}),e}c(Du,"parseStripeSignature");async function vu({payload:s,signatureHeader:e,secret:t,toleranceSeconds:i=300}){let n=Du(e);if(!n.timestamp||n.signatures.length===0)return!1;let r=Math.floor(Date.now()/1e3);if(Math.abs(r-n.timestamp)>i)return!1;let a=await crypto.subtle.importKey("raw",Hn.encode(t),{name:"HMAC",hash:"SHA-256"},!1,["sign"]),o=`${n.timestamp}.${s}`,u=await crypto.subtle.sign("HMAC",a,Hn.encode(o)),d=Au(u);return n.signatures.some(l=>wu(d,l))}c(vu,"verifySignature");async function Fn({env:s,session:e,paid:t,baseUrl:i=null}){let n=String(e?.metadata?.payment_id||"").trim(),r=String(e?.metadata?.business_id||"").trim();if(!n||!r)return;let a=String(e?.payment_method_types?.[0]||"card");if(t){await s.DB.prepare(`
        UPDATE payments

        SET
          status = 'paid',
          provider_reference = ?,
          payment_method = ?,
          paid_at =
            COALESCE(
              paid_at,
              CURRENT_TIMESTAMP
            ),
          notes =
            CASE
              WHEN COALESCE(?, '') != ''
                AND instr(COALESCE(notes, ''), 'discount_minor=') = 0
                AND COALESCE(notes, '') = ''
              THEN ? || ' \xB7 Stripe Checkout payment confirmed by webhook'

              WHEN COALESCE(?, '') != ''
                AND instr(COALESCE(notes, ''), 'discount_minor=') = 0
              THEN notes || ' \xB7 ' || ? || ' \xB7 Stripe Checkout payment confirmed by webhook'

              WHEN instr(COALESCE(notes, ''), 'Stripe Checkout payment confirmed by webhook') > 0
              THEN notes

              WHEN COALESCE(notes, '') = ''
              THEN 'Stripe Checkout payment confirmed by webhook'

              ELSE notes || ' \xB7 Stripe Checkout payment confirmed by webhook'
            END,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `).bind(e.id,a,(()=>{let p=Math.max(0,Number(e?.metadata?.discount_minor||0));if(!p)return"";let m=[`discount_minor=${Math.round(p)}`,`deduction_type=${String(e?.metadata?.discount_type||"amount").trim().toLowerCase()}`],_=String(e?.metadata?.voucher_code||"").trim().toUpperCase();return _&&m.push(`voucher=${_}`),m.join(" \xB7 ")})(),(()=>{let p=Math.max(0,Number(e?.metadata?.discount_minor||0));if(!p)return"";let m=[`discount_minor=${Math.round(p)}`,`deduction_type=${String(e?.metadata?.discount_type||"amount").trim().toLowerCase()}`],_=String(e?.metadata?.voucher_code||"").trim().toUpperCase();return _&&m.push(`voucher=${_}`),m.join(" \xB7 ")})(),(()=>{let p=Math.max(0,Number(e?.metadata?.discount_minor||0));if(!p)return"";let m=[`discount_minor=${Math.round(p)}`,`deduction_type=${String(e?.metadata?.discount_type||"amount").trim().toLowerCase()}`],_=String(e?.metadata?.voucher_code||"").trim().toUpperCase();return _&&m.push(`voucher=${_}`),m.join(" \xB7 ")})(),(()=>{let p=Math.max(0,Number(e?.metadata?.discount_minor||0));if(!p)return"";let m=[`discount_minor=${Math.round(p)}`,`deduction_type=${String(e?.metadata?.discount_type||"amount").trim().toLowerCase()}`],_=String(e?.metadata?.voucher_code||"").trim().toUpperCase();return _&&m.push(`voucher=${_}`),m.join(" \xB7 ")})(),n,r).run();let o=String(e?.metadata?.customer_package_id||"").trim();o&&n&&await s.DB.prepare(`
        INSERT OR IGNORE INTO customer_package_payments (
          customer_package_id,
          payment_id
        )
        SELECT ?, ?
        WHERE EXISTS (
          SELECT 1
          FROM customer_packages
          WHERE
            id=?
            AND business_id=?
        )
      `).bind(o,n,o,r).run();let u=await Ye({env:s,session:e,paid:!0});await ge({env:s,businessId:r,paymentId:n,status:"paid",customerPackageId:o||u?.customer_package_id||null});try{let p=await ye({env:s,businessId:r,paymentId:n,baseUrl:i});p&&p.ok===!1&&console.error("Automatic Stripe payment receipt failed:",p.error||p.reason||"Unknown receipt error")}catch(p){console.error("Automatic Stripe payment receipt failed:",p)}let d=String(e?.metadata?.appointment_id||"").trim();if(String(e?.metadata?.public_booking||"")==="1"&&d){await s.DB.prepare(`
          UPDATE appointments
          SET
            status = 'confirmed',
            updated_at =
              CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
            AND status = 'pending'
        `).bind(d,r).run();try{let p=await le({env:s,businessId:r,appointmentId:d,type:"booking_confirmation",uniqueKey:`booking_confirmation:${d}`,baseUrl:i});p&&p.ok===!1&&console.error("Automatic booking confirmation failed:",d,p.error||p.reason||"Unknown confirmation error")}catch(p){console.error("Automatic booking confirmation failed:",d,p)}try{await Ce({env:s,businessId:r,appointmentId:d,triggerEvent:"booking_confirmed",baseUrl:i})}catch(p){console.error("Booking-confirmed form automation failed:",d,p)}try{await Ce({env:s,businessId:r,appointmentId:d,triggerEvent:"payment_received",baseUrl:i})}catch(p){console.error("Payment-received form automation failed:",d,p)}}}else await Ye({env:s,session:e,paid:!1}),await ge({env:s,businessId:r,paymentId:n,status:"failed"}),await s.DB.prepare(`
        UPDATE payments

        SET
          status = 'failed',
          provider_reference =
            COALESCE(
              provider_reference,
              ?
            ),
          notes =
            'Stripe Checkout did not complete',
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
          AND status = 'pending'
      `).bind(e.id||null,n,r).run()}c(Fn,"updatePaymentFromSession");async function Cu({integration:s,refund:e}){let t=typeof e?.payment_intent=="string"?e.payment_intent:e?.payment_intent?.id||"";if(!t&&e?.charge){let n=typeof e.charge=="string"?e.charge:e.charge?.id||"";if(n){let r=await X({secretKey:s.secretKey,path:`/v1/charges/${encodeURIComponent(n)}`});r.response.ok&&(t=typeof r.data?.payment_intent=="string"?r.data.payment_intent:r.data?.payment_intent?.id||"")}}if(!t)return null;let i=await X({secretKey:s.secretKey,path:`/v1/checkout/sessions?payment_intent=${encodeURIComponent(t)}&limit=1`});return i.response.ok&&i.data?.data?.[0]||null}c(Cu,"getCheckoutSessionForRefund");async function Ou({env:s,businessId:e,paymentId:t}){let i=await s.DB.prepare(`
        SELECT
          p.amount_minor,
          COALESCE(
            (
              SELECT SUM(r.amount_minor)
              FROM payments r
              WHERE
                r.business_id = p.business_id
                AND r.payment_type = 'refund'
                AND r.status = 'paid'
                AND instr(
                  COALESCE(r.notes, ''),
                  ?
                ) > 0
            ),
            0
          ) AS refunded_minor
        FROM payments p
        WHERE
          p.id = ?
          AND p.business_id = ?
        LIMIT 1
      `).bind(`original_payment=${t}`,t,e).first();if(!i)return;let n=Number(i.amount_minor||0),r=Number(i.refunded_minor||0),a=r<=0?"paid":r>=n?"refunded":"partially_refunded";await s.DB.prepare(`
      UPDATE payments
      SET
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        id = ?
        AND business_id = ?
    `).bind(a,t,e).run()}c(Ou,"refreshOriginalPaymentRefundStatus");async function Iu({env:s,integration:e,refund:t,businessId:i}){let n=String(t?.id||"").trim();if(!n)return;let r=await Cu({integration:e,refund:t}),a=String(r?.metadata?.payment_id||"").trim(),o=String(r?.metadata?.business_id||"").trim();if(!a||o!==i)return;let u=await s.DB.prepare(`
        SELECT
          id,
          appointment_id,
          customer_id,
          provider,
          payment_method,
          amount_minor,
          currency
        FROM payments
        WHERE
          id = ?
          AND business_id = ?
        LIMIT 1
      `).bind(a,i).first();if(!u)return;let d=String(t?.status||"").toLowerCase(),l=d==="succeeded"?"paid":d==="failed"||d==="canceled"?"failed":"pending",p=Math.max(0,Number(t?.amount||0)),m=`stripe_refund_${n}`,_=`original_payment=${a} \xB7 Stripe refund ${n}`;await s.DB.prepare(`
      INSERT INTO payments (
        id,
        business_id,
        appointment_id,
        customer_id,
        provider,
        payment_type,
        amount_minor,
        currency,
        status,
        provider_reference,
        paid_at,
        payment_method,
        notes,
        updated_at
      )
      VALUES (
        ?, ?, ?, ?, 'stripe', 'refund', ?, ?, ?, ?,
        CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END,
        ?, ?, CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        amount_minor = excluded.amount_minor,
        status = excluded.status,
        paid_at = CASE
          WHEN excluded.status = 'paid'
          THEN COALESCE(payments.paid_at, CURRENT_TIMESTAMP)
          ELSE payments.paid_at
        END,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `).bind(m,i,u.appointment_id||null,u.customer_id||null,p,String(t?.currency||u.currency||"GBP").toUpperCase(),l,n,l,u.payment_method||"card",_).run(),await Ou({env:s,businessId:i,paymentId:a})}c(Iu,"updatePaymentFromRefund");async function Wn({request:s,env:e}){try{let t=new URL(s.url),i=String(t.searchParams.get("business_id")||"").trim();if(!i)return new Response("Missing business_id",{status:400});let n=await Q(e,i);if(n.error||!n.webhookSecret)return new Response("Webhook is not configured",{status:503});let r=await s.text(),a=s.headers.get("Stripe-Signature");if(!await vu({payload:r,signatureHeader:a,secret:n.webhookSecret}))return new Response("Invalid Stripe signature",{status:400});let u;try{u=JSON.parse(r)}catch{return new Response("Invalid JSON",{status:400})}let d=u?.data?.object;switch(u?.type){case"checkout.session.completed":case"checkout.session.async_payment_succeeded":d?.payment_status==="paid"&&await Fn({env:e,session:d,paid:!0,baseUrl:new URL(s.url).origin});break;case"refund.created":case"refund.updated":case"refund.failed":await Iu({env:e,integration:n,refund:d,businessId:i});break;case"checkout.session.async_payment_failed":case"checkout.session.expired":await Fn({env:e,session:d,paid:!1,baseUrl:new URL(s.url).origin});break;default:break}return new Response("ok",{status:200})}catch(t){return console.error("Stripe webhook failed:",t),new Response("Webhook processing failed",{status:500})}}c(Wn,"onRequestPost");var os="If an active account exists for that email address, a password reset link has been sent.";function Lu(s){let e=new URL(s.url),t=String(s.headers.get("X-Eselram-Admin-Origin")||"").trim();if(t)try{let i=new URL(t);if(i.protocol==="https:"&&i.hostname.endsWith(".eselram.com"))return i.origin}catch{}return e.origin}c(Lu,"adminOrigin");function $n(s){return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}c($n,"escapeHtml");async function Jn({request:s,env:e}){try{let t=await s.json().catch(()=>({})),i=String(t.email||"").trim().toLowerCase();if(!i||!i.includes("@"))return Response.json({ok:!0,message:os});let n=await e.DB.prepare(`
        SELECT
          u.id,
          u.business_id,
          u.name,
          u.email,
          u.is_active,
          b.name AS business_name
        FROM users u
        JOIN businesses b
          ON b.id = u.business_id
        WHERE u.email = ? COLLATE NOCASE
          AND u.is_active = 1
        LIMIT 1
      `).bind(i).first();if(!n)return Response.json({ok:!0,message:os});let r=kt(),a=await D(r),o=new Date(Date.now()+1800*1e3).toISOString();await e.DB.batch([e.DB.prepare(`
          UPDATE password_reset_tokens
          SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP)
          WHERE user_id = ? AND used_at IS NULL
        `).bind(n.id),e.DB.prepare(`
          INSERT INTO password_reset_tokens (
            id,
            user_id,
            token_hash,
            expires_at,
            user_agent
          )
          VALUES (?, ?, ?, ?, ?)
        `).bind(`prt_${crypto.randomUUID()}`,n.id,a,o,s.headers.get("User-Agent")||null)]);let u=`${Lu(s)}/auth/reset-password/?token=${encodeURIComponent(r)}`,d=String(n.business_name||"Eselram").trim(),l=String(n.name||"").trim(),p=`Reset your ${d} Eselram password`,m=[l?`Hello ${l},`:"Hello,","","A password reset was requested for your Eselram account.","",`Reset your password: ${u}`,"","This link expires in 30 minutes and can only be used once.","If you did not request this, you can ignore this email."].join(`
`),_=`
      <p>${l?`Hello ${$n(l)},`:"Hello,"}</p>
      <p>A password reset was requested for your Eselram account.</p>
      <p>
        <a href="${$n(u)}">Reset your password</a>
      </p>
      <p>This link expires in 30 minutes and can only be used once.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `;try{await De(e,n.business_id,{to:n.email,subject:p,html:_,text:m})}catch(g){console.error("Password reset email could not be sent:",g?.message||g)}return Response.json({ok:!0,message:os})}catch(t){return console.error("Password reset request failed:",t),Response.json({ok:!0,message:os})}}c(Jn,"onRequestPost");async function Gn({request:s,env:e}){try{let t=await s.json(),i=String(t.email||"").trim().toLowerCase(),n=String(t.password||"");if(!i||!n)return Response.json({ok:!1,error:"Email and password are required."},{status:400});let r=await e.DB.prepare(`
          SELECT
            id,
            business_id,
            name,
            email,
            password_hash,
            is_active

          FROM users

          WHERE email = ?

          LIMIT 1
        `).bind(i).first();if(!r||r.is_active!==1)return Response.json({ok:!1,error:"Invalid email or password."},{status:401});if(!await Hi(n,r.password_hash))return Response.json({ok:!1,error:"Invalid email or password."},{status:401});let o=kt(),u=await D(o),d=`ses_${crypto.randomUUID()}`,l=new Date(Date.now()+10080*60*1e3).toISOString();return await e.DB.prepare(`
        INSERT INTO user_sessions (
          id,
          user_id,
          token_hash,
          expires_at,
          last_seen_at,
          user_agent
        )

        VALUES (
          ?, ?, ?, ?,
          CURRENT_TIMESTAMP,
          ?
        )
      `).bind(d,r.id,u,l,s.headers.get("User-Agent")||null).run(),await e.DB.prepare(`
        UPDATE users

        SET
          last_login_at =
            CURRENT_TIMESTAMP,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = ?
      `).bind(r.id).run(),Response.json({ok:!0,user:{id:r.id,name:r.name,email:r.email}},{headers:{"Set-Cookie":Yt(o),"Cache-Control":"no-store"}})}catch(t){return console.error("Login failed:",t),Response.json({ok:!1,error:"Unable to sign in."},{status:500})}}c(Gn,"onRequestPost");async function Yn({request:s,env:e}){try{let t=C(s);if(t){let i=await D(t);await e.DB.prepare(`
          UPDATE user_sessions

          SET
            revoked_at =
              CURRENT_TIMESTAMP

          WHERE
            token_hash = ?
            AND revoked_at IS NULL
        `).bind(i).run()}return Response.json({ok:!0},{headers:{"Set-Cookie":Fi(),"Cache-Control":"no-store"}})}catch(t){return console.error("Logout failed:",t),Response.json({ok:!1,error:"Unable to sign out."},{status:500})}}c(Yn,"onRequestPost");async function Kn({request:s,env:e}){try{let t=C(s);if(!t)return Response.json({ok:!0,authenticated:!1},{headers:{"Cache-Control":"no-store"}});let i=await D(t),n=await e.DB.prepare(`
          SELECT
            s.id AS session_id,
            s.expires_at,
            s.revoked_at,

            u.id AS user_id,
            u.name,
            u.email,
            u.business_id

          FROM user_sessions s

          JOIN users u
            ON u.id = s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(i).first();if(!n)return Response.json({ok:!0,authenticated:!1},{headers:{"Cache-Control":"no-store"}});let r=await e.DB.prepare(`
          SELECT role_key

          FROM user_roles

          WHERE user_id = ?
        `).bind(n.user_id).all();return Response.json({ok:!0,authenticated:!0,user:{id:n.user_id,name:n.name,email:n.email,business_id:n.business_id,roles:r.results.map(a=>a.role_key)}},{headers:{"Cache-Control":"no-store"}})}catch(t){return console.error("Session check failed:",t),Response.json({ok:!1,authenticated:!1,error:"Unable to verify session."},{status:500})}}c(Kn,"onRequestGet");async function zn({request:s,env:e}){try{let t=await s.json().catch(()=>({})),i=String(t.token||"").trim(),n=String(t.password||"");if(!i)return Response.json({ok:!1,error:"This password reset link is invalid or has expired."},{status:400});if(n.length<12)return Response.json({ok:!1,error:"Password must contain at least 12 characters."},{status:400});let r=await D(i),a=await e.DB.prepare(`
        SELECT
          prt.id,
          prt.user_id
        FROM password_reset_tokens prt
        JOIN users u
          ON u.id = prt.user_id
        WHERE prt.token_hash = ?
          AND prt.used_at IS NULL
          AND datetime(prt.expires_at) > datetime('now')
          AND u.is_active = 1
        LIMIT 1
      `).bind(r).first();if(!a)return Response.json({ok:!1,error:"This password reset link is invalid or has expired."},{status:400});let o=await Gt(n),u=await e.DB.prepare(`
        UPDATE password_reset_tokens
        SET used_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND used_at IS NULL
          AND datetime(expires_at) > datetime('now')
      `).bind(a.id).run();return Number(u?.meta?.changes||0)!==1?Response.json({ok:!1,error:"This password reset link is invalid or has expired."},{status:400}):(await e.DB.batch([e.DB.prepare(`
          UPDATE users
          SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(o,a.user_id),e.DB.prepare(`
          UPDATE user_sessions
          SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
          WHERE user_id = ? AND revoked_at IS NULL
        `).bind(a.user_id),e.DB.prepare(`
          UPDATE password_reset_tokens
          SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP)
          WHERE user_id = ? AND id <> ? AND used_at IS NULL
        `).bind(a.user_id,a.id)]),Response.json({ok:!0,message:"Your password has been reset. You can now sign in with your new password."}))}catch(t){return console.error("Password reset failed:",t),Response.json({ok:!1,error:"Unable to reset your password. Please request a new reset link."},{status:500})}}c(zn,"onRequestPost");async function Mu(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(Mu,"getUserContext");function xu(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(xu,"unauthorized");function Vn(s){let[e,t]=s.split(":").map(Number);return e*60+t}c(Vn,"timeToMinutes");function Pu(s){let e=Math.floor(s/60),t=s%60;return`${String(e).padStart(2,"0")}:${String(t).padStart(2,"0")}`}c(Pu,"minutesToTime");function Uu(s){let t=new Date(`${s}T12:00:00Z`).getUTCDay();return t===0?7:t}c(Uu,"weekdayFromDate");async function Xn({request:s,env:e}){try{let t=await Mu(s,e);if(!t)return xu();let i=new URL(s.url),n=String(i.searchParams.get("service_id")||"").trim(),r=String(i.searchParams.get("date")||"").trim(),a=String(i.searchParams.get("exclude_appointment_id")||"").trim();if(!n||!/^\d{4}-\d{2}-\d{2}$/.test(r))return Response.json({ok:!1,error:"service_id and date are required."},{status:400});let o=await e.DB.prepare(`
          SELECT
            id,
            name,
            duration_minutes,
            is_active
          FROM services
          WHERE
            id = ?
            AND business_id = ?
          LIMIT 1
        `).bind(n,t.business_id).first();if(!o||o.is_active!==1)return Response.json({ok:!1,error:"Service not found."},{status:404});let u=await e.DB.prepare(`
          SELECT
            timezone,
            booking_buffer_before_minutes,
            booking_buffer_after_minutes
          FROM businesses
          WHERE id = ?
          LIMIT 1
        `).bind(t.business_id).first(),d=await e.DB.prepare(`
          SELECT setting_value
          FROM business_settings
          WHERE
            business_id = ?
            AND setting_key =
              'public_booking_blocked_dates'
          LIMIT 1
        `).bind(t.business_id).first(),l=[];try{l=JSON.parse(d?.setting_value||"[]")}catch{l=[]}let p=(Array.isArray(l)?l:[]).map(T=>{let O=String(T?.date||"").trim();return{start_date:String(T?.start_date||O||"").trim(),end_date:String(T?.end_date||O||T?.start_date||"").trim(),reason:String(T?.reason||"").trim()}}).find(T=>T.start_date&&T.end_date&&r>=T.start_date&&r<=T.end_date);if(p)return Response.json({ok:!0,date:r,service:{id:o.id,name:o.name,duration_minutes:o.duration_minutes},timezone:u?.timezone||"Europe/London",slots:[],reason:p.reason?`This date is blocked: ${p.reason}.`:"This date is blocked."});let m=Uu(r),_=await e.DB.prepare(`
          SELECT
            is_open,
            open_time,
            close_time,
            booking_interval_minutes
          FROM working_hours
          WHERE
            business_id = ?
            AND weekday = ?
          LIMIT 1
        `).bind(t.business_id,m).first();if(!_||_.is_open!==1)return Response.json({ok:!0,date:r,service:{id:o.id,name:o.name,duration_minutes:o.duration_minutes},timezone:u?.timezone||"Europe/London",slots:[]});let g=`
  SELECT
    id,
    start_at,
    end_at

  FROM appointments

  WHERE
    business_id = ?
    AND status != 'cancelled'
    AND date(start_at) = ?
`,E=[t.business_id,r];a&&(g+=`
    AND id != ?
  `,E.push(a)),g+=`
  ORDER BY
    datetime(start_at) ASC
`;let f=await e.DB.prepare(g).bind(...E).all(),b=Number(_.booking_interval_minutes||30),N=Number(o.duration_minutes),v=Number(u?.booking_buffer_before_minutes||0),S=Number(u?.booking_buffer_after_minutes||0),h=Vn(_.open_time),I=Vn(_.close_time),R=(f.results||[]).map(T=>{let O=new Date(T.start_at),w=new Date(T.end_at);return{start:O.getHours()*60+O.getMinutes()-v,end:w.getHours()*60+w.getMinutes()+S}}),L=[];for(let T=h;T+N<=I;T+=b){let O=T+N;R.some(B=>T<B.end&&O>B.start)||L.push(Pu(T))}return Response.json({ok:!0,date:r,service:{id:o.id,name:o.name,duration_minutes:o.duration_minutes},timezone:u?.timezone||"Europe/London",booking_interval_minutes:b,buffer_before_minutes:v,buffer_after_minutes:S,slots:L})}catch(t){return console.error("Availability lookup failed:",t),Response.json({ok:!1,error:"Unable to load availability."},{status:500})}}c(Xn,"onRequestGet");async function ni(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) >
            datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(ni,"getUserContext");function ri(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(ri,"unauthorized");function Zn(s,e){let t=Pe(s)||bt(s),i=e&&typeof e=="object"?e:{},n=Array.isArray(i.sections)?i.sections:[];if(n.length<1||n.length>12)return null;let r=[];for(let a of n){let o=Array.isArray(a)?a:[a?.title,a?.items],u=String(o[0]||"").trim().slice(0,120),d=(Array.isArray(o[1])?o[1]:[]).map(l=>String(l||"").trim().slice(0,600)).filter(Boolean).slice(0,30);if(!u||!d.length)return null;r.push([u,d])}return{key:t.key||"custom_service",serviceLabel:String(i.serviceLabel||t.serviceLabel||s).trim().slice(0,120)||s,sections:r,note:String(i.note||"").trim().slice(0,3e3)}}c(Zn,"cleanTemplate");async function Qn(s,e){return(await s.DB.prepare(`
        SELECT
          COALESCE(
            NULLIF(
              TRIM(
                booking_group
              ),
              ''
            ),
            name
          ) AS group_name,

          MIN(sort_order) AS group_sort,

          MIN(id) AS representative_service_id

        FROM services

        WHERE
          business_id = ?
          AND is_active = 1
          AND COALESCE(
            service_type,
            'standard'
          ) != 'consultation'

        GROUP BY
          COALESCE(
            NULLIF(
              TRIM(
                booking_group
              ),
              ''
            ),
            name
          )

        ORDER BY
          group_sort ASC,
          group_name COLLATE NOCASE ASC
      `).bind(e).all()).results||[]}c(Qn,"groupRows");async function er(s,e,t){return(await Qn(s,e)).find(n=>String(n.group_name||"")===t)||null}c(er,"validGroup");async function Bu(s,e){let t=await s.DB.prepare(`
        SELECT
          setting_key,
          setting_value

        FROM business_settings

        WHERE
          business_id = ?
          AND setting_key LIKE
            'communications.aftercare.group.%'
      `).bind(e).all(),i={};for(let n of t.results||[]){let r=String(n.setting_key||"").replace("communications.aftercare.group.",""),a="";try{a=decodeURIComponent(r)}catch{a=r}try{i[a]=JSON.parse(n.setting_value)}catch{i[a]=null}}return i}c(Bu,"storedGroupSettings");async function qu({env:s,businessId:e,groupName:t,value:i}){await s.DB.prepare(`
      INSERT INTO business_settings (
        id,
        business_id,
        setting_key,
        setting_value,
        value_type
      )
      VALUES (?, ?, ?, ?, 'json')

      ON CONFLICT(
        business_id,
        setting_key
      )

      DO UPDATE SET
        setting_value =
          excluded.setting_value,
        value_type =
          'json',
        updated_at =
          CURRENT_TIMESTAMP
    `).bind(`set_${crypto.randomUUID()}`,e,ii(t),JSON.stringify(i)).run()}c(qu,"upsertGroupSetting");async function tr({request:s,env:e}){try{let t=await ni(s,e);if(!t)return ri();let[i,n,r]=await Promise.all([Qn(e,t.business_id),Bu(e,t.business_id),ss(e,t.business_id)]),a=[];for(let o of i){let u=String(o.group_name||""),d=n[u],l=Pe(u),p=l?r[l.key]||l:bt(u),m=d?d.enabled!==!1:!!l,_=d&&Zn(u,d.template||d)||p;a.push({service_id:u,service_name:u,enabled:m,customised:!!d,has_eselram_starter:!!l,starter_key:l?.key||null,template:_})}return Response.json({ok:!0,services:a,legacy_templates:si()})}catch(t){return console.error("Aftercare templates GET failed:",t),Response.json({ok:!1,error:"Unable to load aftercare."},{status:500})}}c(tr,"onRequestGet");async function sr({request:s,env:e}){try{let t=await ni(s,e);if(!t)return ri();let i=await s.json(),n=String(i.service_id||i.group_name||"").trim().slice(0,160);if(!await er(e,t.business_id,n))return Response.json({ok:!1,error:"Choose a valid treatment service group."},{status:400});let a=i.enabled!==!1,o=Zn(n,i.template);if(a&&!o)return Response.json({ok:!1,error:"Every aftercare section needs a heading and at least one instruction."},{status:400});let u=Pe(n)||bt(n);return await qu({env:e,businessId:t.business_id,groupName:n,value:{enabled:a,template:o||u}}),Response.json({ok:!0,service_id:n,enabled:a,template:o||u})}catch(t){return console.error("Aftercare template PUT failed:",t),Response.json({ok:!1,error:"Unable to save aftercare."},{status:500})}}c(sr,"onRequestPut");async function ir({request:s,env:e}){try{let t=await ni(s,e);if(!t)return ri();let i=new URL(s.url),n=String(i.searchParams.get("service_id")||i.searchParams.get("group_name")||"").trim().slice(0,160);if(!await er(e,t.business_id,n))return Response.json({ok:!1,error:"Invalid treatment service group."},{status:400});await e.DB.prepare(`
        DELETE FROM business_settings

        WHERE
          business_id = ?
          AND setting_key = ?
      `).bind(t.business_id,ii(n)).run();let a=Pe(n),o=a?(await ss(e,t.business_id))[a.key]||a:bt(n);return Response.json({ok:!0,service_id:n,enabled:!!a,template:o,restored_to:a?"eselram_starter":"off"})}catch(t){return console.error("Aftercare template DELETE failed:",t),Response.json({ok:!1,error:"Unable to restore aftercare."},{status:500})}}c(ir,"onRequestDelete");async function ai(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) >
            datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(ai,"getUserContext");function oi(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(oi,"unauthorized");async function vt({env:s,businessId:e,key:t,value:i}){await s.DB.prepare(`
      INSERT INTO business_settings (
        id,
        business_id,
        setting_key,
        setting_value,
        value_type
      )
      VALUES (
        ?, ?, ?, ?, 'json'
      )

      ON CONFLICT(
        business_id,
        setting_key
      )

      DO UPDATE SET
        setting_value =
          excluded.setting_value,
        value_type =
          'json',
        updated_at =
          CURRENT_TIMESTAMP
    `).bind(`set_${crypto.randomUUID()}`,e,t,JSON.stringify(i)).run()}c(vt,"upsertJson");async function ju(s,e){return((await s.DB.prepare(`
        SELECT
          COALESCE(
            NULLIF(
              TRIM(
                booking_group
              ),
              ''
            ),
            name
          ) AS group_name,

          MAX(
            CASE
              WHEN
                COALESCE(
                  requires_consultation,
                  0
                ) = 1
              THEN 1
              ELSE 0
            END
          ) AS has_consultation,

          MAX(CASE WHEN COALESCE(requires_patch_test, 0) = 1 THEN 1 ELSE 0 END) AS has_patch_test

        FROM services

        WHERE
          business_id = ?
          AND is_active = 1
          AND COALESCE(
            service_type,
            'standard'
          ) != 'consultation'

        GROUP BY
          COALESCE(
            NULLIF(
              TRIM(
                booking_group
              ),
              ''
            ),
            name
          )

        ORDER BY
          MIN(sort_order) ASC,
          group_name COLLATE NOCASE ASC
      `).bind(e).all()).results||[]).map(i=>({name:String(i.group_name||""),kind:Number(i.has_consultation||0)===1?"consultation":"standard",patch_required:Number(i.has_patch_test||0)===1}))}c(ju,"bookingGroups");async function nr({request:s,env:e}){try{let t=await ai(s,e);if(!t)return oi();let[i,n,r,a,o]=await Promise.all([vn(e,t.business_id),jt(e,t.business_id),At(e,t.business_id),wt(e,t.business_id),ju(e,t.business_id)]);return Response.json({ok:!0,email_templates:i,email_defaults:Tt,email_customised:Object.keys(n),email_variable_rules:Gs,booking_groups:o.map(u=>({...u,default_copy:Js[u.kind],copy:r[u.name]||Js[u.kind],customised:!!r[u.name],patch_test_copy:a[u.name]||wn,patch_test_customised:!!a[u.name]})),booking_variables:{consultation:["{{consultation_duration}}","{{consultation_payment}}","{{consultation_credit_sentence}}","{{patch_test_sentence}}","{{post_consultation_sentence}}"],standard:["{{group_name}}"]}})}catch(t){return console.error("Communications content GET failed:",t),Response.json({ok:!1,error:"Unable to load communication content."},{status:500})}}c(nr,"onRequestGet");async function rr({request:s,env:e}){try{let t=await ai(s,e);if(!t)return oi();let i=await s.json(),n=String(i.kind||"").trim();if(n==="email"){let r=String(i.key||"").trim(),a=Dn(r,i.template);if(!a)return Response.json({ok:!1,error:"Invalid email template."},{status:400});let o=Gs[r]||{allowed:[],required:{}},u=["subject","title","intro","closing"],d=[],l=[];for(let m of u){let g=[...String(a[m]||"").matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map(E=>E[1]);for(let E of g)o.allowed.includes(E)||d.push(`{{${E}}}`);for(let E of o.required[m]||[])g.includes(E)||l.push(`{{${E}}} in ${m}`)}if(d.length||l.length)return Response.json({ok:!1,error:d.length?`Unknown or mistyped variable: ${[...new Set(d)].join(", ")}. Use the variable buttons provided.`:`Required information is missing: ${[...new Set(l)].join(", ")}.`},{status:400});let p=await jt(e,t.business_id);return p[r]={subject:a.subject,title:a.title,intro:a.intro,closing:a.closing},await vt({env:e,businessId:t.business_id,key:Vs(),value:p}),Response.json({ok:!0,template:a})}if(n==="booking_copy"){let r=String(i.group||"").trim().slice(0,160),a=String(i.copy||"").trim().slice(0,4e3);if(!r||!a)return Response.json({ok:!1,error:"Booking group and wording are required."},{status:400});let o=["group_name","consultation_duration","consultation_payment","consultation_credit_sentence","patch_test_sentence","post_consultation_sentence"],u=[...a.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map(l=>l[1]).filter(l=>!o.includes(l));if(u.length)return Response.json({ok:!1,error:`Unknown or mistyped variable: {{${u[0]}}}. Use the variable buttons provided.`},{status:400});let d=await At(e,t.business_id);return d[r]=a,await vt({env:e,businessId:t.business_id,key:Xs(),value:d}),Response.json({ok:!0,copy:a})}if(n==="booking_patch_test_copy"){let r=String(i.group||"").trim().slice(0,160),a=String(i.copy||"").trim().slice(0,4e3);if(!r||!a)return Response.json({ok:!1,error:"Booking group and patch-test wording are required."},{status:400});let o=[...a.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map(d=>d[1]).filter(d=>!["group_name","service_name"].includes(d));if(o.length)return Response.json({ok:!1,error:`Unknown or mistyped variable: {{${o[0]}}}.`},{status:400});let u=await wt(e,t.business_id);return u[r]=a,await vt({env:e,businessId:t.business_id,key:Zs(),value:u}),Response.json({ok:!0,copy:a})}return Response.json({ok:!1,error:"Unsupported communication content."},{status:400})}catch(t){return console.error("Communications content PUT failed:",t),Response.json({ok:!1,error:"Unable to save communication content."},{status:500})}}c(rr,"onRequestPut");async function ar({request:s,env:e}){try{let t=await ai(s,e);if(!t)return oi();let i=new URL(s.url),n=String(i.searchParams.get("kind")||"").trim();if(n==="email"){let r=String(i.searchParams.get("key")||"").trim();if(!Tt[r])return Response.json({ok:!1,error:"Invalid email template."},{status:400});let a=await jt(e,t.business_id);return delete a[r],await vt({env:e,businessId:t.business_id,key:Vs(),value:a}),Response.json({ok:!0,template:Tt[r]})}if(n==="booking_copy"){let r=String(i.searchParams.get("group")||"").trim(),a=await At(e,t.business_id);return delete a[r],await vt({env:e,businessId:t.business_id,key:Xs(),value:a}),Response.json({ok:!0})}if(n==="booking_patch_test_copy"){let r=String(i.searchParams.get("group")||"").trim(),a=await wt(e,t.business_id);return delete a[r],await vt({env:e,businessId:t.business_id,key:Zs(),value:a}),Response.json({ok:!0})}return Response.json({ok:!1,error:"Unsupported communication content."},{status:400})}catch(t){return console.error("Communications content DELETE failed:",t),Response.json({ok:!1,error:"Unable to restore communication content."},{status:500})}}c(ar,"onRequestDelete");function Hu(s,e){let t=String(s||""),i=String(e||"");if(!t||t.length!==i.length)return!1;let n=0;for(let r=0;r<t.length;r+=1)n|=t.charCodeAt(r)^i.charCodeAt(r);return n===0}c(Hu,"safeEqual");async function or({request:s,env:e}){try{let t=String(e.ESELRAM_CRON_SECRET||"").trim(),i=String(s.headers.get("Authorization")||""),n=i.startsWith("Bearer ")?i.slice(7):"";if(!t||!Hu(n,t))return new Response("Unauthorized",{status:401});let r=await is({env:e}),a=await as({env:e,baseUrl:e.ESELRAM_BASE_URL||null});return Response.json({ok:!0,checked:Number(r.checked||0)+Number(a.checked||0),sent:Number(r.sent||0)+Number(a.sent||0),failed:Number(r.failed||0)+Number(a.failed||0),appointment_reminders:r,form_reminders:a})}catch(t){return console.error("Reminder scheduler failed:",t),Response.json({ok:!1,error:"Unable to run reminder scheduler."},{status:500})}}c(or,"onRequestPost");async function Fu(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare("SELECT u.id AS user_id,u.business_id FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND u.is_active=1 LIMIT 1").bind(i).first()}c(Fu,"getUserContext");function Wu(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Wu,"unauthorized");async function cr({request:s,env:e}){try{let t=await Fu(s,e);if(!t)return Wu();let i=await s.json(),n=String(i.form_request_id||"").trim();if(!n)return Response.json({ok:!1,error:"Form request id is required."},{status:400});let r=await rs({env:e,businessId:t.business_id,formRequestId:n,baseUrl:new URL(s.url).origin,reminder:i.reminder===!0,force:i.force===!0});return r.ok?Response.json({ok:!0,duplicate:r.duplicate===!0,skipped:r.skipped===!0,provider_id:r.provider_id||null}):Response.json({ok:!1,error:r.error||"Unable to send client form."},{status:400})}catch(t){return console.error("Client form email send failed:",t),Response.json({ok:!1,error:"Unable to send client form email."},{status:500})}}c(cr,"onRequestPost");async function ur(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(ur,"getAuthenticatedUser");async function dr({request:s,env:e}){try{let t=new URL(s.url),i=String(t.searchParams.get("mode")||"").trim(),n=String(t.searchParams.get("template_id")||"").trim(),r=String(t.searchParams.get("token")||"").trim(),a=String(t.searchParams.get("request_token")||"").trim(),o=null,u=null,d=null;if(i==="preview"){let f=await ur(s,e);if(!f)return Response.json({ok:!1,error:"Authentication required."},{status:401});if(!n)return Response.json({ok:!1,error:"template_id is required."},{status:400});o=await e.DB.prepare(`
          SELECT
            id,
            business_id,
            name,
            description,
            template_type,
            is_published,
            public_token
          FROM clinical_templates
          WHERE
            id = ?
            AND business_id = ?
          LIMIT 1
        `).bind(n,f.business_id).first(),u=f.business_id}else if(a){let f=a.startsWith("fri_"),b=f?await ur(s,e):null;if(f&&!b)return Response.json({ok:!1,error:"Authentication required."},{status:401});d=await e.DB.prepare(f?`
                SELECT
                  r.id, r.business_id, r.template_id, r.customer_id,
                  r.appointment_id, r.status, r.expires_at,
                  t.name, t.description, t.template_type,
                  t.is_published, t.public_token
                FROM clinical_form_requests r
                JOIN clinical_templates t ON t.id = r.template_id
                WHERE
                  r.request_token = ?
                  AND r.business_id = ?
                  AND r.status IN ('created', 'opened')
                  AND datetime(r.expires_at) > datetime('now')
                  AND t.is_active = 1
                LIMIT 1
              `:`
                SELECT
                  r.id, r.business_id, r.template_id, r.customer_id,
                  r.appointment_id, r.status, r.expires_at,
                  t.name, t.description, t.template_type,
                  t.is_published, t.public_token
                FROM clinical_form_requests r
                JOIN clinical_templates t ON t.id = r.template_id
                WHERE
                  r.request_token = ?
                  AND r.status IN ('created', 'opened')
                  AND datetime(r.expires_at) > datetime('now')
                  AND t.is_active = 1
                  AND t.is_client_sendable = 1
                LIMIT 1
              `).bind(...f?[a,b.business_id]:[a]).first(),d&&(o={id:d.template_id,business_id:d.business_id,name:d.name,description:d.description,template_type:d.template_type,is_published:d.is_published,public_token:d.public_token},u=d.business_id,d.status==="created"&&(await e.DB.prepare(`
              UPDATE clinical_form_requests
              SET
                status = 'opened',
                opened_at = COALESCE(
                  opened_at,
                  CURRENT_TIMESTAMP
                )
              WHERE
                id = ?
                AND status = 'created'
            `).bind(d.id).run(),d.status="opened"))}else{if(!r)return Response.json({ok:!1,error:"Form token is required."},{status:400});o=await e.DB.prepare(`
          SELECT
            id,
            business_id,
            name,
            description,
            template_type,
            is_published,
            public_token
          FROM clinical_templates
          WHERE
            public_token = ?
            AND is_published = 1
            AND is_active = 1
          LIMIT 1
        `).bind(r).first(),u=o?.business_id||null}if(!o)return Response.json({ok:!1,error:"Form not found or unavailable."},{status:404});let[l,p,m,_]=await Promise.all([e.DB.prepare(`
          SELECT
            id,
            title,
            description,
            sort_order,
            condition_json
          FROM clinical_template_sections
          WHERE
            business_id = ?
            AND template_id = ?
          ORDER BY sort_order ASC
        `).bind(u,o.id).all(),e.DB.prepare(`
          SELECT
            id,
            section_id,
            label,
            field_key,
            field_type,
            help_text,
            placeholder,
            options_json,
            is_required,
            sort_order,
            condition_json
          FROM clinical_template_fields
          WHERE
            business_id = ?
            AND template_id = ?
          ORDER BY sort_order ASC
        `).bind(u,o.id).all(),e.DB.prepare(`
          SELECT
            id,
            name
          FROM businesses
          WHERE id = ?
          LIMIT 1
        `).bind(u).first(),e.DB.prepare(`
          SELECT
            logo_data_url,
            primary_colour,
            accent_colour,
            background_colour,
            surface_colour,
            text_colour,
            form_style,
            logo_position,
            show_business_name,
            show_contact_details,
            footer_text
          FROM business_branding
          WHERE business_id = ?
          LIMIT 1
        `).bind(u).first()]),g=(l.results||[]).map(f=>({...f,condition:ci(f.condition_json,null),fields:[]})),E=new Map(g.map(f=>[f.id,f]));for(let f of p.results||[]){let b=E.get(f.section_id);b&&b.fields.push({...f,options:ci(f.options_json,[]),condition:ci(f.condition_json,null),multiple:0})}return Response.json({ok:!0,preview:i==="preview",request:d?{id:d.id,customer_id:d.customer_id,appointment_id:d.appointment_id,status:d.status}:null,business:{id:m?.id,name:m?.name||"Business",contact_line:m?.name||""},branding:_||{logo_data_url:null,primary_colour:"#365c50",accent_colour:"#6f8079",background_colour:"#f5f4ef",surface_colour:"#ffffff",text_colour:"#18221f",form_style:"soft",logo_position:"centre",show_business_name:1,show_contact_details:1,footer_text:null},template:{id:o.id,name:o.name,description:o.description,template_type:o.template_type,is_published:o.is_published,public_token:o.public_token,sections:g}})}catch(t){return console.error("Form renderer lookup failed:",t),Response.json({ok:!1,error:"Unable to load form."},{status:500})}}c(dr,"onRequestGet");function ci(s,e){if(!s)return e;try{return JSON.parse(s)}catch{return e}}c(ci,"parseJson");async function $u(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c($u,"getUserContext");async function lr({request:s,env:e}){try{let t=await $u(s,e);if(!t)return Response.json({ok:!1,error:"Authentication required."},{status:401});let i=await s.json(),n=String(i.template_id||"").trim(),r=i.publish!==!1;if(!n)return Response.json({ok:!1,error:"template_id is required."},{status:400});let a=await e.DB.prepare(`
        SELECT
          id,
          public_token
        FROM clinical_templates
        WHERE
          id = ?
          AND business_id = ?
        LIMIT 1
      `).bind(n,t.business_id).first();if(!a)return Response.json({ok:!1,error:"Template not found."},{status:404});let o=a.public_token;return r&&!o&&(o=crypto.randomUUID().replaceAll("-","")),r?await e.DB.prepare(`
          UPDATE clinical_templates
          SET
            is_published = 1,
            public_token = ?,
            published_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
        `).bind(o,n,t.business_id).run():await e.DB.prepare(`
          UPDATE clinical_templates
          SET
            is_published = 0,
            published_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
        `).bind(n,t.business_id).run(),Response.json({ok:!0,is_published:r?1:0,public_token:o,public_path:o?`/forms/view.html?token=${encodeURIComponent(o)}`:null})}catch(t){return console.error("Form publish failed:",t),Response.json({ok:!1,error:"Unable to update form publishing."},{status:500})}}c(lr,"onRequestPost");async function Ju(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
    SELECT u.id AS user_id, u.business_id
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now')
      AND u.is_active = 1
    LIMIT 1
  `).bind(i).first()}c(Ju,"getAuthenticatedUser");async function _r({request:s,env:e}){try{let t=await s.formData(),i=String(t.get("token")||"").trim(),n=String(t.get("request_token")||"").trim(),r=n.startsWith("fri_");if(!i&&!n)return Response.json({ok:!1,error:"Form token is required."},{status:400});let a=null,o=null;if(n){let h=r?await Ju(s,e):null;if(r&&!h)return Response.json({ok:!1,error:"Authentication required."},{status:401});a=await e.DB.prepare(r?`
                SELECT
                  r.id AS request_id, r.business_id, r.template_id,
                  r.customer_id, r.appointment_id,
                  r.status AS request_status, r.expires_at,
                  t.name, t.template_type, t.description, t.version
                FROM clinical_form_requests r
                JOIN clinical_templates t ON t.id = r.template_id
                WHERE
                  r.request_token = ?
                  AND r.business_id = ?
                  AND r.status IN ('created', 'opened')
                  AND datetime(r.expires_at) > datetime('now')
                  AND t.is_active = 1
                LIMIT 1
              `:`
                SELECT
                  r.id AS request_id, r.business_id, r.template_id,
                  r.customer_id, r.appointment_id,
                  r.status AS request_status, r.expires_at,
                  t.name, t.template_type, t.description, t.version
                FROM clinical_form_requests r
                JOIN clinical_templates t ON t.id = r.template_id
                WHERE
                  r.request_token = ?
                  AND r.status IN ('created', 'opened')
                  AND datetime(r.expires_at) > datetime('now')
                  AND t.is_active = 1
                  AND t.is_client_sendable = 1
                LIMIT 1
              `).bind(...r?[n,h.business_id]:[n]).first(),a&&(o={id:a.template_id,business_id:a.business_id,name:a.name,template_type:a.template_type,description:a.description,version:a.version})}else o=await e.DB.prepare(`
          SELECT
            id,
            business_id,
            name,
            template_type,
            description,
            version
          FROM clinical_templates
          WHERE
            public_token = ?
            AND is_published = 1
            AND is_active = 1
          LIMIT 1
        `).bind(i).first();if(!o)return Response.json({ok:!1,error:"Form is not available or has already been submitted."},{status:404});let[u,d]=await Promise.all([e.DB.prepare(`
          SELECT
            id,
            title,
            description,
            sort_order,
            condition_json
          FROM clinical_template_sections
          WHERE
            business_id = ?
            AND template_id = ?
          ORDER BY sort_order ASC
        `).bind(o.business_id,o.id).all(),e.DB.prepare(`
          SELECT
            section_id,
            label,
            field_key,
            field_type,
            help_text,
            placeholder,
            options_json,
            is_required,
            sort_order,
            condition_json
          FROM clinical_template_fields
          WHERE
            business_id = ?
            AND template_id = ?
          ORDER BY sort_order ASC
        `).bind(o.business_id,o.id).all()]),l=d.results||[],p=new Map(l.map(h=>[h.field_key,h])),m=new Map((u.results||[]).map(h=>[h.id,h.condition_json])),_=new Map;for(let h of l)_.set(h.section_id,[..._.get(h.section_id)||[],{label:h.label,field_key:h.field_key,field_type:h.field_type,help_text:h.help_text,placeholder:h.placeholder,options:ui(h.options_json,[]),is_required:h.is_required,sort_order:h.sort_order,condition:ui(h.condition_json,null)}]);let g={id:o.id,name:o.name,template_type:o.template_type,description:o.description||null,version:Number(o.version||1),sections:(u.results||[]).map(h=>({title:h.title,description:h.description||null,sort_order:h.sort_order,condition:ui(h.condition_json,null),fields:_.get(h.id)||[]}))},E=new Map,f=new Map,b=new Map;for(let[h,I]of t.entries())if(h.startsWith("answer:"))E.set(h.slice(7),String(I||""));else if(h.startsWith("signature:"))f.set(h.slice(10),String(I||""));else if(h.startsWith("file:"))continue;for(let h of l){if(h.is_required!==1)continue;let I=m.get(h.section_id);if(!pr(I,E)||!pr(h.condition_json,E))continue;if(h.field_type==="signature"){if(!f.get(h.field_key))return Response.json({ok:!1,error:`${h.label} is required.`},{status:400});continue}if(h.field_type==="file_upload")continue;let R=String(E.get(h.field_key)||"").trim();if(!R||h.field_type==="checkbox"&&R!=="Yes")return Response.json({ok:!1,error:`${h.label} is required.`},{status:400})}let N=`cfs_${crypto.randomUUID()}`,v=[e.DB.prepare(`
          INSERT INTO clinical_form_submissions (
            id,
            business_id,
            template_id,
            customer_id,
            appointment_id,
            form_request_id,
            public_token,
            submitted_by,
            status,
            template_version,
            template_snapshot_json
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?,
            'submitted',
            ?, ?
          )
        `).bind(N,o.business_id,o.id,a?.customer_id||null,a?.appointment_id||null,a?.request_id||null,n||i,r?"staff":"client",Number(o.version||1),JSON.stringify(g))];for(let[h,I]of E.entries()){let R=p.get(h);R&&v.push(e.DB.prepare(`
            INSERT INTO clinical_form_answers (
              id,
              submission_id,
              business_id,
              template_id,
              field_key,
              field_label,
              field_type,
              value_text
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(`cfa_${crypto.randomUUID()}`,N,o.business_id,o.id,h,R.label,R.field_type,I))}for(let[h,I]of f.entries()){let R=p.get(h);if(!(!R||R.field_type!=="signature")){if(!/^data:image\/png;base64,/i.test(I))return Response.json({ok:!1,error:"Invalid signature data."},{status:400});if(I.length>7e5)return Response.json({ok:!1,error:"Signature is too large."},{status:400});v.push(e.DB.prepare(`
            INSERT INTO clinical_form_signatures (
              id,
              submission_id,
              business_id,
              field_key,
              signature_data_url
            )
            VALUES (?, ?, ?, ?, ?)
          `).bind(`cfsig_${crypto.randomUUID()}`,N,o.business_id,h,I))}}if([...b.entries()].some(([h,I])=>p.get(h)?.field_type==="file_upload"&&Array.isArray(I)&&I.length>0)&&!e.FORM_UPLOADS)return Response.json({ok:!1,error:"File storage is not configured yet. Ask the business owner to enable Photo & file storage in Eselram Setup Health."},{status:503});await e.DB.batch(v);for(let[h,I]of b.entries()){let R=p.get(h);if(!(!R||R.field_type!=="file_upload"))for(let L of I){if(L.size>5*1024*1024)return Response.json({ok:!1,error:`${L.name} is larger than 5 MB.`},{status:400});if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(L.type))return Response.json({ok:!1,error:`${L.name} has an unsupported file type.`},{status:400});let T=String(L.name||"upload").replace(/[^a-zA-Z0-9._-]+/g,"_").slice(0,100),O=`${o.business_id}/${N}/${h}/${crypto.randomUUID()}-${T}`;await e.FORM_UPLOADS.put(O,await L.arrayBuffer(),{httpMetadata:{contentType:L.type||"application/octet-stream"}}),await e.DB.prepare(`
            INSERT INTO clinical_form_uploads (
              id,
              submission_id,
              business_id,
              field_key,
              storage_provider,
              storage_key,
              original_name,
              mime_type,
              size_bytes
            )
            VALUES (?, ?, ?, ?, 'r2', ?, ?, ?, ?)
          `).bind(`cfu_${crypto.randomUUID()}`,N,o.business_id,h,O,L.name||T,L.type||null,L.size).run()}}return a?.request_id&&await e.DB.prepare(`
          UPDATE clinical_form_requests
          SET
            status = 'submitted',
            submission_id = ?,
            submitted_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND status IN ('created', 'opened')
        `).bind(N,a.request_id).run(),Response.json({ok:!0,submission_id:N})}catch(t){return console.error("Clinical form submission failed:",t),Response.json({ok:!1,error:"Unable to submit form."},{status:500})}}c(_r,"onRequestPost");function ui(s,e){if(!s)return e;try{return JSON.parse(s)}catch{return e}}c(ui,"parseJson");function pr(s,e){if(!s)return!0;let t=null;try{t=JSON.parse(s)}catch{return!0}if(!t?.field_key)return!0;let i=String(e.get(t.field_key)||""),n=String(t.value||"");return t.operator==="not_equals"?i!==n:i===n}c(pr,"isConditionSatisfied");async function mr({request:s,env:e}){try{if((await e.DB.prepare(`
        SELECT is_complete
        FROM installer_state
        WHERE id = 1
      `).first())?.is_complete===1)return Response.json({ok:!1,error:"Eselram has already been configured."},{status:409});let i=await s.json(),n=String(i.primary_colour||"").trim(),r=String(i.accent_colour||"").trim(),a=String(i.theme||"light").trim(),o=String(i.time_format||"24").trim(),u=String(i.date_format||"DD/MM/YYYY").trim(),d=/^#[0-9a-fA-F]{6}$/;if(!d.test(n)||!d.test(r))return Response.json({ok:!1,error:"Invalid colour value."},{status:400});if(!["light","dark","system"].includes(a))return Response.json({ok:!1,error:"Invalid theme."},{status:400});if(!["12","24"].includes(o))return Response.json({ok:!1,error:"Invalid time format."},{status:400});if(!["DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD"].includes(u))return Response.json({ok:!1,error:"Invalid date format."},{status:400});let l=await e.DB.prepare(`
        SELECT id
        FROM businesses
        LIMIT 1
      `).first();if(!l)return Response.json({ok:!1,error:"Business setup must be completed first."},{status:409});let p=[["branding.primary_colour",n],["branding.accent_colour",r],["branding.theme",a],["display.time_format",o],["display.date_format",u]];for(let[m,_]of p)await e.DB.prepare(`
          INSERT INTO business_settings (
            id,
            business_id,
            setting_key,
            setting_value,
            value_type
          )
          VALUES (?, ?, ?, ?, 'string')

          ON CONFLICT(business_id, setting_key)
          DO UPDATE SET
            setting_value = excluded.setting_value,
            updated_at = CURRENT_TIMESTAMP
        `).bind(`set_${crypto.randomUUID()}`,l.id,m,_).run();return await e.DB.prepare(`
        UPDATE installer_state
        SET
          current_step = 'payments',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(),Response.json({ok:!0,next_step:"payments"})}catch(t){return console.error("Branding installer step failed:",t),Response.json({ok:!1,error:"Unable to save branding preferences."},{status:500})}}c(mr,"onRequestPost");function Gu(s="biz"){return`${s}_${crypto.randomUUID()}`}c(Gu,"createId");async function fr({request:s,env:e}){try{let t=await s.json(),i=String(t.name||"").trim(),n=String(t.email||"").trim(),r=String(t.phone||"").trim(),a=String(t.country_code||"GB").trim(),o=String(t.timezone||"Europe/London").trim(),u=String(t.currency||"GBP").trim();if(!i)return Response.json({ok:!1,error:"Business name is required."},{status:400});if(!n||!n.includes("@"))return Response.json({ok:!1,error:"A valid business email is required."},{status:400});let[d,l]=await Promise.all([e.DB.prepare(`
          SELECT id
          FROM businesses
          LIMIT 1
        `).first(),e.DB.prepare(`
          SELECT current_step, is_complete
          FROM installer_state
          WHERE id = 1
        `).first()]);if(d&&l?.is_complete===1)return Response.json({ok:!1,error:"Eselram has already been configured."},{status:409});let p=d?.id||Gu();return d?await e.DB.prepare(`
          UPDATE businesses
          SET
            name = ?,
            email = ?,
            phone = ?,
            country_code = ?,
            timezone = ?,
            currency = ?,
            locale = ?
          WHERE id = ?
        `).bind(i,n,r||null,a,o,u,"en-GB",p).run():await e.DB.prepare(`
          INSERT INTO businesses (
            id,
            name,
            email,
            phone,
            country_code,
            timezone,
            currency,
            locale
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(p,i,n,r||null,a,o,u,"en-GB").run(),await e.DB.prepare(`
        UPDATE installer_state
        SET
          current_step = 'hours',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(),Response.json({ok:!0,business:{id:p,name:i},next_step:"hours"})}catch(t){return console.error("Business installer step failed:",t),Response.json({ok:!1,error:"Unable to save business details."},{status:500})}}c(fr,"onRequestPost");function Yu(s="hrs"){return`${s}_${crypto.randomUUID()}`}c(Yu,"createId");async function br({request:s,env:e}){try{if((await e.DB.prepare(`
        SELECT is_complete
        FROM installer_state
        WHERE id = 1
      `).first())?.is_complete===1)return Response.json({ok:!1,error:"Eselram has already been configured."},{status:409});let i=await s.json(),n=Number(i.booking_interval_minutes),r=Array.isArray(i.hours)?i.hours:[];if(![15,20,30,45,60].includes(n))return Response.json({ok:!1,error:"Invalid booking interval."},{status:400});if(r.length!==7)return Response.json({ok:!1,error:"Hours must be supplied for all seven days."},{status:400});let a=await e.DB.prepare(`
          SELECT id
          FROM businesses
          LIMIT 1
        `).first();if(!a)return Response.json({ok:!1,error:"Business setup must be completed first."},{status:409});for(let o of r){let u=Number(o.weekday);if(!Number.isInteger(u)||u<1||u>7)return Response.json({ok:!1,error:"Invalid weekday."},{status:400});let d=o.is_open?1:0,l=d?String(o.open_time||""):null,p=d?String(o.close_time||""):null;if(d&&(!l||!p))return Response.json({ok:!1,error:"Open days require opening and closing times."},{status:400});if(d&&l>=p)return Response.json({ok:!1,error:"Closing time must be later than opening time."},{status:400});await e.DB.prepare(`
          INSERT INTO working_hours (
            id,
            business_id,
            weekday,
            is_open,
            open_time,
            close_time,
            booking_interval_minutes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)

          ON CONFLICT(business_id, weekday)
          DO UPDATE SET
            is_open = excluded.is_open,
            open_time = excluded.open_time,
            close_time = excluded.close_time,
            booking_interval_minutes =
              excluded.booking_interval_minutes,
            updated_at = CURRENT_TIMESTAMP
        `).bind(Yu(),a.id,u,d,l,p,n).run()}return await e.DB.prepare(`
        UPDATE installer_state
        SET
          current_step = 'branding',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(),Response.json({ok:!0,next_step:"branding"})}catch(t){return console.error("Hours installer step failed:",t),Response.json({ok:!1,error:"Unable to save business hours."},{status:500})}}c(br,"onRequestPost");async function gr({request:s,env:e}){try{let t=await s.json(),i=String(t.name||"").trim(),n=String(t.email||"").trim().toLowerCase(),r=String(t.password||"");if(!i)return Response.json({ok:!1,error:"Your name is required."},{status:400});if(!n||!n.includes("@"))return Response.json({ok:!1,error:"A valid email address is required."},{status:400});if(r.length<12)return Response.json({ok:!1,error:"Password must contain at least 12 characters."},{status:400});if((await e.DB.prepare(`
          SELECT
            current_step,
            is_complete

          FROM installer_state

          WHERE id = 1
        `).first())?.is_complete===1)return Response.json({ok:!1,error:"Eselram has already been installed."},{status:409});let o=await e.DB.prepare(`
          SELECT id

          FROM businesses

          LIMIT 1
        `).first();if(!o)return Response.json({ok:!1,error:"Business setup must be completed first."},{status:409});if(await e.DB.prepare(`
          SELECT id

          FROM users

          WHERE
            business_id = ?
            AND email = ?

          LIMIT 1
        `).bind(o.id,n).first())return Response.json({ok:!1,error:"An account already exists with this email."},{status:409});let d=await Gt(r),l=`usr_${crypto.randomUUID()}`;await e.DB.prepare(`
        INSERT INTO users (
          id,
          business_id,
          name,
          email,
          password_hash,
          role,
          is_active
        )

        VALUES (
          ?, ?, ?, ?, ?, 'owner', 1
        )
      `).bind(l,o.id,i,n,d).run(),await e.DB.prepare(`
        INSERT INTO user_roles (
          user_id,
          role_key
        )

        VALUES (
          ?, 'owner'
        )
      `).bind(l).run();let p=kt(),m=await D(p),_=`ses_${crypto.randomUUID()}`,g=new Date(Date.now()+10080*60*1e3).toISOString();return await e.DB.prepare(`
        INSERT INTO user_sessions (
          id,
          user_id,
          token_hash,
          expires_at,
          last_seen_at,
          user_agent
        )

        VALUES (
          ?, ?, ?, ?, CURRENT_TIMESTAMP, ?
        )
      `).bind(_,l,m,g,s.headers.get("User-Agent")||null).run(),await e.DB.prepare(`
        UPDATE installer_state

        SET
          current_step = 'complete',
          is_complete = 1,
          completed_at =
            CURRENT_TIMESTAMP,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = 1
      `).run(),Response.json({ok:!0,installation_complete:!0,user:{id:l,name:i,email:n}},{headers:{"Set-Cookie":Yt(p),"Cache-Control":"no-store"}})}catch(t){return console.error("Owner installation failed:",t),Response.json({ok:!1,error:"Unable to create the owner account."},{status:500})}}c(gr,"onRequestPost");var Ku=["stripe","paypal","sumup","square","manual"];function zu(s="payprov"){return`${s}_${crypto.randomUUID()}`}c(zu,"createId");async function Er({request:s,env:e}){try{if((await e.DB.prepare(`
          SELECT is_complete
          FROM installer_state
          WHERE id = 1
        `).first())?.is_complete===1)return Response.json({ok:!1,error:"Eselram has already been configured."},{status:409});let i=await s.json(),n=Array.isArray(i.enabled_providers)?[...new Set(i.enabled_providers.map(l=>String(l).trim()))]:[],r=String(i.default_provider||"").trim();if(n.length===0)return Response.json({ok:!1,error:"At least one payment method is required."},{status:400});if(n.find(l=>!Ku.includes(l)))return Response.json({ok:!1,error:"An invalid payment provider was supplied."},{status:400});if(!n.includes(r))return Response.json({ok:!1,error:"The default payment method must be enabled."},{status:400});let o=await e.DB.prepare(`
          SELECT id
          FROM businesses
          LIMIT 1
        `).first();if(!o)return Response.json({ok:!1,error:"Business setup must be completed first."},{status:409});let[u,d]=await Promise.all([e.DB.prepare(`
            SELECT
              connection_status,
              environment,
              external_account_reference,
              webhook_status
            FROM business_payment_providers
            WHERE business_id = ? AND provider_key = 'stripe'
            LIMIT 1
          `).bind(o.id).first(),e.DB.prepare(`
            SELECT
              status,
              encrypted_credentials
            FROM business_integrations
            WHERE business_id = ?
              AND integration_type = 'payments'
              AND provider = 'stripe'
            LIMIT 1
          `).bind(o.id).first()]);await e.DB.prepare(`
        UPDATE business_payment_providers
        SET
          is_enabled = 0,
          is_default = 0,
          updated_at = CURRENT_TIMESTAMP
        WHERE business_id = ?
      `).bind(o.id).run();for(let l of n){let p=l===r?1:0,m=l==="stripe"&&!!d?.encrypted_credentials&&["configured","verified"].includes(String(d?.status||"")),_=l==="manual"||m?"connected":u?.connection_status||"not_connected",g=l==="manual"?"configured":u?.webhook_status||"not_configured",E=l==="stripe"?["sandbox","live"].includes(String(u?.environment||""))?u.environment:"sandbox":"live",f=l==="stripe"&&u?.external_account_reference||null;await e.DB.prepare(`
          INSERT INTO business_payment_providers (
            id,
            business_id,
            provider_key,
            is_enabled,
            is_default,
            connection_status,
            environment,
            external_account_reference,
            webhook_status
          )

          VALUES (
            ?, ?, ?, 1, ?, ?, ?, ?, ?
          )

          ON CONFLICT(
            business_id,
            provider_key
          )

          DO UPDATE SET
            is_enabled = 1,
            is_default =
              excluded.is_default,
            connection_status =
              excluded.connection_status,
            environment =
              excluded.environment,
            external_account_reference =
              COALESCE(excluded.external_account_reference, external_account_reference),
            webhook_status =
              excluded.webhook_status,
            updated_at =
              CURRENT_TIMESTAMP
        `).bind(zu(),o.id,l,p,_,E,f,g).run()}return await e.DB.prepare(`
        UPDATE installer_state

        SET
          current_step = 'owner',
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = 1
      `).run(),Response.json({ok:!0,enabled_providers:n,default_provider:r,next_step:"owner"})}catch(t){return console.error("Payment installer step failed:",t),Response.json({ok:!1,error:t?.message?.includes("CHECK constraint failed")?"The selected payment methods could not be saved because an invalid payment environment was generated.":"Unable to save payment preferences."},{status:500})}}c(Er,"onRequestPost");async function cs(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id,
        b.name AS business_name,
        b.email AS business_email
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      JOIN businesses b
        ON b.id = u.business_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(cs,"getUserContext");function us(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(us,"unauthorized");function st(s){return Response.json({ok:!1,error:s},{status:400})}c(st,"badRequest");function hr(s,e={}){if(!s)return e;try{return JSON.parse(s)}catch{return e}}c(hr,"parseJson");function ds(s){return String(s||"").trim().toLowerCase()}c(ds,"normaliseEmail");function yr(s){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||"").trim())}c(yr,"isValidEmail");var Vu=new Set(["gmail.com","googlemail.com","outlook.com","hotmail.com","live.com","icloud.com","me.com","yahoo.com","yahoo.co.uk","aol.com","proton.me","protonmail.com"]);function Xu(s){let e=ds(s);return e.includes("@")?e.split("@").pop():""}c(Xu,"emailDomain");function kr(s){return Vu.has(Xu(s))}c(kr,"isPersonalSendingAddress");function Zu(s){return String(s||"").includes("@")}c(Zu,"looksLikeEmail");function di(s){let e=ds(s);return!e||e.endsWith("@myclinic.co.uk")||e.endsWith("@example.com")||e.endsWith("@example.co.uk")||kr(e)}c(di,"looksLikePlaceholderSender");async function Sr(s,e){return await s.DB.prepare(`
      SELECT
        id,
        provider,
        encrypted_credentials,
        config_json,
        status,
        last_tested_at,
        last_error,
        created_at,
        updated_at
      FROM business_integrations
      WHERE
        business_id = ?
        AND integration_type = 'email'
      LIMIT 1
    `).bind(e).first()}c(Sr,"getIntegration");async function Rr({request:s,env:e}){try{let t=await cs(s,e);if(!t)return us();let i=await Sr(e,t.business_id);if(!i)return Response.json({ok:!0,integration:{provider:"resend",status:"not_configured",has_api_key:!1,from_name:"",from_email:"",last_tested_at:null,last_error:null,business_name:t.business_name||"",business_contact_email:t.business_email||""},encryption_ready:!!String(e.ESELRAM_ENCRYPTION_KEY||"").trim()});let n=hr(i.config_json,{});return Response.json({ok:!0,integration:{provider:i.provider,status:i.status,has_api_key:!!i.encrypted_credentials,from_name:!n.from_name||Zu(n.from_name)||String(n.from_name).trim().toLowerCase()==="my clinic"?t.business_name||"":n.from_name,from_email:di(n.from_email)?"":n.from_email||"",business_name:t.business_name||"",business_contact_email:t.business_email||"",sender_domain_required:!n.from_email||di(n.from_email),sending_domain_id:n.sending_domain_id||null,sending_domain_name:n.sending_domain_name||"",sending_domain_status:n.sending_domain_status||"not_configured",last_tested_at:i.last_tested_at,last_error:di(n.from_email)?null:i.last_error},encryption_ready:!!String(e.ESELRAM_ENCRYPTION_KEY||"").trim()})}catch(t){return console.error("Email integration GET failed:",t),Response.json({ok:!1,error:"Unable to load email integration."},{status:500})}}c(Rr,"onRequestGet");async function Nr({request:s,env:e}){try{let t=await cs(s,e);if(!t)return us();if(!String(e.ESELRAM_ENCRYPTION_KEY||"").trim())return Response.json({ok:!1,error:"This Eselram installation does not have ESELRAM_ENCRYPTION_KEY configured."},{status:503});let i=await s.json();if(String(i.provider||"resend").trim().toLowerCase()!=="resend")return st("Resend is currently the supported email provider.");let r=String(i.from_name||"").trim(),a=ds(i.from_email),o=String(i.api_key||"").trim();if(!r)return st("From name is required.");if(a&&!yr(a))return st("Enter a valid sending email address, or leave it blank until your sending domain is ready.");if(a&&kr(a))return st("Gmail, Outlook and other personal email addresses can be your business contact/reply address, but Resend cannot use them as the sending address. Use an address on a domain you have verified in Resend, or leave Sending email blank for now.");let u=await Sr(e,t.business_id),d=u?.encrypted_credentials||null;if(o){if(!o.startsWith("re_"))return st("The Resend API key does not look valid.");d=await Ze(JSON.stringify({api_key:o}),e.ESELRAM_ENCRYPTION_KEY)}if(!d)return st("A Resend API key is required.");let l=hr(u?.config_json,{}),p=JSON.stringify({...l,from_name:r,from_email:a});return u?await e.DB.prepare(`
          UPDATE business_integrations
          SET
            provider = 'resend',
            encrypted_credentials = ?,
            config_json = ?,
            status = 'configured',
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            business_id = ?
            AND integration_type = 'email'
        `).bind(d,p,t.business_id).run():await e.DB.prepare(`
          INSERT INTO business_integrations (
            id,
            business_id,
            integration_type,
            provider,
            encrypted_credentials,
            config_json,
            status
          )
          VALUES (
            ?,
            ?,
            'email',
            'resend',
            ?,
            ?,
            'configured'
          )
        `).bind(`bi_${crypto.randomUUID()}`,t.business_id,d,p).run(),Response.json({ok:!0,integration:{provider:"resend",status:"configured",has_api_key:!0,from_name:r,from_email:a}})}catch(t){return console.error("Email integration PUT failed:",t),Response.json({ok:!1,error:"Unable to save email integration."},{status:500})}}c(Nr,"onRequestPut");async function Tr({request:s,env:e}){try{let t=await cs(s,e);if(!t)return us();let i=await s.json();if(String(i.action||"").trim()!=="test")return st("Invalid email integration action.");let n=ds(i.test_email);if(!n||!yr(n))return st("Enter a valid email address for the test.");let r=await De(e,t.business_id,{to:n,subject:"Eselram email connection test",html:"<p>Your Eselram email connection is working.</p><p>This message was sent using the email provider selected in Eselram.</p>",text:"Your Eselram email connection is working. This message was sent using the email provider selected in Eselram."});return r.provider==="resend"?await e.DB.prepare(`
          UPDATE business_integrations
          SET
            status = 'verified',
            last_tested_at = CURRENT_TIMESTAMP,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE business_id = ?
            AND integration_type = 'email'
            AND provider = 'resend'
        `).bind(t.business_id).run():r.provider==="gmail"&&await e.DB.prepare(`
          UPDATE business_email_connections
          SET
            status = 'verified',
            last_tested_at = CURRENT_TIMESTAMP,
            last_error = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE business_id = ?
            AND provider = 'gmail'
        `).bind(t.business_id).run(),Response.json({ok:!0,message:`Test email sent to ${n} using ${r.provider==="gmail"?"Gmail":"Resend"}.`,provider:r.provider,provider_id:r.id||null})}catch(t){console.error("Email integration test failed:",t);let i=t?.message||"Unable to test email integration.",n=i.startsWith("Email permission required.");return Response.json({ok:!1,error:i,...n?{code:"gmail_permission_required"}:{}},{status:n?409:500})}}c(Tr,"onRequestPost");async function Ar({request:s,env:e}){try{let t=await cs(s,e);return t?(await e.DB.prepare(`
        DELETE FROM business_integrations
        WHERE
          business_id = ?
          AND integration_type = 'email'
      `).bind(t.business_id).run(),Response.json({ok:!0})):us()}catch(t){return console.error("Email integration DELETE failed:",t),Response.json({ok:!1,error:"Unable to disconnect email integration."},{status:500})}}c(Ar,"onRequestDelete");function it(s){let e=new URL(s.url).origin,t=[s.headers.get("Origin"),s.headers.get("X-Eselram-Public-Origin")];for(let i of t){let n=String(i||"").trim();if(n)try{let r=new URL(n),a=r.hostname.toLowerCase();if(r.protocol==="https:"&&a.endsWith(".eselram.com")&&a!=="eselram.com")return r.origin}catch{}}return e}c(it,"publicRequestOrigin");function G(s){return Response.json({ok:!1,error:s},{status:400})}c(G,"badRequest");function Ct(s){return Response.json({ok:!1,error:s},{status:409})}c(Ct,"conflict");function he(s="Unable to complete this request."){return Response.json({ok:!1,error:s},{status:500})}c(he,"serverError");async function ee(s){return await s.DB.prepare(`
      SELECT
        id,
        name,
        email,
        phone,
        website,
        timezone,
        currency,
        locale,
        booking_buffer_before_minutes,
        booking_buffer_after_minutes
      FROM businesses
      WHERE status = 'active'
      ORDER BY datetime(created_at) ASC
      LIMIT 1
    `).first()}c(ee,"getPublicBusiness");async function li(s,e){let t=await s.DB.prepare(`
        SELECT
          setting_key,
          setting_value

        FROM business_settings

        WHERE
          business_id = ?
          AND setting_key IN (
            'public_booking_enabled',
            'public_booking_minimum_notice_hours',
            'public_booking_max_advance_days',
            'public_booking_blocked_dates'
          )
      `).bind(e).all(),i=Object.fromEntries((t.results||[]).map(r=>[r.setting_key,r.setting_value])),n=[];try{n=JSON.parse(i.public_booking_blocked_dates||"[]")}catch{n=[]}return{enabled:i.public_booking_enabled===void 0||i.public_booking_enabled==="1"||String(i.public_booking_enabled).toLowerCase()==="true",minimum_notice_hours:Math.max(0,Number(i.public_booking_minimum_notice_hours??2)||0),max_advance_days:Math.max(1,Number(i.public_booking_max_advance_days??90)||90),blocked_dates:(Array.isArray(n)?n:[]).map(r=>{let a=String(r?.date||"").trim(),o=String(r?.start_date||a||"").trim(),u=String(r?.end_date||a||o||"").trim();return{start_date:o,end_date:u,reason:String(r?.reason||"").trim()}}).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.start_date)&&/^\d{4}-\d{2}-\d{2}$/.test(r.end_date)&&r.start_date<=r.end_date)}}c(li,"getPublicBookingRules");function ls(s){let[e,t,i]=String(s).split("-").map(Number);return Math.floor(Date.UTC(e,t-1,i)/864e5)}c(ls,"dayNumber");function Ae(s){return/^\d{4}-\d{2}-\d{2}$/.test(String(s||""))}c(Ae,"validDate");function Ot(s){return/^\d{2}:\d{2}$/.test(String(s||""))}c(Ot,"validTime");function It(s){let e=String(s||"").trim();return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)}c(It,"validEmail");function wr(s){let[e,t]=String(s).split(":").map(Number);return e*60+t}c(wr,"timeToMinutes");function Qu(s){let e=Math.floor(s/60),t=s%60;return`${String(e).padStart(2,"0")}:${String(t).padStart(2,"0")}`}c(Qu,"minutesToTime");function Lt(s,e,t){let[i,n]=String(e).split(":").map(Number),r=new Date(`${s}T${String(i).padStart(2,"0")}:${String(n).padStart(2,"0")}:00`);r.setMinutes(r.getMinutes()+Number(t||0));let a=r.getFullYear(),o=String(r.getMonth()+1).padStart(2,"0"),u=String(r.getDate()).padStart(2,"0"),d=String(r.getHours()).padStart(2,"0"),l=String(r.getMinutes()).padStart(2,"0");return`${a}-${o}-${u}T${d}:${l}:00`}c(Lt,"addMinutesToDateTime");function ed(s){let e=new Intl.DateTimeFormat("en-CA",{timeZone:s||"Europe/London",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}),t=Object.fromEntries(e.formatToParts(new Date).filter(i=>i.type!=="literal").map(i=>[i.type,i.value]));return{date:`${t.year}-${t.month}-${t.day}`,time:`${t.hour}:${t.minute}`,minutes:Number(t.hour)*60+Number(t.minute)}}c(ed,"localDateTimeParts");async function ue(s,e){await s.DB.prepare(`
      UPDATE appointments
      SET
        status = 'confirmed',
        updated_at = CURRENT_TIMESTAMP
      WHERE
        business_id = ?
        AND booking_source = 'online'
        AND status = 'pending'
        AND EXISTS (
          SELECT 1
          FROM payments p
          WHERE
            p.appointment_id = appointments.id
            AND p.business_id = appointments.business_id
            AND p.status IN ('paid', 'partially_refunded', 'refunded')
            AND p.payment_type != 'refund'
        )
    `).bind(e).run();let t=await s.DB.prepare(`
      SELECT
        a.id,
        a.customer_id,
        CASE
          WHEN ABS((julianday(a.created_at) - julianday(c.created_at)) * 86400) <= 120
          THEN 1 ELSE 0
        END AS customer_created_for_checkout
      FROM appointments a
      JOIN customers c
        ON c.id = a.customer_id
       AND c.business_id = a.business_id
      WHERE
        a.business_id = ?
        AND a.booking_source = 'online'
        AND datetime(a.created_at) < datetime('now', '-35 minutes')
        AND (
          a.status = 'pending'
          OR (
            a.status = 'cancelled'
            AND a.cancellation_reason IN (
              'Online booking payment was not completed',
              'Customer left online payment before completion',
              'Online payment could not be started',
              'Online booking could not be completed'
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM payments p
          WHERE
            p.appointment_id = a.id
            AND p.business_id = a.business_id
            AND p.status IN ('paid', 'partially_refunded', 'refunded')
            AND p.payment_type != 'refund'
        )
    `).bind(e).all(),i=Array.isArray(t?.results)?t.results:[];if(i.length)for(let n=0;n<i.length;n+=50){let r=i.slice(n,n+50),a=r.map(d=>String(d.id||"")).filter(Boolean);if(!a.length)continue;let o=a.map(()=>"?").join(", "),u=r.filter(d=>Number(d.customer_created_for_checkout||0)===1).map(d=>String(d.customer_id||"")).filter(Boolean);await s.DB.prepare(`
        DELETE FROM payments
        WHERE
          business_id = ?
          AND appointment_id IN (${o})
          AND status NOT IN ('paid', 'partially_refunded', 'refunded')
      `).bind(e,...a).run(),await s.DB.prepare(`
        DELETE FROM appointments
        WHERE
          business_id = ?
          AND booking_source = 'online'
          AND id IN (${o})
          AND status IN ('pending', 'cancelled')
          AND NOT EXISTS (
            SELECT 1
            FROM payments p
            WHERE
              p.appointment_id = appointments.id
              AND p.business_id = appointments.business_id
              AND p.status IN ('paid', 'partially_refunded', 'refunded')
              AND p.payment_type != 'refund'
          )
      `).bind(e,...a).run();for(let d of[...new Set(u)])await He(s,e,d)}}c(ue,"cleanupPendingOnlineBookings");async function ps(s,e){let t=await s.DB.prepare(`
      SELECT
        ps.id AS sale_id,
        ps.payment_id,
        ps.customer_id,
        CASE
          WHEN c.id IS NOT NULL
               AND ABS((julianday(ps.created_at) - julianday(c.created_at)) * 86400) <= 120
          THEN 1 ELSE 0
        END AS customer_created_for_checkout
      FROM package_sales ps
      LEFT JOIN customers c
        ON c.id = ps.customer_id
       AND c.business_id = ps.business_id
      WHERE
        ps.business_id = ?
        AND ps.source = 'public'
        AND ps.status = 'failed'
        AND datetime(ps.created_at) < datetime('now', '-35 minutes')
        AND NOT EXISTS (
          SELECT 1
          FROM payments paid
          WHERE
            paid.id = ps.payment_id
            AND paid.business_id = ps.business_id
            AND paid.status IN ('paid', 'partially_refunded', 'refunded')
            AND paid.payment_type != 'refund'
        )
    `).bind(e).all(),i=Array.isArray(t?.results)?t.results:[];if(i.length)for(let n of i){let r=String(n.sale_id||"").trim(),a=String(n.payment_id||"").trim(),o=String(n.customer_id||"").trim();r&&(await s.DB.prepare(`
      DELETE FROM package_sales
      WHERE
        id = ?
        AND business_id = ?
        AND source = 'public'
        AND status = 'failed'
    `).bind(r,e).run(),a&&await s.DB.prepare(`
        DELETE FROM payments
        WHERE
          id = ?
          AND business_id = ?
          AND status NOT IN ('paid', 'partially_refunded', 'refunded')
      `).bind(a,e).run(),o&&Number(n.customer_created_for_checkout||0)===1&&await He(s,e,o))}}c(ps,"cleanupPendingPublicPackageSales");async function Mt(s,e,t){return await s.DB.prepare(`
      SELECT
        id,
        name,
        description,
        booking_group,
        service_type,
        consultation_service_id,
        post_consultation_booking,
        duration_minutes,
        price_minor,
        deposit_minor,
        payment_timing,
        consultation_duration_minutes,
        consultation_price_minor,
        consultation_payment_timing,
        requires_consultation,
        requires_patch_test,
        is_active,
        sort_order
      FROM services
      WHERE id = ? AND business_id = ?
      LIMIT 1
    `).bind(t,e).first()}c(Mt,"getPublicService");async function Oe({env:s,business:e,service:t,date:i,excludeAppointmentId:n=null}){if(!Ae(i))return{error:"A valid date is required."};let r=await li(s,e.id);if(!r.enabled)return{slots:[],reason:"Online booking is currently unavailable."};let a=ed(e.timezone),o=ls(i)-ls(a.date);if(o<0)return{slots:[],reason:"This date has already passed."};if(o>Number(r.max_advance_days||90))return{slots:[],reason:`Online bookings can only be made up to ${Number(r.max_advance_days||90)} days ahead.`};let u=(r.blocked_dates||[]).find(I=>i>=I.start_date&&i<=I.end_date);if(u)return{slots:[],reason:u.reason?`This date is unavailable: ${u.reason}.`:"This date is unavailable."};let l=new Date(`${i}T12:00:00Z`).getUTCDay(),p=l===0?7:l,m=await s.DB.prepare(`
      SELECT
        is_open,
        open_time,
        close_time,
        booking_interval_minutes
      FROM working_hours
      WHERE business_id = ? AND weekday = ?
      LIMIT 1
    `).bind(e.id,p).first();if(!m||m.is_open!==1||!m.open_time||!m.close_time)return{slots:[],booking_interval_minutes:30};let _=await s.DB.prepare(`
      SELECT start_at, end_at
      FROM appointments
      WHERE
        business_id = ?
        AND status != 'cancelled'
        AND date(start_at) = ?
        AND (
          ? IS NULL
          OR id != ?
        )
      ORDER BY datetime(start_at) ASC
    `).bind(e.id,i,n||null,n||null).all(),g=Number(t.duration_minutes||0),E=Number(m.booking_interval_minutes||30),f=Number(e.booking_buffer_before_minutes||0),b=Number(e.booking_buffer_after_minutes||0),N=wr(m.open_time),v=wr(m.close_time),S=(_.results||[]).map(I=>{let R=new Date(I.start_at),L=new Date(I.end_at);return{start:R.getHours()*60+R.getMinutes()-f,end:L.getHours()*60+L.getMinutes()+b}}),h=[];for(let I=N;I+g<=v;I+=E){if(i===a.date&&I<=a.minutes)continue;let R=ls(i)*1440+I,L=ls(a.date)*1440+a.minutes;if(R-L<Number(r.minimum_notice_hours||0)*60)continue;let O=I+g;S.some(B=>I<B.end&&O>B.start)||h.push(Qu(I))}return{slots:h,booking_interval_minutes:E,reason:h.length?null:Number(r.minimum_notice_hours||0)>0&&o<=1?"No appointment times meet the minimum booking notice on this date.":null}}c(Oe,"getAvailableSlots");async function xt({env:s,businessId:e,firstName:t,lastName:i,email:n,phone:r}){let a=String(t||"").trim().toLowerCase(),o=String(i||"").trim().toLowerCase(),u=String(n||"").trim().toLowerCase(),d=String(r||"").trim();return!a||!o||!u||!d?null:await s.DB.prepare(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone

      FROM customers

      WHERE
        business_id = ?
        AND lower(trim(COALESCE(first_name, ''))) = ?
        AND lower(trim(COALESCE(last_name, ''))) = ?
        AND lower(trim(COALESCE(email, ''))) = ?
        AND trim(COALESCE(phone, '')) = ?

      ORDER BY
        datetime(created_at) ASC

      LIMIT 1
    `).bind(e,a,o,u,d).first()}c(xt,"findVerifiedExistingPublicCustomer");async function _s({env:s,businessId:e,firstName:t,lastName:i,email:n,phone:r,marketingConsent:a}){let o=String(t||"").trim().toLowerCase(),u=String(i||"").trim().toLowerCase(),d=[];n&&(d=(await s.DB.prepare(`
          SELECT
            id,
            first_name,
            last_name,
            email,
            phone,
            marketing_consent

          FROM customers

          WHERE
            business_id = ?
            AND lower(email) =
                lower(?)

          ORDER BY
            datetime(created_at) ASC
        `).bind(e,n).all()).results||[]),d.length===0&&r&&(d=(await s.DB.prepare(`
          SELECT
            id,
            first_name,
            last_name,
            email,
            phone,
            marketing_consent

          FROM customers

          WHERE
            business_id = ?
            AND phone = ?

          ORDER BY
            datetime(created_at) ASC
        `).bind(e,r).all()).results||[]);let l=d.find(m=>String(m.first_name||"").trim().toLowerCase()===o&&String(m.last_name||"").trim().toLowerCase()===u)||null;if(l)return await s.DB.prepare(`
        UPDATE customers

        SET
          email =
            COALESCE(
              NULLIF(email, ''),
              NULLIF(?, '')
            ),

          phone =
            COALESCE(
              NULLIF(phone, ''),
              NULLIF(?, '')
            ),

          marketing_consent =
            CASE
              WHEN marketing_consent = 1
                THEN 1
              WHEN ? = 1
                THEN 1
              ELSE 0
            END,

          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `).bind(n,r,a?1:0,l.id,e).run(),{id:l.id,created:!1};let p=`cus_${crypto.randomUUID()}`;return await s.DB.prepare(`
      INSERT INTO customers (
        id,
        business_id,
        first_name,
        last_name,
        email,
        phone,
        marketing_consent
      )

      VALUES (
        ?, ?, ?, ?, ?, ?, ?
      )
    `).bind(p,e,t,i,n||null,r||null,a?1:0).run(),{id:p,created:!0}}c(_s,"findOrCreatePublicCustomer");async function He(s,e,t){await s.DB.prepare(`
      DELETE FROM customers
      WHERE
        id = ?
        AND business_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM appointments a WHERE a.customer_id = customers.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM payments p WHERE p.customer_id = customers.id
        )
    `).bind(t,e).run()}c(He,"deleteUnusedCustomer");async function Dr({request:s,env:e}){try{let t=new URL(s.url),i=String(t.searchParams.get("token")||"").trim(),n=String(t.searchParams.get("date")||"").trim();if(!Ae(n))return Response.json({ok:!1,error:"Choose a valid date."},{status:400});let r=await Ht({env:e,token:i});if(!r)return Response.json({ok:!1,error:"This manage-booking link is invalid or has expired."},{status:404});if(r.status!=="confirmed")return Response.json({ok:!0,slots:[],reason:"This appointment can no longer be rescheduled online."});let a=await e.DB.prepare(`
        SELECT
          booking_buffer_before_minutes,
          booking_buffer_after_minutes
        FROM businesses
        WHERE id = ?
        LIMIT 1
      `).bind(r.business_id).first(),o=await Oe({env:e,business:{id:r.business_id,timezone:r.timezone||"Europe/London",booking_buffer_before_minutes:Number(a?.booking_buffer_before_minutes||0),booking_buffer_after_minutes:Number(a?.booking_buffer_after_minutes||0)},service:{id:r.service_id,duration_minutes:Number(r.duration_minutes||0)},date:n,excludeAppointmentId:r.appointment_id});return o.error?Response.json({ok:!1,error:o.error},{status:400}):Response.json({ok:!0,slots:o.slots||[],reason:o.reason||null})}catch(t){return console.error("Manage booking availability failed:",t),Response.json({ok:!1,error:"Unable to load available times."},{status:500})}}c(Dr,"onRequestGet");function td(s){return Response.json({ok:!1,error:s},{status:400})}c(td,"badRequest");async function vr({request:s,env:e}){try{let t=new URL(s.url),i=String(t.searchParams.get("sale_id")||"").trim(),n=String(t.searchParams.get("session_id")||"").trim();if(!i||!n.startsWith("cs_"))return td("A valid package sale and Stripe Checkout Session are required.");let r=await e.DB.prepare(`
        SELECT
          ps.id,
          ps.business_id,
          ps.payment_id,
          ps.provider_reference,
          ps.customer_package_id,
          ps.status
        FROM package_sales ps
        WHERE
          ps.id = ?
          AND ps.source = 'staff'
          AND ps.provider_reference = ?
        LIMIT 1
      `).bind(i,n).first();if(!r)return Response.json({ok:!1,error:"Package payment was not found."},{status:404});if(r.status==="paid"&&r.customer_package_id)return Response.json({ok:!0,paid:!0,customer_package_id:r.customer_package_id});let a=await Q(e,r.business_id);if(a.error||a.row.status!=="verified")return Response.json({ok:!1,error:"Stripe verification is temporarily unavailable."},{status:503});let o=await X({secretKey:a.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(n)}`});if(!o.response.ok)return Response.json({ok:!1,error:be(o.data,"Unable to verify package payment.")},{status:502});let u=o.data||{};if(String(u?.metadata?.package_sale_id||"")!==r.id||String(u?.metadata?.business_id||"")!==r.business_id)return Response.json({ok:!1,error:"Stripe package payment reference did not match."},{status:409});if(u.payment_status!=="paid")return Response.json({ok:!0,paid:!1,status:u.status||"pending"});await e.DB.prepare(`
      UPDATE payments
      SET
        status = 'paid',
        provider_reference = ?,
        payment_method = ?,
        paid_at =
          COALESCE(
            paid_at,
            CURRENT_TIMESTAMP
          ),
        notes = CASE
          WHEN COALESCE(notes, '') = '' THEN
            'Stripe package payment confirmed on customer return'
          WHEN instr(
            COALESCE(notes, ''),
            'Stripe package payment confirmed on customer return'
          ) > 0 THEN notes
          ELSE
            notes ||
            ' \xB7 Stripe package payment confirmed on customer return'
        END,
        updated_at =
          CURRENT_TIMESTAMP
      WHERE
        id = ?
        AND business_id = ?
    `).bind(u.id,String(u.payment_method_types?.[0]||"card"),r.payment_id,r.business_id).run();let d=await Ye({env:e,session:u,paid:!0});await ge({env:e,businessId:r.business_id,paymentId:r.payment_id,status:"paid",customerPackageId:d?.customer_package_id||null});try{await ye({env:e,businessId:r.business_id,paymentId:r.payment_id})}catch(l){console.error("Package payment confirmation email failed:",l)}return Response.json({ok:!0,paid:!0,customer_package_id:d?.customer_package_id||null})}catch(t){return console.error("Public package payment confirmation failed:",t),Response.json({ok:!1,error:"Unable to confirm package payment."},{status:500})}}c(vr,"onRequestGet");async function sd({env:s,businessId:e,serviceId:t}){let i=await s.DB.prepare(`
      SELECT
        service_type,
        consultation_service_id
      FROM services
      WHERE
        id = ?
        AND business_id = ?
      LIMIT 1
    `).bind(t,e).first();return!i||String(i.service_type||"standard")==="consultation"?t:i.consultation_service_id||t}c(sd,"resolveConsultationServiceId");async function Fe({env:s,businessId:e,customerId:t,serviceId:i}){let n=await sd({env:s,businessId:e,serviceId:i}),r=await s.DB.prepare(`
    SELECT
      a.id AS consultation_appointment_id,
      MAX(
        0,
        COALESCE(
          SUM(
            CASE
              WHEN p.payment_type = 'refund'
                   AND p.status = 'paid'
                THEN -ABS(p.amount_minor)
              WHEN p.payment_type != 'refund'
                   AND p.status IN (
                     'paid',
                     'partially_refunded',
                     'refunded'
                   )
                THEN ABS(p.amount_minor)
              ELSE 0
            END
          ),
          0
        )
      ) AS paid_minor
    FROM appointments a
    LEFT JOIN payments p
      ON p.appointment_id = a.id
     AND p.business_id = a.business_id
    JOIN services consultation_service
      ON consultation_service.id = a.service_id
     AND consultation_service.business_id = a.business_id
    WHERE
      a.business_id = ?
      AND a.customer_id = ?
      AND a.service_id = ?
      AND (
        a.booking_kind = 'consultation'
        OR consultation_service.service_type = 'consultation'
      )
      AND a.status != 'cancelled'
    GROUP BY a.id
    HAVING paid_minor > 0
    ORDER BY datetime(a.start_at) DESC
  `).bind(e,t,n).all();for(let a of r.results||[])if(!await s.DB.prepare(`
      SELECT 1 AS used
      FROM appointments target
      WHERE
        target.business_id = ?
        AND target.consultation_credit_source_appointment_id = ?
        AND target.status != 'cancelled'

      UNION ALL

      SELECT 1 AS used
      FROM package_sales sale
      WHERE
        sale.business_id = ?
        AND sale.consultation_credit_source_appointment_id = ?
        AND sale.status NOT IN ('failed', 'cancelled')

      LIMIT 1
    `).bind(e,a.consultation_appointment_id,e,a.consultation_appointment_id).first())return{source_appointment_id:a.consultation_appointment_id,available_minor:Math.max(0,Number(a.paid_minor||0))};return{source_appointment_id:null,available_minor:0}}c(Fe,"findAvailableConsultationCredit");async function pi(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
    SELECT
      u.id AS user_id,
      u.business_id,
      b.name AS business_name,
      b.website,
      b.currency
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN businesses b ON b.id = u.business_id
    WHERE
      s.token_hash = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now')
      AND u.is_active = 1
    LIMIT 1
  `).bind(i).first()}c(pi,"getUserContext");function ke(s){return Response.json({ok:!1,error:s},{status:400})}c(ke,"badRequest");function id(s){let e=String(s||"").trim();if(!e)return"";let t;try{t=new URL(e)}catch{try{t=new URL(`https://${e}`)}catch{return""}}return["http:","https:"].includes(t.protocol)?t.toString():""}c(id,"safeBusinessWebsite");async function Cr({env:s,integration:e,businessId:t,sale:i}){if(!i||i.status!=="pending")return!1;let n=String(i.provider_reference||"").trim();if(n)try{if(!(await X({secretKey:e.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(n)}/expire`,method:"POST"})).response.ok)return!1}catch(r){return console.error("Unable to expire superseded package checkout:",r),!1}return await s.DB.prepare(`
    DELETE FROM package_sales
    WHERE
      id = ?
      AND business_id = ?
      AND status = 'pending'
  `).bind(i.id,t).run(),i.payment_id&&(await s.DB.prepare(`
      DELETE FROM payments
      WHERE
        business_id = ?
        AND provider = 'none'
        AND payment_method = 'discount'
        AND notes LIKE ?
        AND status = 'pending'
    `).bind(t,`Discount adjustment for payment=${i.payment_id}%`).run(),await s.DB.prepare(`
      DELETE FROM payments
      WHERE
        id = ?
        AND business_id = ?
        AND status = 'pending'
    `).bind(i.payment_id,t).run()),!0}c(Cr,"cancelPendingPackageSale");async function nd({env:s,integration:e,businessId:t,customerId:i}){let n=await s.DB.prepare(`
      SELECT
        ps.id,
        ps.payment_id,
        ps.provider_reference,
        ps.status
      FROM package_sales ps
      LEFT JOIN payments p
        ON p.id = ps.payment_id
       AND p.business_id = ps.business_id
      WHERE
        ps.business_id = ?
        AND ps.customer_id = ?
        AND ps.source = 'staff'
        AND ps.status = 'pending'
        AND COALESCE(
          p.status,
          'pending'
        ) = 'pending'
      ORDER BY
        datetime(
          ps.created_at
        ) DESC
    `).bind(t,i).all();for(let r of n.results||[])await Cr({env:s,integration:e,businessId:t,sale:r})}c(nd,"cancelSupersededPackageSales");async function Or({request:s,env:e}){try{let t=await pi(s,e);if(!t)return Response.json({ok:!1,error:"Authentication required."},{status:401});let i=new URL(s.url),n=String(i.searchParams.get("sale_id")||"").trim();if(!n)return ke("Package sale is required.");let r=await e.DB.prepare(`
        SELECT
          ps.id,
          ps.payment_id,
          ps.provider_reference,
          ps.customer_package_id,
          ps.status,
          p.status AS payment_status
        FROM package_sales ps
        LEFT JOIN payments p
          ON p.id = ps.payment_id
         AND p.business_id = ps.business_id
        WHERE
          ps.id = ?
          AND ps.business_id = ?
          AND ps.source = 'staff'
        LIMIT 1
      `).bind(n,t.business_id).first();if(!r)return Response.json({ok:!1,error:"Package sale not found."},{status:404});if(r.status==="paid"&&r.customer_package_id){let d=!1,l=null;if(r.payment_id)try{let p=await ye({env:e,businessId:t.business_id,paymentId:r.payment_id});d=p?.ok===!0,d||(l=p?.error||p?.reason||"Unable to send package payment confirmation email.")}catch(p){l=p?.message||"Unable to send package payment confirmation email.",console.error("Paid package receipt retry failed:",p)}return Response.json({ok:!0,status:"paid",customer_package_id:r.customer_package_id,payment_id:r.payment_id||null,receipt_sent:d,receipt_error:l})}if(r.status!=="pending"||!r.provider_reference||!r.payment_id)return Response.json({ok:!0,status:r.status,customer_package_id:r.customer_package_id||null,payment_id:r.payment_id||null});let a=await Q(e,t.business_id);if(a.error||a.row.status!=="verified")return Response.json({ok:!1,error:a.error||"Stripe is unavailable."},{status:503});let o=await X({secretKey:a.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(r.provider_reference)}`});if(!o.response.ok)return Response.json({ok:!1,error:be(o.data,"Unable to verify package payment.")},{status:502});let u=o.data||{};if(String(u?.metadata?.package_sale_id||"")!==r.id||String(u?.metadata?.business_id||"")!==t.business_id)return Response.json({ok:!1,error:"Stripe package payment reference did not match this sale."},{status:409});if(u.payment_status==="paid"){await e.DB.prepare(`
        UPDATE payments
        SET
          status = 'paid',
          provider_reference = ?,
          payment_method = ?,
          paid_at =
            COALESCE(
              paid_at,
              CURRENT_TIMESTAMP
            ),
          notes = CASE
            WHEN COALESCE(notes, '') = '' THEN
              'Stripe package payment confirmed directly'
            WHEN instr(
              COALESCE(notes, ''),
              'Stripe package payment confirmed directly'
            ) > 0 THEN notes
            ELSE
              notes ||
              ' \xB7 Stripe package payment confirmed directly'
          END,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE
          id = ?
          AND business_id = ?
      `).bind(u.id,String(u.payment_method_types?.[0]||"card"),r.payment_id,t.business_id).run();let d=await Ye({env:e,session:u,paid:!0});await ge({env:e,businessId:t.business_id,paymentId:r.payment_id,status:"paid",customerPackageId:d?.customer_package_id||null});let l=!1,p=null;try{let m=await ye({env:e,businessId:t.business_id,paymentId:r.payment_id});l=m?.ok===!0,l||(p=m?.error||m?.reason||"Unable to send package payment confirmation email.")}catch(m){p=m?.message||"Unable to send package payment confirmation email.",console.error("Package payment confirmation email failed:",m)}return Response.json({ok:!0,status:"paid",customer_package_id:d?.customer_package_id||null,payment_id:r.payment_id,receipt_sent:l,receipt_error:p})}return u.status==="expired"?Response.json({ok:!0,status:"failed",payment_id:r.payment_id}):Response.json({ok:!0,status:"pending",payment_id:r.payment_id})}catch(t){return console.error("Package sale status failed:",t),Response.json({ok:!1,error:"Unable to verify package payment."},{status:500})}}c(Or,"onRequestGet");async function Ir({request:s,env:e}){try{let t=await pi(s,e);if(!t)return Response.json({ok:!1,error:"Authentication required."},{status:401});let i=await s.json(),n=String(i.customer_id||"").trim(),r=String(i.package_template_id||"").trim(),a=String(i.package_variant_id||"").trim(),o=String(i.payment_choice||"full").trim();if(!n||!r)return ke("Customer and package are required.");if(!["deposit","full"].includes(o))return ke("Choose deposit or full payment.");let u=await e.DB.prepare(`
      SELECT id, first_name, last_name, email
      FROM customers
      WHERE id = ? AND business_id = ?
      LIMIT 1
    `).bind(n,t.business_id).first();if(!u)return ke("Customer not found.");if(!u.email)return ke("Add an email address to the customer before taking an online package payment.");let d=await e.DB.prepare(`
      SELECT
        pt.id,
        pt.service_id,
        pt.name,
        pt.sessions_total,
        pt.price_minor,
        pt.payment_rule,
        pt.deposit_minor,
        pt.validity_days,
        pt.is_active,
        s.requires_consultation
      FROM package_templates pt
      JOIN services s
        ON s.id = pt.service_id
       AND s.business_id = pt.business_id
      WHERE
        pt.id = ?
        AND pt.business_id = ?
      LIMIT 1
    `).bind(r,t.business_id).first();if(!d||Number(d.is_active)!==1)return ke("Package is unavailable.");let p=(await e.DB.prepare(`
      SELECT
        pv.id,
        pv.service_id,
        pv.name,
        pv.price_minor,
        pv.payment_rule,
        pv.deposit_minor,
        s.requires_consultation
      FROM package_variants pv
      JOIN services s
        ON s.id = pv.service_id
       AND s.business_id = pv.business_id
      WHERE
        pv.package_template_id = ?
        AND pv.business_id = ?
        AND pv.is_active = 1
      ORDER BY pv.sort_order, pv.name COLLATE NOCASE
    `).bind(d.id,t.business_id).all()).results||[];if(p.length>0&&!a)return ke("Choose a package variant.");let m=a?p.find($=>$.id===a):null;if(a&&!m)return ke("Selected package variant is unavailable.");let _=m?.service_id||d.service_id,g=Math.max(0,Number(m?.price_minor??d.price_minor??0)),E=Math.max(0,Number(m?.deposit_minor??d.deposit_minor??0)),f=String(m?.payment_rule??d.payment_rule??(E>0?"deposit":"full")),b=m?`${d.name} \xB7 ${m.name}`:d.name,N=Number(m?.requires_consultation??d.requires_consultation??0);if(f==="full"&&o!=="full")return ke("This package requires full payment.");if(f==="deposit"&&!["deposit","full"].includes(o))return ke("Choose either the configured deposit or full payment for this package.");if(f==="pay_later")return ke("This package is configured for staff-managed payment. Assign it first, then record payment against the customer package.");let v=g,S=f==="deposit"?E:0,h=await Q(e,t.business_id);if(h.error)return Response.json({ok:!1,error:h.error},{status:503});if(h.row.status!=="verified")return ke("Test the Stripe connection in Settings \u2192 Payments before taking package payments.");await nd({env:e,integration:h,businessId:t.business_id,customerId:u.id});let I=await Fe({env:e,businessId:t.business_id,customerId:u.id,serviceId:_}),R=I.source_appointment_id,L=Math.min(Number(I.available_minor||0),v),T=o==="deposit"?Math.min(S,v):v,O=Math.max(T-L,0),w={discountMinor:0,type:"none",label:"",voucher:null};if(O>0)try{w=await mt({env:e,businessId:t.business_id,baseAmountMinor:O,deduction:i.deduction})}catch($){return ke($.message||"Unable to apply deduction.")}let B=Math.max(O-w.discountMinor,0);if(T<=0&&L<=0)return ke(o==="deposit"?"This package does not have a deposit configured.":"This package does not require an online payment.");let j=`psl_${crypto.randomUUID()}`,y=String(t.currency||"GBP").toUpperCase();if(B<=0&&L>0){let $=`cpk_${crypto.randomUUID()}`,me=Number(d.validity_days||0);return await e.DB.prepare(`
        INSERT INTO customer_packages (
          id, business_id, customer_id, package_template_id, package_variant_id, service_id,
          name_snapshot, sessions_total, price_minor, status,
          starts_on, expires_on, notes
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', date('now'),
          CASE WHEN ? > 0 THEN date('now', '+' || ? || ' days') ELSE NULL END,
          'Created from package sale using consultation credit'
        )
      `).bind($,t.business_id,u.id,d.id,m?.id||null,_,b,d.sessions_total,v,me,me).run(),await e.DB.prepare(`
        INSERT INTO package_sales (
          id, business_id, customer_id, package_template_id, package_variant_id,
          source, payment_choice, amount_minor, currency,
          status, payment_id, customer_package_id, created_by_user_id,
          paid_at, consultation_credit_source_appointment_id,
          consultation_credit_minor
        )
        VALUES (
          ?, ?, ?, ?, ?, 'staff', ?, 0, ?, 'paid', NULL, ?, ?,
          CURRENT_TIMESTAMP, ?, ?
        )
      `).bind(j,t.business_id,u.id,d.id,m?.id||null,o,y,$,t.user_id,R,L).run(),Response.json({ok:!0,sale_id:j,customer_package_id:$,payment_required:!1,consultation_credit_minor:L,currency:y})}let F=`pay_${crypto.randomUUID()}`,Z=String(h.config.currency||t.currency||"GBP").toUpperCase();await e.DB.prepare(`
      INSERT INTO payments (
        id, business_id, appointment_id, customer_id,
        provider, payment_type, amount_minor, currency,
        status, payment_method, notes
      )
      VALUES (?, ?, NULL, ?, 'stripe', ?, ?, ?, 'pending', 'card', ?)
    `).bind(F,t.business_id,u.id,o==="deposit"?"deposit":"full",B,Z,`Package sale: ${b} \xB7 consultation credit ${L}${w.discountMinor>0?` \xB7 discount_minor=${w.discountMinor} \xB7 deduction_type=${w.type}${w.voucher?.code?` \xB7 voucher=${w.voucher.code}`:""}${w.label?` \xB7 label=${w.label}`:""}`:""}`).run(),await Rt({env:e,businessId:t.business_id,paymentId:F,customerId:u.id,paymentType:o==="deposit"?"deposit":"full",currency:Z,discountMinor:w.discountMinor,deductionType:w.type,label:w.label,voucher:w.voucher,status:"pending"}),await e.DB.prepare(`
      INSERT INTO package_sales (
        id, business_id, customer_id, package_template_id, package_variant_id,
        source, payment_choice, amount_minor, currency,
        status, payment_id, created_by_user_id,
        consultation_credit_source_appointment_id, consultation_credit_minor
      )
      VALUES (?, ?, ?, ?, ?, 'staff', ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).bind(j,t.business_id,u.id,d.id,m?.id||null,o,B,Z,F,t.user_id,R,L).run();let oe=new URL(s.url).origin,H=new URLSearchParams;H.set("mode","payment");let z=id(t.website),Y=new URLSearchParams({business:t.business_name||"the business",website:z});H.set("success_url",`${oe}/payment-result/?status=success&package_sale_id=${encodeURIComponent(j)}&session_id={CHECKOUT_SESSION_ID}&${Y.toString()}`),H.set("cancel_url",`${oe}/payment-result/?status=cancelled&${Y.toString()}`),H.set("customer_email",u.email),H.set("client_reference_id",j),H.set("line_items[0][price_data][currency]",Z.toLowerCase()),H.set("line_items[0][price_data][unit_amount]",String(B)),H.set("line_items[0][price_data][product_data][name]",o==="deposit"?`${b} deposit`:b),H.set("line_items[0][quantity]","1"),H.set("metadata[payment_id]",F),H.set("metadata[business_id]",t.business_id),H.set("metadata[package_sale_id]",j),H.set("metadata[package_template_id]",d.id),m?.id&&H.set("metadata[package_variant_id]",m.id),H.set("metadata[package_sale_source]","staff"),w.discountMinor>0&&(H.set("metadata[discount_minor]",String(w.discountMinor)),H.set("metadata[discount_type]",w.type),w.voucher?.code&&H.set("metadata[voucher_code]",w.voucher.code)),H.set("payment_intent_data[metadata][payment_id]",F),H.set("payment_intent_data[metadata][business_id]",t.business_id),H.set("payment_intent_data[metadata][package_sale_id]",j);let ie=await X({secretKey:h.secretKey,path:"/v1/checkout/sessions",method:"POST",body:H});if(!ie.response.ok||!ie.data?.id||!ie.data?.url){let $=be(ie.data,"Unable to create Stripe Checkout.");return await e.DB.prepare(`
        DELETE FROM package_sales
        WHERE id = ? AND business_id = ?
      `).bind(j,t.business_id).run(),await e.DB.prepare(`
        DELETE FROM payments
        WHERE business_id = ?
          AND provider = 'none'
          AND payment_method = 'discount'
          AND notes LIKE ?
          AND status = 'pending'
      `).bind(t.business_id,`Discount adjustment for payment=${F}%`).run(),await e.DB.prepare(`
        DELETE FROM payments
        WHERE id = ? AND business_id = ? AND status = 'pending'
      `).bind(F,t.business_id).run(),Response.json({ok:!1,error:$},{status:502})}return await e.DB.prepare(`
      UPDATE package_sales
      SET provider_reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(ie.data.id,j,t.business_id).run(),await e.DB.prepare(`
      UPDATE payments
      SET provider_reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(ie.data.id,F,t.business_id).run(),Response.json({ok:!0,sale_id:j,checkout_url:ie.data.url,payment_id:F,amount_minor:B,currency:Z,consultation_credit_minor:L,package_value_minor:v,discount_minor:w.discountMinor,deduction_type:w.type,deduction_label:w.label||"",voucher:w.voucher?{code:w.voucher.code,discount_type:w.voucher.discount_type,value:Number(w.voucher.value||0)}:null,payment_required:!0})}catch(t){return console.error("Package sale failed:",t),Response.json({ok:!1,error:"Unable to start package sale."},{status:500})}}c(Ir,"onRequestPost");async function Lr({request:s,env:e}){try{let t=await pi(s,e);if(!t)return Response.json({ok:!1,error:"Authentication required."},{status:401});let i=await s.json(),n=String(i.sale_id||"").trim();if(!n)return ke("Package sale is required.");let r=await e.DB.prepare(`
        SELECT
          id,
          payment_id,
          provider_reference,
          status
        FROM package_sales
        WHERE
          id = ?
          AND business_id = ?
          AND source = 'staff'
        LIMIT 1
      `).bind(n,t.business_id).first();if(!r)return Response.json({ok:!0,already_closed:!0});if(r.status!=="pending")return Response.json({ok:!0,already_closed:!0});let a=await Q(e,t.business_id);if(a.error||a.row.status!=="verified")return Response.json({ok:!1,error:a.error||"Stripe is unavailable."},{status:503});let o=await Cr({env:e,integration:a,businessId:t.business_id,sale:r});return Response.json({ok:!0,cancelled:o})}catch(t){return console.error("Package sale cancellation failed:",t),Response.json({ok:!1,error:"Unable to cancel package checkout."},{status:500})}}c(Lr,"onRequestDelete");async function rd(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id =
           s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(
          s.expires_at
        ) > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(rd,"getUserContext");async function Mr({request:s,env:e}){try{let t=await rd(s,e);if(!t)return Response.json({ok:!1,error:"Authentication required."},{status:401});let i=await s.json(),n=String(i.appointment_id||"").trim(),r=String(i.package_sale_id||"").trim(),a=String(i.payment_id||"").trim(),o=String(i.checkout_url||"").trim();if(!n&&!r||!a||!o)return Response.json({ok:!1,error:"A booking or package sale, payment and checkout link are required."},{status:400});let u=await Un({env:e,businessId:t.business_id,appointmentId:n||null,packageSaleId:r||null,paymentId:a,checkoutUrl:o});return u.ok?Response.json(u):Response.json(u,{status:502})}catch(t){return console.error("Payment link email failed:",t),Response.json({ok:!1,error:"Unable to email the payment link."},{status:500})}}c(Mr,"onRequestPost");async function xr({request:s,env:e}){try{let t=await ee(e);if(!t)return Response.json({ok:!1,error:"This booking page is not configured."},{status:404});let i=new URL(s.url),n=String(i.searchParams.get("service_id")||"").trim(),r=String(i.searchParams.get("date")||"").trim(),a=String(i.searchParams.get("booking_kind")||"").trim();if(!n||!Ae(r))return G("service_id and a valid date are required.");await ue(e,t.id);let o=await Mt(e,t.id,n);if(!o||o.is_active!==1)return Response.json({ok:!1,error:"Service not found."},{status:404});let u=a==="consultation"||a==="service"?a:null,d={...o,duration_minutes:Number(o.requires_consultation||0)===1?u==="consultation"?Number(o.consultation_duration_minutes||30):u==="service"?Number(o.duration_minutes||0):Math.max(Number(o.duration_minutes||0),Number(o.consultation_duration_minutes||30)):Number(o.duration_minutes||0)},l=await Oe({env:e,business:t,service:d,date:r});return l.error?G(l.error):Response.json({ok:!0,date:r,timezone:t.timezone,service:{id:o.id,name:o.name,duration_minutes:Number(d.duration_minutes||0),booking_kind:u},slots:l.slots||[],reason:l.reason||null})}catch(t){return console.error("Public booking availability failed:",t),he("Unable to load available times.")}}c(xr,"onRequestGet");async function Pr({request:s,env:e}){try{let t=await ee(e);if(!t)return Response.json({ok:!1,error:"This booking page is not configured."},{status:404});let i=await s.json(),n=String(i.appointment_id||"").trim(),r=String(i.payment_id||"").trim();if(!n||!r)return G("Booking reference is required.");let a=await e.DB.prepare(`
        SELECT
          a.id,
          a.customer_id,
          CASE
            WHEN ABS((julianday(a.created_at) - julianday(c.created_at)) * 86400) <= 120
            THEN 1 ELSE 0
          END AS customer_created_for_checkout,
          a.status AS appointment_status,
          p.id AS payment_id,
          p.status AS payment_status,
          p.provider_reference
        FROM appointments a
        JOIN customers c
          ON c.id = a.customer_id
         AND c.business_id = a.business_id
        JOIN payments p ON p.appointment_id = a.id
        WHERE
          a.id = ?
          AND a.business_id = ?
          AND p.id = ?
          AND p.business_id = a.business_id
          AND p.provider = 'stripe'
        LIMIT 1
      `).bind(n,t.id,r).first();if(!a)return Response.json({ok:!1,error:"Booking could not be found."},{status:404});if(["paid","partially_refunded","refunded"].includes(a.payment_status))return a.appointment_status==="pending"&&await e.DB.prepare(`
            UPDATE appointments
            SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND business_id = ? AND status = 'pending'
          `).bind(n,t.id).run(),Response.json({ok:!0,paid:!0,cancelled:!1});if(a.provider_reference&&a.payment_status==="pending")try{let u=await Q(e,t.id);if(!u.error){let d=await X({secretKey:u.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(a.provider_reference)}`});if(d.response.ok&&d.data?.payment_status==="paid")return await e.DB.prepare(`
                UPDATE payments
                SET
                  status = 'paid',
                  paid_at = COALESCE(
                    paid_at,
                    CURRENT_TIMESTAMP
                  ),
                  notes =
                    'Public booking Stripe Checkout payment confirmed while returning from Checkout',
                  updated_at =
                    CURRENT_TIMESTAMP
                WHERE
                  id = ?
                  AND business_id = ?
                  AND status = 'pending'
              `).bind(r,t.id).run(),await e.DB.prepare(`
                UPDATE appointments
                SET
                  status = 'confirmed',
                  updated_at =
                    CURRENT_TIMESTAMP
                WHERE
                  id = ?
                  AND business_id = ?
                  AND status = 'pending'
              `).bind(n,t.id).run(),Response.json({ok:!0,paid:!0,cancelled:!1});d.response.ok&&d.data?.status==="open"&&await X({secretKey:u.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(a.provider_reference)}/expire`,method:"POST"})}}catch(u){console.error("Unable to verify/expire returned public Checkout session:",u)}return await e.DB.prepare(`
        DELETE FROM payments
        WHERE
          id = ?
          AND business_id = ?
          AND appointment_id = ?
          AND status NOT IN ('paid', 'partially_refunded', 'refunded')
      `).bind(r,t.id,n).run(),await e.DB.prepare(`
        DELETE FROM appointments
        WHERE
          id = ?
          AND business_id = ?
          AND booking_source = 'online'
          AND status = 'pending'
          AND NOT EXISTS (
            SELECT 1
            FROM payments p
            WHERE
              p.appointment_id = appointments.id
              AND p.business_id = appointments.business_id
              AND p.status IN ('paid', 'partially_refunded', 'refunded')
              AND p.payment_type != 'refund'
          )
      `).bind(n,t.id).run(),Number(a.customer_created_for_checkout||0)===1&&a.customer_id&&await e.DB.prepare(`
          DELETE FROM customers
          WHERE
            id = ?
            AND business_id = ?
            AND NOT EXISTS (
              SELECT 1 FROM appointments a WHERE a.customer_id = customers.id
            )
            AND NOT EXISTS (
              SELECT 1 FROM payments p WHERE p.customer_id = customers.id
            )
        `).bind(a.customer_id,t.id).run(),Response.json({ok:!0,paid:!1,cancelled:!0})}catch(t){return console.error("Public booking cancellation failed:",t),he("Unable to release the booking slot.")}}c(Pr,"onRequestPost");async function Ur({env:s}){try{let e=await ee(s);if(!e)return Response.json({ok:!1,error:"This booking page is not configured."},{status:404});await ue(s,e.id);let t=await li(s,e.id),[i,n,r,a]=await Promise.all([s.DB.prepare(`
          SELECT
            logo_data_url,
            primary_colour,
            accent_colour,
            background_colour,
            surface_colour,
            text_colour,
            form_style,
            logo_position,
            show_business_name,
            show_contact_details,
            footer_text
          FROM business_branding
          WHERE business_id = ?
          LIMIT 1
        `).bind(e.id).first(),s.DB.prepare(`
          SELECT
            s.id,
            s.name,
            s.description,
            s.booking_group,
            s.service_type,
            s.consultation_service_id,
            s.post_consultation_booking,
            s.duration_minutes,
            s.price_minor,
            s.deposit_minor,
            s.payment_timing,
            s.consultation_duration_minutes,
            s.consultation_price_minor,
            s.consultation_payment_timing,
            s.requires_consultation,
            s.requires_patch_test,
            s.sort_order,
            EXISTS (
              SELECT 1
              FROM service_payment_providers spp
              WHERE
                spp.service_id = s.id
                AND spp.provider_key = 'stripe'
            ) AS stripe_allowed,
            EXISTS (
              SELECT 1
              FROM services linked
              WHERE
                linked.business_id = s.business_id
                AND linked.consultation_service_id = s.id
                AND linked.is_active = 1
                AND linked.requires_patch_test = 1
            ) AS linked_patch_test_required,
            EXISTS (
              SELECT 1
              FROM services linked
              WHERE
                linked.business_id = s.business_id
                AND linked.consultation_service_id = s.id
                AND linked.is_active = 1
                AND linked.post_consultation_booking = 'practitioner_managed'
            ) AS linked_practitioner_managed,
            EXISTS (
              SELECT 1
              FROM services linked
              WHERE
                linked.business_id = s.business_id
                AND linked.consultation_service_id = s.id
                AND linked.is_active = 1
                AND linked.post_consultation_booking = 'client_can_book'
            ) AS linked_client_bookable
          FROM services s
          WHERE
            s.business_id = ?
            AND s.is_active = 1
            AND (
              s.service_type = 'consultation'
              OR s.requires_consultation = 0
              OR s.post_consultation_booking = 'client_can_book'
            )
          ORDER BY s.sort_order ASC, s.name COLLATE NOCASE ASC
        `).bind(e.id).all(),s.DB.prepare(`
          SELECT status
          FROM business_integrations
          WHERE
            business_id = ?
            AND integration_type = 'payments'
            AND provider = 'stripe'
          LIMIT 1
        `).bind(e.id).first(),s.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM package_templates pt
          JOIN services s
            ON s.id = pt.service_id
           AND s.business_id = pt.business_id
          WHERE
            pt.business_id = ?
            AND pt.is_active = 1
            AND pt.is_public = 1
            AND s.is_active = 1
            AND (
              s.requires_consultation = 0
              OR s.post_consultation_booking = 'client_can_book'
            )
        `).bind(e.id).first()]),[o,u]=await Promise.all([At(s,e.id),wt(s,e.id)]),d=["verified","connected","configured"].includes(String(r?.status||"").toLowerCase()),l=(n.results||[]).map(p=>{let m=p.payment_timing==="online_deposit"||p.payment_timing==="online_full"||Number(p.requires_consultation||0)===1&&p.consultation_payment_timing==="online_full";return{id:p.id,name:p.name,description:p.description,booking_group:String(p.booking_group||"").trim(),service_type:p.service_type||"standard",consultation_service_id:p.consultation_service_id||null,post_consultation_booking:p.post_consultation_booking||"client_can_book",duration_minutes:Number(p.duration_minutes||0),price_minor:Number(p.price_minor||0),deposit_minor:Number(p.deposit_minor||0),payment_timing:p.payment_timing,consultation_duration_minutes:Number(p.consultation_duration_minutes||30),consultation_price_minor:Number(p.consultation_price_minor||0),consultation_payment_timing:p.consultation_payment_timing||"free",requires_consultation:Number(p.requires_consultation||0),requires_patch_test:Number(p.requires_patch_test||0),linked_patch_test_required:Number(p.linked_patch_test_required||0),linked_practitioner_managed:Number(p.linked_practitioner_managed||0),linked_client_bookable:Number(p.linked_client_bookable||0),online_booking_available:!m||d,unavailable_reason:m&&!d?"Online payment is not currently available for this service.":null}});return Response.json({ok:!0,business:{name:e.name,email:e.email,phone:e.phone,website:e.website,timezone:e.timezone,currency:e.currency,locale:e.locale},branding:i||{logo_data_url:null,primary_colour:"#365c50",accent_colour:"#6f8079",background_colour:"#f5f4ef",surface_colour:"#ffffff",text_colour:"#18221f",form_style:"soft",logo_position:"centre",show_business_name:1,show_contact_details:1,footer_text:null},booking_rules:{enabled:t.enabled,minimum_notice_hours:t.minimum_notice_hours,max_advance_days:t.max_advance_days},booking_copy:o,booking_patch_test_copy:u,services:t.enabled?l:[],has_public_packages:Number(a?.count||0)>0})}catch(e){return console.error("Public booking config failed:",e),he("Unable to load the booking page.")}}c(Ur,"onRequestGet");async function Br({env:s,businessId:e,appointmentId:t,baseUrl:i}){let n={booking_confirmation:null,form_automation:null};try{n.booking_confirmation=await le({env:s,businessId:e,appointmentId:t,type:"booking_confirmation",uniqueKey:`booking_confirmation:${t}`,baseUrl:i})}catch(r){console.error("Booking confirmation automation failed:",t,r)}try{n.form_automation=await Ce({env:s,businessId:e,appointmentId:t,triggerEvent:"booking_confirmed",baseUrl:i})}catch(r){console.error("Booking form automation failed:",t,r)}return n}c(Br,"runConfirmedBookingAutomation");function We(s,e=300){return String(s||"").trim().slice(0,e)}c(We,"clean");async function qr({request:s,env:e}){let t=null,i=null,n=null;try{let r=await ee(e);if(!r)return Response.json({ok:!1,error:"This booking page is not configured."},{status:404});let a=await s.json();if(We(a.company_website,200))return G("We couldn't complete the booking. Please refresh the page and try again.");let o=We(a.service_id,120),u=We(a.date,10),d=We(a.time,5),l=We(a.first_name,100),p=We(a.last_name,100),m=We(a.email,200).toLowerCase(),_=We(a.phone,50),g=We(a.notes,1e3),E=a.marketing_consent===!0,f=We(a.booking_intent,20);if(!o)return G("Please choose a service.");if(!Ae(u))return G("Please choose a valid date.");if(!Ot(d))return G("Please choose a valid time.");if(!l)return G("First name is required.");if(!p)return G("Last name is required.");if(!m||!It(m))return G("A valid email address is required.");await ue(e,r.id);let b=await Mt(e,r.id,o);if(!b||b.is_active!==1)return G("That service is no longer available.");if(f==="service"&&String(b.service_type||"standard")!=="consultation"&&Number(b.requires_consultation||0)===1&&String(b.post_consultation_booking||"client_can_book")==="practitioner_managed")return Response.json({ok:!1,error:"This treatment is managed by the practitioner after consultation. Please contact the business to arrange treatment.",practitioner_managed:!0},{status:409});let N=null;if(String(b.service_type||"standard")!=="consultation"&&Number(b.requires_consultation||0)===1&&f==="service"&&(N=await xt({env:e,businessId:r.id,firstName:l,lastName:p,email:m,phone:_}),!N))return Response.json({ok:!1,error:"We could not verify you as an existing client for this treatment. Please use the same first name, last name, email address and phone number held on your customer record, or book a consultation.",consultation_required:!0},{status:409});let v=await _s({env:e,businessId:r.id,firstName:l,lastName:p,email:m,phone:_,marketingConsent:E});t=v.created?v.id:null;let S=null,h=0,I=String(b.service_type||"standard")==="consultation",R=I?"consultation":"service";if(!I&&Number(b.requires_consultation||0)===1&&(f==="consultation"?R="consultation":f==="service"?R="service":R="consultation"),R==="service"){let ne=await Fe({env:e,businessId:r.id,customerId:v.id,serviceId:b.id});S=ne.source_appointment_id,h=Number(ne.available_minor||0)}let L=Number(I?b.duration_minutes||0:R==="consultation"?b.consultation_duration_minutes||30:b.duration_minutes||0),T=String(I?b.payment_timing||"pay_at_appointment":R==="consultation"?b.consultation_payment_timing||"free":b.payment_timing||"pay_at_appointment"),O=I?Math.max(0,Number(b.price_minor||0)):R==="consultation"?Math.max(0,Number(b.consultation_price_minor||0)):Math.max(0,Number(b.price_minor||0)),w=R==="consultation"?0:Math.max(0,Number(b.deposit_minor||0)),B=R==="service"?Math.min(h,O):0,j=Math.max(0,O-B),y=Math.max(0,w-B),F={...b,duration_minutes:L},Z=await Oe({env:e,business:r,service:F,date:u});if(Z.error)return t&&await He(e,r.id,t),G(Z.error);if(!(Z.slots||[]).includes(d))return t&&await He(e,r.id,t),Ct(Z.reason||"That time is no longer available. Please choose another time.");let oe=T==="online_deposit"&&y>0||T==="online_full"&&j>0,H=null;if(oe&&(H=await Q(e,r.id),H.error))return t&&await He(e,r.id,t),Response.json({ok:!1,error:"Online booking is temporarily unavailable for this service. Please contact the business."},{status:503});let z=`apt_${crypto.randomUUID()}`,Y=`${u}T${d}:00`,ie=Lt(u,d,L),$=oe?"pending":"confirmed",me=T==="online_deposit"?y:0;if(T==="online_deposit"&&O>0&&w<=0)return t&&await He(e,r.id,t),G("This service's deposit amount has not been configured.");let Ve=Math.max(0,Number(r.booking_buffer_before_minutes||0)),ut=Math.max(0,Number(r.booking_buffer_after_minutes||0));if(!(await e.DB.prepare(`
        INSERT INTO appointments (
          id,
          business_id,
          customer_id,
          service_id,
          status,
          start_at,
          end_at,
          price_minor,
          deposit_due_minor,
          booking_source,
          customer_notes,
          booking_kind,
          consultation_credit_source_appointment_id,
          consultation_credit_minor
        )
        SELECT
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1
          FROM appointments existing
          WHERE
            existing.business_id = ?
            AND existing.status != 'cancelled'
            AND datetime(existing.start_at, '-' || ? || ' minutes') < datetime(?)
            AND datetime(existing.end_at, '+' || ? || ' minutes') > datetime(?)
        )
      `).bind(z,r.id,v.id,b.id,$,Y,ie,O,me,g||null,R,R==="service"?S:null,B,r.id,Ve,ie,ut,Y).run()).meta?.changes)return t&&await He(e,r.id,t),Ct("That time has just been booked. Please choose another time.");i=z;let te={id:z,service_name:b.name,start_at:Y,end_at:ie,status:$,price_minor:O,deposit_due_minor:me,consultation_credit_minor:B,payment_timing:T,booking_kind:R,booking_label:I?b.name:R==="consultation"?`Consultation \xB7 ${b.name}`:b.name,requires_consultation:Number(b.requires_consultation||0),requires_patch_test:Number(b.requires_patch_test||0)};if(!oe||j<=0||T==="free")return await Br({env:e,businessId:r.id,appointmentId:z,baseUrl:it(s)}),Response.json({ok:!0,booking:te,payment_required:!1});let k=T==="online_deposit"?Math.min(y,j):j;if(k<=0)return await e.DB.prepare(`
          UPDATE appointments
          SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ?
        `).bind(z,r.id).run(),te.status="confirmed",await Br({env:e,businessId:r.id,appointmentId:z,baseUrl:it(s)}),Response.json({ok:!0,booking:te,payment_required:!1});let M=`pay_${crypto.randomUUID()}`;n=M;let U=T==="online_deposit"?"deposit":"full",V=String(H.config?.currency||r.currency||"GBP").toLowerCase();await e.DB.prepare(`
        INSERT INTO payments (
          id,
          business_id,
          appointment_id,
          customer_id,
          provider,
          payment_type,
          amount_minor,
          currency,
          status,
          payment_method,
          notes
        )
        VALUES (?, ?, ?, ?, 'stripe', ?, ?, ?, 'pending', 'card', ?)
      `).bind(M,r.id,z,v.id,U,k,V.toUpperCase(),"Public booking Stripe Checkout session created").run();let x=it(s),P=new URLSearchParams;P.set("mode","payment"),P.set("success_url",`${x}/book/success/?appointment_id=${encodeURIComponent(z)}&session_id={CHECKOUT_SESSION_ID}`),P.set("cancel_url",`${x}/book/cancelled/?appointment_id=${encodeURIComponent(z)}&payment_id=${encodeURIComponent(M)}`),P.set("customer_email",m),P.set("client_reference_id",z),P.set("expires_at",String(Math.floor(Date.now()/1e3)+1800)),P.set("line_items[0][price_data][currency]",V),P.set("line_items[0][price_data][unit_amount]",String(k)),P.set("line_items[0][price_data][product_data][name]",R==="consultation"?`${b.name} consultation`:U==="deposit"?`${b.name} deposit`:b.name),P.set("line_items[0][quantity]","1"),P.set("metadata[payment_id]",M),P.set("metadata[business_id]",r.id),P.set("metadata[appointment_id]",z),P.set("metadata[public_booking]","1"),P.set("payment_intent_data[metadata][payment_id]",M),P.set("payment_intent_data[metadata][business_id]",r.id),P.set("payment_intent_data[metadata][appointment_id]",z);let J=await X({secretKey:H.secretKey,path:"/v1/checkout/sessions",method:"POST",body:P});if(!J.response.ok||!J.data?.id||!J.data?.url){let ne=be(J.data,"Stripe Checkout could not be created.");return await e.DB.prepare(`
          UPDATE payments
          SET status = 'failed', notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ?
        `).bind(`Public booking Checkout failed: ${ne}`.slice(0,1e3),M,r.id).run(),await e.DB.prepare(`
          UPDATE appointments
          SET
            status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_reason = 'Online payment could not be started',
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ? AND status = 'pending'
        `).bind(z,r.id).run(),Response.json({ok:!1,error:"We couldn't start the secure payment. Please try again."},{status:502})}return await e.DB.prepare(`
        UPDATE payments
        SET provider_reference = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `).bind(J.data.id,M,r.id).run(),Response.json({ok:!0,booking:te,payment_required:!0,checkout:{payment_id:M,session_id:J.data.id,url:J.data.url,amount_minor:k,currency:V.toUpperCase(),payment_type:U,expires_in_minutes:30}})}catch(r){console.error("Public booking creation failed:",r);try{n&&await e.DB.prepare(`
            UPDATE payments
            SET status = 'failed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'pending'
          `).bind(n).run(),i&&await e.DB.prepare(`
            UPDATE appointments
            SET
              status = 'cancelled',
              cancelled_at = CURRENT_TIMESTAMP,
              cancellation_reason = 'Online booking could not be completed',
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'pending'
          `).bind(i).run()}catch(a){console.error("Public booking cleanup failed:",a)}return he("We couldn't complete the booking. Please try again.")}}c(qr,"onRequestPost");function Pt(s,e=300){return String(s||"").trim().slice(0,e)}c(Pt,"clean");async function jr({request:s,env:e}){try{let t=await ee(e);if(!t)return Response.json({ok:!1,error:"This booking page is not configured."},{status:404});let i=await s.json(),n=Pt(i.service_id,120),r=Pt(i.booking_intent,20),a=Pt(i.first_name,100),o=Pt(i.last_name,100),u=Pt(i.email,200).toLowerCase(),d=Pt(i.phone,50);if(!n)return G("Please choose a service.");if(!a||!o)return G("First and last name are required.");if(!u||!It(u))return G("A valid email address is required.");let l=await Mt(e,t.id,n);if(!l||Number(l.is_active||0)!==1)return G("That service is no longer available.");if(r==="service"&&String(l.service_type||"standard")!=="consultation"&&Number(l.requires_consultation||0)===1&&String(l.post_consultation_booking||"client_can_book")==="practitioner_managed")return Response.json({ok:!1,error:"This treatment is managed by the practitioner after consultation. Please contact the business to arrange treatment.",practitioner_managed:!0},{status:409});let p=null;r==="service"&&String(l.service_type||"standard")!=="consultation"&&Number(l.requires_consultation||0)===1&&(p=await xt({env:e,businessId:t.id,firstName:a,lastName:o,email:u,phone:d}));let m=Math.max(0,Number(l.price_minor||0)),_=Math.max(0,Number(l.deposit_minor||0));if(String(l.service_type||"standard")==="consultation"||r!=="service"||Number(l.requires_consultation||0)!==1||!p)return Response.json({ok:!0,existing_customer:!!p,consultation_completed:!1,consultation_credit_minor:0,price_minor:m,deposit_minor:_,remaining_minor:m,due_today_minor:l.payment_timing==="online_full"?m:l.payment_timing==="online_deposit"?_:0});let g=await Fe({env:e,businessId:t.id,customerId:p.id,serviceId:l.id}),E=Math.max(0,Number(g.available_minor||0)),f=Math.min(E,m),b=Math.max(0,m-f),N=0;return l.payment_timing==="online_full"?N=b:l.payment_timing==="online_deposit"&&(N=Math.min(Math.max(0,_-f),b)),Response.json({ok:!0,existing_customer:!0,consultation_completed:null,consultation_credit_minor:f,price_minor:m,deposit_minor:_,remaining_minor:b,due_today_minor:N})}catch(t){return console.error("Public booking preview failed:",t),he("Unable to check your booking payment details.")}}c(jr,"onRequestPost");async function Hr({request:s,env:e}){try{let t=await ee(e);if(!t)return Response.json({ok:!1,error:"This booking page is not configured."},{status:404});let i=new URL(s.url),n=String(i.searchParams.get("appointment_id")||"").trim(),r=String(i.searchParams.get("session_id")||"").trim();if(!n||!r)return G("Booking reference and payment session are required.");await ue(e,t.id);let a=await e.DB.prepare(`
        SELECT
          a.id,
          a.customer_id,
          a.status,
          a.start_at,
          a.end_at,
          a.price_minor,
          a.deposit_due_minor,
          a.consultation_credit_minor,
          a.booking_kind,
          s.name AS service_name,
          s.requires_consultation,
          s.requires_patch_test,
          p.id AS payment_id,
          p.status AS payment_status,
          p.amount_minor AS payment_amount_minor,
          p.payment_type,
          p.currency
        FROM appointments a
        JOIN services s ON s.id = a.service_id
        JOIN payments p ON p.appointment_id = a.id
        WHERE
          a.id = ?
          AND a.business_id = ?
          AND p.provider = 'stripe'
          AND p.provider_reference = ?
        ORDER BY datetime(p.created_at) DESC
        LIMIT 1
      `).bind(n,t.id,r).first();if(!a)return Response.json({ok:!1,error:"Booking confirmation could not be found."},{status:404});let o=it(s);if(!["paid","partially_refunded","refunded"].includes(String(a.payment_status||""))){let p=await Q(e,t.id);if(!p.error){let m=await X({secretKey:p.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(r)}`});m.response.ok&&m.data?.payment_status==="paid"&&(await e.DB.prepare(`
              UPDATE payments
              SET
                status = 'paid',
                payment_method = ?,
                paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
                notes = 'Stripe Checkout payment confirmed on booking return',
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND business_id = ?
            `).bind(String(m.data?.payment_method_types?.[0]||"card"),a.payment_id,t.id).run(),a.payment_status="paid")}}if(["paid","partially_refunded","refunded"].includes(String(a.payment_status||""))&&a.status==="pending"&&(await e.DB.prepare(`
          UPDATE appointments
          SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ? AND status = 'pending'
        `).bind(n,t.id).run(),a.status="confirmed"),["paid","partially_refunded","refunded"].includes(String(a.payment_status||""))&&a.status==="confirmed"){try{await ye({env:e,businessId:t.id,paymentId:a.payment_id,baseUrl:o})}catch(p){console.error("Booking return payment receipt failed:",p)}try{await le({env:e,businessId:t.id,appointmentId:n,type:"booking_confirmation",uniqueKey:`booking_confirmation:${n}`,baseUrl:o})}catch(p){console.error("Booking return confirmation email failed:",p)}try{await Ce({env:e,businessId:t.id,appointmentId:n,triggerEvent:"booking_confirmed",baseUrl:o})}catch(p){console.error("Booking return form automation failed:",p)}try{await Ce({env:e,businessId:t.id,appointmentId:n,triggerEvent:"payment_received",baseUrl:o})}catch(p){console.error("Payment return form automation failed:",p)}}let d=a.status==="confirmed"&&["paid","partially_refunded","refunded"].includes(String(a.payment_status||"")),l=null;if(d)try{let p=await ts({env:e,businessId:t.id,appointmentId:a.id,customerId:a.customer_id});l=`/manage-booking/#token=${encodeURIComponent(p)}`}catch(p){console.error("Unable to issue success-page manage link:",p)}return Response.json({ok:!0,booking:{id:a.id,status:a.status,service_name:a.service_name,booking_kind:a.booking_kind||"service",booking_label:a.booking_kind==="consultation"?`Consultation \xB7 ${a.service_name}`:a.service_name,start_at:a.start_at,end_at:a.end_at,price_minor:Number(a.price_minor||0),deposit_due_minor:Number(a.deposit_due_minor||0),consultation_credit_minor:Number(a.consultation_credit_minor||0),requires_consultation:Number(a.requires_consultation||0),requires_patch_test:Number(a.requires_patch_test||0)},payment:{status:a.payment_status,amount_minor:Number(a.payment_amount_minor||0),payment_type:a.payment_type,currency:a.currency},manage_url:l,business:{name:t.name||null,website:t.website||null},confirmed:d})}catch(t){return console.error("Public booking status failed:",t),he("Unable to confirm the booking yet.")}}c(Hr,"onRequestGet");function ad(s){let e=atob(s),t=new Uint8Array(e.length);for(let i=0;i<e.length;i+=1)t[i]=e.charCodeAt(i);return t}c(ad,"decodeBase64");async function Fr({env:s}){try{let e=await ee(s);if(!e)return new Response("Not found",{status:404});let t=await s.DB.prepare(`
        SELECT logo_data_url
        FROM business_branding
        WHERE business_id = ?
        LIMIT 1
      `).bind(e.id).first(),n=String(t?.logo_data_url||"").trim().match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/i);if(!n)return new Response("Not found",{status:404});let r=ad(n[2]);return new Response(r,{status:200,headers:{"Content-Type":n[1].toLowerCase(),"Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff"}})}catch(e){return console.error("Public branding logo failed:",e),new Response("Not found",{status:404})}}c(Fr,"onRequestGet");async function Wr({request:s,env:e}){try{let t=await ee(e);if(!t)return Response.json({ok:!1,error:"Business is unavailable."},{status:404});let i=new URL(s.url),n=String(i.searchParams.get("sale_id")||"").trim(),r=String(i.searchParams.get("date")||"").trim();if(!n||!Ae(r))return G("A valid package purchase and date are required.");await ue(e,t.id);let a=await e.DB.prepare(`
          SELECT
            ps.customer_id,
            ps.customer_package_id,
            cp.status AS package_status,
            cp.sessions_total,
            cp.expires_on,
            pt.service_id,
            s.name AS service_name,
            s.duration_minutes,
            s.price_minor,
            s.deposit_minor,
            s.payment_timing,
            s.requires_consultation,
            s.requires_patch_test,
            s.is_active

          FROM package_sales ps

          JOIN package_templates pt
            ON pt.id =
               ps.package_template_id

          JOIN services s
            ON s.id =
               pt.service_id
           AND s.business_id =
               ps.business_id

          JOIN customer_packages cp
            ON cp.id =
               ps.customer_package_id

          WHERE
            ps.id = ?
            AND ps.business_id = ?
            AND ps.source =
                'public'
            AND ps.status =
                'paid'

          LIMIT 1
        `).bind(n,t.id).first();if(!a||!a.customer_package_id)return Response.json({ok:!1,error:"The paid package could not be found."},{status:404});if(a.package_status!=="active")return G("This package is not available for booking.");if(a.expires_on&&r>a.expires_on)return G("The selected date is after this package expires.");let o=await e.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM customer_package_appointments cpa
          JOIN appointments a
            ON a.id =
               cpa.appointment_id
          WHERE
            cpa.customer_package_id = ?
            AND a.status IN (
              'pending',
              'confirmed',
              'completed'
            )
        `).bind(a.customer_package_id).first();if(Number(o?.count||0)>=Number(a.sessions_total||0))return G("There are no package sessions remaining to book.");let u=await Oe({env:e,business:t,service:a,date:r});return u.error?G(u.error):Response.json({ok:!0,date:r,timezone:t.timezone,service:{id:a.service_id,name:a.service_name,duration_minutes:Number(a.duration_minutes||0)},slots:u.slots||[],reason:u.reason||null})}catch(t){return console.error("Public package availability failed:",t),he("Unable to load package-session availability.")}}c(Wr,"onRequestGet");async function $r({request:s,env:e}){try{let t=await ee(e);if(!t)return Response.json({ok:!1,error:"Business is unavailable."},{status:404});let i=await s.json(),n=String(i.sale_id||"").trim(),r=String(i.date||"").trim(),a=String(i.time||"").trim();if(!n||!Ae(r)||!Ot(a))return G("A valid package purchase, date and time are required.");await ue(e,t.id);let o=await e.DB.prepare(`
          SELECT
            ps.customer_id,
            ps.customer_package_id,
            cp.status AS package_status,
            cp.sessions_total,
            cp.expires_on,
            pt.service_id,
            s.name AS service_name,
            s.duration_minutes,
            s.price_minor,
            s.deposit_minor,
            s.payment_timing,
            s.requires_consultation,
            s.requires_patch_test,
            s.is_active

          FROM package_sales ps

          JOIN package_templates pt
            ON pt.id =
               ps.package_template_id

          JOIN services s
            ON s.id =
               pt.service_id
           AND s.business_id =
               ps.business_id

          JOIN customer_packages cp
            ON cp.id =
               ps.customer_package_id

          WHERE
            ps.id = ?
            AND ps.business_id = ?
            AND ps.source =
                'public'
            AND ps.status =
                'paid'

          LIMIT 1
        `).bind(n,t.id).first();if(!o||!o.customer_package_id)return Response.json({ok:!1,error:"The paid package could not be found."},{status:404});if(o.package_status!=="active")return G("This package is not available for booking.");if(o.expires_on&&r>o.expires_on)return G("The selected date is after this package expires.");let u=await e.DB.prepare(`
          SELECT COUNT(*) AS count
          FROM customer_package_appointments cpa
          JOIN appointments a
            ON a.id =
               cpa.appointment_id
          WHERE
            cpa.customer_package_id = ?
            AND a.status IN (
              'pending',
              'confirmed',
              'completed'
            )
        `).bind(o.customer_package_id).first();if(Number(u?.count||0)>=Number(o.sessions_total||0))return G("There are no package sessions remaining to book.");let d=await Oe({env:e,business:t,service:o,date:r});if(d.error)return G(d.error);if(!(d.slots||[]).includes(a))return Ct(d.reason||"That time is no longer available.");let l=`apt_${crypto.randomUUID()}`,p=`${r}T${a}:00`,m=Lt(r,a,Number(o.duration_minutes||0));if(!(await e.DB.prepare(`
          INSERT INTO appointments (
            id,
            business_id,
            customer_id,
            service_id,
            status,
            start_at,
            end_at,
            price_minor,
            deposit_due_minor,
            booking_source,
            booking_kind
          )
          SELECT
            ?, ?, ?, ?,
            'confirmed',
            ?, ?,
            0,
            0,
            'online',
            'service'
          WHERE NOT EXISTS (
            SELECT 1
            FROM appointments existing
            WHERE
              existing.business_id = ?
              AND existing.status !=
                  'cancelled'
              AND datetime(
                existing.start_at
              ) < datetime(?)
              AND datetime(
                existing.end_at
              ) > datetime(?)
          )
        `).bind(l,t.id,o.customer_id,o.service_id,p,m,t.id,m,p).run()).meta?.changes)return Ct("That time has just been booked. Please choose another time.");await e.DB.prepare(`
        INSERT INTO customer_package_appointments (
          customer_package_id,
          appointment_id
        )
        VALUES (?, ?)
      `).bind(o.customer_package_id,l).run();try{await le({env:e,businessId:t.id,appointmentId:l,type:"booking_confirmation",uniqueKey:`booking_confirmation:${l}`,baseUrl:new URL(s.url).origin})}catch(g){console.error("Public package-session confirmation failed:",g)}try{await Ce({env:e,businessId:t.id,appointmentId:l,triggerEvent:"booking_confirmed",baseUrl:new URL(s.url).origin})}catch(g){console.error("Public package-session form automation failed:",g)}return Response.json({ok:!0,booking:{id:l,service_name:o.service_name,start_at:p,end_at:m,status:"confirmed",price_minor:0,covered_by_package:!0,customer_package_id:o.customer_package_id}})}catch(t){return console.error("Public package-session booking failed:",t),he("Unable to book the package session.")}}c($r,"onRequestPost");async function Jr({request:s,env:e}){try{let t=await ee(e);if(!t)return Response.json({ok:!1,error:"Business unavailable."},{status:404});let i=await s.json().catch(()=>({})),n=String(i.sale_id||"").trim();if(!n)return Response.json({ok:!1,error:"Sale id is required."},{status:400});let r=await e.DB.prepare(`
      SELECT
        ps.id,
        ps.payment_id,
        ps.customer_id,
        ps.status,
        CASE
          WHEN c.id IS NOT NULL
               AND ABS((julianday(ps.created_at) - julianday(c.created_at)) * 86400) <= 120
          THEN 1 ELSE 0
        END AS customer_created_for_checkout
      FROM package_sales ps
      LEFT JOIN customers c
        ON c.id = ps.customer_id
       AND c.business_id = ps.business_id
      WHERE
        ps.id = ?
        AND ps.business_id = ?
        AND ps.source = 'public'
      LIMIT 1
    `).bind(n,t.id).first();return r?String(r.status||"")==="paid"?Response.json({ok:!0,removed:!1}):r.payment_id&&await e.DB.prepare(`
        SELECT 1 AS found
        FROM payments
        WHERE
          id = ?
          AND business_id = ?
          AND status IN ('paid', 'partially_refunded', 'refunded')
          AND payment_type != 'refund'
        LIMIT 1
      `).bind(r.payment_id,t.id).first()?Response.json({ok:!0,removed:!1}):(await e.DB.prepare(`
      DELETE FROM package_sales
      WHERE
        id = ?
        AND business_id = ?
        AND source = 'public'
        AND status IN ('pending', 'failed')
    `).bind(n,t.id).run(),r.payment_id&&await e.DB.prepare(`
        DELETE FROM payments
        WHERE
          id = ?
          AND business_id = ?
          AND status NOT IN ('paid', 'partially_refunded', 'refunded')
      `).bind(r.payment_id,t.id).run(),r.customer_id&&Number(r.customer_created_for_checkout||0)===1&&await He(e,t.id,r.customer_id),Response.json({ok:!0,removed:!0})):Response.json({ok:!0,removed:!1})}catch(t){return console.error("Public package cancellation cleanup failed:",t),Response.json({ok:!1,error:"Unable to clear cancelled package purchase."},{status:500})}}c(Jr,"onRequestPost");async function Gr({env:s}){try{let e=await ee(s);if(!e)return Response.json({ok:!1,error:"Business is unavailable."},{status:404});let[t,i,n]=await Promise.all([s.DB.prepare(`
        SELECT
          pt.id,
          pt.name,
          pt.description,
          pt.sessions_total,
          pt.price_minor,
          pt.payment_rule,
          pt.deposit_minor,
          pt.validity_days,
          s.id AS service_id,
          s.name AS service_name,
          s.requires_consultation,
          s.requires_patch_test,
          s.post_consultation_booking
        FROM package_templates pt
        JOIN services s
          ON s.id = pt.service_id
         AND s.business_id = pt.business_id
        WHERE
          pt.business_id = ?
          AND pt.is_active = 1
          AND pt.is_public = 1
          AND s.is_active = 1
          AND pt.payment_rule <> 'pay_later'
        ORDER BY pt.name COLLATE NOCASE
      `).bind(e.id).all(),s.DB.prepare(`
        SELECT
          pv.id,
          pv.package_template_id,
          pv.service_id,
          pv.name,
          pv.price_minor,
          pv.payment_rule,
          pv.deposit_minor,
          s.name AS service_name,
          s.requires_consultation,
          s.requires_patch_test,
          s.post_consultation_booking
        FROM package_variants pv
        JOIN services s
          ON s.id = pv.service_id
         AND s.business_id = pv.business_id
        JOIN package_templates pt
          ON pt.id = pv.package_template_id
         AND pt.business_id = pv.business_id
        WHERE
          pv.business_id = ?
          AND pv.is_active = 1
          AND pt.is_active = 1
          AND pt.is_public = 1
          AND s.is_active = 1
          AND pv.payment_rule <> 'pay_later'
          AND (
            s.requires_consultation = 0
            OR s.post_consultation_booking = 'client_can_book'
          )
        ORDER BY
          pv.package_template_id,
          pv.sort_order,
          pv.name COLLATE NOCASE
      `).bind(e.id).all(),s.DB.prepare(`
        SELECT primary_colour
        FROM business_branding
        WHERE business_id = ?
        LIMIT 1
      `).bind(e.id).first()]),r=i.results||[],a=(t.results||[]).map(o=>{let u=r.filter(l=>l.package_template_id===o.id),d=Number(o.requires_consultation||0)===0||String(o.post_consultation_booking||"client_can_book")==="client_can_book";return!u.length&&!d?null:{...o,variants:u}}).filter(Boolean);return Response.json({ok:!0,business:{name:e.name,currency:e.currency||"GBP"},branding:{primary_colour:n?.primary_colour||"#365178"},packages:a})}catch(e){return console.error("Public packages config failed:",e),Response.json({ok:!1,error:"Unable to load packages."},{status:500})}}c(Gr,"onRequestGet");async function od(s,e,t=null){let i=`
    SELECT
      ps.id,
      ps.business_id,
      ps.payment_id,
      ps.provider_reference,
      ps.customer_package_id,
      ps.status,
      ps.source
    FROM package_sales ps
    WHERE ps.id = ?
      AND ps.source = 'public'
  `,n=[e];return t&&(i+=" AND ps.business_id = ?",n.push(t)),i+=" LIMIT 1",await s.DB.prepare(i).bind(...n).first()}c(od,"getSale");async function Ft({env:s,saleId:e,sessionId:t=null,businessId:i=null,baseUrl:n=null,sendReceipt:r=!0}){let a=String(e||"").trim();if(!a)return{ok:!1,error:"Package sale is required."};let o=await od(s,a,i);if(!o)return{ok:!1,not_found:!0,error:"Package purchase was not found."};let u=String(t||o.provider_reference||"").trim();if(!u.startsWith("cs_"))return{ok:!0,paid:o.status==="paid",status:o.status||"pending",customer_package_id:o.customer_package_id||null,skipped:!0,reason:"missing_checkout_session"};let d=await Q(s,o.business_id);if(d.error||d.row?.status!=="verified")return{ok:!1,error:"Stripe verification is temporarily unavailable."};let l=await X({secretKey:d.secretKey,path:`/v1/checkout/sessions/${encodeURIComponent(u)}`});if(!l.response.ok)return{ok:!1,error:be(l.data,"Unable to verify package payment.")};let p=l.data||{};if(String(p?.metadata?.package_sale_id||"")!==o.id||String(p?.metadata?.business_id||"")!==String(o.business_id))return{ok:!1,error:"Stripe package payment reference did not match."};if(p.payment_status!=="paid")return p.status==="expired"&&(await s.DB.prepare(`
        UPDATE package_sales
        SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ? AND status = 'pending'
      `).bind(o.id,o.business_id).run(),o.payment_id&&await s.DB.prepare(`
          UPDATE payments
          SET status = 'failed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ?
            AND status NOT IN ('paid', 'partially_refunded', 'refunded')
        `).bind(o.payment_id,o.business_id).run()),{ok:!0,paid:!1,status:p.status||o.status||"pending"};let m=await Ye({env:s,session:p,paid:!0});o.payment_id&&(await s.DB.prepare(`
      UPDATE payments
      SET
        status = 'paid',
        provider_reference = ?,
        payment_method = ?,
        paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP),
        notes = CASE
          WHEN COALESCE(notes, '') = '' THEN
            'Stripe public package payment confirmed'
          WHEN instr(COALESCE(notes, ''), 'Stripe public package payment confirmed') > 0 THEN notes
          ELSE notes || ' \xB7 Stripe public package payment confirmed'
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(p.id,String(p.payment_method_types?.[0]||"card"),o.payment_id,o.business_id).run(),await ge({env:s,businessId:o.business_id,paymentId:o.payment_id,status:"paid",customerPackageId:m?.customer_package_id||o.customer_package_id||null}));let _=!1,g=null;if(r&&o.payment_id)try{let E=await ye({env:s,businessId:o.business_id,paymentId:o.payment_id,baseUrl:n});_=E?.ok===!0,_||(g=E?.error||E?.reason||null)}catch(E){g=E?.message||"Unable to send package payment confirmation email.",console.error("Public package payment confirmation email failed:",E)}return{ok:!0,paid:!0,status:"paid",customer_package_id:m?.customer_package_id||o.customer_package_id||null,receipt_sent:_,receipt_error:g}}c(Ft,"confirmPublicPackagePayment");async function ms({env:s,businessId:e,baseUrl:t=null,limit:i=25}){let n=await s.DB.prepare(`
    SELECT id, provider_reference
    FROM package_sales
    WHERE business_id = ?
      AND source = 'public'
      AND status = 'pending'
      AND provider_reference LIKE 'cs_%'
    ORDER BY datetime(created_at) ASC
    LIMIT ?
  `).bind(e,Math.max(1,Math.min(Number(i||25),100))).all(),r=[];for(let a of n.results||[])try{r.push(await Ft({env:s,saleId:a.id,sessionId:a.provider_reference,businessId:e,baseUrl:t,sendReceipt:!0}))}catch(o){console.error("Pending public package reconciliation failed:",a.id,o),r.push({ok:!1,error:o?.message||"Unable to reconcile package payment."})}return r}c(ms,"reconcilePendingPublicPackageSales");function cd(s){return Response.json({ok:!1,error:s},{status:400})}c(cd,"badRequest");async function Yr({request:s,env:e}){try{let t=await s.json(),i=String(t?.sale_id||"").trim(),n=String(t?.session_id||"").trim();if(!i||!n.startsWith("cs_"))return cd("A valid package sale and Stripe Checkout Session are required.");let r=await Ft({env:e,saleId:i,sessionId:n,baseUrl:new URL(s.url).origin,sendReceipt:!0});return r.ok?Response.json(r):Response.json(r,{status:r.not_found?404:502})}catch(t){return console.error("Public package payment confirmation failed:",t),Response.json({ok:!1,error:"Unable to confirm package payment."},{status:500})}}c(Yr,"onRequestPost");function Ke(s){return Response.json({ok:!1,error:s},{status:400})}c(Ke,"badRequest");async function Kr({request:s,env:e}){let t=null,i=null;try{let n=await ee(e);if(!n)return Response.json({ok:!1,error:"Business is unavailable."},{status:404});let r=await s.json(),a=String(r.package_template_id||"").trim(),o=String(r.package_variant_id||"").trim(),u=String(r.first_name||"").trim().slice(0,100),d=String(r.last_name||"").trim().slice(0,100),l=String(r.email||"").trim().toLowerCase().slice(0,254),p=String(r.phone||"").trim().slice(0,50),m=String(r.payment_choice||"full").trim();if(!a||!u||!d||!It(l))return Ke("Package, name and a valid email address are required.");if(!["deposit","full"].includes(m))return Ke("Choose deposit or full payment.");let _=await e.DB.prepare(`
      SELECT
        pt.id,
        pt.service_id,
        pt.name,
        pt.sessions_total,
        pt.price_minor,
        pt.payment_rule,
        pt.deposit_minor,
        pt.validity_days,
        s.requires_consultation,
        s.post_consultation_booking
      FROM package_templates pt
      JOIN services s
        ON s.id = pt.service_id
       AND s.business_id = pt.business_id
      WHERE
        pt.id = ?
        AND pt.business_id = ?
        AND pt.is_active = 1
        AND pt.is_public = 1
        AND s.is_active = 1
      LIMIT 1
    `).bind(a,n.id).first();if(!_)return Ke("That package is no longer available.");let E=(await e.DB.prepare(`
      SELECT
        pv.id,
        pv.service_id,
        pv.name,
        pv.price_minor,
        pv.payment_rule,
        pv.deposit_minor,
        s.requires_consultation,
        s.post_consultation_booking
      FROM package_variants pv
      JOIN services s
        ON s.id = pv.service_id
       AND s.business_id = pv.business_id
      WHERE
        pv.package_template_id = ?
        AND pv.business_id = ?
        AND pv.is_active = 1
      ORDER BY pv.sort_order, pv.name COLLATE NOCASE
    `).bind(_.id,n.id).all()).results||[];if(E.length>0&&!o)return Ke("Choose a package variant.");let f=o?E.find($=>$.id===o):null;if(o&&!f)return Ke("Selected package variant is unavailable.");let b=f?.service_id||_.service_id,N=Math.max(0,Number(f?.price_minor??_.price_minor??0)),v=Math.max(0,Number(f?.deposit_minor??_.deposit_minor??0)),S=String(f?.payment_rule??_.payment_rule??(v>0?"deposit":"full")),h=f?`${_.name} \xB7 ${f.name}`:_.name,I=Number(f?.requires_consultation??_.requires_consultation??0),R=String(f?.post_consultation_booking??_.post_consultation_booking??"client_can_book");if(I===1&&R==="practitioner_managed")return Response.json({ok:!1,error:"This package is selected and sold by the practitioner after consultation.",practitioner_managed:!0,service_id:b},{status:409});if(S==="pay_later")return Ke("This package is not available for online purchase.");if(S==="full"&&m!=="full")return Ke("This package requires full payment.");if(S==="deposit"&&m!=="deposit")return Ke("This package requires the configured deposit.");let L=null;if(I===1){let $=await xt({env:e,businessId:n.id,firstName:u,lastName:d,email:l,phone:p});if(!$)return Response.json({ok:!1,error:"We could not verify you as an existing client for this package. Please book the required consultation first.",consultation_required:!0,service_id:b},{status:409});L={...$,created:!1}}else L=await _s({env:e,businessId:n.id,firstName:u,lastName:d,email:l,phone:p,marketingConsent:!1});let T=null,O=0;if(I===1){let $=await Fe({env:e,businessId:n.id,customerId:L.id,serviceId:b});T=$.source_appointment_id,O=Number($.available_minor||0)}let w=N,B=S==="deposit"?v:0,j=Math.min(O,w),y=Math.max(0,w-j),F=Math.max(0,B-j),Z=m==="deposit"?Math.min(F,y):y;if(Z<=0&&j<=0)return Ke(m==="deposit"?"This package does not offer a deposit option.":"This package cannot be purchased online.");if(Z<=0&&j>0){t=`psl_${crypto.randomUUID()}`;let $=`cpk_${crypto.randomUUID()}`,me=Number(_.validity_days||0),Ve=String(n.currency||"GBP").toUpperCase();return await e.DB.prepare(`
        INSERT INTO customer_packages (
          id, business_id, customer_id, package_template_id, package_variant_id, service_id,
          name_snapshot, sessions_total, price_minor, status,
          starts_on, expires_on, notes
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', date('now'),
          CASE WHEN ? > 0 THEN date('now', '+' || ? || ' days') ELSE NULL END,
          'Created automatically from consultation credit'
        )
      `).bind($,n.id,L.id,_.id,f?.id||null,b,h,_.sessions_total,w,me,me).run(),await e.DB.prepare(`
        INSERT INTO package_sales (
          id, business_id, customer_id, package_template_id, package_variant_id,
          source, payment_choice, amount_minor, currency,
          status, payment_id, customer_package_id, paid_at,
          consultation_credit_source_appointment_id, consultation_credit_minor
        )
        VALUES (?, ?, ?, ?, ?, 'public', ?, 0, ?, 'paid', NULL, ?, CURRENT_TIMESTAMP, ?, ?)
      `).bind(t,n.id,L.id,_.id,f?.id||null,m,Ve,$,T,j).run(),Response.json({ok:!0,sale_id:t,checkout_url:null,payment_required:!1,consultation_credit_minor:j})}let oe=await Q(e,n.id);if(oe.error||oe.row.status!=="verified")return Response.json({ok:!1,error:"Online package payment is temporarily unavailable. Please contact the business."},{status:503});t=`psl_${crypto.randomUUID()}`,i=`pay_${crypto.randomUUID()}`;let H=String(oe.config.currency||n.currency||"GBP").toUpperCase();await e.DB.prepare(`
      INSERT INTO payments (
        id, business_id, appointment_id, customer_id,
        provider, payment_type, amount_minor, currency,
        status, payment_method, notes
      )
      VALUES (?, ?, NULL, ?, 'stripe', ?, ?, ?, 'pending', 'card', ?)
    `).bind(i,n.id,L.id,m==="deposit"?"deposit":"full",Z,H,`Public package purchase: ${h}`).run(),await e.DB.prepare(`
      INSERT INTO package_sales (
        id, business_id, customer_id, package_template_id, package_variant_id,
        source, payment_choice, amount_minor, currency,
        status, payment_id,
        consultation_credit_source_appointment_id, consultation_credit_minor
      )
      VALUES (?, ?, ?, ?, ?, 'public', ?, ?, ?, 'pending', ?, ?, ?)
    `).bind(t,n.id,L.id,_.id,f?.id||null,m,Z,H,i,T,j).run();let z=it(s),Y=new URLSearchParams;Y.set("mode","payment"),Y.set("success_url",`${z}/buy-package/success/?sale_id=${encodeURIComponent(t)}&session_id={CHECKOUT_SESSION_ID}`),Y.set("cancel_url",`${z}/buy-package/?cancelled=1&sale_id=${encodeURIComponent(t)}`),Y.set("customer_email",l),Y.set("client_reference_id",t),Y.set("expires_at",String(Math.floor(Date.now()/1e3)+1800)),Y.set("line_items[0][price_data][currency]",H.toLowerCase()),Y.set("line_items[0][price_data][unit_amount]",String(Z)),Y.set("line_items[0][price_data][product_data][name]",m==="deposit"?`${h} deposit`:h),Y.set("line_items[0][quantity]","1"),Y.set("metadata[payment_id]",i),Y.set("metadata[business_id]",n.id),Y.set("metadata[package_sale_id]",t),Y.set("metadata[package_template_id]",_.id),f?.id&&Y.set("metadata[package_variant_id]",f.id),Y.set("metadata[package_sale_source]","public"),Y.set("payment_intent_data[metadata][payment_id]",i),Y.set("payment_intent_data[metadata][business_id]",n.id),Y.set("payment_intent_data[metadata][package_sale_id]",t);let ie=await X({secretKey:oe.secretKey,path:"/v1/checkout/sessions",method:"POST",body:Y});if(!ie.response.ok||!ie.data?.id||!ie.data?.url){let $=be(ie.data,"Unable to create secure payment.");return await e.DB.prepare(`
        UPDATE package_sales
        SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `).bind(t,n.id).run(),await e.DB.prepare(`
        UPDATE payments
        SET status = 'failed', notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ?
      `).bind($.slice(0,1e3),i,n.id).run(),Response.json({ok:!1,error:$},{status:502})}return await e.DB.prepare(`
      UPDATE package_sales
      SET provider_reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(ie.data.id,t,n.id).run(),await e.DB.prepare(`
      UPDATE payments
      SET provider_reference = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ?
    `).bind(ie.data.id,i,n.id).run(),Response.json({ok:!0,sale_id:t,checkout_url:ie.data.url,payment_required:!0,consultation_credit_minor:j})}catch(n){return console.error("Public package purchase failed:",n),Response.json({ok:!1,error:"Unable to start package purchase."},{status:500})}}c(Kr,"onRequestPost");async function zr(s,e,t){return await s.DB.prepare(`
    SELECT
      ps.id,
      ps.status,
      ps.payment_choice,
      ps.amount_minor,
      ps.currency,
      ps.customer_package_id,
      ps.customer_id,
      ps.consultation_credit_minor,
      ps.package_variant_id,
      ps.provider_reference,
      CASE
        WHEN pv.id IS NOT NULL THEN pt.name || ' \xB7 ' || pv.name
        ELSE pt.name
      END AS package_name,
      pt.sessions_total,
      COALESCE(pv.service_id, pt.service_id) AS service_id,
      COALESCE(vs.name, s.name) AS service_name,
      COALESCE(vs.requires_consultation, s.requires_consultation) AS requires_consultation
    FROM package_sales ps
    JOIN package_templates pt ON pt.id = ps.package_template_id
    LEFT JOIN package_variants pv
      ON pv.id = ps.package_variant_id
     AND pv.package_template_id = pt.id
    JOIN services s
      ON s.id = pt.service_id
     AND s.business_id = pt.business_id
    LEFT JOIN services vs
      ON vs.id = pv.service_id
     AND vs.business_id = pt.business_id
    WHERE ps.id = ? AND ps.business_id = ? AND ps.source = 'public'
    LIMIT 1
  `).bind(t,e).first()}c(zr,"loadSale");async function Vr({request:s,env:e}){try{let t=await ee(e);if(!t)return Response.json({ok:!1,error:"Business unavailable."},{status:404});let i=new URL(s.url),n=String(i.searchParams.get("sale_id")||"").trim();if(!n)return Response.json({ok:!1,error:"Sale id is required."},{status:400});let r=await zr(e,t.id,n);return r?(r.status==="pending"&&String(r.provider_reference||"").startsWith("cs_")&&(await Ft({env:e,saleId:n,sessionId:r.provider_reference,businessId:t.id,baseUrl:i.origin,sendReceipt:!0})).ok&&(r=await zr(e,t.id,n)||r),Response.json({ok:!0,sale:r,business:{name:t.name,website:t.website||null}})):Response.json({ok:!1,error:"Package purchase not found."},{status:404})}catch(t){return console.error("Public package status failed:",t),Response.json({ok:!1,error:"Unable to check purchase."},{status:500})}}c(Vr,"onRequestGet");async function Xr(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at)
            > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(Xr,"getUserContext");function Zr(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Zr,"unauthorized");function ud(s,e=!0){return s==null?e:String(s)==="1"||String(s).toLowerCase()==="true"}c(ud,"parseBooleanSetting");function dd(s,e){if(!s)return e;try{return JSON.parse(s)}catch{return e}}c(dd,"parseJsonSetting");async function fs({env:s,businessId:e,key:t,value:i,type:n}){await s.DB.prepare(`
      INSERT INTO business_settings (
        id,
        business_id,
        setting_key,
        setting_value,
        value_type
      )
      VALUES (?, ?, ?, ?, ?)

      ON CONFLICT(
        business_id,
        setting_key
      )

      DO UPDATE SET
        setting_value =
          excluded.setting_value,
        value_type =
          excluded.value_type,
        updated_at =
          CURRENT_TIMESTAMP
    `).bind(`set_${crypto.randomUUID()}`,e,t,i,n).run()}c(fs,"upsertSetting");async function Qr({request:s,env:e}){try{let t=await Xr(s,e);if(!t)return Zr();let i=await e.DB.prepare(`
          SELECT
            timezone,
            booking_buffer_before_minutes,
            booking_buffer_after_minutes

          FROM businesses

          WHERE id = ?

          LIMIT 1
        `).bind(t.business_id).first(),n=await e.DB.prepare(`
          SELECT
            weekday,
            is_open,
            open_time,
            close_time,
            booking_interval_minutes

          FROM working_hours

          WHERE business_id = ?

          ORDER BY weekday ASC
        `).bind(t.business_id).all(),r=await e.DB.prepare(`
          SELECT
            setting_key,
            setting_value

          FROM business_settings

          WHERE
            business_id = ?
            AND setting_key IN (
              'public_booking_enabled',
              'public_booking_minimum_notice_hours',
              'public_booking_max_advance_days',
              'public_booking_blocked_dates'
            )
        `).bind(t.business_id).all(),a=Object.fromEntries((r.results||[]).map(l=>[l.setting_key,l.setting_value])),o=n.results||[],u={};for(let l of o)u[l.weekday]=l;let d=[];for(let l=1;l<=7;l++){let p=u[l];d.push({weekday:l,is_open:p?p.is_open===1:l<=5,open_time:p?.open_time||"09:00",close_time:p?.close_time||"17:00",booking_interval_minutes:p?.booking_interval_minutes||30})}return Response.json({ok:!0,timezone:i?.timezone||"Europe/London",booking_buffer_before_minutes:Number(i?.booking_buffer_before_minutes||0),booking_buffer_after_minutes:Number(i?.booking_buffer_after_minutes||0),public_booking_rules:{enabled:ud(a.public_booking_enabled,!0),minimum_notice_hours:Number(a.public_booking_minimum_notice_hours??2),max_advance_days:Number(a.public_booking_max_advance_days??90),blocked_dates:dd(a.public_booking_blocked_dates,[])},hours:d})}catch(t){return console.error("Working hours GET failed:",t),Response.json({ok:!1,error:"Unable to load working hours."},{status:500})}}c(Qr,"onRequestGet");async function ea({request:s,env:e}){try{let t=await Xr(s,e);if(!t)return Zr();let i=await s.json(),n=Array.isArray(i.hours)?i.hours:[],r=Number(i.booking_interval_minutes),a=Number(i.booking_buffer_before_minutes),o=Number(i.booking_buffer_after_minutes),u=i.public_booking_enabled!==!1,d=Number(i.public_booking_minimum_notice_hours),l=Number(i.public_booking_max_advance_days),p=Array.isArray(i.blocked_dates)?i.blocked_dates:[],m=[5,10,15,20,30,45,60],_=[0,5,10,15,20,30,45,60],g=[0,1,2,4,12,24,48,72,168],E=[7,14,30,60,90,180,365];if(!g.includes(d))return Response.json({ok:!1,error:"Invalid minimum booking notice."},{status:400});if(!E.includes(l))return Response.json({ok:!1,error:"Invalid maximum booking window."},{status:400});if(p.length>366)return Response.json({ok:!1,error:"Too many blocked-date ranges."},{status:400});let f=[],b=new Set;for(let N of p){let v=String(N?.date||"").trim(),S=String(N?.start_date||v||"").trim(),h=String(N?.end_date||v||S||"").trim(),I=String(N?.reason||"").trim().slice(0,200);if(!/^\d{4}-\d{2}-\d{2}$/.test(S)||!/^\d{4}-\d{2}-\d{2}$/.test(h))return Response.json({ok:!1,error:"Blocked dates must use valid From and To dates."},{status:400});if(h<S)return Response.json({ok:!1,error:"A blocked-date range cannot end before it starts."},{status:400});let R=`${S}:${h}`;b.has(R)||(b.add(R),f.push({start_date:S,end_date:h,reason:I}))}if(f.sort((N,v)=>N.start_date.localeCompare(v.start_date)||N.end_date.localeCompare(v.end_date)),n.length!==7)return Response.json({ok:!1,error:"Working hours must be supplied for all seven days."},{status:400});if(!m.includes(r))return Response.json({ok:!1,error:"Invalid booking interval."},{status:400});if(!_.includes(a)||!_.includes(o))return Response.json({ok:!1,error:"Invalid booking buffer."},{status:400});for(let N of n){let v=Number(N.weekday);if(!Number.isInteger(v)||v<1||v>7)return Response.json({ok:!1,error:"Invalid weekday."},{status:400});let S=N.is_open?1:0,h=S?String(N.open_time||""):null,I=S?String(N.close_time||""):null;if(S&&(!h||!I))return Response.json({ok:!1,error:"Open days require opening and closing times."},{status:400});if(S&&h>=I)return Response.json({ok:!1,error:"Closing time must be later than opening time."},{status:400})}await e.DB.prepare(`
        UPDATE businesses

        SET
          booking_buffer_before_minutes = ?,
          booking_buffer_after_minutes = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = ?
      `).bind(a,o,t.business_id).run(),await fs({env:e,businessId:t.business_id,key:"public_booking_enabled",value:u?"1":"0",type:"boolean"}),await fs({env:e,businessId:t.business_id,key:"public_booking_minimum_notice_hours",value:String(d),type:"number"}),await fs({env:e,businessId:t.business_id,key:"public_booking_max_advance_days",value:String(l),type:"number"}),await fs({env:e,businessId:t.business_id,key:"public_booking_blocked_dates",value:JSON.stringify(f),type:"json"});for(let N of n){let v=Number(N.weekday),S=N.is_open?1:0,h=S?String(N.open_time):null,I=S?String(N.close_time):null;await e.DB.prepare(`
          INSERT INTO working_hours (
            id,
            business_id,
            weekday,
            is_open,
            open_time,
            close_time,
            booking_interval_minutes
          )

          VALUES (
            ?, ?, ?, ?, ?, ?, ?
          )

          ON CONFLICT(
            business_id,
            weekday
          )

          DO UPDATE SET
            is_open =
              excluded.is_open,
            open_time =
              excluded.open_time,
            close_time =
              excluded.close_time,
            booking_interval_minutes =
              excluded.booking_interval_minutes,
            updated_at =
              CURRENT_TIMESTAMP
        `).bind(`hrs_${crypto.randomUUID()}`,t.business_id,v,S,h,I,r).run()}return Response.json({ok:!0})}catch(t){return console.error("Working hours update failed:",t),Response.json({ok:!1,error:"Unable to save working hours."},{status:500})}}c(ea,"onRequestPut");function nt(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}c(nt,"escapeHtml");function bs(s,e){let t=String(s||"").trim();return/^#[0-9a-fA-F]{6}$/.test(t)?t:e}c(bs,"normaliseHex");async function _i(s,e,t){return(await s.DB.prepare("SELECT setting_value FROM business_settings WHERE business_id = ? AND setting_key = ? LIMIT 1").bind(e,t).first())?.setting_value??null}c(_i,"setting");async function ta(s,e){return String(await _i(s,e,"reviews.google_url")||"").trim()}c(ta,"getGoogleReviewUrl");function ld({business:s,branding:e,customerName:t,reviewUrl:i}){let n=bs(e?.primary_colour,"#365178"),r=bs(e?.background_colour,"#f5f4ef"),a=bs(e?.surface_colour,"#ffffff"),o=bs(e?.text_colour,"#18221f"),u=s.base_url&&e?.logo_data_url?`${s.base_url}/api/public-branding/logo`:"",d=u?`<img src="${nt(u)}" alt="${nt(s.name)}" style="display:block;max-width:180px;max-height:64px;width:auto;height:auto;margin:0 0 20px;">`:"",l=e?.footer_text||`Sent by ${s.name}`;return`<!doctype html><html><body style="margin:0;padding:0;background:${r};font-family:Arial,sans-serif;color:${o};"><div style="max-width:620px;margin:0 auto;padding:28px 18px;"><div style="background:${a};border:1px solid rgba(24,34,31,.14);border-radius:18px;padding:30px;">${d}<div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:${n};text-transform:uppercase;">${nt(s.name)}</div><h1 style="margin:10px 0 14px;font-size:28px;line-height:1.15;">We'd love your feedback</h1><p style="margin:0 0 22px;line-height:1.6;color:#66706b;">Hi ${nt(t||"there")}, thank you for choosing ${nt(s.name)}. If you have a moment, we'd really appreciate you sharing your experience.</p><div style="margin-top:24px;"><a href="${nt(i)}" style="display:inline-block;background:${n};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">Leave a Google review</a><p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#66706b;">If the button above does not work, <a href="${nt(i)}" style="color:${n};text-decoration:underline;font-weight:600;">open the Google review page</a>.</p></div><p style="margin:22px 0 0;line-height:1.6;">Thank you for your support.</p></div><p style="margin:14px 0 0;text-align:center;color:#7b837f;font-size:12px;">${nt(l)}</p></div></body></html>`}c(ld,"reviewHtml");function pd({businessName:s,customerName:e,reviewUrl:t}){return["We'd love your feedback","",`Hi ${e||"there"}, thank you for choosing ${s}. If you have a moment, we'd really appreciate you sharing your experience.`,"","Leave a Google review:",t,"","Thank you for your support.","",`Sent by ${s}`].join(`
`)}c(pd,"reviewText");async function _d(s,e,t=""){let i=await s.DB.prepare("SELECT b.name,b.email,bb.logo_data_url,bb.primary_colour,bb.background_colour,bb.surface_colour,bb.text_colour,bb.footer_text FROM businesses b LEFT JOIN business_branding bb ON bb.business_id=b.id WHERE b.id=? LIMIT 1").bind(e).first();return i?{business:{name:i.name||"Your business",email:i.email||"",base_url:String(t||"").replace(/\/+$/,"")},branding:i}:null}c(_d,"businessEmailContext");async function sa({env:s,businessId:e,recipient:t,customerName:i,reviewUrl:n,appointmentId:r=null,customerId:a=null,customerPackageId:o=null,uniqueKey:u,baseUrl:d=""}){let l=await _d(s,e,d);if(!l)return{ok:!1,error:"Business not found."};let p=`How was your experience with ${l.business.name}?`,m=`com_${crypto.randomUUID()}`;if(u&&!(await s.DB.prepare("INSERT OR IGNORE INTO customer_communications (id,business_id,appointment_id,customer_id,customer_package_id,communication_type,recipient,subject,status,provider,unique_key) VALUES (?,?,?,?,?,'google_review_request',?,?,'pending','resend',?)").bind(m,e,r,a,o,t,p,u).run()).meta?.changes)return{ok:!0,duplicate:!0};let _=await _t(s,e);if(_.error)return u&&await s.DB.prepare("UPDATE customer_communications SET status='failed',error_details=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(_.error,m).run(),{ok:!1,error:_.error};try{let g=await De(s,e,{to:t,subject:p,html:ld({...l,customerName:i,reviewUrl:n}),text:pd({businessName:l.business.name,customerName:i,reviewUrl:n})});return u&&await s.DB.prepare("UPDATE customer_communications SET status='sent',provider=?,provider_reference=?,sent_at=CURRENT_TIMESTAMP,error_details=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(g?.provider||_.provider||"resend",g?.id||null,m).run(),{ok:!0,provider_id:g?.id||null}}catch(g){return u&&await s.DB.prepare("UPDATE customer_communications SET status='failed',error_details=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(String(g?.message||"Unable to send review request.").slice(0,1e3),m).run(),{ok:!1,error:String(g?.message||"Unable to send review request.")}}}c(sa,"deliverReview");async function ia({env:s,businessId:e,appointmentId:t,baseUrl:i=""}){let n=await ta(s,e);if(!n)return{ok:!0,skipped:!0,reason:"no_review_url"};let r=await s.DB.prepare("SELECT a.id,a.customer_id,a.service_id,a.booking_kind,a.status,c.first_name,c.email,s.service_type,cpa.customer_package_id,cp.package_template_id,cpa.linked_at FROM appointments a JOIN customers c ON c.id=a.customer_id JOIN services s ON s.id=a.service_id LEFT JOIN customer_package_appointments cpa ON cpa.appointment_id=a.id LEFT JOIN customer_packages cp ON cp.id=cpa.customer_package_id AND cp.business_id=a.business_id WHERE a.id=? AND a.business_id=? LIMIT 1").bind(t,e).first();if(!r)return{ok:!0,skipped:!0,reason:"appointment_not_found"};if(String(r.status)!=="completed")return{ok:!0,skipped:!0,reason:"not_completed"};if(String(r.booking_kind||"")==="consultation"||String(r.service_type||"")==="consultation")return{ok:!0,skipped:!0,reason:"consultation"};let a=String(r.email||"").trim().toLowerCase();if(!a)return{ok:!0,skipped:!0,reason:"no_email"};let o=!1,u=null;if(r.customer_package_id&&r.package_template_id){let d=[];try{d=JSON.parse(await _i(s,e,`reviews.package.${r.package_template_id}`)||"[]")}catch{}d=(Array.isArray(d)?d:[]).map(Number).filter(Number.isInteger);let l=await s.DB.prepare("SELECT COUNT(*) AS n FROM customer_package_appointments cpa2 WHERE cpa2.customer_package_id=? AND (datetime(cpa2.linked_at)<datetime(?) OR (datetime(cpa2.linked_at)=datetime(?) AND cpa2.appointment_id<=?))").bind(r.customer_package_id,r.linked_at,r.linked_at,t).first();u=Math.max(1,Number(l?.n||1)),o=d.includes(u)}else o=String(await _i(s,e,`reviews.service.${r.service_id}`)||"0")==="1";return o?sa({env:s,businessId:e,recipient:a,customerName:r.first_name||"there",reviewUrl:n,appointmentId:t,customerId:r.customer_id,customerPackageId:r.customer_package_id||null,uniqueKey:`google_review_request:${t}`,baseUrl:i}):{ok:!0,skipped:!0,reason:"not_configured",session_number:u}}c(ia,"sendReviewRequestForCompletedAppointment");async function na({env:s,businessId:e,recipient:t,baseUrl:i=""}){let n=await ta(s,e);if(!n)return{ok:!1,error:"Add and save a Google review link first."};let r=String(t||"").trim().toLowerCase();return/^\S+@\S+\.\S+$/.test(r)?sa({env:s,businessId:e,recipient:r,customerName:"Test customer",reviewUrl:n,baseUrl:i}):{ok:!1,error:"Enter a valid test email address."}}c(na,"sendReviewTestEmail");async function mi(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) >
            datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(mi,"getUserContext");async function ze(s,e,t,i,n){await s.DB.prepare(`
      INSERT INTO business_settings (
        id,
        business_id,
        setting_key,
        setting_value,
        value_type
      )
      VALUES (?, ?, ?, ?, ?)

      ON CONFLICT(
        business_id,
        setting_key
      )

      DO UPDATE SET
        setting_value =
          excluded.setting_value,
        value_type =
          excluded.value_type,
        updated_at =
          CURRENT_TIMESTAMP
    `).bind(`set_${crypto.randomUUID()}`,e,t,String(i),n).run()}c(ze,"upsert");function fi(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(fi,"unauthorized");async function ra({request:s,env:e}){try{let t=await mi(s,e);if(!t)return fi();let i=await gt(e,t.business_id);return Response.json({ok:!0,settings:i})}catch(t){return console.error("Notification settings GET failed:",t),Response.json({ok:!1,error:"Unable to load notification settings."},{status:500})}}c(ra,"onRequestGet");async function aa({request:s,env:e}){try{let t=await mi(s,e);if(!t)return fi();let i=await s.json();if(String(i.action||"")!=="send_test_review")return Response.json({ok:!1,error:"Invalid notification action."},{status:400});let n=await na({env:e,businessId:t.business_id,recipient:i.recipient,baseUrl:new URL(s.url).origin});return n.ok?Response.json({ok:!0}):Response.json({ok:!1,error:n.error||"Unable to send test review request."},{status:502})}catch(t){return console.error("Test review request failed:",t),Response.json({ok:!1,error:"Unable to send test review request."},{status:500})}}c(aa,"onRequestPost");async function oa({request:s,env:e}){try{let t=await mi(s,e);if(!t)return fi();let i=await s.json(),n=Number(i.reminder_hours_before),r=[1,2,6,12,24,48,72],a=Number(i.form_reminder_hours_after),o=[24,48,72,120,168];if(!r.includes(n))return Response.json({ok:!1,error:"Invalid reminder timing."},{status:400});if(!o.includes(a))return Response.json({ok:!1,error:"Invalid form reminder timing."},{status:400});let u=String(i.google_review_url||"").trim();if(u)try{let d=new URL(u);if(!["http:","https:"].includes(d.protocol))throw new Error("invalid")}catch{return Response.json({ok:!1,error:"Enter a valid Google review link."},{status:400})}return await Promise.all([ze(e,t.business_id,"reviews.google_url",u,"string"),ze(e,t.business_id,"notifications_booking_confirmation_enabled",i.booking_confirmation_enabled?"1":"0","boolean"),ze(e,t.business_id,"notifications_reminder_enabled",i.reminder_enabled?"1":"0","boolean"),ze(e,t.business_id,"notifications_reminder_hours_before",n,"number"),ze(e,t.business_id,"notifications_cancellation_enabled",i.cancellation_enabled?"1":"0","boolean"),ze(e,t.business_id,"notifications_reschedule_enabled",i.reschedule_enabled?"1":"0","boolean"),ze(e,t.business_id,"notifications_form_reminder_enabled",i.form_reminder_enabled?"1":"0","boolean"),ze(e,t.business_id,"notifications_form_reminder_hours_after",a,"number"),ze(e,t.business_id,"notifications_payment_receipt_enabled",i.payment_receipt_enabled?"1":"0","boolean")]),Response.json({ok:!0})}catch(t){return console.error("Notification settings PUT failed:",t),Response.json({ok:!1,error:"Unable to save notification settings."},{status:500})}}c(oa,"onRequestPut");function bi(s,e=200){return Response.json(s,{status:e,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}c(bi,"json");async function pe(s,e){let t=C(s);if(!t)return{response:bi({ok:!1,error:"Sign in as the business owner to manage Eselram updates."},401)};let i=await D(t),n=await e.DB.prepare(`
    SELECT s.id AS session_id, u.id AS user_id, u.business_id, u.name, u.email
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now')
      AND u.is_active = 1
    LIMIT 1
  `).bind(i).first();return n?(await e.DB.prepare(`
    SELECT 1 AS allowed
    FROM user_roles
    WHERE user_id = ? AND role_key = 'owner'
    LIMIT 1
  `).bind(n.user_id).first())?.allowed?{session:n}:{response:bi({ok:!1,error:"Only the business owner can install Eselram updates."},403)}:{response:bi({ok:!1,error:"Your session has expired. Sign in again to manage Eselram updates."},401)}}c(pe,"requireOwner");function ca(){let s=crypto.getRandomValues(new Uint8Array(18)),e="";for(let t of s)e+=String.fromCharCode(t);return btoa(e).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}c(ca,"randomNonce");async function ua(s,e){let t=await crypto.subtle.importKey("raw",new TextEncoder().encode(String(s||"")),{name:"HMAC",hash:"SHA-256"},!1,["sign"]);return[...new Uint8Array(await crypto.subtle.sign("HMAC",t,new TextEncoder().encode(e)))].map(n=>n.toString(16).padStart(2,"0")).join("")}c(ua,"hmacHex");async function rt(s,e,t=""){let i=String(s.ESELRAM_INSTALLATION_ID||"").trim(),n=String(s.ESELRAM_RELEASE_VERSION||"").trim(),r=String(s.ESELRAM_UPDATE_HANDOFF_SECRET||s.ESELRAM_UPDATE_SECRET||"").trim(),a=String(e||"").trim().toLowerCase(),o=String(t||"").trim();if(!i||!n||!r){let m=new Error("Subscription management will become available after this installation receives its secure Eselram handoff configuration.");throw m.status=409,m}if(!["status","cancel","resume","payment-method"].includes(a)){let m=new Error("Unsupported subscription management action.");throw m.status=400,m}let u=Date.now(),d=ca(),l=[i,n,String(u),d,a,o].join(`
`),p=await ua(r,l);return{installation_id:i,current_version:n,timestamp:u,nonce:d,action:a,return_url:o||void 0,signature:p}}c(rt,"installedBillingAssertion");async function $e(s){let e=String(s.ESELRAM_INSTALLATION_ID||"").trim(),t=String(s.ESELRAM_RELEASE_VERSION||"").trim(),i=String(s.ESELRAM_UPDATE_HANDOFF_SECRET||s.ESELRAM_UPDATE_SECRET||"").trim();if(!e||!t||!i){let u=new Error("Secure in-app updates will become available after this installation receives the update handoff configuration.");throw u.status=409,u}let n=Date.now(),r=ca(),a=[e,t,String(n),r].join(`
`),o=await ua(i,a);return{installation_id:e,current_version:t,timestamp:n,nonce:r,signature:o}}c($e,"installedUpdateAssertion");function gs(s){return String(s.ESELRAM_OAUTH_BROKER_URL||"https://auth.eselram.com").replace(/\/$/,"")}c(gs,"updateBrokerBase");function at(s,e){return gs(e)}c(at,"subscriptionBrokerBase");async function Ee(s,e,t,i=""){let n=String(i||gs(s)).replace(/\/$/,""),r=await fetch(`${n}${e}`,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(t)}),a=await r.json().catch(()=>({}));if(!r.ok||a?.ok===!1){let o=new Error(a?.error||`Secure updater request failed (${r.status}).`);throw o.status=r.status,o}return a}c(Ee,"brokerJson");async function da({request:s,env:e}){try{let t=await pe(s,e);if(t.response)return t.response;if(e.FORM_UPLOADS)return Response.json({ok:!0,already_configured:!0,setup_url:null},{headers:{"Cache-Control":"no-store"}});let i=await $e(e),n=await Ee(e,"/api/installed-storage/handoff",i);return Response.json({ok:!0,already_configured:!1,current_version:n.current_version||i.current_version,setup_url:n.setup_url||null},{headers:{"Cache-Control":"no-store"}})}catch(t){return Response.json({ok:!1,error:t?.message||"Unable to start secure file storage setup."},{status:Number(t?.status)||500,headers:{"Cache-Control":"no-store"}})}}c(da,"onRequestPost");async function la({request:s,env:e}){try{let t=await pe(s,e);if(t.response)return t.response;let i=await rt(e,"cancel"),n=await Ee(e,"/api/installed-billing/cancel",i,at(s,e));return Response.json({ok:!0,subscription:n.subscription||null},{headers:{"Cache-Control":"no-store"}})}catch(t){return Response.json({ok:!1,error:t?.message||"Unable to schedule subscription cancellation."},{status:Number(t?.status)||500,headers:{"Cache-Control":"no-store"}})}}c(la,"onRequestPost");async function pa({request:s,env:e}){try{let t=await pe(s,e);if(t.response)return t.response;let n=`${new URL(s.url).origin}/settings/subscription.html?payment_method=updated`,r=await rt(e,"payment-method",n),a=await Ee(e,"/api/installed-billing/payment-method",r,at(s,e));if(!a.url)throw Object.assign(new Error("Stripe did not return a secure payment-method update link."),{status:502});return Response.json({ok:!0,url:a.url},{headers:{"Cache-Control":"no-store"}})}catch(t){return Response.json({ok:!1,error:t?.message||"Unable to start the secure payment-method update."},{status:Number(t?.status)||500,headers:{"Cache-Control":"no-store"}})}}c(pa,"onRequestPost");async function _a({request:s,env:e}){try{let t=await pe(s,e);if(t.response)return t.response;let i=await rt(e,"resume"),n=await Ee(e,"/api/installed-billing/resume",i,at(s,e));return Response.json({ok:!0,subscription:n.subscription||null},{headers:{"Cache-Control":"no-store"}})}catch(t){return Response.json({ok:!1,error:t?.message||"Unable to keep this subscription active."},{status:Number(t?.status)||500,headers:{"Cache-Control":"no-store"}})}}c(_a,"onRequestPost");async function ma({request:s,env:e}){try{let t=await pe(s,e);if(t.response)return t.response;let i=await $e(e),n=await Ee(e,"/api/installed-update/handoff",i);return Response.json({ok:!0,update_available:n.update_available===!0,current_version:n.current_version||i.current_version,target_version:n.target_version||i.current_version,updater_url:n.updater_url||null},{headers:{"Cache-Control":"no-store"}})}catch(t){return Response.json({ok:!1,error:t?.message||"Unable to open the secure updater."},{status:Number(t?.status)||500,headers:{"Cache-Control":"no-store"}})}}c(ma,"onRequestPost");async function fa({request:s,env:e}){try{let t=await pe(s,e);if(t.response)return t.response;let i=await s.json().catch(()=>({})),n=String(i.recovery_id||"").trim(),r=String(i.confirmation||"").trim().toUpperCase();if(!n)return Response.json({ok:!1,error:"Choose a valid recovery point."},{status:400,headers:{"Cache-Control":"no-store"}});if(r!=="ROLLBACK")return Response.json({ok:!1,error:"Type ROLLBACK to confirm this recovery."},{status:400,headers:{"Cache-Control":"no-store"}});let a=await $e(e),o=await e.DB.prepare(`
      SELECT id, recovery_type, bookmark, from_version, target_version, status, created_at
      FROM eselram_recovery_points
      WHERE id = ? AND recovery_type = 'pre_update' AND status = 'available'
      LIMIT 1
    `).bind(n).first();if(!o?.bookmark||!o?.from_version||!o?.target_version)return Response.json({ok:!1,error:"That recovery point is no longer available."},{status:409,headers:{"Cache-Control":"no-store"}});if(String(o.target_version)!==String(a.current_version))return Response.json({ok:!1,error:`This recovery point belongs to Eselram ${o.target_version}. The installed version is ${a.current_version}, so rollback has been blocked.`},{status:409,headers:{"Cache-Control":"no-store"}});let u=await Ee(e,"/api/installed-recovery/handoff",{...a,recovery_id:o.id,recovery_bookmark:o.bookmark,from_version:o.from_version,target_version:o.target_version,created_at:o.created_at});return Response.json({ok:!0,current_version:a.current_version,restore_version:o.from_version,updater_url:u.updater_url||null},{headers:{"Cache-Control":"no-store"}})}catch(t){return Response.json({ok:!1,error:t?.message||"Unable to open secure database recovery."},{status:Number(t?.status)||500,headers:{"Cache-Control":"no-store"}})}}c(fa,"onRequestPost");async function ba({request:s,env:e}){try{let t=await pe(s,e);if(t.response)return t.response;let i=await $e(e),n=await Ee(e,"/api/installed-update/status",i),r=null,a=[];try{let u=await e.DB.prepare(`
        SELECT id, recovery_type, bookmark, from_version, target_version, status, created_at
        FROM eselram_recovery_points
        WHERE status = 'available'
        ORDER BY datetime(created_at) DESC
        LIMIT 5
      `).all();a=Array.isArray(u?.results)?u.results:[],r=a[0]||null}catch{}let o={active:!1,retention_days:30,available_count:0,latest:null};try{let u=await e.DB.prepare("SELECT COUNT(*) AS count FROM eselram_file_recovery_objects WHERE status='available'").first(),d=await e.DB.prepare("SELECT id,source_type,source_id,original_name,reason,protected_until,created_at FROM eselram_file_recovery_objects WHERE status='available' ORDER BY datetime(created_at) DESC LIMIT 1").first();o={active:!!e.FORM_UPLOADS,retention_days:30,available_count:Number(u?.count||0),latest:d||null}}catch{}return Response.json({ok:!0,installed_version:n.installation?.installed_version||i.current_version,available_version:n.release?.version||i.current_version,update_available:n.update_available===!0,release_type:n.release?.release_type||null,release_notes:n.release?.release_notes||null,published_at:n.release?.published_at||null,updates_until:n.license?.updates_until||null,recovery_protection:{time_travel:!0,latest:r||null,latest_pre_update:a.find(u=>u?.recovery_type==="pre_update")||null,latest_restore_undo:a.find(u=>u?.recovery_type==="restore_undo")||null,points:a,rollback_available:!!(r?.recovery_type==="pre_update"&&r?.id&&r?.bookmark&&r?.from_version&&r?.target_version&&String(r.target_version)===String(n.installation?.installed_version||i.current_version))},file_protection:o},{headers:{"Cache-Control":"no-store"}})}catch(t){return Response.json({ok:!1,error:t?.message||"Unable to check for Eselram updates."},{status:Number(t?.status)||500,headers:{"Cache-Control":"no-store"}})}}c(ba,"onRequestGet");async function gi(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(gi,"getUserContext");function Ei(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Ei,"unauthorized");function de(s){return Response.json({ok:!1,error:s},{status:400})}c(de,"badRequest");function md(s){return Response.json({ok:!1,error:s},{status:404})}c(md,"notFound");function Je(s){return Response.json({ok:!1,error:s},{status:409})}c(Je,"conflict");function fd(s){let e=Math.max(Number(s||0),0)/100;return new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(e)}c(fd,"formatMoneyMinor");async function bd(s,e,t){if(t.customer_package_id){let i=await s.DB.prepare(`
          SELECT
            cp.price_minor,

            COALESCE(
              (
                SELECT SUM(
                  CASE
                    WHEN p.payment_type = 'refund'
                         AND p.status = 'paid'
                      THEN -ABS(p.amount_minor)

                    WHEN p.payment_type != 'refund'
                         AND p.status IN (
                           'paid',
                           'partially_refunded',
                           'refunded'
                         )
                      THEN ABS(p.amount_minor)

                    ELSE 0
                  END
                )

                FROM customer_package_payments cpp

                JOIN payments p
                  ON p.id =
                     cpp.payment_id

                WHERE
                  cpp.customer_package_id =
                    cp.id
                  AND p.business_id =
                    cp.business_id
                  AND COALESCE(
                    p.payment_method,
                    ''
                  ) != 'discount'
              ),
              0
            ) AS paid_minor,

            COALESCE(
              (
                SELECT SUM(
                  ps.consultation_credit_minor
                )

                FROM package_sales ps

                WHERE
                  ps.business_id =
                    cp.business_id
                  AND ps.customer_package_id =
                    cp.id
                  AND ps.status = 'paid'
              ),
              0
            ) AS consultation_credit_minor

          FROM customer_packages cp

          WHERE
            cp.id = ?
            AND cp.business_id = ?

          LIMIT 1
        `).bind(t.customer_package_id,e).first();return i?Math.max(Number(i.price_minor||0)-Number(i.paid_minor||0)-Number(i.consultation_credit_minor||0),0):0}return Math.max(Number(t.price_minor||0)-Number(t.paid_minor||0)-Number(t.consultation_credit_minor||0),0)}c(bd,"getCompletionOutstandingMinor");function ga(s){let[e,t]=String(s).split(":").map(Number);return e*60+t}c(ga,"timeToMinutes");function gd(s){let e=Math.floor(s/60),t=s%60;return`${String(e).padStart(2,"0")}:${String(t).padStart(2,"0")}`}c(gd,"minutesToTime");function Ea(s,e,t){let[i,n]=String(e).split(":").map(Number),r=new Date(`${s}T${String(i).padStart(2,"0")}:${String(n).padStart(2,"0")}:00`);r.setMinutes(r.getMinutes()+t);let a=r.getFullYear(),o=String(r.getMonth()+1).padStart(2,"0"),u=String(r.getDate()).padStart(2,"0"),d=String(r.getHours()).padStart(2,"0"),l=String(r.getMinutes()).padStart(2,"0");return`${a}-${o}-${u}T${d}:${l}:00`}c(Ea,"addMinutesToDateTime");function ha(s){return/^\d{4}-\d{2}-\d{2}$/.test(s)}c(ha,"isValidDate");function ya(s){return/^\d{2}:\d{2}$/.test(s)}c(ya,"isValidTime");async function Ed(s,e,t){return await s.DB.prepare(`
      SELECT
        id,
        name,
        duration_minutes,
        price_minor,
        deposit_minor,
        payment_timing,
        is_active

      FROM services

      WHERE
        id = ?
        AND business_id = ?

      LIMIT 1
    `).bind(t,e).first()}c(Ed,"getService");async function ka({env:s,businessId:e,serviceId:t,date:i,excludeAppointmentId:n=null}){let r=await Ed(s,e,t);if(!r||r.is_active!==1)return{error:"Service not found."};let a=await s.DB.prepare(`
        SELECT
          timezone,
          booking_buffer_before_minutes,
          booking_buffer_after_minutes

        FROM businesses

        WHERE id = ?

        LIMIT 1
      `).bind(e).first(),o=await s.DB.prepare(`
        SELECT setting_value
        FROM business_settings
        WHERE
          business_id = ?
          AND setting_key =
            'public_booking_blocked_dates'
        LIMIT 1
      `).bind(e).first(),u=[];try{u=JSON.parse(o?.setting_value||"[]")}catch{u=[]}let d=(Array.isArray(u)?u:[]).map(T=>{let O=String(T?.date||"").trim();return{start_date:String(T?.start_date||O||"").trim(),end_date:String(T?.end_date||O||T?.start_date||"").trim(),reason:String(T?.reason||"").trim()}}).find(T=>T.start_date&&T.end_date&&i>=T.start_date&&i<=T.end_date);if(d)return{service:r,timezone:a?.timezone||"Europe/London",slots:[],reason:d.reason?`This date is blocked: ${d.reason}.`:"This date is blocked."};let p=new Date(`${i}T12:00:00Z`).getUTCDay(),m=p===0?7:p,_=await s.DB.prepare(`
        SELECT
          is_open,
          open_time,
          close_time,
          booking_interval_minutes

        FROM working_hours

        WHERE
          business_id = ?
          AND weekday = ?

        LIMIT 1
      `).bind(e,m).first();if(!_||_.is_open!==1)return{service:r,timezone:a?.timezone||"Europe/London",slots:[]};let g=`
    SELECT
      id,
      start_at,
      end_at

    FROM appointments

    WHERE
      business_id = ?
      AND status != 'cancelled'
      AND date(start_at) = ?
  `,E=[e,i];n&&(g+=`
      AND id != ?
    `,E.push(n)),g+=`
    ORDER BY
      datetime(start_at) ASC
  `;let f=await s.DB.prepare(g).bind(...E).all(),b=Number(r.duration_minutes),N=Number(_.booking_interval_minutes||30),v=Number(a?.booking_buffer_before_minutes||0),S=Number(a?.booking_buffer_after_minutes||0),h=ga(_.open_time),I=ga(_.close_time),R=(f.results||[]).map(T=>{let O=new Date(T.start_at),w=new Date(T.end_at);return{start:O.getHours()*60+O.getMinutes()-v,end:w.getHours()*60+w.getMinutes()+S}}),L=[];for(let T=h;T+b<=I;T+=N){let O=T+b;R.some(B=>T<B.end&&O>B.start)||L.push(gd(T))}return{service:r,timezone:a?.timezone||"Europe/London",booking_interval_minutes:N,slots:L}}c(ka,"getAvailableSlots");async function hd(s,e,t){return await s.DB.prepare(`
      SELECT
        a.id,
        a.business_id,
        a.customer_id,
        a.service_id,
        a.status,
        a.start_at,
        a.end_at,
        a.price_minor,
        a.deposit_due_minor,
        a.booking_source,
        a.booking_kind,
        a.consultation_credit_minor,

        COALESCE(
          (
            SELECT SUM(
              CASE
                WHEN p.payment_type = 'refund'
                     AND p.status = 'paid'
                  THEN -ABS(p.amount_minor)
                WHEN p.payment_type != 'refund'
                     AND p.status IN (
                       'paid',
                       'partially_refunded',
                       'refunded'
                     )
                  THEN ABS(p.amount_minor)
                ELSE 0
              END
            )
            FROM payments p
            WHERE
              p.business_id = a.business_id
              AND p.appointment_id = a.id
          ),
          0
        ) AS paid_minor,

        a.customer_notes,
        a.internal_notes,
        a.created_at,

        c.first_name,
        c.last_name,
        c.email,
        c.phone,

        s.name AS service_name,
        s.duration_minutes,

        cp.id AS customer_package_id,
        cp.name_snapshot AS package_name,
        cp.status AS package_status,
        cp.expires_on AS package_expires_on,
        cp.service_id AS package_service_id

      FROM appointments a

      JOIN customers c
        ON c.id =
           a.customer_id

      JOIN services s
        ON s.id =
           a.service_id

      LEFT JOIN customer_package_appointments cpa
        ON cpa.appointment_id =
           a.id

      LEFT JOIN customer_packages cp
        ON cp.id =
           cpa.customer_package_id
        AND cp.business_id =
            a.business_id

      WHERE
        a.id = ?
        AND a.business_id = ?

      LIMIT 1
    `).bind(t,e).first()}c(hd,"getAppointment");async function yd({env:s,businessId:e,customerId:t,firstName:i,lastName:n,email:r,phone:a}){if(t){let d=await s.DB.prepare(`
          SELECT
            id,
            first_name,
            last_name,
            email,
            phone

          FROM customers

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `).bind(t,e).first();return d?{customer:d}:{error:"Selected customer was not found."}}let o=null;if(r&&(o=await s.DB.prepare(`
          SELECT
            id,
            first_name,
            last_name,
            email,
            phone

          FROM customers

          WHERE
            business_id = ?
            AND lower(email) =
                lower(?)

          LIMIT 1
        `).bind(e,r).first()),!o&&a&&(o=await s.DB.prepare(`
          SELECT
            id,
            first_name,
            last_name,
            email,
            phone

          FROM customers

          WHERE
            business_id = ?
            AND phone = ?

          LIMIT 1
        `).bind(e,a).first()),o)return{customer:o};let u=`cus_${crypto.randomUUID()}`;return await s.DB.prepare(`
      INSERT INTO customers (
        id,
        business_id,
        first_name,
        last_name,
        email,
        phone
      )

      VALUES (
        ?, ?, ?, ?, ?, ?
      )
    `).bind(u,e,i,n,r||null,a||null).run(),{customer:{id:u,first_name:i,last_name:n,email:r||null,phone:a||null}}}c(yd,"findOrCreateCustomer");async function Sa({request:s,env:e}){try{let t=await gi(s,e);if(!t)return Ei();await ue(e,t.business_id);let i=new URL(s.url),n=String(i.searchParams.get("customer_search")||"").trim();if(n){let a=`%${n}%`,o=await e.DB.prepare(`
            SELECT
              id,
              first_name,
              last_name,
              email,
              phone

            FROM customers

            WHERE
              business_id = ?
              AND (
                first_name LIKE ?
                OR last_name LIKE ?
                OR email LIKE ?
                OR phone LIKE ?
                OR (
                  first_name || ' ' ||
                  last_name
                ) LIKE ?
              )

            ORDER BY
              last_name,
              first_name

            LIMIT 8
          `).bind(t.business_id,a,a,a,a,a).all();return Response.json({ok:!0,customers:o.results||[]})}let r=await e.DB.prepare(`
          SELECT
            a.id,
            a.start_at,
            a.end_at,
            a.status,
            a.price_minor,
            a.deposit_due_minor,
            a.booking_source,
            a.booking_kind,
            a.consultation_credit_minor,

            COALESCE(
              (
                SELECT SUM(
                  CASE
                    WHEN p.payment_type = 'refund'
                         AND p.status = 'paid'
                      THEN -ABS(p.amount_minor)
                    WHEN p.payment_type != 'refund'
                         AND p.status IN (
                           'paid',
                           'partially_refunded',
                           'refunded'
                         )
                      THEN ABS(p.amount_minor)
                    ELSE 0
                  END
                )
                FROM payments p
                WHERE
                  p.business_id = a.business_id
                  AND p.appointment_id = a.id
              ),
              0
            ) AS paid_minor,

            a.customer_notes AS notes,
            a.internal_notes,
            a.created_at,

            c.id AS customer_id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,

            s.id AS service_id,
            s.name AS service_name,
            s.service_type,
            s.duration_minutes,

            cp.id AS customer_package_id,
            cp.name_snapshot AS package_name

          FROM appointments a

          JOIN customers c
            ON c.id =
               a.customer_id

          JOIN services s
            ON s.id =
               a.service_id

          LEFT JOIN customer_package_appointments cpa
            ON cpa.appointment_id =
               a.id

          LEFT JOIN customer_packages cp
            ON cp.id =
               cpa.customer_package_id

          WHERE
            a.business_id = ?
            AND NOT (
              a.booking_source = 'online'
              AND a.status IN ('pending', 'cancelled')
              AND NOT EXISTS (
                SELECT 1
                FROM payments p_paid
                WHERE
                  p_paid.appointment_id = a.id
                  AND p_paid.business_id = a.business_id
                  AND p_paid.status IN ('paid', 'partially_refunded', 'refunded')
                  AND p_paid.payment_type != 'refund'
              )
              AND (
                EXISTS (
                  SELECT 1
                  FROM payments p_checkout
                  WHERE
                    p_checkout.appointment_id = a.id
                    AND p_checkout.business_id = a.business_id
                    AND p_checkout.provider = 'stripe'
                    AND p_checkout.status IN ('pending', 'failed')
                )
                OR a.cancellation_reason IN (
                  'Online booking payment was not completed',
                  'Customer left online payment before completion',
                  'Online payment could not be started',
                  'Online booking could not be completed'
                )
                OR a.status = 'pending'
              )
            )

          ORDER BY
            CASE
              WHEN
                a.status != 'cancelled'
                AND datetime(a.start_at)
                    >= datetime('now')
              THEN 0
              ELSE 1
            END,
            datetime(a.start_at) ASC
        `).bind(t.business_id).all();return Response.json({ok:!0,bookings:r.results||[]})}catch(t){return console.error("Bookings GET failed:",t),Response.json({ok:!1,error:"Unable to load bookings."},{status:500})}}c(Sa,"onRequestGet");async function Ra({request:s,env:e}){try{let t=await gi(s,e);if(!t)return Ei();let i=await s.json(),n=String(i.service_id||"").trim(),r=String(i.date||"").trim(),a=String(i.time||"").trim(),o=String(i.customer_id||"").trim(),u=String(i.customer_package_id||"").trim(),d=String(i.first_name||"").trim(),l=String(i.last_name||"").trim(),p=String(i.email||"").trim(),m=String(i.phone||"").trim(),_=String(i.notes||"").trim();if(!n)return de("Service is required.");if(!ha(r))return de("A valid date is required.");if(!ya(a))return de("A valid time is required.");if(!d)return de("First name is required.");if(!l)return de("Last name is required.");if(!p&&!m)return de("An email address or phone number is required.");let g=await ka({env:e,businessId:t.business_id,serviceId:n,date:r});if(g.error)return de(g.error);if(!g.slots.includes(a))return Je("That time is no longer available.");let E=await yd({env:e,businessId:t.business_id,customerId:o||null,firstName:d,lastName:l,email:p,phone:m});if(E.error)return de(E.error);let f=E.customer,b=null;if(u){if(b=await e.DB.prepare(`
            SELECT
              cp.id,
              cp.customer_id,
              cp.service_id,
              cp.sessions_total,
              cp.status,
              cp.expires_on,

              (
                SELECT COUNT(*)
                FROM customer_package_appointments cpa
                JOIN appointments a
                  ON a.id =
                     cpa.appointment_id
                WHERE
                  cpa.customer_package_id =
                    cp.id
                  AND a.status IN (
                    'pending',
                    'confirmed',
                    'completed'
                  )
              ) AS sessions_committed

            FROM customer_packages cp

            WHERE
              cp.id = ?
              AND cp.business_id = ?

            LIMIT 1
          `).bind(u,t.business_id).first(),!b)return de("Customer package not found.");if(b.customer_id!==f.id)return de("Package does not belong to this customer.");if(b.service_id!==n)return de("This package is for a different service.");if(b.status!=="active")return de("This package is not active.");if(b.expires_on&&r>b.expires_on)return de("This package has expired before the selected appointment date.");if(Number(b.sessions_committed||0)>=Number(b.sessions_total||0))return de("There are no package sessions remaining to book.")}let N=`apt_${crypto.randomUUID()}`,v=`${r}T${a}:00`,S=Ea(r,a,Number(g.service.duration_minutes)),h=b?0:Number(g.service.price_minor||0),I=b?0:g.service.payment_timing==="online_deposit"?Number(g.service.deposit_minor||0):0,R=null,L=0;if(!b&&h>0){let O=await Fe({env:e,businessId:t.business_id,customerId:f.id,serviceId:n});R=O.source_appointment_id,L=Math.min(Number(O.available_minor||0),h)}let T=Math.max(I-L,0);await e.DB.prepare(`
        INSERT INTO appointments (
          id,
          business_id,
          customer_id,
          service_id,
          status,
          start_at,
          end_at,
          price_minor,
          deposit_due_minor,
          booking_source,
          customer_notes,
          consultation_credit_source_appointment_id,
          consultation_credit_minor
        )

        VALUES (
          ?, ?, ?, ?,
          'confirmed',
          ?, ?, ?, ?,
          'admin',
          ?, ?, ?
        )
      `).bind(N,t.business_id,f.id,n,v,S,h,T,_||null,R,L).run(),b&&await e.DB.prepare(`
          INSERT INTO customer_package_appointments (
            customer_package_id,
            appointment_id
          )
          VALUES (?, ?)
        `).bind(b.id,N).run();try{await le({env:e,businessId:t.business_id,appointmentId:N,type:"booking_confirmation",uniqueKey:`booking_confirmation:${N}`,baseUrl:new URL(s.url).origin})}catch(O){console.error("Automatic booking confirmation failed:",O)}return Response.json({ok:!0,booking:{id:N,customer_id:f.id,service_id:n,start_at:v,end_at:S,status:"confirmed"}})}catch(t){return console.error("Booking creation failed:",t),Response.json({ok:!1,error:"Unable to create booking."},{status:500})}}c(Ra,"onRequestPost");async function Na({request:s,env:e}){try{let t=await gi(s,e);if(!t)return Ei();let i=await s.json(),n=String(i.id||"").trim();if(!n)return de("Booking id is required.");let r=await hd(e,t.business_id,n);if(!r)return md("Booking not found.");let a=String(i.action||"update").trim();if(a==="complete"){if(r.status==="cancelled")return Je("A cancelled booking cannot be completed.");if(r.status==="completed")return Response.json({ok:!0});let I=await bd(e,t.business_id,r);if(I>0)return Je(`Take the outstanding payment of ${fd(I)} before marking this booking as complete.`);await e.DB.prepare(`
          UPDATE appointments

          SET
            status = 'completed',
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id = ?
            AND business_id = ?
        `).bind(n,t.business_id).run();try{let R=await le({env:e,businessId:t.business_id,appointmentId:n,type:"treatment_aftercare",uniqueKey:`treatment_aftercare:${n}`,baseUrl:e.ESELRAM_BASE_URL||null});!R.ok&&!R.skipped&&console.error("Aftercare email failed:",R.error||"Unknown email error")}catch(R){console.error("Aftercare email failed:",R)}try{let R=await ia({env:e,businessId:t.business_id,appointmentId:n,baseUrl:e.ESELRAM_BASE_URL||new URL(s.url).origin});!R.ok&&!R.skipped&&console.error("Google review request failed:",R.error||"Unknown email error")}catch(R){console.error("Google review request failed:",R)}return Response.json({ok:!0})}if(a==="cancel"){if(r.status==="completed")return Je("A completed booking cannot be cancelled.");let I=String(i.reason||"").trim();return await e.DB.prepare(`
          UPDATE appointments

          SET
            status = 'cancelled',
            cancelled_at =
              CURRENT_TIMESTAMP,
            cancellation_reason = ?,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id = ?
            AND business_id = ?
        `).bind(I||null,n,t.business_id).run(),await le({env:e,businessId:t.business_id,appointmentId:n,type:"cancellation_confirmation",uniqueKey:`cancellation_confirmation:${n}:${Date.now()}`,baseUrl:new URL(s.url).origin}),Response.json({ok:!0})}if(a!=="update")return de("Invalid booking action.");if(r.status==="cancelled")return Je("A cancelled booking cannot be edited.");if(r.status==="completed")return Je("A completed booking cannot be edited.");let o=String(i.service_id||"").trim(),u=String(i.date||"").trim(),d=String(i.time||"").trim(),l=String(i.first_name||"").trim(),p=String(i.last_name||"").trim(),m=String(i.email||"").trim(),_=String(i.phone||"").trim(),g=String(i.notes||"").trim();if(!o||!ha(u)||!ya(d))return de("Service, date and time are required.");if(!l||!p)return de("First and last name are required.");if(!m&&!_)return de("An email address or phone number is required.");let E=String(r.customer_package_id||"").trim();if(E){if(o!==r.package_service_id)return Je("A package appointment cannot be changed to a different service.");if(r.package_status==="cancelled"||r.package_status==="expired")return Je("This package is no longer active, so the appointment cannot be rescheduled.");if(r.package_expires_on&&u>r.package_expires_on)return Je("The new appointment date is after this package expires.")}let f=await ka({env:e,businessId:t.business_id,serviceId:o,date:u,excludeAppointmentId:n});if(f.error)return de(f.error);if(!f.slots.includes(d))return Je("That time is no longer available.");let b=`${u}T${d}:00`,N=Ea(u,d,Number(f.service.duration_minutes)),v=E?0:Number(f.service.price_minor||0),S=E?0:f.service.payment_timing==="online_deposit"?Number(f.service.deposit_minor||0):0;return await e.DB.prepare(`
        UPDATE appointments

        SET
          service_id = ?,
          start_at = ?,
          end_at = ?,
          price_minor = ?,
          deposit_due_minor = ?,
          customer_notes = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `).bind(o,b,N,v,S,g||null,n,t.business_id).run(),(String(r.start_at||"")!==b||String(r.service_id||"")!==o)&&await le({env:e,businessId:t.business_id,appointmentId:n,type:"reschedule_confirmation",uniqueKey:`reschedule_confirmation:${n}:${b}:${o}`,baseUrl:new URL(s.url).origin}),Response.json({ok:!0,booking:{id:n,service_id:o,start_at:b,end_at:N,status:r.status,customer_package_id:E||null,package_name:r.package_name||null,price_minor:v,deposit_due_minor:S}})}catch(t){return console.error("Booking update failed:",t),Response.json({ok:!1,error:"Unable to update booking."},{status:500})}}c(Na,"onRequestPut");async function Ta(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id,
        b.name AS business_name
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      JOIN businesses b
        ON b.id = u.business_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(Ta,"getUserContext");function Aa(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Aa,"unauthorized");function Wt(s){return Response.json({ok:!1,error:s},{status:400})}c(Wt,"badRequest");function kd(s){return/^#[0-9a-fA-F]{6}$/.test(String(s||"").trim())}c(kd,"validColour");async function wa({request:s,env:e}){try{let t=await Ta(s,e);if(!t)return Aa();let i=await e.DB.prepare(`
        SELECT
          logo_data_url,
          primary_colour,
          accent_colour,
          background_colour,
          surface_colour,
          text_colour,
          form_style,
          logo_position,
          show_business_name,
          show_contact_details,
          footer_text
        FROM business_branding
        WHERE business_id = ?
        LIMIT 1
      `).bind(t.business_id).first();return Response.json({ok:!0,business:{id:t.business_id,name:t.business_name},branding:i||{logo_data_url:null,primary_colour:"#365c50",accent_colour:"#6f8079",background_colour:"#f5f4ef",surface_colour:"#ffffff",text_colour:"#18221f",form_style:"soft",logo_position:"centre",show_business_name:1,show_contact_details:1,footer_text:null}})}catch(t){return console.error("Branding GET failed:",t),Response.json({ok:!1,error:"Unable to load branding."},{status:500})}}c(wa,"onRequestGet");async function Da({request:s,env:e}){try{let t=await Ta(s,e);if(!t)return Aa();let i=await s.json();if(![i.primary_colour,i.accent_colour,i.background_colour,i.surface_colour,i.text_colour].every(kd))return Wt("All colours must use a six-digit hex value.");let r=String(i.form_style||"soft"),a=String(i.logo_position||"centre");if(!["light","soft","minimal","dark"].includes(r))return Wt("Invalid form style.");if(!["left","centre"].includes(a))return Wt("Invalid logo position.");let o=i.logo_data_url===null||i.logo_data_url===""?null:String(i.logo_data_url);return o&&!/^data:image\/(png|jpeg|webp);base64,/i.test(o)?Wt("Invalid logo format."):o&&o.length>36e4?Wt("Logo is too large."):(await e.DB.prepare(`
        INSERT INTO business_branding (
          business_id,
          logo_data_url,
          primary_colour,
          accent_colour,
          background_colour,
          surface_colour,
          text_colour,
          form_style,
          logo_position,
          show_business_name,
          show_contact_details,
          footer_text,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(business_id)
        DO UPDATE SET
          logo_data_url = excluded.logo_data_url,
          primary_colour = excluded.primary_colour,
          accent_colour = excluded.accent_colour,
          background_colour = excluded.background_colour,
          surface_colour = excluded.surface_colour,
          text_colour = excluded.text_colour,
          form_style = excluded.form_style,
          logo_position = excluded.logo_position,
          show_business_name = excluded.show_business_name,
          show_contact_details = excluded.show_contact_details,
          footer_text = excluded.footer_text,
          updated_at = CURRENT_TIMESTAMP
      `).bind(t.business_id,o,i.primary_colour,i.accent_colour,i.background_colour,i.surface_colour,i.text_colour,r,a,i.show_business_name===0?0:1,i.show_contact_details===0?0:1,String(i.footer_text||"").trim()||null).run(),Response.json({ok:!0}))}catch(t){return console.error("Branding PUT failed:",t),Response.json({ok:!1,error:"Unable to save branding."},{status:500})}}c(Da,"onRequestPut");var Sd="_eselram-recovery/";function Rd(s){return String(s||"unknown").replace(/[^a-zA-Z0-9._-]+/g,"_").slice(0,120)||"unknown"}c(Rd,"safeSegment");async function Es({env:s,businessId:e,originalKey:t,sourceType:i,sourceId:n=null,originalName:r=null,mimeType:a=null,sizeBytes:o=null,reason:u="delete",sourceMetadata:d=null}){if(!s?.FORM_UPLOADS||!s?.DB||!t)throw new Error("R2 file protection is not configured.");let l=await s.FORM_UPLOADS.get(t);if(!l)return{ok:!0,missing:!0};let p=`r2rec_${crypto.randomUUID()}`,m=new Date().toISOString().replace(/[:.]/g,"-"),_=`${Sd}${Rd(e)}/${m}-${crypto.randomUUID()}/${t}`,g=new Date(Date.now()+30*864e5).toISOString(),E=a||l.httpMetadata?.contentType||"application/octet-stream",f=Number(o||l.size||0)||null,b=d?JSON.stringify(d):null;await s.FORM_UPLOADS.put(_,l.body,{httpMetadata:{...l.httpMetadata||{},contentType:E},customMetadata:{eselramRecovery:"1",originalKey:String(t),sourceType:String(i||"file"),sourceId:String(n||""),protectedUntil:g}});try{await s.DB.prepare(`
      INSERT INTO eselram_file_recovery_objects (
        id,business_id,original_key,recovery_key,source_type,source_id,original_name,mime_type,size_bytes,reason,status,protected_until,source_metadata_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,'available',?,?)
    `).bind(p,e,t,_,i||"file",n,r,E,f,u,g,b).run()}catch(N){throw N}return{ok:!0,id:p,recoveryKey:_,protectedUntil:g}}c(Es,"preserveR2ObjectBeforeDelete");async function va({env:s,businessId:e,recoveryId:t}){let i=await s.DB.prepare(`
    SELECT * FROM eselram_file_recovery_objects WHERE id=? AND business_id=? AND status='available' LIMIT 1
  `).bind(t,e).first();if(!i)throw new Error("Protected file recovery copy was not found.");return i}c(va,"getProtectedR2Recovery");async function Ca({env:s,row:e}){if(!e?.recovery_key||!e?.original_key)throw new Error("Protected file recovery details are incomplete.");let t=await s.FORM_UPLOADS.get(e.recovery_key);if(!t)throw new Error("Protected R2 recovery object is missing.");return await s.FORM_UPLOADS.put(e.original_key,t.body,{httpMetadata:t.httpMetadata||void 0}),e}c(Ca,"restoreProtectedR2Object");async function Oa({env:s,businessId:e,recoveryId:t}){await s.DB.prepare(`
    UPDATE eselram_file_recovery_objects
    SET status='restored', restored_at=CURRENT_TIMESTAMP
    WHERE id=? AND business_id=? AND status='available'
  `).bind(t,e).run()}c(Oa,"markProtectedR2RecoveryRestored");async function yi(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
    SELECT u.id AS user_id,u.business_id
    FROM user_sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL
      AND datetime(s.expires_at)>datetime('now')
      AND u.is_active=1
    LIMIT 1
  `).bind(i).first()}c(yi,"getUserContext");function ki(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(ki,"unauthorized");function Et(s){return Response.json({ok:!1,error:s},{status:400})}c(Et,"badRequest");async function Ia({request:s,env:e}){try{let t=await yi(s,e);if(!t)return ki();let i=new URL(s.url),n=String(i.searchParams.get("id")||"").trim();if(n)return await Nd({id:n,user:t,env:e});let[r,a,o,u,d,l,p,m]=await Promise.all([e.DB.prepare(`
        SELECT s.id,s.template_id,s.customer_id,s.appointment_id,s.submitted_by,s.status,s.client_name,s.client_email,s.submitted_at,s.reviewed_at,
          t.name AS template_name,t.template_type,
          c.first_name AS customer_first_name,c.last_name AS customer_last_name,
          a.start_at AS appointment_start_at,sv.name AS service_name,
          (SELECT COUNT(*) FROM clinical_form_answers a2 WHERE a2.submission_id=s.id) AS answer_count,
          (SELECT COUNT(*) FROM clinical_form_signatures sig WHERE sig.submission_id=s.id) AS signature_count
        FROM clinical_form_submissions s
        JOIN clinical_templates t ON t.id=s.template_id
        LEFT JOIN customers c ON c.id=s.customer_id
        LEFT JOIN appointments a ON a.id=s.appointment_id
        LEFT JOIN services sv ON sv.id=a.service_id
        WHERE s.business_id=?
        ORDER BY datetime(s.submitted_at) DESC
      `).bind(t.business_id).all(),e.DB.prepare("SELECT id,name,template_type FROM clinical_templates WHERE business_id=? ORDER BY name COLLATE NOCASE").bind(t.business_id).all(),e.DB.prepare("SELECT id,first_name,last_name FROM customers WHERE business_id=? ORDER BY last_name COLLATE NOCASE,first_name COLLATE NOCASE").bind(t.business_id).all(),e.DB.prepare(`
        SELECT a.id,a.customer_id,a.start_at,a.status,sv.name AS service_name
        FROM appointments a JOIN services sv ON sv.id=a.service_id
        WHERE a.business_id=? AND a.status!='cancelled'
        ORDER BY datetime(a.start_at) DESC
      `).bind(t.business_id).all(),e.DB.prepare("SELECT COUNT(*) AS count FROM clinical_form_submissions WHERE business_id=?").bind(t.business_id).first(),e.DB.prepare("SELECT COUNT(*) AS count FROM clinical_form_submissions WHERE business_id=? AND status='submitted'").bind(t.business_id).first(),e.DB.prepare("SELECT COUNT(*) AS count FROM clinical_form_submissions WHERE business_id=? AND status='reviewed'").bind(t.business_id).first(),e.DB.prepare("SELECT COUNT(*) AS count FROM clinical_form_submissions WHERE business_id=? AND customer_id IS NULL").bind(t.business_id).first()]);return Response.json({ok:!0,stats:{total_submissions:Number(d?.count||0),awaiting_review:Number(l?.count||0),reviewed_submissions:Number(p?.count||0),unassigned_submissions:Number(m?.count||0)},submissions:r.results||[],templates:a.results||[],customers:o.results||[],appointments:u.results||[]})}catch(t){return console.error("Clinical submissions GET failed:",t),Response.json({ok:!1,error:"Unable to load clinical records."},{status:500})}}c(Ia,"onRequestGet");async function Nd({id:s,user:e,env:t}){let i=await t.DB.prepare(`
    SELECT s.id,s.business_id,s.template_id,s.customer_id,s.appointment_id,s.submitted_by,s.status,s.client_name,s.client_email,s.submitted_at,s.reviewed_at,s.template_version,s.template_snapshot_json,
      t.name AS template_name,t.template_type,t.description AS template_description,
      c.first_name AS customer_first_name,c.last_name AS customer_last_name,
      a.start_at AS appointment_start_at,sv.name AS service_name
    FROM clinical_form_submissions s
    JOIN clinical_templates t ON t.id=s.template_id
    LEFT JOIN customers c ON c.id=s.customer_id
    LEFT JOIN appointments a ON a.id=s.appointment_id
    LEFT JOIN services sv ON sv.id=a.service_id
    WHERE s.id=? AND s.business_id=? LIMIT 1
  `).bind(s,e.business_id).first();if(!i)return Response.json({ok:!1,error:"Clinical record not found."},{status:404});let[n,r,a]=await Promise.all([t.DB.prepare("SELECT field_key,field_label,field_type,value_text,value_json FROM clinical_form_answers WHERE submission_id=? AND business_id=?").bind(i.id,e.business_id).all(),t.DB.prepare("SELECT field_key,signature_data_url,created_at FROM clinical_form_signatures WHERE submission_id=? AND business_id=?").bind(i.id,e.business_id).all(),t.DB.prepare("SELECT id,field_key,original_name,mime_type,size_bytes,storage_provider,created_at FROM clinical_form_uploads WHERE submission_id=? AND business_id=?").bind(i.id,e.business_id).all()]),o=new Map((n.results||[]).map(m=>[m.field_key,m])),u=hi(i.template_snapshot_json,null),d=[],l=new Map((n.results||[]).map(m=>[m.field_key,m.value_text||""]));if(u&&Array.isArray(u.sections))d=u.sections.filter(m=>hs(m.condition,l)).map((m,_)=>({id:`snapshot_section_${_}`,title:m.title||`Section ${_+1}`,description:m.description||null,sort_order:Number(m.sort_order??_),fields:(Array.isArray(m.fields)?m.fields:[]).filter(g=>hs(g.condition,l)).map((g,E)=>{let f=o.get(g.field_key);return{id:`snapshot_field_${_}_${E}`,section_id:`snapshot_section_${_}`,label:g.label||f?.field_label||"Field",field_key:g.field_key,field_type:g.field_type||f?.field_type||"short_text",sort_order:Number(g.sort_order??E),value:f?.value_text||"",value_json:f?.value_json||null}})}));else{let[m,_]=await Promise.all([t.DB.prepare("SELECT id,title,description,sort_order,condition_json FROM clinical_template_sections WHERE business_id=? AND template_id=? ORDER BY sort_order ASC").bind(e.business_id,i.template_id).all(),t.DB.prepare("SELECT id,section_id,label,field_key,field_type,sort_order,condition_json FROM clinical_template_fields WHERE business_id=? AND template_id=? ORDER BY sort_order ASC").bind(e.business_id,i.template_id).all()]);d=(m.results||[]).filter(E=>hs(hi(E.condition_json,null),l)).map(E=>({...E,fields:[]}));let g=new Map(d.map(E=>[E.id,E]));for(let E of _.results||[]){let f=g.get(E.section_id);if(!f||!hs(hi(E.condition_json,null),l))continue;let b=o.get(E.field_key);f.fields.push({...E,value:b?.value_text||"",value_json:b?.value_json||null})}}let p=i.customer_id?`${i.customer_first_name||""} ${i.customer_last_name||""}`.trim():null;return Response.json({ok:!0,submission:{...i,customer_name:p,sections:d,signatures:r.results||[],uploads:a.results||[]}})}c(Nd,"getSubmissionDetail");function hs(s,e){if(!s||typeof s!="object"||!s.field_key)return!0;let t=String(e.get(String(s.field_key))||""),i=String(s.value||"");return s.operator==="not_equals"?t!==i:t===i}c(hs,"isSavedConditionSatisfied");function hi(s,e){if(!s)return e;try{return JSON.parse(s)}catch{return e}}c(hi,"parseJson");async function La({request:s,env:e}){try{let t=await yi(s,e);if(!t)return ki();let i=await s.json(),n=String(i.action||"").trim(),r=String(i.submission_id||"").trim();if(!r)return Et("submission_id is required.");if(!await e.DB.prepare("SELECT id FROM clinical_form_submissions WHERE id=? AND business_id=? LIMIT 1").bind(r,t.business_id).first())return Response.json({ok:!1,error:"Clinical record not found."},{status:404});if(n==="status"){let o=String(i.status||"").trim();return["submitted","reviewed"].includes(o)?(o==="reviewed"?await e.DB.prepare(`
          UPDATE clinical_form_submissions
          SET status='reviewed',reviewed_at=CURRENT_TIMESTAMP,reviewed_by_user_id=?,updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND business_id=?
        `).bind(t.user_id,r,t.business_id).run():await e.DB.prepare(`
          UPDATE clinical_form_submissions
          SET status='submitted',reviewed_at=NULL,reviewed_by_user_id=NULL,updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND business_id=?
        `).bind(r,t.business_id).run(),Response.json({ok:!0})):Et("Invalid review status.")}if(n==="assign"){let o=i.customer_id===null||i.customer_id===""?null:String(i.customer_id).trim(),u=i.appointment_id===null||i.appointment_id===""?null:String(i.appointment_id).trim();if(o&&!await e.DB.prepare("SELECT id FROM customers WHERE id=? AND business_id=? LIMIT 1").bind(o,t.business_id).first())return Et("Customer not found.");if(u){let d=await e.DB.prepare("SELECT id,customer_id FROM appointments WHERE id=? AND business_id=? LIMIT 1").bind(u,t.business_id).first();if(!d)return Et("Appointment not found.");if(o&&d.customer_id!==o)return Et("Appointment does not belong to the selected customer.")}return await e.DB.prepare(`
        UPDATE clinical_form_submissions
        SET customer_id=?,appointment_id=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND business_id=?
      `).bind(o,u,r,t.business_id).run(),Response.json({ok:!0})}return Et("Invalid action.")}catch(t){return console.error("Clinical submissions PUT failed:",t),Response.json({ok:!1,error:"Unable to update clinical record."},{status:500})}}c(La,"onRequestPut");async function Ma({request:s,env:e}){try{let t=await yi(s,e);if(!t)return ki();let i=new URL(s.url),n=String(i.searchParams.get("id")||"").trim();if(!n)return Et("Clinical record id is required.");let r=await e.DB.prepare(`
      SELECT id,submitted_by
      FROM clinical_form_submissions
      WHERE id=? AND business_id=?
      LIMIT 1
    `).bind(n,t.business_id).first();if(!r)return Response.json({ok:!1,error:"Clinical record not found."},{status:404});if(r.submitted_by!=="staff")return Response.json({ok:!1,error:"Client-submitted forms cannot be deleted from this action."},{status:403});let a=await e.DB.prepare(`
      SELECT id,submission_id,business_id,field_key,storage_provider,storage_key,original_name,mime_type,size_bytes,created_at
      FROM clinical_form_uploads
      WHERE submission_id=? AND business_id=?
    `).bind(n,t.business_id).all();for(let o of a.results||[])o.storage_provider==="r2"&&o.storage_key&&e.FORM_UPLOADS&&(await Es({env:e,businessId:t.business_id,originalKey:o.storage_key,sourceType:"clinical_form_upload",sourceId:o.id,originalName:o.original_name||null,mimeType:o.mime_type||null,sizeBytes:o.size_bytes||null,reason:"clinical_record_delete",sourceMetadata:{id:o.id,submission_id:o.submission_id,field_key:o.field_key,storage_provider:o.storage_provider||"r2",storage_key:o.storage_key,original_name:o.original_name,mime_type:o.mime_type||null,size_bytes:Number(o.size_bytes||0),created_at:o.created_at||null}}),await e.FORM_UPLOADS.delete(o.storage_key));return await e.DB.batch([e.DB.prepare("DELETE FROM clinical_form_uploads WHERE submission_id=? AND business_id=?").bind(n,t.business_id),e.DB.prepare("DELETE FROM clinical_form_signatures WHERE submission_id=? AND business_id=?").bind(n,t.business_id),e.DB.prepare("DELETE FROM clinical_form_answers WHERE submission_id=? AND business_id=?").bind(n,t.business_id),e.DB.prepare("DELETE FROM clinical_form_requests WHERE submission_id=? AND business_id=?").bind(n,t.business_id),e.DB.prepare("DELETE FROM clinical_form_submissions WHERE id=? AND business_id=?").bind(n,t.business_id)]),Response.json({ok:!0})}catch(t){return console.error("Clinical record DELETE failed:",t),Response.json({ok:!1,error:"Unable to delete clinical record."},{status:500})}}c(Ma,"onRequestDelete");var Pa=[{key:"general_consultation",name:"General Consultation",template_type:"consultation",description:"",sections:[{title:"Choose Your Treatment",fields:[{label:"Treatment type",field_type:"dropdown",field_key:"treatment_type",help_text:"",placeholder:"",options:["Tattoo Removal","Carbon Facial","Fungal Nail Treatment"],is_required:1,condition:null}],description:"Select the treatment this consultation relates to.",condition:null},{title:"Client Details",fields:[{label:"Full name",field_type:"short_text",field_key:"full_name",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Email address",field_type:"short_text",field_key:"email_address",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Date of birth",field_type:"date",field_key:"date_of_birth",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Contact number",field_type:"short_text",field_key:"contact_number",help_text:"",placeholder:"e.g. 07...",options:[],is_required:1,condition:null}],description:"",condition:null},{title:"Tattoo Information",fields:[{label:"Approximate age of the tattoo (years)",field_type:"number",field_key:"tattoo_age",help_text:"",placeholder:"e.g. 5",options:[],is_required:1,condition:null},{label:"Location on body",field_type:"short_text",field_key:"tattoo_location",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Have you attempted removal before? (Laser, saline, excision or other)",field_type:"yes_no",field_key:"previous_removal",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"If yes, please describe",field_type:"long_text",field_key:"previous_removal_details",help_text:"",placeholder:"Laser, saline, excision or other",options:[],is_required:0,condition:{field_key:"previous_removal",operator:"equals",value:"Yes"}}],description:"",condition:{field_key:"treatment_type",operator:"equals",value:"Tattoo Removal"}},{title:"Tattoo Characteristics",fields:[{label:"Type of tattoo",field_type:"dropdown",field_key:"tattoo_type",help_text:"",placeholder:"",options:["Professional","Amateur","Cosmetic / PMU","Not sure"],is_required:1,condition:null},{label:"Black",field_type:"checkbox",field_key:"ink_black",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Blue",field_type:"checkbox",field_key:"ink_blue",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Green",field_type:"checkbox",field_key:"ink_green",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Red",field_type:"checkbox",field_key:"ink_red",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Yellow",field_type:"checkbox",field_key:"ink_yellow",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"White",field_type:"checkbox",field_key:"ink_white",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Multi-colour",field_type:"checkbox",field_key:"ink_multicolour",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Not sure of tattoo colours",field_type:"checkbox",field_key:"ink_not_sure",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Is the tattoo raised or scarred?",field_type:"yes_no",field_key:"tattoo_raised_scarred",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Have you ever had a reaction to your tattoo ink?",field_type:"yes_no",field_key:"tattoo_ink_reaction",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"If yes, please describe the reaction",field_type:"long_text",field_key:"tattoo_ink_reaction_details",help_text:"",placeholder:"e.g. swelling, itching, rash, raised areas",options:[],is_required:0,condition:{field_key:"tattoo_ink_reaction",operator:"equals",value:"Yes"}},{label:"Is this tattoo a cover-up of another tattoo?",field_type:"dropdown",field_key:"tattoo_coverup",help_text:"",placeholder:"",options:["No","Yes","Not sure"],is_required:1,condition:null}],description:"Select all tattoo colours that apply.",condition:{field_key:"treatment_type",operator:"equals",value:"Tattoo Removal"}},{title:"Consent & Privacy",fields:[{label:"I consent to the business storing and processing my personal and health-related information to assess treatment suitability and respond to my enquiry.",field_type:"checkbox",field_key:"gdpr_consent",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I confirm that I am over 18 years of age.",field_type:"checkbox",field_key:"age_confirm",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I give informed consent to undergo the selected treatment, understanding the risks, healing process, and that results vary.",field_type:"checkbox",field_key:"explicit_consent",help_text:"",placeholder:"",options:[],is_required:1,condition:null}],description:"Please do not submit urgent medical information here. This form is for consultation screening only.",condition:null},{title:"Medical History",fields:[{label:"Lupus",field_type:"checkbox",field_key:"lupus",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Psoriasis",field_type:"checkbox",field_key:"psoriasis",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Vitiligo",field_type:"checkbox",field_key:"vitiligo_condition",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Eczema / dermatitis",field_type:"checkbox",field_key:"eczema_dermatitis",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Keloid scarring",field_type:"checkbox",field_key:"keloid_scarring",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Autoimmune disorder",field_type:"checkbox",field_key:"autoimmune_disorder",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Immunosuppressive medication or therapy (e.g. biologics, chemotherapy, steroid therapy)",field_type:"checkbox",field_key:"immunosuppressive_therapy",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"None of the above",field_type:"checkbox",field_key:"medical_history_none",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Other (please specify)",field_type:"short_text",field_key:"autoimmune_other",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"Do you have or have you ever been diagnosed with any of the following conditions? Medical screening helps ensure treatment is safe and appropriate for your skin and medical history.",condition:null},{title:"Treatment Safety",fields:[{label:"Currently pregnant or breastfeeding",field_type:"checkbox",field_key:"pregnant_nursing",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Recent sun exposure or tanning beds in the last 4 weeks",field_type:"checkbox",field_key:"sun_exposure",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Skin becomes unusually sensitive to sunlight or UV light",field_type:"checkbox",field_key:"photosensitising_meds",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Moles or suspicious lesions in treatment area",field_type:"checkbox",field_key:"moles_lesions_area",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Active infection in treatment area",field_type:"checkbox",field_key:"active_infection_area",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Tattoo done within the last 6\u20138 weeks",field_type:"checkbox",field_key:"recent_tattoo_6weeks",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"History of poor wound healing or abnormal scarring",field_type:"checkbox",field_key:"poor_wound_healing",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"None of the above",field_type:"checkbox",field_key:"treatment_safety_none",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"Select every statement that applies.",condition:null},{title:"Recent Skin Preparation",fields:[{label:"Have you used fake tan on the treatment area within the last 2 weeks?",field_type:"yes_no",field_key:"fake_tan_last_2_weeks",help_text:"",placeholder:"",options:[],is_required:1,condition:null}],description:"",condition:{field_key:"treatment_type",operator:"not_equals",value:"Fungal Nail Treatment"}},{title:"Carbon Facial Screening",fields:[{label:"Have you had Botox or dermal filler in the treatment area within the last 2 weeks?",field_type:"yes_no",field_key:"recent_botox_filler",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Are you currently using exfoliating acids, benzoyl peroxide or prescription acne medication on your face?",field_type:"yes_no",field_key:"active_skincare_products",help_text:"Examples include AHA/BHA acids, benzoyl peroxide, retinoids or prescription acne products.",placeholder:"",options:[],is_required:1,condition:null},{label:"Have you had microneedling, laser treatment, a chemical peel or dermabrasion on your face within the last 4 weeks?",field_type:"yes_no",field_key:"recent_cosmetic_procedure",help_text:"",placeholder:"",options:[],is_required:1,condition:null}],description:"",condition:{field_key:"treatment_type",operator:"equals",value:"Carbon Facial"}},{title:"Fungal Nail Screening",fields:[{label:"Has the nail condition been diagnosed as a fungal infection by a GP, podiatrist or other qualified healthcare professional?",field_type:"dropdown",field_key:"fungal_diagnosis",help_text:"",placeholder:"",options:["Yes","No","Unsure"],is_required:1,condition:null},{label:"Are you currently using or taking antifungal medication?",field_type:"yes_no",field_key:"current_antifungal_medication",help_text:"Examples include Terbinafine, Amorolfine/Loceryl or Canesten.",placeholder:"",options:[],is_required:1,condition:null},{label:"If yes, please list the antifungal medication",field_type:"short_text",field_key:"antifungal_medication_details",help_text:"",placeholder:"Medication name and how long you have used it",options:[],is_required:0,condition:{field_key:"current_antifungal_medication",operator:"equals",value:"Yes"}}],description:"",condition:{field_key:"treatment_type",operator:"equals",value:"Fungal Nail Treatment"}},{title:"Viral & Blood-Borne Conditions",fields:[{label:"History of cold sores (Herpes Simplex Virus)",field_type:"checkbox",field_key:"cold_sores_hsv",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Hepatitis B",field_type:"checkbox",field_key:"hepatitis_b",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Hepatitis C",field_type:"checkbox",field_key:"hepatitis_c",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"HIV",field_type:"checkbox",field_key:"hiv",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"None of the above",field_type:"checkbox",field_key:"viral_conditions_none",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Other blood-borne condition (please specify)",field_type:"short_text",field_key:"other_blood_borne",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"Select every statement that applies.",condition:null},{title:"Chronic Health Conditions",fields:[{label:"Diabetes (Type I or II)",field_type:"checkbox",field_key:"diabetes",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Epilepsy or history of seizures",field_type:"checkbox",field_key:"epilepsy_seizures",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Heart condition or pacemaker",field_type:"checkbox",field_key:"heart_condition_pacemaker",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Bleeding disorder (e.g. haemophilia)",field_type:"checkbox",field_key:"bleeding_disorder",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"History of skin cancer",field_type:"checkbox",field_key:"skin_cancer_history",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"None of the above",field_type:"checkbox",field_key:"chronic_conditions_none",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Other chronic health conditions (please specify)",field_type:"short_text",field_key:"other_chronic_health_conditions",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"Select every statement that applies.",condition:null},{title:"Allergies",fields:[{label:"Tattoo ink allergy",field_type:"checkbox",field_key:"tattoo_ink_allergy",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Lidocaine / numbing cream allergy",field_type:"checkbox",field_key:"lidocaine_numbing_allergy",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Latex allergy",field_type:"checkbox",field_key:"latex_allergy",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"No known allergies",field_type:"checkbox",field_key:"allergies_none",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Other allergies (please specify)",field_type:"short_text",field_key:"other_allergies",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"Select every statement that applies.",condition:null},{title:"Medications & Supplements",fields:[{label:"Have you taken Accutane (Isotretinoin) in the last 6 months?",field_type:"yes_no",field_key:"accutane",help_text:"If yes, treatment may need to be postponed until your practitioner has confirmed it is safe to proceed.",placeholder:"",options:[],is_required:1,condition:null},{label:"Blood thinners (e.g. Warfarin, Apixaban, Rivaroxaban)",field_type:"checkbox",field_key:"blood_thinners",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Gold therapy (for rheumatoid arthritis)",field_type:"checkbox",field_key:"gold_therapy",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Antibiotics in the last 2 weeks (e.g. Doxycycline, Lymecycline, Minocycline)",field_type:"checkbox",field_key:"antibiotics_last_2_weeks",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Steroid medication (e.g. Prednisolone)",field_type:"checkbox",field_key:"steroid_medication",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Prescription skin creams used on the treatment area (e.g. Retin-A, Tretinoin, Adapalene, Hydroquinone)",field_type:"checkbox",field_key:"retinol_retina_area",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Supplements that may increase bleeding (e.g. Fish Oil/Omega-3, Vitamin E, Ginkgo Biloba)",field_type:"checkbox",field_key:"bleeding_supplements",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"None of the above",field_type:"checkbox",field_key:"medications_none",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"List all current prescription medications, over-the-counter medicines, herbs, vitamins and supplements",field_type:"long_text",field_key:"current_medications",help_text:"",placeholder:"e.g. Aspirin, Metformin, Doxycycline, Prednisolone, Fish Oil, Vitamin D, St John's Wort",options:[],is_required:0,condition:null}],description:"Select every medication or supplement category that applies.",condition:null},{title:"Lifestyle Factors",fields:[{label:"Do you currently smoke or vape?",field_type:"dropdown",field_key:"smoke_vape",help_text:"",placeholder:"",options:["No","Yes - cigarettes","Yes - vape","Yes - both"],is_required:1,condition:null},{label:"If yes: approximate daily use",field_type:"short_text",field_key:"smoke_vape_frequency",help_text:"",placeholder:"e.g. 5 cigarettes per day or vape daily",options:[],is_required:0,condition:null}],description:"Smoking and vaping can affect healing and treatment outcomes. For tattoo removal, it may also slow the body\u2019s ability to clear tattoo pigment.",condition:null},{title:"Additional Information",fields:[{label:"Is there anything else I should know?",field_type:"long_text",field_key:"additional_info",help_text:"",placeholder:"Optional",options:[],is_required:0,condition:null},{label:"What outcome are you hoping for?",field_type:"long_text",field_key:"treatment_goal",help_text:"",placeholder:"Full removal, fading for cover-up, lightening, clearer skin, improved nail appearance, etc.",options:[],is_required:0,condition:null}],description:"",condition:null},{title:"Photos",fields:[{label:"Upload treatment photos (optional)",field_type:"file_upload",field_key:"treatment_photos",help_text:"Please upload clear, unedited photos taken in good lighting. Avoid filters or beauty enhancements. Include a close-up and an image showing the surrounding area where possible.",placeholder:"",options:[],is_required:0,condition:null},{label:"I consent to clinical photos being taken for treatment monitoring",field_type:"yes_no",field_key:"photo_consent",help_text:"Clinical photos are used for treatment documentation and monitoring unless separate written consent is provided for marketing or educational purposes.",placeholder:"",options:[],is_required:0,condition:null}],description:"Photos can help the practitioner assess treatment suitability before consultation.",condition:null},{title:"Treatment & Aftercare Acknowledgement",fields:[{label:"I understand that I must follow the aftercare instructions provided for my selected treatment.",field_type:"checkbox",field_key:"aftercare_understood",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I understand that a patch test is required before treatment. Treatment can only proceed after my consultation and patch test have been completed and approved.",field_type:"checkbox",field_key:"patch_test_acknowledgement",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I understand that treatments carry potential risks and that these will be explained for my selected treatment.",field_type:"checkbox",field_key:"risk_acknowledgement",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I understand that no guarantee has been made regarding the outcome of treatment and that results vary between individuals.",field_type:"checkbox",field_key:"no_guarantee_results",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I accept responsibility for following all aftercare guidance provided for my selected treatment.",field_type:"checkbox",field_key:"client_responsibility",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I confirm that all information provided is accurate and complete to the best of my knowledge. I understand that withholding or providing incorrect information may increase the risk of complications and may invalidate my treatment.",field_type:"checkbox",field_key:"medical_accuracy",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Client signature",field_type:"signature",field_key:"client_signature",help_text:"",placeholder:"",options:[],is_required:1,condition:null}],description:"Treatment will only proceed once suitability has been confirmed by the practitioner during consultation.",condition:null}]},{key:"patch_test",name:"Patch Test",template_type:"patch_test",description:"",sections:[{title:"Patch Test Details",fields:[{label:"Practitioner name",field_type:"short_text",field_key:"patch_practitioner",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Date of test",field_type:"date",field_key:"patch_test_date",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Client name",field_type:"short_text",field_key:"patch_client_name",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Date of birth",field_type:"date",field_key:"patch_date_of_birth",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Treatment type",field_type:"dropdown",field_key:"patch_treatment_type",help_text:"",placeholder:"",options:["Tattoo Removal","Carbon Facial","Fungal Toenail Treatment"],is_required:1,condition:null},{label:"Test area",field_type:"short_text",field_key:"patch_test_area",help_text:"",placeholder:"e.g. left forearm tattoo, full face, right big toenail",options:[],is_required:1,condition:null},{label:"Fitzpatrick type",field_type:"dropdown",field_key:"patch_fitzpatrick_type",help_text:"",placeholder:"",options:["Type I","Type II","Type III","Type IV","Type V","Type VI"],is_required:0,condition:null}],description:"",condition:null},{title:"Device & Settings",fields:[{label:"Machine serial no.",field_type:"short_text",field_key:"patch_machine_serial",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Wavelength",field_type:"dropdown",field_key:"patch_wavelength",help_text:"",placeholder:"",options:["1064nm","532nm"],is_required:0,condition:null},{label:"Joules (J/cm\xB2)",field_type:"short_text",field_key:"patch_joules",help_text:"",placeholder:"e.g. 1.2J",options:[],is_required:0,condition:null},{label:"Number of test shots",field_type:"short_text",field_key:"patch_test_shots",help_text:"",placeholder:"e.g. 3 pulses",options:[],is_required:0,condition:null},{label:"Earliest safe treatment date",field_type:"date",field_key:"patch_earliest_treatment_date",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"",condition:null},{title:"Immediate Reaction & Safety",fields:[{label:"Normal erythema",field_type:"checkbox",field_key:"patch_reaction_normal_erythema",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Perifollicular edema",field_type:"checkbox",field_key:"patch_reaction_perifollicular_edema",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Mild swelling",field_type:"checkbox",field_key:"patch_reaction_mild_swelling",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Warmth",field_type:"checkbox",field_key:"patch_reaction_warmth",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Mild blistering",field_type:"checkbox",field_key:"patch_reaction_mild_blistering",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Frosting",field_type:"checkbox",field_key:"patch_reaction_frosting",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Pinpoint bleeding",field_type:"checkbox",field_key:"patch_reaction_pinpoint_bleeding",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"No significant reaction",field_type:"checkbox",field_key:"patch_reaction_none",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Laser eye protection worn (practitioner & client)",field_type:"checkbox",field_key:"patch_eye_protection",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Practitioner's notes",field_type:"long_text",field_key:"patch_practitioner_notes",help_text:"",placeholder:"Clinical observations, client feedback, parameter adjustments, skin response, advice given, recommendations, or any additional notes.",options:[],is_required:0,condition:null}],description:"Select all immediate reactions that apply and confirm safety compliance.",condition:null},{title:"Tattoo Removal Declaration & Consent",fields:[{label:"I acknowledge that a patch test has been performed to test for adverse reactions or pigment changes.",field_type:"checkbox",field_key:"patch_tattoo_ack_test",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I understand laser tattoo removal carries risks including blistering, scarring, pigmentation changes, infection and incomplete removal, and that complete removal cannot be guaranteed.",field_type:"checkbox",field_key:"patch_tattoo_ack_risks",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I will monitor the area for 24\u201348 hours and report any adverse reactions before proceeding with full treatment.",field_type:"checkbox",field_key:"patch_tattoo_ack_monitor",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I consent to photographs being taken of the treated area for my clinical records and insurance purposes.",field_type:"checkbox",field_key:"patch_tattoo_ack_photos",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I confirm that I have received and understood the aftercare instructions and agree to follow them to minimise the risk of complications.",field_type:"checkbox",field_key:"patch_tattoo_ack_aftercare",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I confirm there have been no changes to my medical history, medication, or recent sun exposure since my initial consultation.",field_type:"checkbox",field_key:"patch_tattoo_ack_changes",help_text:"",placeholder:"",options:[],is_required:1,condition:null}],description:"",condition:{field_key:"patch_treatment_type",operator:"equals",value:"Tattoo Removal"}},{title:"Carbon Facial Declaration & Consent",fields:[{label:"I acknowledge that a patch test has been performed to assess skin suitability before Carbon Facial treatment.",field_type:"checkbox",field_key:"patch_carbon_ack_test",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I understand Carbon Facial treatment may cause temporary redness, warmth, sensitivity, dryness, tingling or mild irritation, and that results vary and cannot be guaranteed.",field_type:"checkbox",field_key:"patch_carbon_ack_risks",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I will monitor the area for 24\u201348 hours and report any unexpected reaction before proceeding with full treatment.",field_type:"checkbox",field_key:"patch_carbon_ack_monitor",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I consent to photographs being taken of the treated area for my clinical records and insurance purposes.",field_type:"checkbox",field_key:"patch_carbon_ack_photos",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I confirm that I have received and understood the aftercare instructions and agree to follow them to minimise the risk of complications.",field_type:"checkbox",field_key:"patch_carbon_ack_aftercare",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I confirm there have been no changes to my medical history, medication, skincare products, active skin conditions, or recent sun exposure since my initial consultation.",field_type:"checkbox",field_key:"patch_carbon_ack_changes",help_text:"",placeholder:"",options:[],is_required:1,condition:null}],description:"",condition:{field_key:"patch_treatment_type",operator:"equals",value:"Carbon Facial"}},{title:"Fungal Toenail Declaration & Consent",fields:[{label:"I acknowledge that a patch test has been performed to assess suitability before Fungal Toenail treatment.",field_type:"checkbox",field_key:"patch_fungal_ack_test",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I understand laser treatment for fungal toenails may cause temporary warmth, sensitivity, mild discomfort, redness around the nail or temporary nail changes, and that results vary and cannot be guaranteed.",field_type:"checkbox",field_key:"patch_fungal_ack_risks",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I understand that fungal nail improvement can take time and may require multiple sessions, good foot hygiene and ongoing aftercare.",field_type:"checkbox",field_key:"patch_fungal_ack_time",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I will monitor the treated area for 24\u201348 hours and report any unexpected reaction before proceeding with full treatment.",field_type:"checkbox",field_key:"patch_fungal_ack_monitor",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I consent to photographs being taken of the treated area for my clinical records and insurance purposes.",field_type:"checkbox",field_key:"patch_fungal_ack_photos",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I confirm that I have received and understood the aftercare instructions and agree to follow them to minimise the risk of complications.",field_type:"checkbox",field_key:"patch_fungal_ack_aftercare",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"I confirm there have been no changes to my medical history, medication, nail condition, skin condition, or recent sun exposure since my initial consultation.",field_type:"checkbox",field_key:"patch_fungal_ack_changes",help_text:"",placeholder:"",options:[],is_required:1,condition:null}],description:"",condition:{field_key:"patch_treatment_type",operator:"equals",value:"Fungal Toenail Treatment"}},{title:"Client Signature",fields:[{label:"Client signature",field_type:"signature",field_key:"patch_client_signature",help_text:"",placeholder:"",options:[],is_required:1,condition:null}],description:"Client signature confirming the patch-test record and applicable declaration.",condition:null}]},{key:"treatment_record",name:"Treatment Record",template_type:"treatment_record",description:"",sections:[{title:"Client & Appointment",fields:[{label:"Practitioner",field_type:"short_text",field_key:"treatment_practitioner",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Treatment date",field_type:"date",field_key:"treatment_date",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Client name",field_type:"short_text",field_key:"treatment_client_name",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Treatment",field_type:"dropdown",field_key:"treatment_type",help_text:"",placeholder:"",options:["Tattoo Removal","Carbon Facial","Fungal Nail Laser"],is_required:1,condition:null},{label:"Treatment option",field_type:"short_text",field_key:"treatment_option",help_text:"",placeholder:"e.g. Small Tattoo \xB7 6 Sessions",options:[],is_required:1,condition:null},{label:"Session",field_type:"number",field_key:"treatment_session_number",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Treatment area",field_type:"short_text",field_key:"treatment_area",help_text:"",placeholder:"e.g. left forearm, full face, right big toenail",options:[],is_required:0,condition:null}],description:"",condition:null},{title:"Laser Settings",fields:[{label:"Machine",field_type:"short_text",field_key:"treatment_machine",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Wavelength",field_type:"dropdown",field_key:"treatment_wavelength",help_text:"",placeholder:"",options:["1064nm","532nm","1064nm + 532nm"],is_required:0,condition:null},{label:"Fluence / Energy (J/cm\xB2)",field_type:"short_text",field_key:"treatment_fluence",help_text:"",placeholder:"e.g. 1.2",options:[],is_required:0,condition:null},{label:"Air cooling",field_type:"checkbox",field_key:"treatment_cooling_air",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Ice pack",field_type:"checkbox",field_key:"treatment_cooling_ice",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"No cooling",field_type:"checkbox",field_key:"treatment_cooling_none",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"Record the device and settings used during this treatment.",condition:null},{title:"Tattoo Removal Details",fields:[{label:"Black ink",field_type:"checkbox",field_key:"treatment_tattoo_colour_black",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Blue ink",field_type:"checkbox",field_key:"treatment_tattoo_colour_blue",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Green ink",field_type:"checkbox",field_key:"treatment_tattoo_colour_green",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Red ink",field_type:"checkbox",field_key:"treatment_tattoo_colour_red",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Yellow ink",field_type:"checkbox",field_key:"treatment_tattoo_colour_yellow",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"White ink",field_type:"checkbox",field_key:"treatment_tattoo_colour_white",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Mixed ink colours",field_type:"checkbox",field_key:"treatment_tattoo_colour_mixed",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Frosting",field_type:"checkbox",field_key:"treatment_tattoo_response_frosting",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Mild erythema",field_type:"checkbox",field_key:"treatment_tattoo_response_erythema",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Mild oedema",field_type:"checkbox",field_key:"treatment_tattoo_response_oedema",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Pinpoint bleeding",field_type:"checkbox",field_key:"treatment_tattoo_response_pinpoint_bleeding",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Blistering",field_type:"checkbox",field_key:"treatment_tattoo_response_blistering",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"No unusual reaction",field_type:"checkbox",field_key:"treatment_tattoo_response_none",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"Select all ink colours and treatment responses that apply.",condition:{field_key:"treatment_type",operator:"equals",value:"Tattoo Removal"}},{title:"Carbon Facial Details",fields:[{label:"Carbon layer",field_type:"dropdown",field_key:"treatment_carbon_layer",help_text:"",placeholder:"",options:["Thin","Medium","Heavy"],is_required:0,condition:null},{label:"Mild redness",field_type:"checkbox",field_key:"treatment_carbon_response_redness",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Warmth",field_type:"checkbox",field_key:"treatment_carbon_response_warmth",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Tightening",field_type:"checkbox",field_key:"treatment_carbon_response_tightening",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Good response",field_type:"checkbox",field_key:"treatment_carbon_response_good",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Sensitive",field_type:"checkbox",field_key:"treatment_carbon_response_sensitive",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"Record the carbon layer and all skin responses that apply.",condition:{field_key:"treatment_type",operator:"equals",value:"Carbon Facial"}},{title:"Fungal Nail Details",fields:[{label:"Left foot",field_type:"checkbox",field_key:"treatment_fungal_foot_left",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Right foot",field_type:"checkbox",field_key:"treatment_fungal_foot_right",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Both feet",field_type:"checkbox",field_key:"treatment_fungal_foot_both",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Big toe",field_type:"checkbox",field_key:"treatment_fungal_nail_big_toe",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"2nd toe",field_type:"checkbox",field_key:"treatment_fungal_nail_2",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"3rd toe",field_type:"checkbox",field_key:"treatment_fungal_nail_3",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"4th toe",field_type:"checkbox",field_key:"treatment_fungal_nail_4",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"5th toe",field_type:"checkbox",field_key:"treatment_fungal_nail_5",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Thickened",field_type:"checkbox",field_key:"treatment_fungal_appearance_thickened",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Yellow",field_type:"checkbox",field_key:"treatment_fungal_appearance_yellow",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"White",field_type:"checkbox",field_key:"treatment_fungal_appearance_white",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Brittle",field_type:"checkbox",field_key:"treatment_fungal_appearance_brittle",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Lifting",field_type:"checkbox",field_key:"treatment_fungal_appearance_lifting",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Improving",field_type:"checkbox",field_key:"treatment_fungal_appearance_improving",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"Select the affected foot/feet, nails treated and all appearance observations that apply.",condition:{field_key:"treatment_type",operator:"equals",value:"Fungal Nail Laser"}},{title:"Treatment Outcome",fields:[{label:"Client tolerance",field_type:"dropdown",field_key:"treatment_client_tolerance",help_text:"",placeholder:"",options:["Excellent","Good","Fair","Poor"],is_required:0,condition:null},{label:"Plan for next session",field_type:"long_text",field_key:"treatment_next_session_plan",help_text:"",placeholder:"Settings to repeat or adjust, areas to focus on and recommendations.",options:[],is_required:0,condition:null},{label:"Recommended next treatment date",field_type:"date",field_key:"treatment_next_date",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Recommended interval",field_type:"dropdown",field_key:"treatment_recommended_interval",help_text:"",placeholder:"",options:["4 weeks","6 weeks","8 weeks","10 weeks","12 weeks","Other"],is_required:0,condition:null}],description:"",condition:null}]},{key:"incident_accident_log",name:"Incident / Accident Log",template_type:"custom",description:"A comprehensive incident, accident, near-miss and adverse-event record with register details, immediate action, follow-up, post-incident review and signed sign-off.",sections:[{title:"Log Book Details",fields:[{label:"Business name",field_type:"short_text",field_key:"incident_business_name",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Responsible person",field_type:"short_text",field_key:"incident_responsible_person",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Log start date",field_type:"date",field_key:"incident_log_start_date",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Review date",field_type:"date",field_key:"incident_review_date",help_text:"",placeholder:"",options:[],is_required:0,condition:null}],description:"",condition:null},{title:"How to Use This Log",fields:[{label:"Log instructions / notes",field_type:"long_text",field_key:"incident_how_to_use",help_text:"Record all accidents, incidents, near misses, adverse reactions, unexpected equipment events, spills, electrical concerns, client injuries, practitioner injuries and first aid events connected with the business. Complete each entry as soon as practicable, record immediate actions taken and note whether the event requires follow-up, insurer notification, maintenance action or report under RIDDOR.",placeholder:"",options:[],is_required:0,condition:null}],description:"",condition:null},{title:"Incident / Accident Register",fields:[{label:"Date",field_type:"date",field_key:"incident_date",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Time",field_type:"short_text",field_key:"incident_time",help_text:"",placeholder:"e.g. 14:30",options:[],is_required:1,condition:null},{label:"Person(s) involved",field_type:"long_text",field_key:"incident_persons_involved",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Type of event",field_type:"dropdown",field_key:"incident_type",help_text:"",placeholder:"",options:["Accident","Incident","Near miss","Adverse reaction","Equipment issue","Spill","Electrical concern","Client injury","Practitioner injury","First aid event","Other"],is_required:1,condition:null},{label:"Details / injury / damage",field_type:"long_text",field_key:"incident_details_injury_damage",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Immediate action taken",field_type:"long_text",field_key:"incident_immediate_action",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Follow-up / outcome",field_type:"long_text",field_key:"incident_follow_up_outcome",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"RIDDOR / insurer review",field_type:"dropdown",field_key:"incident_riddor_insurer_review",help_text:"",placeholder:"",options:["Yes","No","Not applicable"],is_required:1,condition:null}],description:"",condition:null},{title:"Post-Incident Review",fields:[{label:"Root cause / contributing factors",field_type:"long_text",field_key:"incident_root_cause",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Corrective action implemented",field_type:"long_text",field_key:"incident_corrective_action",help_text:"",placeholder:"",options:[],is_required:0,condition:null},{label:"Documents updated",field_type:"long_text",field_key:"incident_documents_updated",help_text:"",placeholder:"Risk assessment / COSHH / local rules / maintenance log / training records / client notes",options:[],is_required:0,condition:null}],description:"",condition:null},{title:"Sign Off",fields:[{label:"Recorded by",field_type:"short_text",field_key:"incident_recorded_by",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Date signed",field_type:"date",field_key:"incident_date_signed",help_text:"",placeholder:"",options:[],is_required:1,condition:null},{label:"Signature",field_type:"signature",field_key:"incident_signature",help_text:"Sign using a finger, mouse or stylus.",placeholder:"",options:[],is_required:1,condition:null}],description:"",condition:null}]}],Td=["consultation","patch_test","treatment_record","custom"],Ad=["short_text","long_text","yes_no","checkbox","dropdown","date","number","signature"];async function ks(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(ks,"getUserContext");function Ss(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Ss,"unauthorized");function ys(s){return Response.json({ok:!1,error:s},{status:400})}c(ys,"badRequest");async function Ua({request:s,env:e}){try{let t=await ks(s,e);if(!t)return Ss();let i=await e.DB.prepare(`
        SELECT
          id,
          name,
          template_type,
          description,
          version,
          is_active,
          is_default,
          is_published,
          is_client_sendable,
          public_token,
          published_at,
          created_at,
          updated_at
        FROM clinical_templates
        WHERE business_id = ?
        ORDER BY is_active DESC, name COLLATE NOCASE
      `).bind(t.business_id).all(),n=await e.DB.prepare(`
        SELECT
          id,
          template_id,
          title,
          description,
          sort_order,
          condition_json
        FROM clinical_template_sections
        WHERE business_id = ?
        ORDER BY sort_order ASC
      `).bind(t.business_id).all(),r=await e.DB.prepare(`
        SELECT
          id,
          template_id,
          section_id,
          label,
          field_key,
          field_type,
          help_text,
          placeholder,
          options_json,
          is_required,
          sort_order,
          condition_json
        FROM clinical_template_fields
        WHERE business_id = ?
        ORDER BY sort_order ASC
      `).bind(t.business_id).all(),a=new Map;for(let l of n.results||[]){let p={...l,condition:Si(l.condition_json,null),fields:[]};a.set(l.template_id,[...a.get(l.template_id)||[],p])}let o=new Map;for(let l of a.values())for(let p of l)o.set(p.id,p);for(let l of r.results||[]){let p=o.get(l.section_id);p&&p.fields.push({...l,options:Si(l.options_json,[]),condition:Si(l.condition_json,null)})}let u=(i.results||[]).map(l=>({...l,sections:a.get(l.id)||[]})),d=Pa.map(l=>({key:l.key,name:l.name,template_type:l.template_type,description:l.description,section_count:l.sections.length,field_count:l.sections.reduce((p,m)=>p+m.fields.length,0)}));return Response.json({ok:!0,templates:u,starters:d})}catch(t){return console.error("Clinical templates GET failed:",t),Response.json({ok:!1,error:"Unable to load clinical templates."},{status:500})}}c(Ua,"onRequestGet");async function Ba({request:s,env:e}){try{let t=await ks(s,e);if(!t)return Ss();let i=await s.json();if(i.action==="clone_starter"){let a=Pa.find(d=>d.key===i.starter_key);if(!a)return ys("Starter template not found.");let o=`ct_${crypto.randomUUID()}`,u={name:a.name,template_type:a.template_type,description:a.description,is_active:1,is_default:0,is_client_sendable:a.key==="general_consultation"?1:0,sections:structuredClone(a.sections)};return await Ri({env:e,businessId:t.business_id,templateId:o,payload:u,isUpdate:!1}),Response.json({ok:!0,template:{id:o}})}let n=Ha(i);if(!n.ok)return ys(n.error);let r=`ct_${crypto.randomUUID()}`;return await Ri({env:e,businessId:t.business_id,templateId:r,payload:n.payload,isUpdate:!1}),Response.json({ok:!0,template:{id:r}})}catch(t){return console.error("Clinical template creation failed:",t),Response.json({ok:!1,error:"Unable to create clinical template."},{status:500})}}c(Ba,"onRequestPost");async function qa({request:s,env:e}){try{let t=await ks(s,e);if(!t)return Ss();let i=await s.json(),n=String(i.id||"").trim();if(!n)return ys("Template id is required.");if(!await e.DB.prepare(`
        SELECT id
        FROM clinical_templates
        WHERE id = ?
          AND business_id = ?
        LIMIT 1
      `).bind(n,t.business_id).first())return Response.json({ok:!1,error:"Clinical template not found."},{status:404});if(i.action==="archive")return await e.DB.prepare(`
          UPDATE clinical_templates
          SET
            is_active = 0,
            is_default = 0,
            is_published = 0,
            published_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND business_id = ?
        `).bind(n,t.business_id).run(),Response.json({ok:!0,template:{id:n,is_active:0,is_default:0,is_published:0}});let a=Ha(i);return a.ok?(await Ri({env:e,businessId:t.business_id,templateId:n,payload:a.payload,isUpdate:!0}),Response.json({ok:!0,template:{id:n}})):ys(a.error)}catch(t){return console.error("Clinical template update failed:",t),Response.json({ok:!1,error:"Unable to update clinical template."},{status:500})}}c(qa,"onRequestPut");async function ja({request:s,env:e}){return await ks(s,e)?Response.json({ok:!1,error:"Clinical templates cannot be permanently deleted. Archive the template instead."},{status:405}):Ss()}c(ja,"onRequestDelete");async function Ri({env:s,businessId:e,templateId:t,payload:i,isUpdate:n}){let r=[];i.is_default===1&&r.push(s.DB.prepare(`
          UPDATE clinical_templates
          SET
            is_default = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            business_id = ?
            AND template_type = ?
            AND id != ?
        `).bind(e,i.template_type,t)),n?(r.push(s.DB.prepare(`
          UPDATE clinical_templates
          SET
            name = ?,
            template_type = ?,
            description = ?,
            is_active = ?,
            is_default = ?,
            is_client_sendable = ?,
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
        `).bind(i.name,i.template_type,i.description||null,i.is_active,i.is_default,i.is_client_sendable,t,e)),r.push(s.DB.prepare(`
          DELETE FROM clinical_template_fields
          WHERE template_id = ?
            AND business_id = ?
        `).bind(t,e)),r.push(s.DB.prepare(`
          DELETE FROM clinical_template_sections
          WHERE template_id = ?
            AND business_id = ?
        `).bind(t,e))):r.push(s.DB.prepare(`
          INSERT INTO clinical_templates (
            id,
            business_id,
            name,
            template_type,
            description,
            is_active,
            is_default,
            is_client_sendable
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(t,e,i.name,i.template_type,i.description||null,i.is_active,i.is_default,i.is_client_sendable));for(let a=0;a<i.sections.length;a+=1){let o=i.sections[a],u=`cts_${crypto.randomUUID()}`;r.push(s.DB.prepare(`
          INSERT INTO clinical_template_sections (
            id,
            business_id,
            template_id,
            title,
            description,
            sort_order,
            condition_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(u,e,t,o.title,o.description||null,a,o.condition?JSON.stringify(o.condition):null));for(let d=0;d<o.fields.length;d+=1){let l=o.fields[d],p=`ctf_${crypto.randomUUID()}`,m=String(l.field_key||"").trim()||wd(l.label,a,d);r.push(s.DB.prepare(`
            INSERT INTO clinical_template_fields (
              id,
              business_id,
              template_id,
              section_id,
              label,
              field_key,
              field_type,
              help_text,
              placeholder,
              options_json,
              is_required,
              sort_order,
              condition_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(p,e,t,u,l.label,m,l.field_type,l.help_text||null,l.placeholder||null,l.field_type==="dropdown"?JSON.stringify(l.options||[]):null,l.is_required,d,l.condition?JSON.stringify(l.condition):null))}}await s.DB.batch(r)}c(Ri,"saveTemplateStructure");function Ha(s){let e=String(s.name||"").trim(),t=String(s.template_type||"").trim(),i=String(s.description||"").trim(),n=s.is_active===0?0:1,r=s.is_default===1?1:0,a=s.is_client_sendable===1?1:0,o=Array.isArray(s.sections)?s.sections:[];if(!e)return{ok:!1,error:"Template name is required."};if(!Td.includes(t))return{ok:!1,error:"Invalid template type."};if(!o.length)return{ok:!1,error:"Add at least one section."};let u=[],d=new Set;for(let l of o){let p=String(l.title||"").trim();if(!p)return{ok:!1,error:"Every section needs a title."};let m=[];for(let _ of Array.isArray(l.fields)?l.fields:[]){let g=String(_.field_type||"").trim();if(g==="file_upload")continue;let E=String(_.label||"").trim();if(!E)return{ok:!1,error:"Every field needs a label."};if(!Ad.includes(g))return{ok:!1,error:"Invalid field type."};let f=String(_.field_key||"").trim();(!f||d.has(f))&&(f=`field_${crypto.randomUUID().replaceAll("-","").slice(0,12)}`),d.add(f),m.push({label:E,field_key:f,field_type:g,help_text:String(_.help_text||"").trim(),placeholder:String(_.placeholder||"").trim(),options:g==="dropdown"&&Array.isArray(_.options)?_.options.map(b=>String(b).trim()).filter(Boolean):[],is_required:_.is_required===1?1:0,condition:xa(_.condition)})}u.push({title:p,description:String(l.description||"").trim(),condition:xa(l.condition),fields:m})}return{ok:!0,payload:{name:e,template_type:t,description:i,is_active:n,is_default:r,is_client_sendable:a,sections:u}}}c(Ha,"validateTemplate");function xa(s){if(!s||typeof s!="object")return null;let e=String(s.field_key||"").trim(),t=String(s.operator||"equals").trim(),i=String(s.value||"").trim();return!e||!["equals","not_equals"].includes(t)?null:{field_key:e,operator:t,value:i}}c(xa,"cleanCondition");function wd(s,e,t){return`${String(s).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,42)||"field"}_${e+1}_${t+1}`}c(wd,"makeFieldKey");function Si(s,e){if(!s)return e;try{return JSON.parse(s)}catch{return e}}c(Si,"parseJson");async function Fa(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) >
            datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(Fa,"getUserContext");function Wa(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Wa,"unauthorized");async function $a({request:s,env:e}){try{let t=await Fa(s,e);if(!t)return Wa();let i=await e.DB.prepare(`
          SELECT
            cc.id,
            cc.appointment_id,
            cc.customer_id,
            cc.communication_type,
            cc.recipient,
            cc.subject,
            cc.status,
            cc.provider,
            cc.provider_reference,
            cc.sent_at,
            cc.error_details,
            cc.created_at,
            cc.payment_id,
            cc.form_request_id,
            cc.customer_package_id,

            c.first_name,
            c.last_name,

            CASE
              WHEN a.booking_kind = 'consultation'
                THEN 'Consultation \xB7 ' || s.name
              ELSE s.name
            END AS service_name,
            a.start_at,

            p.amount_minor AS payment_amount_minor,
            p.currency AS payment_currency,

            cp.name_snapshot AS package_name,

            ct.name AS form_name

          FROM customer_communications cc

          LEFT JOIN customers c
            ON c.id =
               cc.customer_id

          LEFT JOIN appointments a
            ON a.id =
               cc.appointment_id

          LEFT JOIN services s
            ON s.id =
               a.service_id

          LEFT JOIN payments p
            ON p.id =
               cc.payment_id

          LEFT JOIN customer_packages cp
            ON cp.id =
               cc.customer_package_id

          LEFT JOIN clinical_form_requests cfr
            ON cfr.id =
               cc.form_request_id

          LEFT JOIN clinical_templates ct
            ON ct.id =
               cfr.template_id

          WHERE
            cc.business_id = ?

          ORDER BY
            datetime(
              COALESCE(
                cc.sent_at,
                cc.created_at
              )
            ) DESC

          LIMIT 200
        `).bind(t.business_id).all(),n=await gt(e,t.business_id);return Response.json({ok:!0,communications:i.results||[],settings:n})}catch(t){return console.error("Communications GET failed:",t),Response.json({ok:!1,error:"Unable to load communications."},{status:500})}}c($a,"onRequestGet");async function Ja({request:s,env:e}){try{let t=await Fa(s,e);if(!t)return Wa();let i=await s.json();if(i.action==="resend_aftercare"){let a=String(i.communication_id||"").trim();if(!a)return Response.json({ok:!1,error:"Communication id is required."},{status:400});let o=await e.DB.prepare(`
            SELECT
              id,
              appointment_id,
              communication_type,
              status,
              unique_key
            FROM customer_communications
            WHERE
              id = ?
              AND business_id = ?
            LIMIT 1
          `).bind(a,t.business_id).first();if(!o)return Response.json({ok:!1,error:"Communication not found."},{status:404});if(o.communication_type!=="treatment_aftercare")return Response.json({ok:!1,error:"Only treatment aftercare emails can be resent here."},{status:400});if(o.status!=="failed")return Response.json({ok:!1,error:"Only failed aftercare emails can be resent."},{status:409});if(!o.appointment_id)return Response.json({ok:!1,error:"This aftercare email is not linked to a booking."},{status:400});let u=await le({env:e,businessId:t.business_id,appointmentId:o.appointment_id,type:"treatment_aftercare",uniqueKey:o.unique_key||`treatment_aftercare:${o.appointment_id}`,baseUrl:new URL(s.url).origin});return u.ok?u.skipped?Response.json({ok:!1,error:u.reason==="no_email"?"The customer does not have an email address.":"Aftercare could not be resent for this booking."},{status:400}):Response.json({ok:!0,resent:!0,provider_id:u.provider_id||null}):Response.json({ok:!1,error:u.error||"Unable to resend aftercare email."},{status:502})}if(i.action!=="run_reminders")return Response.json({ok:!1,error:"Invalid communications action."},{status:400});let n=await is({env:e,businessId:t.business_id}),r=await as({env:e,businessId:t.business_id,baseUrl:new URL(s.url).origin});return Response.json({ok:!0,checked:Number(n.checked||0)+Number(r.checked||0),sent:Number(n.sent||0)+Number(r.sent||0),failed:Number(n.failed||0)+Number(r.failed||0),appointment_reminders:n,form_reminders:r})}catch(t){return console.error("Manual reminder run failed:",t),Response.json({ok:!1,error:"Unable to run reminders."},{status:500})}}c(Ja,"onRequestPost");async function Ni(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) >
            datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(Ni,"getUserContext");function Ti(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Ti,"unauthorized");function Ne(s){return Response.json({ok:!1,error:s},{status:400})}c(Ne,"badRequest");function Ga(){return Response.json({ok:!1,error:"Photo storage is not configured yet. Set up Photo & file storage from Eselram Setup Health, then try again."},{status:503})}c(Ga,"storageUnavailable");async function Dd(s){let e=new Uint8Array(await s.slice(0,16).arrayBuffer());return e.length>=3&&e[0]===255&&e[1]===216&&e[2]===255?"image/jpeg":e.length>=8&&e[0]===137&&e[1]===80&&e[2]===78&&e[3]===71&&e[4]===13&&e[5]===10&&e[6]===26&&e[7]===10?"image/png":e.length>=12&&e[0]===82&&e[1]===73&&e[2]===70&&e[3]===70&&e[8]===87&&e[9]===69&&e[10]===66&&e[11]===80?"image/webp":null}c(Dd,"detectImageMime");async function Ya({env:s,businessId:e,photoId:t}){return await s.DB.prepare(`
      SELECT
        p.*,
        s.name AS service_name,
        a.start_at AS appointment_start_at

      FROM customer_photos p

      LEFT JOIN services s
        ON s.id = p.service_id

      LEFT JOIN appointments a
        ON a.id = p.appointment_id

      WHERE
        p.id = ?
        AND p.business_id = ?

      LIMIT 1
    `).bind(t,e).first()}c(Ya,"getPhoto");async function Ka({request:s,env:e}){try{let t=await Ni(s,e);if(!t)return Ti();let i=new URL(s.url),n=String(i.searchParams.get("photo_id")||"").trim(),r=String(i.searchParams.get("customer_id")||"").trim(),a=i.searchParams.get("content")==="1";if(n&&a){if(!e.FORM_UPLOADS)return Ga();let d=await Ya({env:e,businessId:t.business_id,photoId:n});if(!d)return new Response("Photo not found",{status:404});let l=await e.FORM_UPLOADS.get(d.storage_key);if(!l)return new Response("Stored photo not found",{status:404});let p=new Headers;return p.set("Content-Type",d.mime_type||l.httpMetadata?.contentType||"application/octet-stream"),p.set("Cache-Control","private, max-age=300"),p.set("Content-Disposition",`inline; filename="${String(d.original_name||"photo").replaceAll('"',"")}"`),new Response(l.body,{headers:p})}if(!r)return Ne("customer_id is required.");if(!await e.DB.prepare(`
          SELECT id
          FROM customers
          WHERE
            id = ?
            AND business_id = ?
          LIMIT 1
        `).bind(r,t.business_id).first())return Response.json({ok:!1,error:"Customer not found."},{status:404});let u=await e.DB.prepare(`
          SELECT
            p.id,
            p.customer_id,
            p.appointment_id,
            p.service_id,
            p.treatment_record_id,
            p.photo_type,
            p.original_name,
            p.mime_type,
            p.size_bytes,
            p.taken_at,
            p.notes,
            p.created_at,

            s.name AS service_name,
            a.start_at AS appointment_start_at

          FROM customer_photos p

          LEFT JOIN services s
            ON s.id =
               p.service_id

          LEFT JOIN appointments a
            ON a.id =
               p.appointment_id

          WHERE
            p.business_id = ?
            AND p.customer_id = ?

          ORDER BY
            COALESCE(
              p.taken_at,
              p.created_at
            ) DESC
        `).bind(t.business_id,r).all();return Response.json({ok:!0,photos:(u.results||[]).map(d=>({...d,content_url:`/api/customer-photos?photo_id=${encodeURIComponent(d.id)}&content=1`}))})}catch(t){return console.error("Customer photos GET failed:",t),Response.json({ok:!1,error:"Unable to load customer photos."},{status:500})}}c(Ka,"onRequestGet");async function za({request:s,env:e}){try{let t=await Ni(s,e);if(!t)return Ti();if(!e.FORM_UPLOADS)return Ga();let i=await s.formData(),n=String(i.get("customer_id")||"").trim(),r=String(i.get("appointment_id")||"").trim()||null,a=String(i.get("treatment_record_id")||"").trim()||null,o=String(i.get("photo_type")||"other").trim(),u=String(i.get("taken_at")||"").trim()||null,d=String(i.get("notes")||"").trim().slice(0,1e3)||null,l=i.get("photo"),p=["before","after","progress","consultation","patch_test","other"];if(!n)return Ne("Customer is required.");if(!p.includes(o))return Ne("Invalid photo type.");if(!l||typeof l.arrayBuffer!="function")return Ne("Choose a photo to upload.");if(l.size<=0)return Ne("The selected photo is empty.");if(l.size>10*1024*1024)return Ne("Photo must be 10 MB or smaller after optimisation.");let m=["image/jpeg","image/png","image/webp"],_=await Dd(l);if(!_||!m.includes(_))return Ne("Photo content must be a genuine JPG, PNG or WebP image.");if(l.type&&!m.includes(l.type))return Ne("Photo must be JPG, PNG or WebP.");let g=_;if(!await e.DB.prepare(`
          SELECT id
          FROM customers
          WHERE
            id = ?
            AND business_id = ?
          LIMIT 1
        `).bind(n,t.business_id).first())return Ne("Customer not found.");let f=null;if(r){let S=await e.DB.prepare(`
            SELECT
              id,
              customer_id,
              service_id

            FROM appointments

            WHERE
              id = ?
              AND business_id = ?

            LIMIT 1
          `).bind(r,t.business_id).first();if(!S||S.customer_id!==n)return Ne("Appointment does not belong to this customer.");f=S.service_id||null}if(a){let S=await e.DB.prepare(`
            SELECT
              id,
              customer_id,
              appointment_id,
              service_id

            FROM treatment_records

            WHERE
              id = ?
              AND business_id = ?

            LIMIT 1
          `).bind(a,t.business_id).first();if(!S||S.customer_id!==n)return Ne("Treatment record does not belong to this customer.");if(r&&S.appointment_id&&S.appointment_id!==r)return Ne("The selected appointment and treatment record are unrelated. Choose matching records.");if(f&&S.service_id&&f!==S.service_id)return Ne("The selected appointment and treatment record belong to different services.");!r&&S.appointment_id&&(r=S.appointment_id),f=S.service_id||f}let b=String(l.name||"photo").replace(/[^a-zA-Z0-9._-]+/g,"_").slice(0,100),N=`cph_${crypto.randomUUID()}`,v=`${t.business_id}/customer-photos/${n}/${N}-${b}`;await e.FORM_UPLOADS.put(v,await l.arrayBuffer(),{httpMetadata:{contentType:g}});try{await e.DB.prepare(`
          INSERT INTO customer_photos (
            id,
            business_id,
            customer_id,
            appointment_id,
            service_id,
            treatment_record_id,
            photo_type,
            storage_provider,
            storage_key,
            original_name,
            mime_type,
            size_bytes,
            taken_at,
            notes,
            uploaded_by_user_id
          )
          VALUES (
            ?, ?, ?, ?, ?, ?,
            ?,
            'r2',
            ?, ?, ?, ?,
            ?, ?, ?
          )
        `).bind(N,t.business_id,n,r,f,a,o,v,l.name||b,g,l.size,u,d,t.user_id).run()}catch(S){throw await e.FORM_UPLOADS.delete(v),S}return Response.json({ok:!0,photo_id:N})}catch(t){return console.error("Customer photo upload failed:",t),Response.json({ok:!1,error:"Unable to upload customer photo."},{status:500})}}c(za,"onRequestPost");async function Va({request:s,env:e}){try{let t=await Ni(s,e);if(!t)return Ti();let i=await s.json(),n=String(i.photo_id||"").trim();if(!n)return Ne("photo_id is required.");let r=await Ya({env:e,businessId:t.business_id,photoId:n});return r?(e.FORM_UPLOADS&&r.storage_key&&(await Es({env:e,businessId:t.business_id,originalKey:r.storage_key,sourceType:"customer_photo",sourceId:n,originalName:r.original_name||null,mimeType:r.mime_type||null,sizeBytes:r.size_bytes||null,reason:"customer_photo_delete",sourceMetadata:{id:r.id,customer_id:r.customer_id,appointment_id:r.appointment_id||null,service_id:r.service_id||null,treatment_record_id:r.treatment_record_id||null,photo_type:r.photo_type||"other",storage_provider:r.storage_provider||"r2",storage_key:r.storage_key,original_name:r.original_name||null,mime_type:r.mime_type||"application/octet-stream",size_bytes:Number(r.size_bytes||0),taken_at:r.taken_at||null,notes:r.notes||null,uploaded_by_user_id:r.uploaded_by_user_id||null,created_at:r.created_at||null,updated_at:r.updated_at||null}}),await e.FORM_UPLOADS.delete(r.storage_key)),await e.DB.prepare(`
        DELETE FROM customer_photos
        WHERE id = ? AND business_id = ?
      `).bind(n,t.business_id).run(),Response.json({ok:!0})):Response.json({ok:!1,error:"Photo not found."},{status:404})}catch(t){return console.error("Customer photo delete failed:",t),Response.json({ok:!1,error:"Unable to delete customer photo."},{status:500})}}c(Va,"onRequestDelete");async function Ns(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at)
            > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(Ns,"getUserContext");function Ts(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Ts,"unauthorized");function Rs(s){return Response.json({ok:!1,error:s},{status:400})}c(Rs,"badRequest");function Ai(s){return Response.json({ok:!1,error:s},{status:404})}c(Ai,"notFound");async function Xa({request:s,env:e}){try{let t=await Ns(s,e);if(!t)return Ts();await ms({env:e,businessId:t.business_id,baseUrl:new URL(s.url).origin}),await ps(e,t.business_id),await ue(e,t.business_id);let i=new URL(s.url),n=String(i.searchParams.get("id")||"").trim();if(n){let a=await e.DB.prepare(`
            SELECT
              c.id,
              c.first_name,
              c.last_name,
              c.email,
              c.phone,
              c.notes,
              c.marketing_consent,
              c.created_at,
              c.updated_at,

              (
                SELECT COUNT(*)

                FROM appointments a

                WHERE
                  a.customer_id = c.id
                  AND a.business_id = c.business_id
                  AND a.status = 'completed'
              ) AS visit_count,

              (
                SELECT COUNT(*)

                FROM appointments a

                WHERE
                  a.customer_id = c.id
                  AND a.business_id = c.business_id
                  AND a.status != 'cancelled'
                  AND datetime(a.start_at)
                      >= datetime('now')
              ) AS upcoming_count,

              (
                SELECT COALESCE(
                  SUM(p.amount_minor),
                  0
                )

                FROM payments p

                WHERE
                  p.customer_id = c.id
                  AND p.business_id = c.business_id
                  AND p.status = 'paid'
                  AND p.payment_type != 'refund'
                AND COALESCE(p.payment_method, '') != 'discount'
              ) AS total_paid_minor

            FROM customers c

            WHERE
              c.id = ?
              AND c.business_id = ?

            LIMIT 1
          `).bind(n,t.business_id).first();if(!a)return Ai("Customer not found.");let o=await e.DB.prepare(`
            SELECT
              a.id,
              a.status,
              a.start_at,
              a.end_at,
              a.price_minor,
              a.deposit_due_minor,
              a.booking_kind,
              s.id AS service_id,
              s.name AS service_name,

              cp.id AS customer_package_id,
              cp.name_snapshot AS package_name,
              cp.sessions_total AS package_sessions_total

            FROM appointments a

            JOIN services s
              ON s.id =
                 a.service_id

            LEFT JOIN customer_package_appointments cpa
              ON cpa.appointment_id =
                 a.id

            LEFT JOIN customer_packages cp
              ON cp.id =
                 cpa.customer_package_id
              AND cp.business_id =
                  a.business_id

            WHERE
              a.customer_id = ?
              AND a.business_id = ?
              AND a.status IN (
                'pending',
                'confirmed'
              )
              AND datetime(a.start_at)
                  >= datetime('now')

            ORDER BY
              datetime(a.start_at) ASC

            LIMIT 20
          `).bind(n,t.business_id).all(),u=await e.DB.prepare(`
            SELECT
              a.id,
              a.status,
              a.start_at,
              a.end_at,
              a.price_minor,
              a.deposit_due_minor,
              a.booking_kind,
              s.id AS service_id,
              s.name AS service_name,

              cp.id AS customer_package_id,
              cp.name_snapshot AS package_name,
              cp.sessions_total AS package_sessions_total

            FROM appointments a

            JOIN services s
              ON s.id =
                 a.service_id

            LEFT JOIN customer_package_appointments cpa
              ON cpa.appointment_id =
                 a.id

            LEFT JOIN customer_packages cp
              ON cp.id =
                 cpa.customer_package_id
              AND cp.business_id =
                  a.business_id

            WHERE
              a.customer_id = ?
              AND a.business_id = ?
              AND (
                a.status IN (
                  'completed',
                  'cancelled',
                  'no_show'
                )
                OR (
                  a.status IN (
                    'pending',
                    'confirmed'
                  )
                  AND datetime(a.start_at)
                      < datetime('now')
                )
              )

            ORDER BY
              datetime(a.start_at) DESC

            LIMIT 50
          `).bind(n,t.business_id).all(),[d,l,p,m,_]=await Promise.all([e.DB.prepare(`
              SELECT
                cs.id,
                cs.template_id,
                cs.appointment_id,
                cs.status,
                cs.submitted_by,
                cs.submitted_at,
                cs.reviewed_at,

                ct.name AS template_name,
                ct.template_type,
                ct.is_client_sendable,

                a.start_at AS appointment_start_at,
                sv.name AS service_name

              FROM clinical_form_submissions cs

              JOIN clinical_templates ct
                ON ct.id =
                   cs.template_id

              LEFT JOIN appointments a
                ON a.id =
                   cs.appointment_id

              LEFT JOIN services sv
                ON sv.id =
                   a.service_id

              WHERE
                cs.business_id = ?
                AND cs.customer_id = ?

              ORDER BY
                datetime(
                  cs.submitted_at
                ) DESC
            `).bind(t.business_id,n).all(),e.DB.prepare(`
              SELECT
                tr.id,
                tr.appointment_id,
                tr.service_id,
                tr.status,
                tr.treatment_date,
                tr.practitioner_name,
                tr.treatment_area,
                tr.device_name,
                tr.next_treatment_date,
                tr.created_at,

                s.name AS service_name,
                a.start_at AS appointment_start_at

              FROM treatment_records tr

              LEFT JOIN services s
                ON s.id =
                   tr.service_id

              LEFT JOIN appointments a
                ON a.id =
                   tr.appointment_id

              WHERE
                tr.business_id = ?
                AND tr.customer_id = ?

              ORDER BY
                date(
                  tr.treatment_date
                ) DESC,
                datetime(
                  tr.created_at
                ) DESC
            `).bind(t.business_id,n).all(),e.DB.prepare(`
              SELECT
                r.id,
                r.template_id,
                r.appointment_id,
                r.status,
                r.created_at,
                r.opened_at,
                r.submitted_at,
                r.email_status,
                r.request_token,

                t.name AS template_name,
                t.template_type,

                a.start_at AS appointment_start_at,
                s.name AS service_name

              FROM clinical_form_requests r

              JOIN clinical_templates t
                ON t.id =
                   r.template_id

              LEFT JOIN appointments a
                ON a.id =
                   r.appointment_id

              LEFT JOIN services s
                ON s.id =
                   a.service_id

              WHERE
                r.business_id = ?
                AND r.customer_id = ?

              ORDER BY
                datetime(
                  r.created_at
                ) DESC
            `).bind(t.business_id,n).all(),e.DB.prepare(`
              SELECT
                p.id,
                p.appointment_id,
                p.service_id,
                p.treatment_record_id,
                p.photo_type,
                p.original_name,
                p.mime_type,
                p.size_bytes,
                p.taken_at,
                p.notes,
                p.created_at,

                s.name AS service_name,
                a.start_at AS appointment_start_at

              FROM customer_photos p

              LEFT JOIN services s
                ON s.id =
                   p.service_id

              LEFT JOIN appointments a
                ON a.id =
                   p.appointment_id

              WHERE
                p.business_id = ?
                AND p.customer_id = ?

              ORDER BY
                COALESCE(
                  p.taken_at,
                  p.created_at
                ) DESC
            `).bind(t.business_id,n).all(),e.DB.prepare(`
              SELECT
                p.id,
                p.appointment_id,
                p.payment_type,
                p.amount_minor,
                p.currency,
                p.status,
                p.created_at,

                s.name AS service_name,
                s.requires_consultation AS service_requires_consultation,
                a.booking_kind AS appointment_booking_kind,
                a.start_at AS appointment_start_at,

                CASE
                  WHEN a.id IS NULL
                    THEN 0
                  ELSE MAX(
                    0,
                    COALESCE(a.price_minor, 0)
                    - COALESCE(a.consultation_credit_minor, 0)
                    - COALESCE(
                        (
                          SELECT SUM(
                            CASE
                              WHEN ap.payment_type = 'refund'
                                   AND ap.status = 'paid'
                                THEN -ABS(ap.amount_minor)
                              WHEN ap.payment_type != 'refund'
                                   AND ap.status IN (
                                     'paid',
                                     'partially_refunded',
                                     'refunded'
                                   )
                                THEN ABS(ap.amount_minor)
                              ELSE 0
                            END
                          )
                          FROM payments ap
                          WHERE
                            ap.business_id = a.business_id
                            AND ap.appointment_id = a.id
                        ),
                        0
                      )
                  )
                END AS appointment_outstanding_minor,

                cp.id AS customer_package_id,
                cp.name_snapshot AS package_name,
                cp.service_id AS package_service_id,
                ps.name AS package_service_name

              FROM payments p

              LEFT JOIN appointments a
                ON a.id =
                   p.appointment_id

              LEFT JOIN services s
                ON s.id =
                   a.service_id

              LEFT JOIN customer_package_payments cpp
                ON cpp.payment_id =
                   p.id

              LEFT JOIN customer_packages cp
                ON cp.id =
                   cpp.customer_package_id

              LEFT JOIN services ps
                ON ps.id =
                   cp.service_id

              WHERE
                p.business_id = ?
                AND p.customer_id = ?
                AND NOT (
                  p.provider = 'stripe'
                  AND p.status IN ('pending', 'failed')
                  AND EXISTS (
                    SELECT 1
                    FROM package_sales ps_public_checkout
                    WHERE ps_public_checkout.payment_id = p.id
                      AND ps_public_checkout.business_id = p.business_id
                      AND ps_public_checkout.source = 'public'
                      AND ps_public_checkout.status IN ('pending', 'failed')
                  )
                )

              ORDER BY
                datetime(
                  p.created_at
                ) DESC
            `).bind(t.business_id,n).all()]),g=(m.results||[]).map(y=>({...y,content_url:`/api/customer-photos?photo_id=${encodeURIComponent(y.id)}&content=1`})),E=d.results||[],f=l.results||[],b=p.results||[],N=_.results||[],S=(await e.DB.prepare(`
            SELECT
              cc.id,
              cc.communication_type,
              cc.recipient,
              cc.subject,
              cc.status,
              cc.sent_at,
              cc.created_at,
              cc.error_details,

              a.start_at AS appointment_start_at,
              s.name AS service_name,
              cp.name_snapshot AS package_name,
              ct.name AS form_name

            FROM customer_communications cc

            LEFT JOIN appointments a
              ON a.id =
                 cc.appointment_id

            LEFT JOIN services s
              ON s.id =
                 a.service_id

            LEFT JOIN customer_packages cp
              ON cp.id =
                 cc.customer_package_id

            LEFT JOIN clinical_form_requests cfr
              ON cfr.id =
                 cc.form_request_id

            LEFT JOIN clinical_templates ct
              ON ct.id =
                 cfr.template_id

            WHERE
              cc.business_id = ?
              AND cc.customer_id = ?

            ORDER BY
              datetime(
                COALESCE(
                  cc.sent_at,
                  cc.created_at
                )
              ) DESC

            LIMIT 50
          `).bind(t.business_id,n).all()).results||[],h=await e.DB.prepare(`
            SELECT
              cp.id,
              cp.name_snapshot,
              cp.service_id,
              cp.sessions_total,
              cp.price_minor,
              cp.status,
              cp.starts_on,
              cp.expires_on,
              cp.created_at,

              s.name AS service_name,

              (
                SELECT COUNT(*)
                FROM customer_package_appointments cpa
                JOIN appointments a
                  ON a.id =
                     cpa.appointment_id
                WHERE
                  cpa.customer_package_id =
                    cp.id
                  AND a.status =
                    'completed'
              ) AS sessions_completed,

              (
                SELECT COUNT(*)
                FROM customer_package_appointments cpa
                JOIN appointments a
                  ON a.id =
                     cpa.appointment_id
                WHERE
                  cpa.customer_package_id =
                    cp.id
                  AND a.status IN (
                    'confirmed',
                    'pending'
                  )
              ) AS sessions_booked,

              (
                SELECT COALESCE(
                  SUM(
                    CASE
                      WHEN p.payment_type = 'refund' AND p.status = 'paid'
                        THEN -ABS(p.amount_minor)
                      WHEN p.payment_type != 'refund'
                           AND p.status IN ('paid', 'partially_refunded', 'refunded')
                        THEN ABS(p.amount_minor)
                      ELSE 0
                    END
                  ),
                  0
                )
                FROM customer_package_payments cpp
                JOIN payments p
                  ON p.id =
                     cpp.payment_id
                WHERE
                  cpp.customer_package_id =
                    cp.id
              ) AS paid_minor,

              (
                SELECT COALESCE(
                  SUM(ps.consultation_credit_minor),
                  0
                )
                FROM package_sales ps
                WHERE
                  ps.business_id = cp.business_id
                  AND ps.customer_package_id = cp.id
                  AND ps.status = 'paid'
              ) AS consultation_credit_minor

            FROM customer_packages cp

            JOIN services s
              ON s.id =
                 cp.service_id

            WHERE
              cp.business_id = ?
              AND cp.customer_id = ?

            ORDER BY
              CASE cp.status
                WHEN 'active' THEN 0
                WHEN 'completed' THEN 1
                ELSE 2
              END,
              datetime(cp.created_at) DESC
          `).bind(t.business_id,n).all(),I=await e.DB.prepare(`
            SELECT
              cpa.customer_package_id,

              a.id AS appointment_id,
              a.status,
              a.start_at,
              a.end_at,
              a.price_minor,
              a.deposit_due_minor,

              s.name AS service_name

            FROM customer_package_appointments cpa

            JOIN customer_packages cp
              ON cp.id =
                 cpa.customer_package_id

            JOIN appointments a
              ON a.id =
                 cpa.appointment_id

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              cp.business_id = ?
              AND cp.customer_id = ?

            ORDER BY
              datetime(a.start_at) ASC
          `).bind(t.business_id,n).all(),R=(h.results||[]).map(y=>({...y,sessions_completed:Number(y.sessions_completed||0),sessions_booked:Number(y.sessions_booked||0),sessions_available_to_book:Math.max(Number(y.sessions_total||0)-Number(y.sessions_completed||0)-Number(y.sessions_booked||0),0),paid_minor:Number(y.paid_minor||0),consultation_credit_minor:Number(y.consultation_credit_minor||0),credited_paid_minor:Number(y.paid_minor||0)+Number(y.consultation_credit_minor||0),outstanding_minor:Math.max(Number(y.price_minor||0)-Number(y.paid_minor||0)-Number(y.consultation_credit_minor||0),0)})),L={};for(let y of I.results||[])L[y.customer_package_id]||(L[y.customer_package_id]=[]),L[y.customer_package_id].push(y);for(let y of R){let F=L[y.id]||[];y.sessions=F.map((Z,oe)=>({...Z,session_number:oe+1}))}let T=[];for(let y of N.filter(F=>F.status!=="failed"))T.push({id:`payment:${y.id}`,event_type:"payment",event_date:y.created_at,title:y.customer_package_id?`Package payment \xB7 ${y.package_name||"Package"}`:y.appointment_booking_kind==="consultation"&&y.service_name?`Consultation \xB7 ${y.service_name}`:y.service_name||"Customer payment",subtitle:y.status,amount_minor:Number(y.amount_minor||0),payment_type:y.payment_type,appointment_booking_kind:y.appointment_booking_kind||null,appointment_id:y.appointment_id||null,customer_package_id:y.customer_package_id||null,service_name:y.package_service_name||y.service_name||null});for(let y of[...o.results||[],...u.results||[]]){let F=null;y.customer_package_id&&(F=R.find(H=>H.id===y.customer_package_id)?.sessions?.find(H=>H.appointment_id===y.id)?.session_number||null),T.push({id:`appointment:${y.id}`,event_type:y.customer_package_id?"package_session":"appointment",event_date:y.start_at,title:y.customer_package_id?`${y.package_name||y.service_name||"Package"}${F?` \xB7 Session ${F}/${y.package_sessions_total}`:""}`:y.booking_kind==="consultation"?`Consultation \xB7 ${y.service_name||"Appointment"}`:y.service_name||"Appointment",subtitle:y.status,booking_kind:y.booking_kind||"service",appointment_id:y.id,customer_package_id:y.customer_package_id||null,service_name:y.service_name||null,package_name:y.package_name||null,session_number:F})}for(let y of b.filter(F=>["created","opened"].includes(F.status)))T.push({id:`form_request:${y.id}`,event_type:"form_request",event_date:y.opened_at||y.created_at,title:y.template_name||"Client form",subtitle:y.status==="opened"?"opened":"outstanding",appointment_id:y.appointment_id||null,service_name:y.service_name||null});for(let y of E)T.push({id:`clinical:${y.id}`,event_type:y.template_type==="patch_test"?"patch_test":y.is_client_sendable===1?"client_form":"clinical_record",event_date:y.submitted_at,title:y.template_name||"Clinical form",subtitle:y.status,record_id:y.id,appointment_id:y.appointment_id||null,service_name:y.service_name||null});for(let y of f)T.push({id:`treatment:${y.id}`,event_type:"treatment_record",event_date:y.treatment_date||y.created_at,title:y.service_name?`${y.service_name} treatment`:"Treatment record",subtitle:y.status,record_id:y.id,appointment_id:y.appointment_id||null,service_name:y.service_name||null});for(let y of g)T.push({id:`photo:${y.id}`,event_type:"photo",event_date:y.taken_at||y.created_at,title:`${y.photo_type.replaceAll("_"," ")} photo`,subtitle:y.service_name||"Customer photo",photo_id:y.id,content_url:y.content_url,appointment_id:y.appointment_id||null,service_name:y.service_name||null});for(let y of R)T.push({id:`package:${y.id}`,event_type:"package",event_date:y.starts_on||y.created_at,title:y.name_snapshot,subtitle:y.status,service_name:y.service_name||null});T.sort((y,F)=>String(F.event_date||"").localeCompare(String(y.event_date||"")));let O=await e.DB.prepare(`
            SELECT
              id AS appointment_id,
              consultation_credit_minor
            FROM appointments
            WHERE
              business_id = ?
              AND customer_id = ?
              AND consultation_credit_minor > 0
          `).bind(t.business_id,n).all(),w=Object.fromEntries((O.results||[]).map(y=>[y.appointment_id,Number(y.consultation_credit_minor||0)])),B=R.reduce((y,F)=>y+Number(F.status==="active"&&F.outstanding_minor||0),0),j=[...o.results||[],...u.results||[]].filter(y=>!y.customer_package_id&&y.status!=="cancelled").reduce((y,F)=>{let oe=N.filter(H=>H.appointment_id===F.id).reduce((H,z)=>{let Y=Math.abs(Number(z.amount_minor||0));return z.payment_type==="refund"&&z.status==="paid"?H-Y:z.payment_type!=="refund"&&["paid","partially_refunded","refunded"].includes(z.status)?H+Y:H},0);return y+Math.max(Number(F.price_minor||0)-oe-Number(w[F.id]||0),0)},0);return Response.json({ok:!0,customer:{...a,upcoming_bookings:o.results||[],booking_history:u.results||[],clinical_records:E,treatment_records:f,form_requests:b,photos:g,payments:N,communications:S,packages:R,financial_summary:{total_paid_minor:Number(a.total_paid_minor||0),package_outstanding_minor:B,appointment_outstanding_minor:j,total_outstanding_minor:B+j},timeline:T,record_counts:{clinical:E.length,treatments:f.length,photos:g.length,forms_outstanding:b.filter(y=>["created","opened"].includes(y.status)).length}}})}let r=await e.DB.prepare(`
          SELECT
            c.id,
            c.first_name,
            c.last_name,
            c.email,
            c.phone,
            c.notes,
            c.marketing_consent,
            c.created_at,
            c.updated_at,

            (
              SELECT COUNT(*)

              FROM appointments a

              WHERE
                a.customer_id = c.id
                AND a.business_id = c.business_id
                AND a.status = 'completed'
            ) AS visit_count,

            (
              SELECT COALESCE(
                SUM(p.amount_minor),
                0
              )

              FROM payments p

              WHERE
                p.customer_id = c.id
                AND p.business_id = c.business_id
                AND p.status = 'paid'
                AND p.payment_type != 'refund'
                AND COALESCE(p.payment_method, '') != 'discount'
            ) AS total_paid_minor

          FROM customers c

          WHERE
            c.business_id = ?
            AND NOT (
              -- Hide a brand-new customer that exists only because an unpaid
              -- public Stripe checkout is still provisional/abandoned.
              EXISTS (
                SELECT 1
                FROM appointments ap
                WHERE
                  ap.customer_id = c.id
                  AND ap.business_id = c.business_id
                  AND ap.booking_source = 'online'
                  AND ap.status IN ('pending', 'cancelled')
                  AND ABS(
                    (julianday(ap.created_at) - julianday(c.created_at)) * 86400
                  ) <= 120
                  AND NOT EXISTS (
                    SELECT 1
                    FROM payments pp
                    WHERE
                      pp.appointment_id = ap.id
                      AND pp.business_id = ap.business_id
                      AND pp.status IN ('paid', 'partially_refunded', 'refunded')
                      AND pp.payment_type != 'refund'
                  )
                  AND (
                    ap.status = 'pending'
                    OR ap.cancellation_reason IN (
                      'Online booking payment was not completed',
                      'Customer left online payment before completion',
                      'Online payment could not be started',
                      'Online booking could not be completed'
                    )
                    OR EXISTS (
                      SELECT 1
                      FROM payments ps
                      WHERE
                        ps.appointment_id = ap.id
                        AND ps.business_id = ap.business_id
                        AND ps.provider = 'stripe'
                        AND ps.status IN ('pending', 'failed')
                    )
                  )
              )
              AND NOT EXISTS (
                SELECT 1
                FROM appointments ar
                WHERE
                  ar.customer_id = c.id
                  AND ar.business_id = c.business_id
                  AND (
                    ar.booking_source != 'online'
                    OR ar.status NOT IN ('pending', 'cancelled')
                    OR EXISTS (
                      SELECT 1
                      FROM payments pr
                      WHERE
                        pr.appointment_id = ar.id
                        AND pr.business_id = ar.business_id
                        AND pr.status IN ('paid', 'partially_refunded', 'refunded')
                        AND pr.payment_type != 'refund'
                    )
                  )
              )
              AND NOT EXISTS (
                SELECT 1
                FROM payments pc
                WHERE
                  pc.customer_id = c.id
                  AND pc.business_id = c.business_id
                  AND pc.status IN ('paid', 'partially_refunded', 'refunded')
                  AND pc.payment_type != 'refund'
              )
            )

          ORDER BY
            c.last_name COLLATE NOCASE,
            c.first_name COLLATE NOCASE
        `).bind(t.business_id).all();return Response.json({ok:!0,customers:r.results||[]})}catch(t){return console.error("Customers GET failed:",t),Response.json({ok:!1,error:"Unable to load customers."},{status:500})}}c(Xa,"onRequestGet");async function Za({request:s,env:e}){try{let t=await Ns(s,e);if(!t)return Ts();let i=await s.json(),n=String(i.first_name||"").trim(),r=String(i.last_name||"").trim(),a=String(i.email||"").trim(),o=String(i.phone||"").trim(),u=String(i.notes||"").trim(),d=i.marketing_consent===1?1:0;if(!n||!r)return Rs("First and last name are required.");if(a){let p=await e.DB.prepare(`
            SELECT id

            FROM customers

            WHERE
              business_id = ?
              AND lower(email) =
                  lower(?)

            LIMIT 1
          `).bind(t.business_id,a).first();if(p)return Response.json({ok:!1,error:"A customer with this email address already exists.",customer_id:p.id},{status:409})}let l=`cus_${crypto.randomUUID()}`;return await e.DB.prepare(`
        INSERT INTO customers (
          id,
          business_id,
          first_name,
          last_name,
          email,
          phone,
          notes,
          marketing_consent
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).bind(l,t.business_id,n,r,a||null,o||null,u||null,d).run(),Response.json({ok:!0,customer:{id:l}})}catch(t){return console.error("Customer creation failed:",t),Response.json({ok:!1,error:"Unable to create customer."},{status:500})}}c(Za,"onRequestPost");async function Qa({request:s,env:e}){try{let t=await Ns(s,e);if(!t)return Ts();let i=await s.json(),n=String(i.id||"").trim(),r=String(i.first_name||"").trim(),a=String(i.last_name||"").trim(),o=String(i.email||"").trim(),u=String(i.phone||"").trim(),d=String(i.notes||"").trim(),l=i.marketing_consent===1?1:0;return n?!r||!a?Rs("First and last name are required."):await e.DB.prepare(`
          SELECT id

          FROM customers

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `).bind(n,t.business_id).first()?o&&await e.DB.prepare(`
            SELECT id

            FROM customers

            WHERE
              business_id = ?
              AND lower(email) =
                  lower(?)
              AND id != ?

            LIMIT 1
          `).bind(t.business_id,o,n).first()?Response.json({ok:!1,error:"Another customer already uses this email address."},{status:409}):(await e.DB.prepare(`
        UPDATE customers

        SET
          first_name = ?,
          last_name = ?,
          email = ?,
          phone = ?,
          notes = ?,
          marketing_consent = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `).bind(r,a,o||null,u||null,d||null,l,n,t.business_id).run(),Response.json({ok:!0})):Ai("Customer not found."):Rs("Customer id is required.")}catch(t){return console.error("Customer update failed:",t),Response.json({ok:!1,error:"Unable to update customer."},{status:500})}}c(Qa,"onRequestPut");async function eo({request:s,env:e}){try{let t=await Ns(s,e);if(!t)return Ts();let i=new URL(s.url),n=String(i.searchParams.get("id")||"").trim();if(!n)return Rs("Customer id is required.");if(!await e.DB.prepare(`
          SELECT id
          FROM customers
          WHERE
            id = ?
            AND business_id = ?
          LIMIT 1
        `).bind(n,t.business_id).first())return Ai("Customer not found.");let a=await e.DB.prepare(`
          SELECT
            (SELECT COUNT(*)
             FROM appointments
             WHERE business_id = ?
               AND customer_id = ?) AS appointments,

            (SELECT COUNT(*)
             FROM payments
             WHERE business_id = ?
               AND customer_id = ?) AS payments,

            (SELECT COUNT(*)
             FROM customer_packages
             WHERE business_id = ?
               AND customer_id = ?) AS packages,

            (SELECT COUNT(*)
             FROM package_sales
             WHERE business_id = ?
               AND customer_id = ?) AS package_sales,

            (SELECT COUNT(*)
             FROM clinical_form_requests
             WHERE business_id = ?
               AND customer_id = ?) AS form_requests,

            (SELECT COUNT(*)
             FROM clinical_form_submissions
             WHERE business_id = ?
               AND customer_id = ?) AS form_submissions,

            (SELECT COUNT(*)
             FROM treatment_records
             WHERE business_id = ?
               AND customer_id = ?) AS treatment_records,

            (SELECT COUNT(*)
             FROM customer_photos
             WHERE business_id = ?
               AND customer_id = ?) AS photos
        `).bind(t.business_id,n,t.business_id,n,t.business_id,n,t.business_id,n,t.business_id,n,t.business_id,n,t.business_id,n,t.business_id,n).first();return Object.values(a||{}).some(u=>Number(u||0)>0)?Response.json({ok:!1,error:"This customer cannot be deleted because they have booking, payment, package or clinical history. Keep the customer record for audit history instead."},{status:409}):(await e.DB.prepare(`
        DELETE FROM customers
        WHERE
          id = ?
          AND business_id = ?
      `).bind(n,t.business_id).run(),Response.json({ok:!0}))}catch(t){return console.error("Customer deletion failed:",t),Response.json({ok:!1,error:"Unable to delete customer."},{status:500})}}c(eo,"onRequestDelete");async function to({request:s,env:e}){try{let t=C(s);if(!t)return Response.json({ok:!1,authenticated:!1},{status:401});let i=await D(t),n=await e.DB.prepare(`
          SELECT
            u.id AS user_id,
            u.name AS user_name,
            u.email,
            u.business_id,

            b.name AS business_name,
            b.currency,
            b.timezone

          FROM user_sessions s

          JOIN users u
            ON u.id =
               s.user_id

          JOIN businesses b
            ON b.id =
               u.business_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(i).first();if(!n)return Response.json({ok:!1,authenticated:!1},{status:401});await ue(e,n.business_id);let[r,a,o,u,d,l,p,m,_]=await Promise.all([e.DB.prepare(`
            SELECT
              COUNT(*) AS count

            FROM appointments

            WHERE
              business_id = ?
              AND status != 'cancelled'
              AND NOT (booking_source = 'online' AND status = 'pending')
              AND date(start_at)
                  = date('now')
          `).bind(n.business_id).first(),e.DB.prepare(`
            SELECT
              COUNT(*) AS count

            FROM appointments

            WHERE
              business_id = ?
              AND status IN (
                'pending',
                'confirmed'
              )
              AND NOT (booking_source = 'online' AND status = 'pending')
              AND datetime(start_at)
                  >= datetime('now')
              AND datetime(start_at)
                  < datetime(
                    'now',
                    '+7 days'
                  )
          `).bind(n.business_id).first(),e.DB.prepare(`
            SELECT
              COUNT(*) AS count

            FROM customers c

            WHERE
              c.business_id = ?
              AND NOT (
                EXISTS (
                  SELECT 1
                  FROM appointments ap
                  WHERE
                    ap.customer_id = c.id
                    AND ap.business_id = c.business_id
                    AND ap.booking_source = 'online'
                    AND ap.status IN ('pending', 'cancelled')
                    AND ABS((julianday(ap.created_at) - julianday(c.created_at)) * 86400) <= 120
                    AND NOT EXISTS (
                      SELECT 1
                      FROM payments pp
                      WHERE
                        pp.appointment_id = ap.id
                        AND pp.business_id = ap.business_id
                        AND pp.status IN ('paid', 'partially_refunded', 'refunded')
                        AND pp.payment_type != 'refund'
                    )
                    AND (
                      ap.status = 'pending'
                      OR ap.cancellation_reason IN (
                        'Online booking payment was not completed',
                        'Customer left online payment before completion',
                        'Online payment could not be started',
                        'Online booking could not be completed'
                      )
                      OR EXISTS (
                        SELECT 1
                        FROM payments ps
                        WHERE
                          ps.appointment_id = ap.id
                          AND ps.business_id = ap.business_id
                          AND ps.provider = 'stripe'
                          AND ps.status IN ('pending', 'failed')
                      )
                    )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM appointments ar
                  WHERE
                    ar.customer_id = c.id
                    AND ar.business_id = c.business_id
                    AND (
                      ar.booking_source != 'online'
                      OR ar.status NOT IN ('pending', 'cancelled')
                      OR EXISTS (
                        SELECT 1
                        FROM payments pr
                        WHERE
                          pr.appointment_id = ar.id
                          AND pr.business_id = ar.business_id
                          AND pr.status IN ('paid', 'partially_refunded', 'refunded')
                          AND pr.payment_type != 'refund'
                      )
                    )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM payments pc
                  WHERE
                    pc.customer_id = c.id
                    AND pc.business_id = c.business_id
                    AND pc.status IN ('paid', 'partially_refunded', 'refunded')
                    AND pc.payment_type != 'refund'
                )
              )
          `).bind(n.business_id).first(),e.DB.prepare(`
            SELECT
              COUNT(*) AS count

            FROM customers c

            WHERE
              c.business_id = ?
              AND NOT (
                EXISTS (
                  SELECT 1
                  FROM appointments ap
                  WHERE
                    ap.customer_id = c.id
                    AND ap.business_id = c.business_id
                    AND ap.booking_source = 'online'
                    AND ap.status IN ('pending', 'cancelled')
                    AND ABS((julianday(ap.created_at) - julianday(c.created_at)) * 86400) <= 120
                    AND NOT EXISTS (
                      SELECT 1
                      FROM payments pp
                      WHERE
                        pp.appointment_id = ap.id
                        AND pp.business_id = ap.business_id
                        AND pp.status IN ('paid', 'partially_refunded', 'refunded')
                        AND pp.payment_type != 'refund'
                    )
                    AND (
                      ap.status = 'pending'
                      OR ap.cancellation_reason IN (
                        'Online booking payment was not completed',
                        'Customer left online payment before completion',
                        'Online payment could not be started',
                        'Online booking could not be completed'
                      )
                      OR EXISTS (
                        SELECT 1
                        FROM payments ps
                        WHERE
                          ps.appointment_id = ap.id
                          AND ps.business_id = ap.business_id
                          AND ps.provider = 'stripe'
                          AND ps.status IN ('pending', 'failed')
                      )
                    )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM appointments ar
                  WHERE
                    ar.customer_id = c.id
                    AND ar.business_id = c.business_id
                    AND (
                      ar.booking_source != 'online'
                      OR ar.status NOT IN ('pending', 'cancelled')
                      OR EXISTS (
                        SELECT 1
                        FROM payments pr
                        WHERE
                          pr.appointment_id = ar.id
                          AND pr.business_id = ar.business_id
                          AND pr.status IN ('paid', 'partially_refunded', 'refunded')
                          AND pr.payment_type != 'refund'
                      )
                    )
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM payments pc
                  WHERE
                    pc.customer_id = c.id
                    AND pc.business_id = c.business_id
                    AND pc.status IN ('paid', 'partially_refunded', 'refunded')
                    AND pc.payment_type != 'refund'
                )
              )
              AND strftime(
                '%Y-%m',
                c.created_at
              ) = strftime(
                '%Y-%m',
                'now'
              )
          `).bind(n.business_id).first(),e.DB.prepare(`
            SELECT
              COALESCE(
                SUM(amount_minor),
                0
              ) AS total

            FROM payments

            WHERE
              business_id = ?
              AND status = 'paid'
              AND payment_type != 'refund'
              AND strftime(
                '%Y-%m',
                COALESCE(
                  paid_at,
                  created_at
                )
              ) = strftime(
                '%Y-%m',
                'now'
              )
          `).bind(n.business_id).first(),e.DB.prepare(`
            SELECT
              COALESCE(
                SUM(
                  CASE
                    WHEN
                      a.price_minor -
                      COALESCE(
                        (
                          SELECT
                            SUM(
                              CASE
                                WHEN
                                  p.payment_type = 'refund'
                                THEN -p.amount_minor
                                ELSE p.amount_minor
                              END
                            )

                          FROM payments p

                          WHERE
                            p.appointment_id =
                              a.id
                            AND p.business_id =
                              a.business_id
                            AND p.status =
                              'paid'
                        ),
                        0
                      ) > 0
                    THEN
                      a.price_minor -
                      COALESCE(
                        (
                          SELECT
                            SUM(
                              CASE
                                WHEN
                                  p.payment_type = 'refund'
                                THEN -p.amount_minor
                                ELSE p.amount_minor
                              END
                            )

                          FROM payments p

                          WHERE
                            p.appointment_id =
                              a.id
                            AND p.business_id =
                              a.business_id
                            AND p.status =
                              'paid'
                        ),
                        0
                      )
                    ELSE 0
                  END
                ),
                0
              ) AS total

            FROM appointments a

            WHERE
              a.business_id = ?
              AND a.status != 'cancelled'
              AND NOT (a.booking_source = 'online' AND a.status = 'pending')
          `).bind(n.business_id).first(),e.DB.prepare(`
            SELECT
              a.id,
              a.start_at,
              a.end_at,
              a.status,
              a.price_minor,

              c.id AS customer_id,
              c.first_name,
              c.last_name,

              s.id AS service_id,
              CASE
                WHEN a.booking_kind = 'consultation'
                  THEN 'Consultation \xB7 ' || s.name
                ELSE s.name
              END AS service_name

            FROM appointments a

            JOIN customers c
              ON c.id =
                 a.customer_id

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              a.business_id = ?
              AND a.status !=
                  'cancelled'
              AND NOT (a.booking_source = 'online' AND a.status = 'pending')
              AND date(a.start_at)
                  = date('now')

            ORDER BY
              datetime(
                a.start_at
              ) ASC
          `).bind(n.business_id).all(),e.DB.prepare(`
            SELECT
              a.id,
              a.start_at,
              a.end_at,
              a.status,
              a.price_minor,

              c.id AS customer_id,
              c.first_name,
              c.last_name,

              s.id AS service_id,
              CASE
                WHEN a.booking_kind = 'consultation'
                  THEN 'Consultation \xB7 ' || s.name
                ELSE s.name
              END AS service_name

            FROM appointments a

            JOIN customers c
              ON c.id =
                 a.customer_id

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              a.business_id = ?
              AND a.status IN (
                'pending',
                'confirmed'
              )
              AND NOT (a.booking_source = 'online' AND a.status = 'pending')
              AND datetime(
                a.start_at
              ) >= datetime('now')

            ORDER BY
              datetime(
                a.start_at
              ) ASC

            LIMIT 6
          `).bind(n.business_id).all(),e.DB.prepare(`
            SELECT
              title,
              detail,
              occurred_at

            FROM (

              SELECT
                'Booking created' AS title,

                c.first_name ||
                ' ' ||
                c.last_name ||
                ' \xB7 ' ||
                CASE
                  WHEN a.booking_kind = 'consultation'
                    THEN 'Consultation \xB7 ' || s.name
                  ELSE s.name
                END AS detail,

                a.created_at AS occurred_at

              FROM appointments a

              JOIN customers c
                ON c.id =
                   a.customer_id

              JOIN services s
                ON s.id =
                   a.service_id

              WHERE
                a.business_id = ?
                AND NOT (a.booking_source = 'online' AND a.status = 'pending')


              UNION ALL


              SELECT
                'Customer added' AS title,

                c.first_name ||
                ' ' ||
                c.last_name AS detail,

                c.created_at AS occurred_at

              FROM customers c

              WHERE
                c.business_id = ?


              UNION ALL


              SELECT
                'Payment received' AS title,

                COALESCE(
                  c.first_name ||
                  ' ' ||
                  c.last_name,
                  'Customer'
                ) ||
                ' \xB7 ' ||
                printf(
                  '%.2f',
                  p.amount_minor /
                  100.0
                ) AS detail,

                COALESCE(
                  p.paid_at,
                  p.created_at
                ) AS occurred_at

              FROM payments p

              LEFT JOIN customers c
                ON c.id =
                   p.customer_id

              WHERE
                p.business_id = ?
                AND p.status =
                    'paid'
                AND p.payment_type !=
                    'refund'

            )

            ORDER BY
              datetime(
                occurred_at
              ) DESC

            LIMIT 8
          `).bind(n.business_id,n.business_id,n.business_id).all()]);return Response.json({ok:!0,user:{id:n.user_id,name:n.user_name,email:n.email},business:{id:n.business_id,name:n.business_name,currency:n.currency||"GBP",timezone:n.timezone||"Europe/London"},stats:{today_bookings:Number(r?.count||0),week_bookings:Number(a?.count||0),customers:Number(o?.count||0),new_customers_month:Number(u?.count||0),month_revenue_minor:Number(d?.total||0),outstanding_minor:Number(l?.total||0)},today_schedule:p.results||[],upcoming_appointments:m.results||[],recent_activity:_.results||[]},{headers:{"Cache-Control":"no-store"}})}catch(t){return console.error("Dashboard API failed:",t),Response.json({ok:!1,error:"Unable to load dashboard."},{status:500})}}c(to,"onRequestGet");function vd(s){try{return s?.source_metadata_json?JSON.parse(s.source_metadata_json):null}catch{return null}}c(vd,"parseMetadata");async function wi(s,e,t,i){return i&&(await s.DB.prepare(`SELECT id FROM ${e} WHERE id=? AND business_id=? LIMIT 1`).bind(i,t).first())?.id||null}c(wi,"optionalExistingId");async function Cd({env:s,businessId:e,row:t,metadata:i}){if(!i?.customer_id)throw new Error("This older recovery copy does not contain the customer-photo metadata required for a complete restore. Create a new protected copy after updating Eselram and try again.");if(!await s.DB.prepare("SELECT id FROM customers WHERE id=? AND business_id=? LIMIT 1").bind(i.customer_id,e).first())throw new Error("The customer record no longer exists. Recover the database to the matching point before restoring this file.");return{existing:!!await s.DB.prepare("SELECT id FROM customer_photos WHERE id=? AND business_id=? LIMIT 1").bind(i.id||t.source_id,e).first()}}c(Cd,"validateCustomerPhotoRestore");async function Od({env:s,businessId:e,row:t,metadata:i}){let n=i.id||t.source_id,r=await wi(s,"appointments",e,i.appointment_id),a=await wi(s,"services",e,i.service_id),o=await wi(s,"treatment_records",e,i.treatment_record_id),u=i.uploaded_by_user_id&&(await s.DB.prepare("SELECT id FROM users WHERE id=? AND business_id=? LIMIT 1").bind(i.uploaded_by_user_id,e).first())?.id||null;await s.DB.prepare(`
    INSERT OR IGNORE INTO customer_photos (
      id,business_id,customer_id,appointment_id,service_id,treatment_record_id,photo_type,storage_provider,storage_key,original_name,mime_type,size_bytes,taken_at,notes,uploaded_by_user_id,created_at,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(n,e,i.customer_id,r,a,o,i.photo_type||"other",i.storage_provider||"r2",t.original_key,i.original_name||t.original_name||null,i.mime_type||t.mime_type||"application/octet-stream",Number(i.size_bytes||t.size_bytes||0),i.taken_at||null,i.notes||null,u,i.created_at||new Date().toISOString(),i.updated_at||new Date().toISOString()).run()}c(Od,"restoreCustomerPhotoRecord");async function Id({env:s,businessId:e,row:t,metadata:i}){if(!i?.submission_id)throw new Error("This older recovery copy does not contain the clinical-upload metadata required for a complete restore.");if(!await s.DB.prepare("SELECT id FROM clinical_form_submissions WHERE id=? AND business_id=? LIMIT 1").bind(i.submission_id,e).first())throw new Error("The clinical record linked to this upload no longer exists. Recover the database to the matching point first, then restore the file if required.");return{existing:!!await s.DB.prepare("SELECT id FROM clinical_form_uploads WHERE id=? AND business_id=? LIMIT 1").bind(i.id||t.source_id,e).first()}}c(Id,"validateClinicalUploadRestore");async function Ld({env:s,businessId:e,row:t,metadata:i}){await s.DB.prepare(`
    INSERT OR IGNORE INTO clinical_form_uploads (id,submission_id,business_id,field_key,storage_provider,storage_key,original_name,mime_type,size_bytes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(i.id||t.source_id,i.submission_id,e,i.field_key,i.storage_provider||"r2",t.original_key,i.original_name||t.original_name||"Recovered file",i.mime_type||t.mime_type||null,Number(i.size_bytes||t.size_bytes||0),i.created_at||new Date().toISOString()).run()}c(Ld,"restoreClinicalUploadRecord");async function so({request:s,env:e}){let t=await pe(s,e);if(t.response)return t.response;try{let i=await e.DB.prepare("SELECT id,original_key,source_type,source_id,original_name,mime_type,size_bytes,reason,status,protected_until,created_at,restored_at FROM eselram_file_recovery_objects WHERE business_id=? ORDER BY datetime(created_at) DESC LIMIT 50").bind(t.session.business_id).all();return Response.json({ok:!0,items:i.results||[]},{headers:{"Cache-Control":"no-store"}})}catch(i){return Response.json({ok:!1,error:i?.message||"Unable to load file recovery."},{status:500})}}c(so,"onRequestGet");async function io({request:s,env:e}){let t=await pe(s,e);if(t.response)return t.response;try{let i=await s.json();if(String(i?.confirmation||"").trim().toUpperCase()!=="RESTORE")return Response.json({ok:!1,error:"Type RESTORE to confirm."},{status:400});let n=String(i?.recovery_id||"").trim();if(!n)return Response.json({ok:!1,error:"Recovery id is required."},{status:400});let r=t.session.business_id,a=await va({env:e,businessId:r,recoveryId:n}),o=vd(a);return a.source_type==="customer_photo"&&await Cd({env:e,businessId:r,row:a,metadata:o}),a.source_type==="clinical_form_upload"&&await Id({env:e,businessId:r,row:a,metadata:o}),await Ca({env:e,row:a}),a.source_type==="customer_photo"&&await Od({env:e,businessId:r,row:a,metadata:o}),a.source_type==="clinical_form_upload"&&await Ld({env:e,businessId:r,row:a,metadata:o}),await Oa({env:e,businessId:r,recoveryId:n}),Response.json({ok:!0,restored_key:a.original_key})}catch(i){return Response.json({ok:!1,error:i?.message||"Unable to restore protected file."},{status:500})}}c(io,"onRequestPost");async function vi(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(vi,"getUserContext");function Ci(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Ci,"unauthorized");function ht(s){return Response.json({ok:!1,error:s},{status:400})}c(ht,"badRequest");function As(s){return Response.json({ok:!1,error:s},{status:404})}c(As,"notFound");function Di(s){return`/forms/view.html#request_token=${encodeURIComponent(s)}`}c(Di,"requestPath");async function no(s,e,t){return t?await s.DB.prepare(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone
      FROM customers
      WHERE
        id = ?
        AND business_id = ?
      LIMIT 1
    `).bind(t,e).first():null}c(no,"getCustomer");async function ro(s,e,t){return t?await s.DB.prepare(`
      SELECT
        a.id,
        a.customer_id,
        a.start_at,
        a.end_at,
        a.status,
        s.name AS service_name
      FROM appointments a
      JOIN services s
        ON s.id = a.service_id
      WHERE
        a.id = ?
        AND a.business_id = ?
      LIMIT 1
    `).bind(t,e).first():null}c(ro,"getAppointment");async function ao({request:s,env:e}){try{let t=await vi(s,e);if(!t)return Ci();let i=new URL(s.url),n=String(i.searchParams.get("appointment_id")||"").trim(),r=String(i.searchParams.get("customer_id")||"").trim(),a=null;if(n){if(a=await ro(e,t.business_id,n),!a)return As("Appointment not found.");r=a.customer_id}let o=r?await no(e,t.business_id,r):null;if(r&&!o)return As("Customer not found.");let u=await e.DB.prepare(`
        SELECT
          id,
          name,
          template_type,
          version,
          is_client_sendable
        FROM clinical_templates
        WHERE
          business_id = ?
          AND is_active = 1
          AND is_published = 1
          AND is_client_sendable = 1
        ORDER BY
          template_type,
          name COLLATE NOCASE
      `).bind(t.business_id).all(),d=await e.DB.prepare(`
        SELECT
          id,
          name,
          template_type,
          version,
          is_client_sendable
        FROM clinical_templates
        WHERE
          business_id = ?
          AND is_active = 1
          AND is_published = 1
          AND is_client_sendable = 0
          AND lower(name) <> 'treatment record'
        ORDER BY
          template_type,
          name COLLATE NOCASE
      `).bind(t.business_id).all(),l={results:[]};return r&&(l=await e.DB.prepare(`
          SELECT
            r.id,
            r.template_id,
            r.customer_id,
            r.appointment_id,
            r.request_token,
            r.status,
            r.submission_id,
            r.created_at,
            r.opened_at,
            r.submitted_at,
            r.expires_at,
            r.email_status,
            r.email_to,
            r.email_sent_at,
            r.email_provider_id,
            r.email_error,
            r.email_send_count,

            t.name AS template_name,
            t.template_type,

            a.start_at AS appointment_start_at,
            s.name AS service_name,

            c.first_name,
            c.last_name,

            fs.status AS submission_status

          FROM clinical_form_requests r

          JOIN clinical_templates t
            ON t.id = r.template_id

          JOIN customers c
            ON c.id = r.customer_id

          LEFT JOIN appointments a
            ON a.id = r.appointment_id

          LEFT JOIN services s
            ON s.id = a.service_id

          LEFT JOIN clinical_form_submissions fs
            ON fs.id = r.submission_id

          WHERE
            r.business_id = ?
            AND r.customer_id = ?
            AND (
              ? = ''
              OR r.appointment_id = ?
            )

          ORDER BY
            datetime(r.created_at) DESC

          LIMIT 50
        `).bind(t.business_id,r,n,n).all()),Response.json({ok:!0,templates:u.results||[],internal_templates:d.results||[],customer:o,appointment:a,requests:(l.results||[]).map(p=>({...p,display_status:p.submission_status==="reviewed"?"reviewed":p.status,url_path:Di(p.request_token)}))})}catch(t){return console.error("Form requests GET failed:",t),Response.json({ok:!1,error:"Unable to load form requests."},{status:500})}}c(ao,"onRequestGet");async function oo({request:s,env:e}){try{let t=await vi(s,e);if(!t)return Ci();let i=await s.json(),n=String(i.template_id||"").trim(),r=String(i.appointment_id||"").trim(),a=i.internal===!0,o=String(i.customer_id||"").trim();if(!n)return ht("Choose a form template.");let u=await e.DB.prepare(a?`
              SELECT
                id,
                name,
                template_type,
                is_client_sendable
              FROM clinical_templates
              WHERE
                id = ?
                AND business_id = ?
                AND is_active = 1
                AND is_published = 1
                AND lower(name) <> 'treatment record'
              LIMIT 1
            `:`
              SELECT
                id,
                name,
                template_type,
                is_client_sendable
              FROM clinical_templates
              WHERE
                id = ?
                AND business_id = ?
                AND is_active = 1
                AND is_published = 1
                AND is_client_sendable = 1
              LIMIT 1
            `).bind(n,t.business_id).first();if(!u)return ht(a?"That clinical record template is not available.":"That clinical form is not available to send to clients.");let d=null;if(r){if(d=await ro(e,t.business_id,r),!d)return As("Appointment not found.");if(o&&o!==d.customer_id)return ht("The selected appointment does not belong to this customer.");o=d.customer_id}if(!o)return ht("A customer is required.");if(!await no(e,t.business_id,o))return As("Customer not found.");let p=await e.DB.prepare(`
        SELECT
          id,
          request_token,
          status,
          expires_at
        FROM clinical_form_requests
        WHERE
          business_id = ?
          AND template_id = ?
          AND customer_id = ?
          AND (
            (? = '' AND appointment_id IS NULL)
            OR appointment_id = ?
          )
          AND status IN ('created', 'opened')
          AND datetime(expires_at) > datetime('now')
        ORDER BY datetime(created_at) DESC
        LIMIT 1
      `).bind(t.business_id,n,o,r,r).first();if(p)return Response.json({ok:!0,reused:!0,request:{...p,template_id:n,customer_id:o,appointment_id:r||null,template_name:u.name,internal:String(p.request_token||"").startsWith("fri_"),url_path:Di(p.request_token)}});let m=`cfr_${crypto.randomUUID()}`,_=`${a?"fri":"frq"}_${crypto.randomUUID().replaceAll("-","")}${crypto.randomUUID().replaceAll("-","")}`;return await e.DB.prepare(`
        INSERT INTO clinical_form_requests (
          id,
          business_id,
          template_id,
          customer_id,
          appointment_id,
          request_token,
          status,
          created_by_user_id,
          expires_at
        )
        VALUES (
          ?, ?, ?, ?, ?, ?,
          'created',
          ?,
          datetime('now', '+30 days')
        )
      `).bind(m,t.business_id,n,o,r||null,_,t.user_id).run(),Response.json({ok:!0,reused:!1,request:{id:m,request_token:_,template_id:n,customer_id:o,appointment_id:r||null,template_name:u.name,status:"created",internal:a,url_path:Di(_)}})}catch(t){return console.error("Form request creation failed:",t),Response.json({ok:!1,error:"Unable to create form link."},{status:500})}}c(oo,"onRequestPost");async function co({request:s,env:e}){try{let t=await vi(s,e);if(!t)return Ci();let i=await s.json(),n=String(i.id||"").trim(),r=String(i.action||"").trim();return n?r!=="revoke"?ht("Invalid action."):(await e.DB.prepare(`
        UPDATE clinical_form_requests
        SET
          status = 'revoked',
          revoked_at = CURRENT_TIMESTAMP
        WHERE
          id = ?
          AND business_id = ?
          AND status IN ('created', 'opened')
      `).bind(n,t.business_id).run()).meta?.changes?Response.json({ok:!0}):ht("This form link can no longer be revoked."):ht("Form request id is required.")}catch(t){return console.error("Form request update failed:",t),Response.json({ok:!1,error:"Unable to update form request."},{status:500})}}c(co,"onRequestPut");var Li=500,uo=new Set(["confirmed","completed","cancelled","no_show"]),lo=new Set(["active","completed","cancelled","expired"]),po=new Set(["draft","complete"]);async function fo(s,e){let t=C(s);if(!t)return null;let i=await D(t);return e.DB.prepare("SELECT u.id AS user_id,u.business_id,b.currency FROM user_sessions s JOIN users u ON u.id=s.user_id JOIN businesses b ON b.id=u.business_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND u.is_active=1 LIMIT 1").bind(i).first()}c(fo,"getUserContext");var bo=c(()=>Response.json({ok:!1,error:"Authentication required."},{status:401}),"unauthorized"),q=c((s,e=500)=>String(s??"").trim().slice(0,e),"clean"),se=c(s=>q(s,300).toLowerCase(),"key");function Oi(s){let e=q(s,254).toLowerCase();return e?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)?e:null:""}c(Oi,"cleanEmail");var go=c(s=>q(s,80),"cleanPhone"),$t=c(s=>go(s).replace(/[^0-9+]/g,""),"phoneKey");function Ii(s,e=!1){let t=q(s,20).toLowerCase();return t?["yes","y","true","1","on"].includes(t):e}c(Ii,"yesNo");function Md(s){let e=Number(s);if(!Number.isFinite(e))return null;let t=new Date(Date.UTC(1899,11,30)+Math.round(e*864e5));return Number.isNaN(t.getTime())?null:t.toISOString().slice(0,10)}c(Md,"excelDate");function Ut(s){let e=q(s,50);if(!e)return null;if(/^\d+(?:\.\d+)?$/.test(e))return Md(e);if(/^\d{4}-\d{2}-\d{2}$/.test(e))return e;let t=e.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);return t?`${t[3]}-${t[2].padStart(2,"0")}-${t[1].padStart(2,"0")}`:null}c(Ut,"dateOnly");function _o(s){let e=q(s,50);if(!e)return null;if(/^\d+(?:\.\d+)?$/.test(e)){let r=(Number(e)%1+1)%1,a=Math.round(r*1440)%1440;return`${String(Math.floor(a/60)).padStart(2,"0")}:${String(a%60).padStart(2,"0")}`}let t=e.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);if(!t)return null;let i=Number(t[1]),n=Number(t[2]);if(n>59)return null;if(t[3]){if(i<1||i>12)return null;t[3].toLowerCase()==="pm"&&i!==12&&(i+=12),t[3].toLowerCase()==="am"&&i===12&&(i=0)}return i>23?null:`${String(i).padStart(2,"0")}:${String(n).padStart(2,"0")}`}c(_o,"timeOnly");function ot(s,e=null){let t=q(s,40).replace(/[£,$\s]/g,"");if(!t)return e;let i=Number(t);return Number.isFinite(i)&&i>=0?Math.round(i*100):null}c(ot,"money");function xd(s,e,t){let i=new Date(`${s}T${e}:00Z`);return Number.isNaN(i.getTime())?null:new Date(i.getTime()+t*6e4).toISOString().slice(0,19)}c(xd,"addMinutes");function mo(s,e,t){let i=[q(s,3e3)];return e>0?i.push(`Imported discount \xA3${(e/100).toFixed(2)}${t?` \xB7 voucher ${t}`:""}`):t&&i.push(`Imported voucher ${t}`),i.filter(Boolean).join(" \xB7 ")||null}c(mo,"noteWithDiscount");function Pd(s,e,t,i,n){let r=[q(s,3e3)],a=Math.max(0,Number(e||0)),o=q(t,80).toUpperCase();if(a>0){let u=(n||[]).find(g=>String(g?.code||"").trim().toUpperCase()===o),d="amount",l="Imported discount",p=Math.max(0,Number(i||0)),m=p>0?a*100/p:0,_=Math.round(m*100)/100;o?(d="voucher",u?.discount_type==="percent"?l=`${o} \xB7 ${Number(u.value||0)}% voucher`:_>0&&_<=100&&Math.abs(m-_)<.001?l=`${o} \xB7 ${_}% voucher`:l=`${o} \xB7 voucher`):_>0&&_<=100&&Math.abs(m-_)<.001&&(d="percent",l=`${_}% discount`),r.push(`discount_minor=${a}`),r.push(`deduction_type=${d}`),o&&r.push(`voucher=${o}`),r.push(`label=${l}`),r.push("discount_balance_applied=1")}return r.filter(Boolean).join(" \xB7 ")||null}c(Pd,"discountPaymentNotes");function W(s,e,t,i,n){s.push({sheet:e,row:t,field:i,message:n})}c(W,"err");function ws(s,e){let t=1469598103934665603n,i=e.map(n=>String(n??"").trim().toLowerCase()).join("|");for(let n=0;n<i.length;n++)t^=BigInt(i.charCodeAt(n)),t=BigInt.asUintN(64,t*1099511628211n);return`${s}_${t.toString(16).padStart(16,"0")}`}c(ws,"autoRef");function Ds(s,e){return q(s,40).toLowerCase().replaceAll(" ","_")||e}c(Ds,"normalizedStatus");async function Eo({request:s,env:e}){let t=await fo(s,e);if(!t)return bo();let[i,n,r]=await Promise.all([e.DB.prepare("SELECT id,name,duration_minutes,price_minor,service_type,consultation_service_id,is_active FROM services WHERE business_id=? AND is_active=1 ORDER BY sort_order,name COLLATE NOCASE").bind(t.business_id).all(),e.DB.prepare("SELECT pt.id,pt.service_id,pt.name,pt.sessions_total,pt.price_minor,pt.deposit_minor,pt.is_active,s.name AS service_name FROM package_templates pt JOIN services s ON s.id=pt.service_id AND s.business_id=pt.business_id WHERE pt.business_id=? AND pt.is_active=1 ORDER BY pt.name COLLATE NOCASE").bind(t.business_id).all(),e.DB.prepare("SELECT pv.id,pv.package_template_id,pv.service_id,pv.name,pv.price_minor,pv.deposit_minor,pv.is_active,pt.name AS template_name,pt.sessions_total,s.name AS service_name FROM package_variants pv JOIN package_templates pt ON pt.id=pv.package_template_id AND pt.business_id=pv.business_id JOIN services s ON s.id=pv.service_id AND s.business_id=pv.business_id WHERE pv.business_id=? AND pv.is_active=1 AND pt.is_active=1 ORDER BY pt.name COLLATE NOCASE,pv.sort_order,pv.name COLLATE NOCASE").bind(t.business_id).all()]);return Response.json({ok:!0,max_rows:Li,services:i.results||[],package_templates:n.results||[],package_variants:r.results||[]})}c(Eo,"onRequestGet");async function ho({request:s,env:e}){try{let Z=function(k,M,U){let V=q(k,254);if(!V)return W(w,M,U,"customer_email_or_phone","Choose the customer using their email address or phone number."),null;let x=null;if(V.includes("@")){let P=Oi(V);if(P===null)return W(w,M,U,"customer_email_or_phone","The customer email address is not valid."),null;x=I.get(se(P))}else x=R.get($t(V));return x||W(w,M,U,"customer_email_or_phone",`Customer '${V}' was not found. Add them on the Customers sheet first, or use the email/phone already stored in Eselram.`),x?.id||null},oe=function(k){let M=q(k,254);if(!M)return null;if(M.includes("@")){let U=Oi(M);return U&&I.get(se(U))||null}return R.get($t(M))||null},ut=function(k,M){if(!M)return null;let U=me.get(`${k}|${se(M)}`);if(U)return U;let V=h.get(se(M));if(!V)return null;let x=Ve.filter(P=>P.customer_id===k&&(P.package_variant_id&&V.variant?.id===P.package_variant_id||!P.package_variant_id&&P.package_template_id===V.template.id||se(P.name_snapshot)===se(M)));return x.length===1?{id:x[0].id,customerId:k,serviceId:x[0].service_id,label:M}:null};c(Z,"resolveCustomer"),c(oe,"lookupCustomer"),c(ut,"findPackageForBooking");let t=await fo(s,e);if(!t)return bo();let i=await s.json().catch(()=>({})),n=i.sheets&&typeof i.sheets=="object"?i.sheets:{},r=q(i.filename,255)||"eselram-import-template.xlsx",a={Customers:Array.isArray(n.Customers)?n.Customers:[],Bookings:Array.isArray(n.Bookings)?n.Bookings:[],Packages:Array.isArray(n["Packages & Courses"])?n["Packages & Courses"]:[],Treatments:Array.isArray(n["Treatment History"])?n["Treatment History"]:[],Vouchers:Array.isArray(n.Vouchers)?n.Vouchers:[]},o=Object.values(a).reduce((k,M)=>k+M.length,0);if(!o)return Response.json({ok:!1,error:"No import rows were supplied."},{status:400});if(o>Li)return Response.json({ok:!1,error:`Import a maximum of ${Li} total rows at a time.`},{status:400});let[u,d,l,p,m,_,g,E]=await Promise.all([e.DB.prepare("SELECT id,name,duration_minutes,price_minor,service_type,consultation_service_id FROM services WHERE business_id=? AND is_active=1").bind(t.business_id).all(),e.DB.prepare("SELECT id,first_name,last_name,email,phone FROM customers WHERE business_id=?").bind(t.business_id).all(),e.DB.prepare("SELECT entity_type,external_reference,internal_id FROM data_import_references WHERE business_id=?").bind(t.business_id).all(),e.DB.prepare("SELECT setting_value FROM business_settings WHERE business_id=? AND setting_key='payment_vouchers' LIMIT 1").bind(t.business_id).first(),e.DB.prepare("SELECT id,service_id,name,sessions_total,price_minor FROM package_templates WHERE business_id=? AND is_active=1").bind(t.business_id).all(),e.DB.prepare("SELECT id,package_template_id,service_id,name,price_minor FROM package_variants WHERE business_id=? AND is_active=1").bind(t.business_id).all(),e.DB.prepare("SELECT cp.id,cp.customer_id,cp.service_id,cp.name_snapshot,cp.package_template_id,cp.package_variant_id FROM customer_packages cp WHERE cp.business_id=? AND cp.status IN ('active','completed')").bind(t.business_id).all(),e.DB.prepare(`
      SELECT a.id,a.customer_id,a.service_id,a.start_at,
        MAX(0,COALESCE(SUM(CASE WHEN p.payment_type='refund' AND p.status='paid' THEN -ABS(p.amount_minor) WHEN p.payment_type!='refund' AND p.status IN ('paid','partially_refunded','refunded') THEN ABS(p.amount_minor) ELSE 0 END),0)) AS paid_minor
      FROM appointments a
      JOIN services s ON s.id=a.service_id AND s.business_id=a.business_id
      LEFT JOIN payments p ON p.appointment_id=a.id AND p.business_id=a.business_id
      WHERE a.business_id=? AND a.status='completed' AND (a.booking_kind='consultation' OR s.service_type='consultation')
        AND NOT EXISTS (SELECT 1 FROM appointments target WHERE target.business_id=a.business_id AND target.consultation_credit_source_appointment_id=a.id AND target.status!='cancelled')
        AND NOT EXISTS (SELECT 1 FROM package_sales ps WHERE ps.business_id=a.business_id AND ps.consultation_credit_source_appointment_id=a.id AND ps.status NOT IN ('failed','cancelled'))
      GROUP BY a.id
      HAVING paid_minor>0
      ORDER BY datetime(a.start_at) DESC
    `).bind(t.business_id).all()]),f=u.results||[],b=new Map(f.map(k=>[se(k.name),k])),N=new Map(f.map(k=>[k.id,k])),v=m.results||[],S=_.results||[],h=new Map;for(let k of v){h.set(se(k.name),{label:k.name,template:k,variant:null,serviceId:k.service_id,sessions:Number(k.sessions_total),price:Number(k.price_minor||0)});for(let M of S.filter(U=>U.package_template_id===k.id)){let U=`${k.name} \xB7 ${M.name}`;h.set(se(U),{label:U,template:k,variant:M,serviceId:M.service_id,sessions:Number(k.sessions_total),price:Number(M.price_minor||0)})}}let I=new Map,R=new Map,L=new Map;for(let k of d.results||[])L.set(k.id,k),k.email&&I.set(se(k.email),k),k.phone&&R.set($t(k.phone),k);let T=new Map((l.results||[]).map(k=>[`${k.entity_type}:${se(k.external_reference)}`,k.internal_id])),O=[];try{O=JSON.parse(p?.setting_value||"[]"),Array.isArray(O)||(O=[])}catch{O=[]}let w=[],B=[],j=`imp_${crypto.randomUUID()}`,y=0,F=0;for(let k of a.Customers){let M=Number(k.__row||0),U=q(k.first_name,100),V=q(k.last_name,100),x=Oi(k.email),P=go(k.phone);U||W(w,"Customers",M,"first_name","Enter the customer's first name."),V||W(w,"Customers",M,"last_name","Enter the customer's last name."),x===null&&W(w,"Customers",M,"email","The email address is not valid."),!x&&!P&&W(w,"Customers",M,"email","Enter an email address or phone number so other sheets can identify this customer.");let J=null;if(x&&(J=I.get(se(x))),!J&&P&&(J=R.get($t(P))),!J&&U&&V&&x!==null&&(x||P)){let ne=`cus_${crypto.randomUUID()}`;J={id:ne,first_name:U,last_name:V,email:x||null,phone:P||null},y++,B.push(e.DB.prepare("INSERT INTO customers(id,business_id,first_name,last_name,email,phone,notes,marketing_consent) VALUES(?,?,?,?,?,?,?,?)").bind(ne,t.business_id,U,V,x||null,P||null,q(k.notes,4e3)||null,Ii(k.marketing_consent,!1)?1:0)),L.set(ne,J),x&&I.set(se(x),J),P&&R.set($t(P),J)}}let H=new Map,z=[];for(let k of a.Bookings){let M=oe(k.customer_email_or_phone),U=b.get(se(k.eselram_service)),V=Ds(k.status,"confirmed"),x=Ut(k.appointment_date),P=_o(k.start_time),J=ot(k.amount_already_paid,0);if(M&&U?.service_type==="consultation"&&V==="completed"&&x&&P&&J!==null&&J>0){let ne=ws("booking",[M.id,U.id,x,P]);if(!T.has(`booking:${se(ne)}`)){let re=`apt_${crypto.randomUUID()}`;H.set(k,re),z.push({id:re,customerId:M.id,serviceId:U.id,paidMinor:J,startAt:`${x}T${P}:00`})}}}let Y=(E.results||[]).map(k=>({id:k.id,customerId:k.customer_id,serviceId:k.service_id,paidMinor:Number(k.paid_minor||0),startAt:k.start_at||""})),ie=new Set,$=[],me=new Map,Ve=g.results||[];for(let k of a.Packages){let M=Number(k.__row||0),U=Z(k.customer_email_or_phone,"Packages & Courses",M),V=q(k.eselram_package_or_course,250),x=h.get(se(V)),P=Ds(k.status,"active"),J=q(k.start_date)?Ut(k.start_date):null,ne=q(k.expiry_date)?Ut(k.expiry_date):null,re=ot(k.discount,0),Se=q(k.voucher_used,80).toUpperCase(),ce=ot(k.consultation_credit,0),Le=ot(k.amount_already_paid,0),Ue=q(k.payment_method,80)||"imported";x||W(w,"Packages & Courses",M,"eselram_package_or_course",`'${V||"blank"}' does not match a current Eselram package/course. Choose a value from the dropdown.`),lo.has(P)||W(w,"Packages & Courses",M,"status","Status must be Active, Completed, Cancelled or Expired."),q(k.start_date)&&!J&&W(w,"Packages & Courses",M,"start_date","Start date is invalid."),q(k.expiry_date)&&!ne&&W(w,"Packages & Courses",M,"expiry_date","Expiry date is invalid.");let lt=ot(k.package_price,x?.price??0);(lt===null||re===null||re>lt)&&W(w,"Packages & Courses",M,"package_price","Package price or discount is invalid.");let Re=lt===null||re===null?null:Math.max(lt-re,0);ce===null&&W(w,"Packages & Courses",M,"consultation_credit","Consultation credit is invalid."),Re!==null&&ce!==null&&ce>Re&&W(w,"Packages & Courses",M,"consultation_credit","Consultation credit cannot be greater than the package value after discount.");let Me=Re===null||ce===null?null:Math.max(Re-ce,0);(Le===null||Me!==null&&Le>Me)&&W(w,"Packages & Courses",M,"amount_already_paid","Amount already paid cannot be greater than the package balance after consultation credit.");let Te=null;if(U&&x&&ce>0){let Be=N.get(x.serviceId),Xe=q(Be?.consultation_service_id,120),qe=[...z,...Y].filter(fe=>fe.customerId===U&&!ie.has(fe.id)),je=Xe?qe.filter(fe=>fe.serviceId===Xe):[];if(!je.length){let fe=qe.filter(xe=>N.get(xe.serviceId)?.service_type==="consultation");if(fe.length===1)je=fe;else if(fe.length>1){let xe=se(Be?.name||x.label),yt=fe.filter(Ec=>{let Ms=se(N.get(Ec.serviceId)?.name||"");return xe&&Ms&&(Ms.includes(xe)||xe.includes(Ms.replace(/\bconsultation\b/g,"").trim()))});yt.length===1&&(je=yt)}}je.sort((fe,xe)=>String(xe.startAt||"").localeCompare(String(fe.startAt||""))),Te=je[0]||null,Te?ce>Te.paidMinor&&W(w,"Packages & Courses",M,"consultation_credit",`Consultation credit cannot exceed the consultation payment of \xA3${(Te.paidMinor/100).toFixed(2)}.`):W(w,"Packages & Courses",M,"consultation_credit","No unique unused paid completed consultation could be matched to this package. Import the consultation booking too, or link the treatment to its consultation in Services.")}if(U&&x&&lo.has(P)&&Re!==null&&ce!==null&&Me!==null&&Le!==null&&Le<=Me&&(!ce||Te)){let Be=`${U}|${se(x.label)}`;if(me.has(Be)){W(w,"Packages & Courses",M,"eselram_package_or_course","This customer already has the same package/course in this workbook. Import each package purchase once.");continue}let Xe=ws("package",[U,x.variant?.id||x.template.id,J||"",ne||"",Re]);if(T.has(`package:${se(Xe)}`)){W(w,"Packages & Courses",M,"eselram_package_or_course","This package/course appears to have already been imported.");continue}let qe=`cpk_${crypto.randomUUID()}`;me.set(Be,{id:qe,customerId:U,serviceId:x.serviceId,label:x.label}),B.push(e.DB.prepare("INSERT INTO customer_packages(id,business_id,customer_id,package_template_id,service_id,name_snapshot,sessions_total,price_minor,status,starts_on,expires_on,notes,package_variant_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(qe,t.business_id,U,x.template.id,x.serviceId,x.label,x.sessions,Re,P,J,ne,mo(k.notes,re,Se),x.variant?.id||null)),B.push(e.DB.prepare("INSERT INTO data_import_references(business_id,import_batch_id,entity_type,external_reference,internal_id) VALUES(?,?,?,?,?)").bind(t.business_id,j,"package",Xe,qe));let je=null;if(Le>0){let fe=`pay_${crypto.randomUUID()}`,xe=Le+ce>=Re?"full":"deposit",yt=Math.max(0,lt-ce);je=fe,F++,B.push(e.DB.prepare("INSERT INTO payments(id,business_id,appointment_id,customer_id,provider,payment_type,amount_minor,currency,status,provider_reference,paid_at,payment_method,notes) VALUES(?,?,NULL,?,'manual',?,?,?,'paid',?,CURRENT_TIMESTAMP,?,?)").bind(fe,t.business_id,U,xe,Le,String(t.currency||"GBP").toUpperCase(),`import:${Xe}`,Ue,Pd("Imported historical package payment",re,Se,yt,O))),B.push(e.DB.prepare("INSERT INTO customer_package_payments(customer_package_id,payment_id) VALUES(?,?)").bind(qe,fe))}ce>0&&Te&&(ie.add(Te.id),$.push({customerPackageId:qe,customerId:U,packageTemplateId:x.template.id,packageVariantId:x.variant?.id||null,paymentId:je,paymentChoice:Le+ce>=Re?"full":"deposit",amountMinor:Le,sourceAppointmentId:Te.id,creditMinor:ce}))}}for(let k of a.Bookings){let M=Number(k.__row||0),U=Z(k.customer_email_or_phone,"Bookings",M),V=q(k.eselram_service,200),x=b.get(se(V)),P=Ut(k.appointment_date),J=_o(k.start_time),ne=Ds(k.status,"confirmed"),re=q(k.package_or_course,250),Se=U&&re?ut(U,re):null,ce=ot(k.discount,0),Le=q(k.voucher_used,80).toUpperCase(),Ue=ot(k.amount_already_paid,0),lt=q(k.payment_method,80)||"imported";x||W(w,"Bookings",M,"eselram_service",`'${V||"blank"}' does not match an active Eselram service. Choose a value from the dropdown.`),P||W(w,"Bookings",M,"appointment_date","Appointment date is invalid."),J||W(w,"Bookings",M,"start_time","Start time is invalid."),uo.has(ne)||W(w,"Bookings",M,"status","Status must be Confirmed, Completed, Cancelled or No show."),re&&!h.has(se(re))?W(w,"Bookings",M,"package_or_course",`'${re}' is not a current Eselram package/course.`):re&&!Se&&W(w,"Bookings",M,"package_or_course","The selected package/course is not attached to this customer. Add it on Packages & Courses first, or make sure the customer already owns it in Eselram."),Se&&x&&Se.serviceId!==x.id&&W(w,"Bookings",M,"package_or_course","The selected package/course belongs to a different service.");let Re=ot(k.price,x?Number(x.price_minor||0):0);(Re===null||ce===null||ce>Re)&&W(w,"Bookings",M,"price","Price or discount is invalid.");let Me=Se?0:Re===null||ce===null?null:Math.max(Re-ce,0);if((Ue===null||Me!==null&&Ue>Me)&&W(w,"Bookings",M,"amount_already_paid","Amount already paid cannot be greater than the appointment price."),Se&&Ue>0&&W(w,"Bookings",M,"amount_already_paid","Leave Amount already paid blank for package-linked appointments. Package payments belong on Packages & Courses."),U&&x&&P&&J&&uo.has(ne)&&Me!==null&&Ue!==null&&Ue<=Me&&(!re||Se)){let Te=ws("booking",[U,x.id,P,J]);if(T.has(`booking:${se(Te)}`)){W(w,"Bookings",M,"appointment_date","This booking appears to have already been imported.");continue}let Be=H.get(k)||`apt_${crypto.randomUUID()}`,Xe=Number(x.duration_minutes||30),qe=`${P}T${J}:00`,je=xd(P,J,Xe),fe=x.service_type==="consultation"?"consultation":"service";if(B.push(e.DB.prepare("INSERT INTO appointments(id,business_id,customer_id,service_id,status,start_at,end_at,price_minor,deposit_due_minor,booking_source,booking_kind,customer_notes,internal_notes,cancelled_at,cancellation_reason,import_batch_id,external_reference,reminders_enabled) VALUES(?,?,?,?,?,?,?,?,0,'import',?,?,?,CASE WHEN ?='cancelled' THEN CURRENT_TIMESTAMP ELSE NULL END,?,?,?,?)").bind(Be,t.business_id,U,x.id,ne,qe,je,Me,fe,q(k.notes,3e3)||null,mo(null,ce,Le),ne,q(k.cancellation_reason,500)||null,j,Te,Ii(k.send_future_reminder,!1)?1:0)),B.push(e.DB.prepare("INSERT INTO data_import_references(business_id,import_batch_id,entity_type,external_reference,internal_id) VALUES(?,?,?,?,?)").bind(t.business_id,j,"booking",Te,Be)),Se?.id&&B.push(e.DB.prepare("INSERT INTO customer_package_appointments(customer_package_id,appointment_id) VALUES(?,?)").bind(Se.id,Be)),Ue>0){let xe=`pay_${crypto.randomUUID()}`,yt=Ue>=Me?"full":"deposit";F++,B.push(e.DB.prepare("INSERT INTO payments(id,business_id,appointment_id,customer_id,provider,payment_type,amount_minor,currency,status,provider_reference,paid_at,payment_method,notes) VALUES(?,?,?,?,'manual',?,?,?,'paid',?,CURRENT_TIMESTAMP,?,?)").bind(xe,t.business_id,Be,U,yt,Ue,String(t.currency||"GBP").toUpperCase(),`import:${Te}`,lt,"Imported historical booking payment"))}}}for(let k of $)B.push(e.DB.prepare("INSERT INTO package_sales(id,business_id,customer_id,package_template_id,package_variant_id,source,payment_choice,amount_minor,currency,status,payment_id,customer_package_id,created_by_user_id,paid_at,consultation_credit_source_appointment_id,consultation_credit_minor) VALUES(?,?,?,?,?,'staff',?,?,?,'paid',?,?,?,CURRENT_TIMESTAMP,?,?)").bind(`psl_${crypto.randomUUID()}`,t.business_id,k.customerId,k.packageTemplateId,k.packageVariantId,k.paymentChoice,k.amountMinor,String(t.currency||"GBP").toUpperCase(),k.paymentId,k.customerPackageId,t.user_id,k.sourceAppointmentId,k.creditMinor));for(let k of a.Treatments){let M=Number(k.__row||0),U=Z(k.customer_email_or_phone,"Treatment History",M),V=q(k.eselram_service,200),x=b.get(se(V)),P=Ds(k.status,"complete"),J=Ut(k.treatment_date),ne=q(k.next_treatment_date)?Ut(k.next_treatment_date):null;if(x||W(w,"Treatment History",M,"eselram_service",`'${V||"blank"}' does not match an active Eselram service.`),po.has(P)||W(w,"Treatment History",M,"status","Status must be Complete or Draft."),J||W(w,"Treatment History",M,"treatment_date","Treatment date is invalid."),q(k.next_treatment_date)&&!ne&&W(w,"Treatment History",M,"next_treatment_date","Next treatment date is invalid."),U&&x&&po.has(P)&&J){let re=ws("treatment",[U,x.id,J,q(k.practitioner,200),q(k.treatment_area,300)]);if(T.has(`treatment_record:${se(re)}`)){W(w,"Treatment History",M,"treatment_date","This treatment record appears to have already been imported.");continue}let Se=`tr_${crypto.randomUUID()}`;B.push(e.DB.prepare("INSERT INTO treatment_records(id,business_id,appointment_id,customer_id,service_id,status,treatment_date,practitioner_name,treatment_area,device_name,device_settings,treatment_notes,client_response,client_tolerance,aftercare_notes,next_session_plan,next_treatment_date,import_batch_id,external_reference) VALUES(?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(Se,t.business_id,U,x.id,P,J,q(k.practitioner,200)||null,q(k.treatment_area,500)||null,q(k.device,300)||null,q(k.device_settings,3e3)||null,q(k.treatment_notes,5e3)||null,q(k.client_response,3e3)||null,q(k.client_tolerance,1e3)||null,q(k.aftercare_notes,3e3)||null,q(k.next_session_plan,3e3)||null,ne,j,re)),B.push(e.DB.prepare("INSERT INTO data_import_references(business_id,import_batch_id,entity_type,external_reference,internal_id) VALUES(?,?,?,?,?)").bind(t.business_id,j,"treatment_record",re,Se))}}let dt=new Set(O.map(k=>String(k.code||"").trim().toUpperCase())),te=[];for(let k of a.Vouchers){let M=Number(k.__row||0),U=q(k.code,80).toUpperCase().replace(/\s+/g,""),V=q(k.name,80)||U,x=q(k.discount_type,30).toLowerCase(),P=Number(String(k.value??"").replace(/[£,%,$\s]/g,"")),J=Ii(k.active,!0);U||W(w,"Vouchers",M,"code","Voucher code is required."),["amount","percent"].includes(x)||W(w,"Vouchers",M,"discount_type","Discount type must be Amount or Percent."),(!Number.isFinite(P)||P<=0||x==="percent"&&P>100)&&W(w,"Vouchers",M,"value","Voucher value is invalid."),dt.has(U)&&W(w,"Vouchers",M,"code",`Voucher code ${U} already exists or is duplicated.`),U&&["amount","percent"].includes(x)&&Number.isFinite(P)&&P>0&&(x!=="percent"||P<=100)&&(dt.add(U),te.push({id:`vch_${crypto.randomUUID()}`,code:U,name:V,discount_type:x,value:P,is_active:J}))}if(w.length)return Response.json({ok:!1,error:"Nothing was imported. Fix the highlighted workbook rows and try again.",errors:w},{status:400});if(B.unshift(e.DB.prepare("INSERT INTO data_import_batches(id,business_id,created_by_user_id,source_filename,customers_imported,bookings_imported,packages_imported,payments_imported,vouchers_imported,treatment_records_imported) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(j,t.business_id,t.user_id,r,a.Customers.length,a.Bookings.length,a.Packages.length,F,a.Vouchers.length,a.Treatments.length)),te.length){let k=[...O,...te];B.push(e.DB.prepare("INSERT INTO business_settings(id,business_id,setting_key,setting_value,value_type) VALUES(?,?,'payment_vouchers',?,'json') ON CONFLICT(business_id,setting_key) DO UPDATE SET setting_value=excluded.setting_value,value_type='json',updated_at=CURRENT_TIMESTAMP").bind(`set_${crypto.randomUUID()}`,t.business_id,JSON.stringify(k)))}return await e.DB.batch(B),Response.json({ok:!0,batch_id:j,customers_imported:a.Customers.length,customers_created:y,bookings_imported:a.Bookings.length,packages_imported:a.Packages.length,payments_created:F,vouchers_imported:a.Vouchers.length,treatment_records_imported:a.Treatments.length})}catch(t){return console.error("Data import failed:",t),Response.json({ok:!1,error:"Unable to import data. Nothing was intentionally sent to Stripe or email providers."},{status:500})}}c(ho,"onRequestPost");function Mi(s){return Response.json({ok:!1,error:s},{status:400})}c(Mi,"badRequest");function yo(){return Response.json({ok:!1,error:"This manage-booking link is invalid or has expired."},{status:404})}c(yo,"notFound");function xi(s){return Response.json({ok:!1,error:s},{status:409})}c(xi,"conflict");function ko(s){return{id:s.appointment_id,status:s.status,service_id:s.service_id,service_name:s.service_name,booking_kind:s.booking_kind||"service",booking_label:s.booking_kind==="consultation"?`Consultation \xB7 ${s.service_name}`:s.service_name,start_at:s.start_at,end_at:s.end_at,duration_minutes:Number(s.duration_minutes||0),price_minor:Number(s.price_minor||0),deposit_due_minor:Number(s.deposit_due_minor||0),requires_consultation:Number(s.requires_consultation||0),requires_patch_test:Number(s.requires_patch_test||0),cancellation_reason:s.cancellation_reason||null}}c(ko,"bookingData");async function So({request:s,env:e}){try{let t=new URL(s.url),i=String(t.searchParams.get("token")||"").trim(),n=await Ht({env:e,token:i});if(!n)return yo();let[r,a]=await Promise.all([In({env:e,businessId:n.business_id,appointmentId:n.appointment_id}),Ln({env:e,businessId:n.business_id,appointmentId:n.appointment_id})]),o=Math.max(Number(n.price_minor||0)-Number(r.net_paid_minor||0)-Number(r.consultation_credit_minor||0),0);return Response.json({ok:!0,customer:{first_name:n.first_name,last_name:n.last_name,email:n.email},business:{name:n.business_name,timezone:n.timezone||"Europe/London",currency:n.currency||"GBP",locale:n.locale||"en-GB",branding:{logo_data_url:n.logo_data_url||null,primary_colour:n.primary_colour||"#365c50",background_colour:n.background_colour||"#f5f4ef",surface_colour:n.surface_colour||"#ffffff",text_colour:n.text_colour||"#18221f"}},booking:ko(n),payment:{...r,outstanding_minor:o},forms:a,permissions:{can_reschedule:n.status==="confirmed",can_cancel:n.status==="confirmed"}})}catch(t){return console.error("Manage booking GET failed:",t),Response.json({ok:!1,error:"Unable to load this booking."},{status:500})}}c(So,"onRequestGet");async function Ro({request:s,env:e}){try{let t=await s.json(),i=String(t.token||"").trim(),n=String(t.action||"").trim().toLowerCase(),r=await Ht({env:e,token:i});if(!r)return yo();if(n==="cancel"){if(r.status==="cancelled")return Response.json({ok:!0,cancelled:!0});if(r.status!=="confirmed")return xi("This appointment can no longer be cancelled online.");let a=String(t.reason||"Cancelled by customer through self-service").trim().slice(0,500);return await e.DB.prepare(`
          UPDATE appointments
          SET
            status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            cancellation_reason = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
            AND status = 'confirmed'
        `).bind(a||"Cancelled by customer through self-service",r.appointment_id,r.business_id).run(),await le({env:e,businessId:r.business_id,appointmentId:r.appointment_id,type:"cancellation_confirmation",uniqueKey:`cancellation_confirmation:self_service:${r.appointment_id}:${Date.now()}`,baseUrl:new URL(s.url).origin}),Response.json({ok:!0,cancelled:!0})}if(n==="reschedule"){if(r.status!=="confirmed")return xi("This appointment can no longer be rescheduled online.");let a=String(t.date||"").trim(),o=String(t.time||"").trim();if(!Ae(a)||!Ot(o))return Mi("Choose a valid date and time.");let u=await e.DB.prepare(`
          SELECT
            booking_buffer_before_minutes,
            booking_buffer_after_minutes
          FROM businesses
          WHERE id = ?
          LIMIT 1
        `).bind(r.business_id).first(),d=await Oe({env:e,business:{id:r.business_id,timezone:r.timezone||"Europe/London",booking_buffer_before_minutes:Number(u?.booking_buffer_before_minutes||0),booking_buffer_after_minutes:Number(u?.booking_buffer_after_minutes||0)},service:{id:r.service_id,duration_minutes:Number(r.duration_minutes||0)},date:a,excludeAppointmentId:r.appointment_id});if(d.error)return Mi(d.error);if(!(d.slots||[]).includes(o))return xi(d.reason||"That time is no longer available. Please choose another time.");let l=`${a}T${o}:00`,p=Lt(a,o,Number(r.duration_minutes||0));return await e.DB.prepare(`
          UPDATE appointments
          SET
            start_at = ?,
            end_at = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
            AND status = 'confirmed'
        `).bind(l,p,r.appointment_id,r.business_id).run(),await le({env:e,businessId:r.business_id,appointmentId:r.appointment_id,type:"reschedule_confirmation",uniqueKey:`reschedule_confirmation:self_service:${r.appointment_id}:${l}`,baseUrl:new URL(s.url).origin}),Response.json({ok:!0,rescheduled:!0,booking:{...ko(r),start_at:l,end_at:p}})}return Mi("Invalid manage-booking action.")}catch(t){return console.error("Manage booking POST failed:",t),Response.json({ok:!1,error:"Unable to update this booking."},{status:500})}}c(Ro,"onRequestPost");async function To(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id,
        b.currency
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      JOIN businesses b
        ON b.id = u.business_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `).bind(i).first()}c(To,"getUserContext");function Ao(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Ao,"unauthorized");function ae(s){return Response.json({ok:!1,error:s},{status:400})}c(ae,"badRequest");function vs(s){return Response.json({ok:!1,error:s},{status:404})}c(vs,"notFound");async function wo(s,e,t){return await s.DB.prepare(`
      SELECT
        cp.id,
        cp.customer_id,
        cp.package_template_id,
        cp.service_id,
        cp.name_snapshot,
        cp.sessions_total,
        cp.price_minor,
        cp.status,
        cp.starts_on,
        cp.expires_on,
        cp.notes,
        cp.created_at,

        c.first_name,
        c.last_name,
        c.email,
        c.phone,

        s.name AS service_name,
        s.duration_minutes,

        (
          SELECT COUNT(*)
          FROM customer_package_appointments cpa
          JOIN appointments a
            ON a.id = cpa.appointment_id
          WHERE
            cpa.customer_package_id = cp.id
            AND a.status = 'completed'
        ) AS sessions_completed,

        (
          SELECT COUNT(*)
          FROM customer_package_appointments cpa
          JOIN appointments a
            ON a.id = cpa.appointment_id
          WHERE
            cpa.customer_package_id = cp.id
            AND a.status IN ('confirmed', 'pending')
        ) AS sessions_booked,

        (
          SELECT COALESCE(
            SUM(
              CASE
                WHEN p.payment_type = 'refund' AND p.status = 'paid'
                  THEN -ABS(p.amount_minor)
                WHEN p.payment_type != 'refund'
                     AND p.status IN ('paid', 'partially_refunded', 'refunded')
                  THEN ABS(p.amount_minor)
                ELSE 0
              END
            ),
            0
          )
          FROM customer_package_payments cpp
          JOIN payments p
            ON p.id = cpp.payment_id
          WHERE cpp.customer_package_id = cp.id
              AND COALESCE(p.payment_method, '') != 'discount'
        ) AS paid_minor,

        (
          SELECT COALESCE(
            SUM(ps.consultation_credit_minor),
            0
          )
          FROM package_sales ps
          WHERE
            ps.business_id = cp.business_id
            AND ps.customer_package_id = cp.id
            AND ps.status = 'paid'
        ) AS consultation_credit_minor

      FROM customer_packages cp

      JOIN customers c
        ON c.id = cp.customer_id

      JOIN services s
        ON s.id = cp.service_id

      WHERE
        cp.id = ?
        AND cp.business_id = ?

      LIMIT 1
    `).bind(t,e).first()}c(wo,"getCustomerPackage");function No(s){if(!s)return null;let e=Number(s.sessions_completed||0),t=Number(s.sessions_booked||0),i=Number(s.sessions_total||0),n=Number(s.paid_minor||0),r=Number(s.consultation_credit_minor||0);return{...s,sessions_completed:e,sessions_booked:t,sessions_remaining:Math.max(i-e-t,0),sessions_available_to_book:Math.max(i-e-t,0),paid_minor:n,consultation_credit_minor:r,credited_paid_minor:n+r,outstanding_minor:Math.max(Number(s.price_minor||0)-n-r,0)}}c(No,"enrichPackage");async function Do({request:s,env:e}){try{let t=await To(s,e);if(!t)return Ao();let i=new URL(s.url),n=String(i.searchParams.get("customer_package_id")||"").trim();if(n){let m=await wo(e,t.business_id,n);if(!m)return vs("Customer package not found.");let _=await e.DB.prepare(`
          SELECT
            a.id,
            a.start_at,
            a.end_at,
            a.status,
            a.booking_source
          FROM customer_package_appointments cpa
          JOIN appointments a
            ON a.id = cpa.appointment_id
          WHERE cpa.customer_package_id = ?
          ORDER BY datetime(a.start_at) ASC
        `).bind(n).all();return Response.json({ok:!0,customer_package:No(m),appointments:_.results||[]})}let[r,a,o,u,d,l]=await Promise.all([e.DB.prepare(`
          SELECT
            pt.id,
            pt.service_id,
            pt.name,
            pt.description,
            pt.sessions_total,
            pt.price_minor,
            pt.payment_rule,
            pt.deposit_minor,
            pt.validity_days,
            pt.is_active,
            pt.is_public,
            pt.created_at,
            s.name AS service_name
          FROM package_templates pt
          JOIN services s
            ON s.id = pt.service_id
          WHERE pt.business_id = ?
          ORDER BY pt.is_active DESC, pt.name COLLATE NOCASE ASC
        `).bind(t.business_id).all(),e.DB.prepare(`
          SELECT
            cp.id,
            cp.customer_id,
            cp.package_template_id,
            cp.service_id,
            cp.name_snapshot,
            cp.sessions_total,
            cp.price_minor,
            cp.status,
            cp.starts_on,
            cp.expires_on,
            cp.notes,
            cp.created_at,

            c.first_name,
            c.last_name,
            COALESCE(
              (
                SELECT variant_service.name
                FROM package_variants direct_variant
                JOIN services variant_service
                  ON variant_service.id = direct_variant.service_id
                 AND variant_service.business_id = cp.business_id
                WHERE direct_variant.id = cp.package_variant_id
                  AND direct_variant.package_template_id = cp.package_template_id
                  AND direct_variant.business_id = cp.business_id
                LIMIT 1
              ),
              (
                SELECT sale_service.name
                FROM package_sales package_sale
                JOIN package_variants sale_variant
                  ON sale_variant.id = package_sale.package_variant_id
                 AND sale_variant.package_template_id = cp.package_template_id
                 AND sale_variant.business_id = cp.business_id
                JOIN services sale_service
                  ON sale_service.id = sale_variant.service_id
                 AND sale_service.business_id = cp.business_id
                WHERE package_sale.customer_package_id = cp.id
                  AND package_sale.business_id = cp.business_id
                  AND package_sale.status = 'paid'
                ORDER BY datetime(package_sale.paid_at) DESC, datetime(package_sale.created_at) DESC
                LIMIT 1
              ),
              (
                SELECT snapshot_service.name
                FROM package_variants snapshot_variant
                JOIN package_templates snapshot_template
                  ON snapshot_template.id = snapshot_variant.package_template_id
                 AND snapshot_template.business_id = cp.business_id
                JOIN services snapshot_service
                  ON snapshot_service.id = snapshot_variant.service_id
                 AND snapshot_service.business_id = cp.business_id
                WHERE snapshot_variant.package_template_id = cp.package_template_id
                  AND snapshot_variant.business_id = cp.business_id
                  AND snapshot_template.name || ' \xB7 ' || snapshot_variant.name = cp.name_snapshot
                ORDER BY snapshot_variant.sort_order, snapshot_variant.name COLLATE NOCASE
                LIMIT 1
              ),
              (
                SELECT template_service.name
                FROM package_templates fallback_template
                JOIN services template_service
                  ON template_service.id = fallback_template.service_id
                 AND template_service.business_id = cp.business_id
                WHERE fallback_template.id = cp.package_template_id
                  AND fallback_template.business_id = cp.business_id
                LIMIT 1
              ),
              s.name
            ) AS service_name,

            (
              SELECT COUNT(*)
              FROM customer_package_appointments cpa
              JOIN appointments a
                ON a.id = cpa.appointment_id
              WHERE
                cpa.customer_package_id = cp.id
                AND a.status = 'completed'
            ) AS sessions_completed,

            (
              SELECT COUNT(*)
              FROM customer_package_appointments cpa
              JOIN appointments a
                ON a.id = cpa.appointment_id
              WHERE
                cpa.customer_package_id = cp.id
                AND a.status IN ('confirmed', 'pending')
            ) AS sessions_booked,

            (
              SELECT COALESCE(
                SUM(
                  CASE
                    WHEN p.payment_type = 'refund' AND p.status = 'paid'
                      THEN -ABS(p.amount_minor)
                    WHEN p.payment_type != 'refund'
                         AND p.status IN ('paid', 'partially_refunded', 'refunded')
                      THEN ABS(p.amount_minor)
                    ELSE 0
                  END
                ),
                0
              )
              FROM customer_package_payments cpp
              JOIN payments p
                ON p.id = cpp.payment_id
              WHERE cpp.customer_package_id = cp.id
              AND COALESCE(p.payment_method, '') != 'discount'
            ) AS paid_minor,

        (
          SELECT COALESCE(
            SUM(ps.consultation_credit_minor),
            0
          )
          FROM package_sales ps
          WHERE
            ps.business_id = cp.business_id
            AND ps.customer_package_id = cp.id
            AND ps.status = 'paid'
        ) AS consultation_credit_minor

          FROM customer_packages cp

          JOIN customers c
            ON c.id = cp.customer_id

          JOIN services s
            ON s.id = cp.service_id

          WHERE cp.business_id = ?

          ORDER BY
            CASE cp.status
              WHEN 'active' THEN 0
              WHEN 'completed' THEN 1
              ELSE 2
            END,
            datetime(cp.created_at) DESC
        `).bind(t.business_id).all(),e.DB.prepare(`
          SELECT id, first_name, last_name, email
          FROM customers
          WHERE business_id = ?
          ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
        `).bind(t.business_id).all(),e.DB.prepare(`
          SELECT
            id,
            name,
            duration_minutes,
            price_minor,
            service_type,
            requires_consultation,
            consultation_service_id,
            post_consultation_booking
          FROM services
          WHERE business_id = ? AND is_active = 1
          ORDER BY sort_order, name COLLATE NOCASE
        `).bind(t.business_id).all(),e.DB.prepare(`
          SELECT
            pv.id,
            pv.package_template_id,
            pv.service_id,
            pv.name,
            pv.price_minor,
            pv.payment_rule,
            pv.deposit_minor,
            pv.is_active,
            pv.sort_order,
            s.name AS service_name,
            s.requires_consultation,
            s.consultation_service_id,
            s.post_consultation_booking
          FROM package_variants pv
          JOIN services s
            ON s.id = pv.service_id
           AND s.business_id = pv.business_id
          WHERE pv.business_id = ?
          ORDER BY
            pv.package_template_id,
            pv.sort_order,
            pv.name COLLATE NOCASE
        `).bind(t.business_id).all(),e.DB.prepare("SELECT setting_key,setting_value FROM business_settings WHERE business_id=? AND setting_key LIKE 'reviews.package.%'").bind(t.business_id).all()]),p={};for(let m of l.results||[]){let _=String(m.setting_key||"").replace("reviews.package.","");try{let g=JSON.parse(m.setting_value||"[]");p[_]=Array.isArray(g)?g.map(Number).filter(Number.isInteger):[]}catch{p[_]=[]}}return Response.json({ok:!0,currency:t.currency||"GBP",templates:(r.results||[]).map(m=>({...m,review_sessions:p[m.id]||[]})),customer_packages:(a.results||[]).map(No),customers:o.results||[],services:u.results||[],variants:d.results||[]})}catch(t){return console.error("Packages GET failed:",t),Response.json({ok:!1,error:"Unable to load packages."},{status:500})}}c(Do,"onRequestGet");async function vo({request:s,env:e}){try{let t=await To(s,e);if(!t)return Ao();let i=await s.json(),n=String(i.action||"").trim();if(n==="save_template"){let r=String(i.id||"").trim(),a=String(i.name||"").trim(),o=String(i.description||"").trim(),u=String(i.service_id||"").trim(),d=Number(i.sessions_total),l=[...new Set((Array.isArray(i.review_sessions)?i.review_sessions:[]).map(Number).filter(R=>Number.isInteger(R)&&R>=1&&R<=d))].sort((R,L)=>R-L),p=Number(i.price_minor),m=Number(i.deposit_minor||0),_=i.validity_days===null||i.validity_days===""||i.validity_days===void 0?null:Number(i.validity_days),g=Array.isArray(i.variants)?i.variants:[],E=["full","deposit","pay_later"].includes(String(i.payment_rule||"full"))?String(i.payment_rule||"full"):"full";if(!a||!u)return ae("Package name and service are required.");if(!Number.isInteger(d)||d<=0)return ae("Sessions must be a positive whole number.");if(_!==null&&(!Number.isInteger(_)||_<=0))return ae("Validity must be a positive number of days.");let f=[];for(let R=0;R<g.length;R+=1){let L=g[R]||{},T=String(L.name||"").trim(),O=String(L.service_id||"").trim(),w=Number(L.price_minor),B=["full","deposit","pay_later"].includes(String(L.payment_rule||"full"))?String(L.payment_rule||"full"):"full",j=B==="deposit"?Number(L.deposit_minor||0):0;if(!T||!O)return ae("Every package variant needs a name and service.");if(!Number.isInteger(w)||w<0)return ae(`Enter a valid price for variant "${T}".`);if(!Number.isInteger(j)||j<0||j>w)return ae(`Enter a valid deposit for variant "${T}".`);let y=await e.DB.prepare(`
          SELECT
            id,
            service_type,
            requires_consultation,
            consultation_service_id,
            post_consultation_booking
          FROM services
          WHERE id = ? AND business_id = ? AND is_active = 1
          LIMIT 1
        `).bind(O,t.business_id).first();if(!y)return ae(`Service for variant "${T}" was not found.`);if(String(y.service_type||"standard")==="consultation")return ae(`Variant "${T}" must use a treatment/service.`);f.push({id:String(L.id||"").trim()||`pkv_${crypto.randomUUID()}`,name:T,service_id:O,price_minor:w,payment_rule:B,deposit_minor:j,sort_order:R,service:y})}if(f.length>0)p=Math.min(...f.map(R=>R.price_minor)),m=Math.min(...f.map(R=>R.deposit_minor));else{if(!Number.isInteger(p)||p<0)return ae("Enter a valid package price.");if(!Number.isInteger(m)||m<0)return ae("Enter a valid deposit amount.");if(m>p)return ae("Deposit cannot exceed the package price.")}let b=await e.DB.prepare(`
          SELECT
            id,
            service_type,
            requires_consultation,
            consultation_service_id,
            post_consultation_booking
          FROM services
          WHERE id = ? AND business_id = ?
          LIMIT 1
        `).bind(u,t.business_id).first();if(!b)return ae("Selected service was not found.");if(String(b.service_type||"standard")==="consultation")return ae("Packages must be linked to a treatment/service, not to a consultation service.");let N=Number(b.requires_consultation||0)===1&&String(b.post_consultation_booking||"client_can_book")==="practitioner_managed",v=f.length>0&&f.every(R=>Number(R.service.requires_consultation||0)===1&&String(R.service.post_consultation_booking||"client_can_book")==="practitioner_managed"),S=f.some(R=>R.payment_rule==="pay_later"),h=N||v||E==="pay_later"||S?0:i.is_public===1?1:0,I=r||`pkg_${crypto.randomUUID()}`;if(r){if(!await e.DB.prepare(`
            SELECT id
            FROM package_templates
            WHERE id = ? AND business_id = ?
            LIMIT 1
          `).bind(r,t.business_id).first())return vs("Package template not found.");await e.DB.prepare(`
            UPDATE package_templates
            SET
              name = ?,
              description = ?,
              service_id = ?,
              sessions_total = ?,
              price_minor = ?,
              payment_rule = ?,
              deposit_minor = ?,
              validity_days = ?,
              is_active = ?,
              is_public = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND business_id = ?
          `).bind(a,o||null,u,d,p,E,E==="deposit"?m:0,_,i.is_active===0?0:1,h,r,t.business_id).run()}else await e.DB.prepare(`
            INSERT INTO package_templates (
              id,
              business_id,
              service_id,
              name,
              description,
              sessions_total,
              price_minor,
              payment_rule,
              deposit_minor,
              validity_days,
              is_active,
              is_public
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(I,t.business_id,u,a,o||null,d,p,E,E==="deposit"?m:0,_,i.is_active===0?0:1,h).run();await e.DB.prepare(`
        DELETE FROM package_variants
        WHERE package_template_id = ? AND business_id = ?
      `).bind(I,t.business_id).run();for(let R of f)await e.DB.prepare(`
          INSERT INTO package_variants (
            id,
            business_id,
            package_template_id,
            service_id,
            name,
            price_minor,
            payment_rule,
            deposit_minor,
            is_active,
            sort_order
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(R.id,t.business_id,I,R.service_id,R.name,R.price_minor,R.payment_rule,R.deposit_minor,R.sort_order).run();return await e.DB.prepare(`
        INSERT INTO business_settings (id,business_id,setting_key,setting_value,value_type)
        VALUES (?,?,?,?, 'json')
        ON CONFLICT(business_id,setting_key) DO UPDATE SET
          setting_value=excluded.setting_value,value_type=excluded.value_type,updated_at=CURRENT_TIMESTAMP
      `).bind(`set_${crypto.randomUUID()}`,t.business_id,`reviews.package.${I}`,JSON.stringify(l)).run(),Response.json({ok:!0,template:{id:I}})}if(n==="archive_template"||n==="restore_template"){let r=String(i.id||"").trim();if(!r)return ae("Package template id is required.");if(!await e.DB.prepare(`
            SELECT id
            FROM package_templates
            WHERE
              id = ?
              AND business_id = ?
            LIMIT 1
          `).bind(r,t.business_id).first())return vs("Package template not found.");let o=n==="restore_template";return await e.DB.prepare(`
          UPDATE package_templates
          SET
            is_active = ?,
            is_public =
              CASE
                WHEN ? = 0
                  THEN 0
                ELSE is_public
              END,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
        `).bind(o?1:0,o?1:0,r,t.business_id).run(),Response.json({ok:!0})}if(n==="assign"){let r=String(i.customer_id||"").trim(),a=String(i.package_template_id||"").trim(),o=String(i.package_variant_id||"").trim(),u=String(i.starts_on||"").trim()||null,d=String(i.notes||"").trim().slice(0,1e3)||null;if(!r||!a)return ae("Customer and package are required.");if(!await e.DB.prepare(`
        SELECT id
        FROM customers
        WHERE id = ? AND business_id = ?
        LIMIT 1
      `).bind(r,t.business_id).first())return ae("Customer not found.");let p=await e.DB.prepare(`
        SELECT
          pt.id,
          pt.service_id,
          pt.name,
          pt.sessions_total,
          pt.price_minor,
          pt.validity_days,
          pt.is_active,
          s.requires_consultation
        FROM package_templates pt
        JOIN services s
          ON s.id = pt.service_id
         AND s.business_id = pt.business_id
        WHERE pt.id = ? AND pt.business_id = ?
        LIMIT 1
      `).bind(a,t.business_id).first();if(!p||Number(p.is_active)!==1)return ae("Package template is unavailable.");let _=(await e.DB.prepare(`
        SELECT
          pv.id,
          pv.service_id,
          pv.name,
          pv.price_minor,
          pv.deposit_minor,
          s.requires_consultation
        FROM package_variants pv
        JOIN services s
          ON s.id = pv.service_id
         AND s.business_id = pv.business_id
        WHERE
          pv.package_template_id = ?
          AND pv.business_id = ?
          AND pv.is_active = 1
        ORDER BY pv.sort_order, pv.name COLLATE NOCASE
      `).bind(p.id,t.business_id).all()).results||[];if(_.length>0&&!o)return ae("Choose a package variant.");let g=o?_.find(h=>h.id===o):null;if(o&&!g)return ae("Selected package variant is unavailable.");let E=g?.service_id||p.service_id,f=Number(g?.price_minor??p.price_minor??0),b=g?`${p.name} \xB7 ${g.name}`:p.name,N=Number(g?.requires_consultation??p.requires_consultation??0),v=null;if(u&&Number(p.validity_days||0)>0){let h=new Date(`${u}T12:00:00Z`);h.setUTCDate(h.getUTCDate()+Number(p.validity_days)),v=h.toISOString().slice(0,10)}let S=`cpk_${crypto.randomUUID()}`;return await e.DB.prepare(`
        INSERT INTO customer_packages (
          id,
          business_id,
          customer_id,
          package_template_id,
          package_variant_id,
          service_id,
          name_snapshot,
          sessions_total,
          price_minor,
          status,
          starts_on,
          expires_on,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `).bind(S,t.business_id,r,p.id,g?.id||null,E,b,p.sessions_total,f,u,v,d).run(),Response.json({ok:!0,customer_package:{id:S}})}if(n==="set_status"){let r=String(i.id||"").trim(),a=String(i.status||"").trim();return["active","completed","cancelled","expired"].includes(a)?await wo(e,t.business_id,r)?(await e.DB.prepare(`
          UPDATE customer_packages
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ?
        `).bind(a,r,t.business_id).run(),Response.json({ok:!0})):vs("Customer package not found."):ae("Invalid package status.")}return ae("Invalid package action.")}catch(t){return console.error("Packages POST failed:",t),Response.json({ok:!1,error:"Unable to save package."},{status:500})}}c(vo,"onRequestPost");async function Co(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id,
        b.currency

      FROM user_sessions s

      JOIN users u
        ON u.id =
           s.user_id

      JOIN businesses b
        ON b.id =
           u.business_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(
          s.expires_at
        ) > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(Co,"getUserContext");function Oo(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Oo,"unauthorized");function _e(s){return Response.json({ok:!1,error:s},{status:400})}c(_e,"badRequest");function Ud(s){return Response.json({ok:!1,error:s},{status:404})}c(Ud,"notFound");async function Io({request:s,env:e}){try{let t=await Co(s,e);if(!t)return Oo();await ms({env:e,businessId:t.business_id,baseUrl:new URL(s.url).origin}),await ue(e,t.business_id),await ps(e,t.business_id);let[i,n,r,a,o,u,d]=await Promise.all([e.DB.prepare(`
            SELECT
              p.id,
              p.appointment_id,
              p.customer_id,
              p.provider,
              p.payment_type,
              p.amount_minor,
              p.currency,
              p.status,
              p.provider_reference,
              p.paid_at,
              p.created_at,
              p.updated_at,
              p.payment_method,
              p.notes,

              (
                SELECT cpp.customer_package_id
                FROM customer_package_payments cpp
                WHERE cpp.payment_id = p.id
                LIMIT 1
              ) AS customer_package_id,

              (
                SELECT cp.name_snapshot
                FROM customer_package_payments cpp
                JOIN customer_packages cp
                  ON cp.id = cpp.customer_package_id
                WHERE cpp.payment_id = p.id
                LIMIT 1
              ) AS package_name,

              c.first_name,
              c.last_name,

              a.start_at,
              a.booking_kind AS appointment_booking_kind,
              s.name AS service_name,

              pp.display_name
                AS provider_display_name,

              CASE
                WHEN
                  p.payment_type = 'refund'
                THEN 0

                ELSE
                  MAX(
                    p.amount_minor -
                    COALESCE(
                      (
                        SELECT
                          SUM(r.amount_minor)

                        FROM payments r

                        WHERE
                          r.business_id =
                            p.business_id
                          AND r.payment_type =
                            'refund'
                          AND r.status =
                            'paid'
                          AND (
                            r.provider_reference =
                              'refund:' || p.id
                            OR instr(
                              COALESCE(r.notes, ''),
                              'original_payment=' || p.id
                            ) > 0
                          )
                      ),
                      0
                    ),
                    0
                  )
              END
              AS refundable_minor

            FROM payments p

            LEFT JOIN customers c
              ON c.id =
                 p.customer_id

            LEFT JOIN appointments a
              ON a.id =
                 p.appointment_id

            LEFT JOIN services s
              ON s.id =
                 a.service_id

            LEFT JOIN payment_providers pp
              ON pp.provider_key =
                 p.provider

            WHERE
              p.business_id = ?
              AND COALESCE(p.payment_method, '') != 'discount'
              AND NOT (p.provider = 'none' AND COALESCE(p.payment_method, '') = 'discount')
              AND NOT (
                p.status = 'failed'
                AND EXISTS (
                  SELECT 1
                  FROM package_sales ps_failed
                  WHERE
                    ps_failed.business_id = p.business_id
                    AND ps_failed.payment_id = p.id
                    AND ps_failed.status = 'failed'
                )
              )
              AND NOT (
                p.provider = 'stripe'
                AND p.status IN ('pending', 'failed')
                AND EXISTS (
                  SELECT 1
                  FROM appointments a_public_checkout
                  WHERE
                    a_public_checkout.id = p.appointment_id
                    AND a_public_checkout.business_id = p.business_id
                    AND a_public_checkout.booking_source = 'online'
                )
              )
              AND NOT (
                p.provider = 'stripe'
                AND p.status IN ('pending', 'failed')
                AND EXISTS (
                  SELECT 1
                  FROM package_sales ps_public_checkout
                  WHERE
                    ps_public_checkout.payment_id = p.id
                    AND ps_public_checkout.business_id = p.business_id
                    AND ps_public_checkout.source = 'public'
                    AND ps_public_checkout.status IN ('pending', 'failed')
                )
              )

            ORDER BY
              datetime(
                COALESCE(
                  p.paid_at,
                  p.created_at
                )
              ) DESC
          `).bind(t.business_id).all(),e.DB.prepare(`
            SELECT
              id,
              first_name,
              last_name

            FROM customers

            WHERE
              business_id = ?

            ORDER BY
              last_name COLLATE NOCASE,
              first_name COLLATE NOCASE
          `).bind(t.business_id).all(),e.DB.prepare(`
            SELECT
              a.id,
              a.customer_id,
              a.start_at,
              a.price_minor,
              a.consultation_credit_minor,
              a.status,

              c.first_name,
              c.last_name,

              s.name AS service_name,

              COALESCE(
                (
                  SELECT
                    SUM(
                      CASE
                        WHEN
                          p.payment_type =
                            'refund'
                        THEN -p.amount_minor
                        ELSE p.amount_minor
                      END
                    )

                  FROM payments p

                  WHERE
                    p.appointment_id =
                      a.id
                    AND p.business_id =
                      a.business_id
                    AND p.status IN (
                      'paid',
                      'partially_refunded',
                      'refunded'
                    )
                ),
                0
              ) AS paid_minor

            FROM appointments a

            JOIN customers c
              ON c.id =
                 a.customer_id

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              a.business_id = ?
              AND a.status !=
                  'cancelled'
              AND NOT (
                a.booking_source = 'online'
                AND a.status = 'pending'
              )

            ORDER BY
              datetime(a.start_at) DESC
          `).bind(t.business_id).all(),e.DB.prepare(`
            SELECT
              cp.id,
              cp.customer_id,
              cp.name_snapshot AS package_name,
              cp.price_minor,
              cp.starts_on,
              cp.status,

              c.first_name,
              c.last_name,

              s.name AS service_name,

              COALESCE(
                (
                  SELECT SUM(
                    CASE
                      WHEN p.payment_type = 'refund'
                           AND p.status = 'paid'
                        THEN -ABS(p.amount_minor)
                      WHEN p.payment_type != 'refund'
                           AND p.status IN (
                             'paid',
                             'partially_refunded',
                             'refunded'
                           )
                        THEN ABS(p.amount_minor)
                      ELSE 0
                    END
                  )
                  FROM customer_package_payments cpp
                  JOIN payments p
                    ON p.id = cpp.payment_id
                  WHERE cpp.customer_package_id = cp.id
                ),
                0
              ) AS paid_minor,

              COALESCE(
                (
                  SELECT SUM(
                    ps.consultation_credit_minor
                  )
                  FROM package_sales ps
                  WHERE
                    ps.business_id = cp.business_id
                    AND ps.customer_package_id = cp.id
                    AND ps.status = 'paid'
                ),
                0
              ) AS consultation_credit_minor

            FROM customer_packages cp

            JOIN customers c
              ON c.id = cp.customer_id

            LEFT JOIN services s
              ON s.id = cp.service_id

            WHERE
              cp.business_id = ?
              AND cp.status NOT IN (
                'cancelled',
                'expired'
              )

            ORDER BY
              date(cp.starts_on) DESC,
              datetime(cp.created_at) DESC
          `).bind(t.business_id).all(),e.DB.prepare(`
            SELECT
              pp.provider_key,
              pp.display_name,
              pp.provider_type,

              COALESCE(
                bpp.is_enabled,
                CASE
                  WHEN
                    pp.provider_key =
                      'manual'
                  THEN 1
                  ELSE 0
                END
              ) AS is_enabled,

              COALESCE(
                bpp.connection_status,
                'not_connected'
              ) AS connection_status

            FROM payment_providers pp

            LEFT JOIN
              business_payment_providers
              bpp

              ON bpp.provider_key =
                 pp.provider_key
              AND bpp.business_id = ?

            WHERE
              pp.is_available = 1
              AND (
                pp.provider_key =
                  'manual'
                OR bpp.is_enabled = 1
              )

            ORDER BY
              pp.sort_order,
              pp.display_name
          `).bind(t.business_id).all(),e.DB.prepare(`
            SELECT
              COALESCE(
                SUM(
                  CASE
                    WHEN
                      payment_type =
                        'refund'
                    THEN -amount_minor
                    ELSE amount_minor
                  END
                ),
                0
              ) AS total

            FROM payments

            WHERE
              business_id = ?
              AND NOT (provider = 'none' AND COALESCE(payment_method, '') = 'discount')
              AND status IN (
                'paid',
                'partially_refunded',
                'refunded'
              )
              AND strftime(
                '%Y-%m',
                COALESCE(
                  paid_at,
                  created_at
                )
              ) =
              strftime(
                '%Y-%m',
                'now'
              )
          `).bind(t.business_id).first(),e.DB.prepare(`
            SELECT
              COALESCE(
                SUM(amount_minor),
                0
              ) AS total

            FROM payments

            WHERE
              business_id = ?
              AND payment_type =
                  'refund'
              AND status = 'paid'
              AND strftime(
                '%Y-%m',
                COALESCE(
                  paid_at,
                  created_at
                )
              ) =
              strftime(
                '%Y-%m',
                'now'
              )
          `).bind(t.business_id).first()]),l=(r.results||[]).map(f=>{let b=Number(f.paid_minor||0),N=Number(f.price_minor||0),v=Number(f.consultation_credit_minor||0);return{...f,paid_minor:b,consultation_credit_minor:v,credited_paid_minor:b+v,balance_minor:Math.max(N-b-v,0)}}),p=(a.results||[]).map(f=>{let b=Number(f.paid_minor||0),N=Number(f.consultation_credit_minor||0),v=Number(f.price_minor||0);return{...f,outstanding_type:"package",paid_minor:b,consultation_credit_minor:N,balance_minor:Math.max(v-b-N,0)}}),m=l.filter(f=>Number(f.balance_minor)>0).map(f=>({...f,outstanding_type:"appointment"})),_=p.filter(f=>Number(f.balance_minor)>0),g=[...m,..._],E=g.reduce((f,b)=>f+Number(b.balance_minor||0),0);return Response.json({ok:!0,currency:t.currency||"GBP",stats:{paid_month_minor:Number(u?.total||0),outstanding_minor:E,refund_month_minor:Number(d?.total||0),transaction_count:(i.results||[]).length},payments:i.results||[],customers:n.results||[],appointments:l,package_balances:p,outstanding:g,providers:o.results||[]})}catch(t){return console.error("Payments GET failed:",t),Response.json({ok:!1,error:"Unable to load payments."},{status:500})}}c(Io,"onRequestGet");async function Lo({request:s,env:e}){try{let t=await Co(s,e);if(!t)return Oo();let i=await s.json();if(i.action==="refund")return await Bd({body:i,user:t,env:e});let n=String(i.customer_id||"").trim(),r=String(i.appointment_id||"").trim(),a=String(i.customer_package_id||"").trim(),o=String(i.provider||"").trim(),u=String(i.payment_method||"").trim(),d=String(i.payment_type||"").trim(),l=Number(i.amount_minor),p=String(i.provider_reference||"").trim(),m=String(i.notes||"").trim();if(!n)return _e("Customer is required.");if(!Number.isInteger(l)||l<=0)return _e("A valid amount is required.");if(!["full","deposit","balance","pay_at_appointment"].includes(d))return _e("Invalid payment type.");if(!["paypal","apple_pay","google_pay","card","cash","bank_transfer","other"].includes(u))return _e("Invalid payment method.");if(!await e.DB.prepare(`
          SELECT id

          FROM customers

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `).bind(n,t.business_id).first())return _e("Customer not found.");let f=null;if(a){if(f=await e.DB.prepare(`
            SELECT
              cp.id,
              cp.customer_id,
              cp.price_minor,
              cp.status,

              (
                SELECT COALESCE(
                  SUM(
                    CASE
                      WHEN p.payment_type = 'refund' AND p.status = 'paid'
                        THEN -ABS(p.amount_minor)
                      WHEN p.payment_type != 'refund'
                           AND p.status IN ('paid', 'partially_refunded', 'refunded')
                        THEN ABS(p.amount_minor)
                      ELSE 0
                    END
                  ),
                  0
                )
                FROM customer_package_payments cpp
                JOIN payments p
                  ON p.id = cpp.payment_id
                WHERE cpp.customer_package_id = cp.id
              ) AS paid_minor,

              (
                SELECT COALESCE(
                  SUM(ps.consultation_credit_minor),
                  0
                )
                FROM package_sales ps
                WHERE
                  ps.business_id = cp.business_id
                  AND ps.customer_package_id = cp.id
                  AND ps.status = 'paid'
              ) AS consultation_credit_minor

            FROM customer_packages cp

            WHERE
              cp.id = ?
              AND cp.business_id = ?

            LIMIT 1
          `).bind(a,t.business_id).first(),!f)return _e("Customer package not found.");if(f.customer_id!==n)return _e("Package does not belong to the selected customer.");if(f.status==="cancelled"||f.status==="expired")return _e("A payment cannot be recorded against this package.");let S=Math.max(Number(f.price_minor||0)-Number(f.paid_minor||0)-Number(f.consultation_credit_minor||0),0);if(l>S)return _e(`Payment cannot exceed the remaining package balance of ${(S/100).toFixed(2)}.`)}let b=null;if(r){if(b=await e.DB.prepare(`
            SELECT
              id,
              customer_id,
              price_minor,
              consultation_credit_minor,
              status

            FROM appointments

            WHERE
              id = ?
              AND business_id = ?

            LIMIT 1
          `).bind(r,t.business_id).first(),!b)return _e("Appointment not found.");if(b.customer_id!==n)return _e("Appointment does not belong to the selected customer.");if(String(b.status||"").toLowerCase()==="cancelled")return _e("A payment cannot be recorded against a cancelled appointment.");let S=await e.DB.prepare(`
            SELECT
              COALESCE(
                SUM(
                  CASE
                    WHEN
                      payment_type = 'refund'
                    THEN -ABS(amount_minor)

                    WHEN
                      payment_type != 'refund'
                      AND status IN (
                        'paid',
                        'partially_refunded',
                        'refunded'
                      )
                    THEN amount_minor

                    ELSE 0
                  END
                ),
                0
              ) AS net_paid_minor

            FROM payments

            WHERE
              business_id = ?
              AND appointment_id = ?
              AND status IN (
                'paid',
                'partially_refunded',
                'refunded'
              )
          `).bind(t.business_id,r).first(),h=Number(b.price_minor||0),I=Number(S?.net_paid_minor||0),R=Math.max(h-I-Number(b.consultation_credit_minor||0),0);if(R<=0)return _e("This appointment has already been paid in full.");if(l>R)return _e(`Payment cannot exceed the remaining outstanding balance of ${(R/100).toFixed(2)}.`)}let N=await e.DB.prepare(`
          SELECT
            pp.provider_key,

            COALESCE(
              bpp.is_enabled,
              CASE
                WHEN
                  pp.provider_key =
                    'manual'
                THEN 1
                ELSE 0
              END
            ) AS is_enabled

          FROM payment_providers pp

          LEFT JOIN
            business_payment_providers
            bpp

            ON bpp.provider_key =
               pp.provider_key
            AND bpp.business_id = ?

          WHERE
            pp.provider_key = ?
            AND pp.is_available = 1

          LIMIT 1
        `).bind(t.business_id,o).first();if(!N||N.is_enabled!==1)return _e("Selected payment provider is not enabled.");let v=`pay_${crypto.randomUUID()}`;await e.DB.prepare(`
        INSERT INTO payments (
          id,
          business_id,
          appointment_id,
          customer_id,
          provider,
          payment_type,
          amount_minor,
          currency,
          status,
          provider_reference,
          paid_at,
          payment_method,
          notes
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          'paid',
          ?,
          CURRENT_TIMESTAMP,
          ?,
          ?
        )
      `).bind(v,t.business_id,r||null,n,o,d,l,t.currency||"GBP",p||null,u,m||null).run(),a&&await e.DB.prepare(`
          INSERT INTO customer_package_payments (
            customer_package_id,
            payment_id
          )
          VALUES (?, ?)
        `).bind(a,v).run(),r&&await Ce({env:e,businessId:t.business_id,appointmentId:r,triggerEvent:"payment_received",baseUrl:new URL(s.url).origin,createdByUserId:t.user_id});try{await ye({env:e,businessId:t.business_id,paymentId:v,baseUrl:new URL(s.url).origin})}catch(S){console.error("Automatic payment receipt failed:",S)}return Response.json({ok:!0,payment:{id:v}})}catch(t){return console.error("Payment creation failed:",t),Response.json({ok:!1,error:"Unable to record payment."},{status:500})}}c(Lo,"onRequestPost");async function Bd({body:s,user:e,env:t}){let i=String(s.payment_id||"").trim(),n=Number(s.amount_minor),r=String(s.notes||"").trim();if(!i||!Number.isInteger(n)||n<=0)return _e("Payment and refund amount are required.");let a=await t.DB.prepare(`
        SELECT
          id,
          appointment_id,
          customer_id,
          provider,
          payment_method,
          amount_minor,
          currency,
          status,
          payment_type

        FROM payments

        WHERE
          id = ?
          AND business_id = ?

        LIMIT 1
      `).bind(i,e.business_id).first();if(!a)return Ud("Payment not found.");if(a.payment_type==="refund"||a.status!=="paid")return _e("This payment cannot be refunded.");let o=await t.DB.prepare(`
        SELECT
          COALESCE(
            SUM(amount_minor),
            0
          ) AS total

        FROM payments

        WHERE
          business_id = ?
          AND payment_type =
              'refund'
          AND status = 'paid'
          AND (
            provider_reference =
              ?
            OR instr(
              COALESCE(notes, ''),
              ?
            ) > 0
          )
      `).bind(e.business_id,`refund:${i}`,`original_payment=${i}`).first(),u=Number(o?.total||0),d=Number(a.amount_minor)-u;if(n>d)return _e("Refund amount exceeds the remaining refundable amount.");let l=`pay_${crypto.randomUUID()}`,p=[`original_payment=${i}`,r].filter(Boolean).join(" \xB7 ");return await t.DB.prepare(`
      INSERT INTO payments (
        id,
        business_id,
        appointment_id,
        customer_id,
        provider,
        payment_type,
        amount_minor,
        currency,
        status,
        provider_reference,
        paid_at,
        payment_method,
        notes
      )

      VALUES (
        ?, ?, ?, ?, ?,
        'refund',
        ?, ?,
        'paid',
        ?,
        CURRENT_TIMESTAMP,
        ?,
        ?
      )
    `).bind(l,e.business_id,a.appointment_id||null,a.customer_id||null,a.provider,n,a.currency||e.currency||"GBP",`refund:${i}`,a.payment_method||"other",p).run(),Response.json({ok:!0,refund:{id:l}})}c(Bd,"createRefund");async function Ui(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at)
            > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(Ui,"getUserContext");function Bi(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Bi,"unauthorised");function Pi(s){let e=Number(s);return!Number.isFinite(e)||e<0?null:Math.round(e*100)}c(Pi,"moneyToMinor");async function Mo({request:s,env:e}){try{let t=await Ui(s,e);if(!t)return Bi();let i=await e.DB.prepare(`
          SELECT
            id,
            name,
            description,
            booking_group,
            service_type,
            consultation_service_id,
            post_consultation_booking,
            duration_minutes,
            price_minor,
            deposit_minor,
            payment_timing,
            consultation_duration_minutes,
            consultation_price_minor,
            consultation_payment_timing,
            requires_consultation,
            requires_patch_test,
            is_active,
            sort_order

          FROM services

          WHERE business_id = ?

          ORDER BY
            sort_order ASC,
            name COLLATE NOCASE ASC
        `).bind(t.business_id).all(),n=await e.DB.prepare(`
          SELECT
            bpp.provider_key,
            pp.display_name,
            bpp.is_default

          FROM business_payment_providers bpp

          JOIN payment_providers pp
            ON pp.provider_key =
               bpp.provider_key

          WHERE
            bpp.business_id = ?
            AND bpp.is_enabled = 1
            AND pp.provider_type = 'online'

          ORDER BY
            pp.sort_order ASC
        `).bind(t.business_id).all(),r=await e.DB.prepare(`
          SELECT
            spp.service_id,
            spp.provider_key

          FROM service_payment_providers spp

          JOIN services s
            ON s.id =
               spp.service_id

          WHERE
            s.business_id = ?
        `).bind(t.business_id).all(),a={};for(let _ of r.results||[])a[_.service_id]||(a[_.service_id]=[]),a[_.service_id].push(_.provider_key);let o=await e.DB.prepare(`
          SELECT id, name, template_type, version
          FROM clinical_templates
          WHERE business_id = ?
            AND is_active = 1
            AND is_published = 1
            AND is_client_sendable = 1
          ORDER BY name COLLATE NOCASE ASC
        `).bind(t.business_id).all(),u=await e.DB.prepare(`
          SELECT service_id, template_id, trigger_event, is_active
          FROM service_form_rules
          WHERE business_id = ?
        `).bind(t.business_id).all(),d=await e.DB.prepare(`
      SELECT setting_key, setting_value
      FROM business_settings
      WHERE business_id = ? AND setting_key LIKE 'reviews.service.%'
    `).bind(t.business_id).all(),l={};for(let _ of d.results||[]){let g=String(_.setting_key||"").replace("reviews.service.","");l[g]=String(_.setting_value||"0")==="1"}let p={};for(let _ of u.results||[])p[_.service_id]||(p[_.service_id]=[]),p[_.service_id].push({template_id:_.template_id,trigger_event:_.trigger_event,is_active:_.is_active});let m=(i.results||[]).map(_=>({..._,providers:a[_.id]||[],form_rules:p[_.id]||[],review_request_enabled:l[_.id]===!0}));return Response.json({ok:!0,services:m,providers:n.results||[],client_templates:o.results||[]})}catch(t){return console.error("Services GET failed:",t),Response.json({ok:!1,error:"Unable to load services."},{status:500})}}c(Mo,"onRequestGet");async function xo({request:s,env:e,updating:t}){let i=await Ui(s,e);if(!i)return Bi();let n=await s.json(),r=String(n.id||"").trim(),a=String(n.name||"").trim(),o=String(n.description||"").trim(),u=String(n.booking_group||"").trim().slice(0,100),d=["client_can_book","practitioner_managed"].includes(String(n.post_consultation_booking||"client_can_book"))?String(n.post_consultation_booking||"client_can_book"):"client_can_book",l=String(n.service_type||"standard")==="consultation"?"consultation":"standard",p=l==="standard"&&n.requires_consultation?String(n.consultation_service_id||"").trim():"",m=Number(n.duration_minutes),_=Pi(n.price),g=Pi(n.deposit||0),E=String(n.payment_timing||"pay_at_appointment"),f=n.requires_consultation&&!p?Number(n.consultation_duration_minutes||30):null,b=n.requires_consultation&&!p?Pi(n.consultation_price||0):0,N=n.requires_consultation&&!p?String(n.consultation_payment_timing||"free"):"free",v=Array.isArray(n.providers)?[...new Set(n.providers.map(O=>String(O)))]:[],S=Array.isArray(n.form_rules)?n.form_rules.map(O=>({template_id:String(O?.template_id||"").trim(),trigger_event:String(O?.trigger_event||"manual").trim()})).filter(O=>O.template_id):[],h=["payment_received","booking_confirmed","manual"];for(let O of S)if(!h.includes(O.trigger_event))return Response.json({ok:!1,error:"Invalid client form trigger."},{status:400});let I=["online_full","online_deposit","pay_at_appointment","free"],R=["online_full","pay_at_appointment","free"];if(p&&!await e.DB.prepare(`
          SELECT id
          FROM services
          WHERE
            id = ?
            AND business_id = ?
            AND service_type = 'consultation'
            AND is_active = 1
          LIMIT 1
        `).bind(p,i.business_id).first())return Response.json({ok:!1,error:"Choose a valid active consultation service."},{status:400});if(!a)return Response.json({ok:!1,error:"Service name is required."},{status:400});if(!Number.isInteger(m)||m<=0)return Response.json({ok:!1,error:"A valid duration is required."},{status:400});if(n.requires_consultation&&!p&&(!Number.isInteger(f)||f<=0))return Response.json({ok:!1,error:"A valid consultation duration is required."},{status:400});if(b===null)return Response.json({ok:!1,error:"Invalid consultation price."},{status:400});if(n.requires_consultation&&!R.includes(N))return Response.json({ok:!1,error:"Invalid consultation payment rule."},{status:400});if(n.requires_consultation&&N==="online_full"&&b<=0)return Response.json({ok:!1,error:"Online consultation payment requires a consultation fee greater than zero."},{status:400});if(_===null||g===null)return Response.json({ok:!1,error:"Invalid price."},{status:400});if(!I.includes(E))return Response.json({ok:!1,error:"Invalid payment rule."},{status:400});if(E==="online_deposit"&&(g<=0||g>_))return Response.json({ok:!1,error:"Deposit must be greater than zero and cannot exceed the service price."},{status:400});if((E==="online_full"||E==="online_deposit"||n.requires_consultation&&N==="online_full")&&v.length===0)return Response.json({ok:!1,error:"Choose at least one online payment provider."},{status:400});if(S.length){let O=[...new Set(S.map(y=>y.template_id))],w=O.map(()=>"?").join(", "),B=await e.DB.prepare(`SELECT id FROM clinical_templates WHERE business_id = ? AND is_active = 1 AND is_published = 1 AND is_client_sendable = 1 AND id IN (${w})`).bind(i.business_id,...O).all(),j=new Set((B.results||[]).map(y=>y.id));if(O.some(y=>!j.has(y)))return Response.json({ok:!1,error:"One or more selected client forms are unavailable."},{status:400})}let L=r;if(t){if(!L)return Response.json({ok:!1,error:"Service ID is required."},{status:400});if(!await e.DB.prepare(`
          SELECT id

          FROM services

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `).bind(L,i.business_id).first())return Response.json({ok:!1,error:"Service not found."},{status:404});await e.DB.prepare(`
        UPDATE services

        SET
          name = ?,
          description = ?,
          booking_group = ?,
          service_type = ?,
          consultation_service_id = ?,
          post_consultation_booking = ?,
          duration_minutes = ?,
          price_minor = ?,
          deposit_minor = ?,
          payment_timing = ?,
          consultation_duration_minutes = ?,
          consultation_price_minor = ?,
          consultation_payment_timing = ?,

          payment_mode =
            CASE ?
              WHEN 'online_full'
                THEN 'stripe_full'

              WHEN 'online_deposit'
                THEN 'stripe_deposit'

              WHEN 'free'
                THEN 'free'

              ELSE
                'pay_at_appointment'
            END,

          requires_consultation = ?,
          requires_patch_test = ?,
          is_active = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `).bind(a,o||null,u||null,l,p||null,d,m,_,g,E,f,b,N,E,n.requires_consultation?1:0,n.requires_patch_test?1:0,n.is_active?1:0,L,i.business_id).run()}else L=`svc_${crypto.randomUUID()}`,await e.DB.prepare(`
        INSERT INTO services (
          id,
          business_id,
          name,
          description,
          booking_group,
          service_type,
          consultation_service_id,
          post_consultation_booking,
          duration_minutes,
          price_minor,
          deposit_minor,
          payment_mode,
          payment_timing,
          consultation_duration_minutes,
          consultation_price_minor,
          consultation_payment_timing,
          requires_consultation,
          requires_patch_test,
          is_active
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          CASE ?
            WHEN 'online_full'
              THEN 'stripe_full'

            WHEN 'online_deposit'
              THEN 'stripe_deposit'

            WHEN 'free'
              THEN 'free'

            ELSE
              'pay_at_appointment'
          END,
          ?, ?, ?, ?, ?, ?, ?
        )
      `).bind(L,i.business_id,a,o||null,u||null,l,p||null,d,m,_,g,E,E,f,b,N,n.requires_consultation?1:0,n.requires_patch_test?1:0,n.is_active?1:0).run();await e.DB.prepare(`
      DELETE FROM service_form_rules
      WHERE business_id = ? AND service_id = ?
    `).bind(i.business_id,L).run();for(let O of S)await e.DB.prepare(`
        INSERT INTO service_form_rules (id,business_id,service_id,template_id,trigger_event,is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).bind(`sfr_${crypto.randomUUID()}`,i.business_id,L,O.template_id,O.trigger_event).run();if(await e.DB.prepare(`
      DELETE FROM service_payment_providers

      WHERE service_id = ?
    `).bind(L).run(),E==="online_full"||E==="online_deposit"||n.requires_consultation&&N==="online_full")for(let O of v)await e.DB.prepare(`
            SELECT 1

            FROM business_payment_providers

            WHERE
              business_id = ?
              AND provider_key = ?
              AND is_enabled = 1

            LIMIT 1
          `).bind(i.business_id,O).first()&&await e.DB.prepare(`
          INSERT OR IGNORE
          INTO service_payment_providers (
            service_id,
            provider_key
          )

          VALUES (?, ?)
        `).bind(L,O).run();let T=l!=="consultation"&&n.review_request_enabled===!0;return await e.DB.prepare(`
    INSERT INTO business_settings (id,business_id,setting_key,setting_value,value_type)
    VALUES (?,?,?,?, 'boolean')
    ON CONFLICT(business_id,setting_key) DO UPDATE SET
      setting_value=excluded.setting_value,value_type=excluded.value_type,updated_at=CURRENT_TIMESTAMP
  `).bind(`set_${crypto.randomUUID()}`,i.business_id,`reviews.service.${L}`,T?"1":"0").run(),Response.json({ok:!0,service_id:L})}c(xo,"saveService");async function Po(s){try{return await xo({...s,updating:!1})}catch(e){return console.error("Service creation failed:",e),Response.json({ok:!1,error:"Unable to create service."},{status:500})}}c(Po,"onRequestPost");async function Uo(s){try{return await xo({...s,updating:!0})}catch(e){return console.error("Service update failed:",e),Response.json({ok:!1,error:"Unable to update service."},{status:500})}}c(Uo,"onRequestPut");async function Bo({request:s,env:e}){try{let t=await Ui(s,e);if(!t)return Bi();let i=String(new URL(s.url).searchParams.get("id")||"").trim();return i?await e.DB.prepare(`
      SELECT id FROM services
      WHERE id = ? AND business_id = ?
      LIMIT 1
    `).bind(i,t.business_id).first()?await e.DB.prepare(`
      SELECT id FROM services
      WHERE business_id = ? AND consultation_service_id = ?
      LIMIT 1
    `).bind(t.business_id,i).first()?Response.json({ok:!1,error:"This consultation is linked to another service. Remove that consultation link before deleting it."},{status:409}):await e.DB.prepare(`
      SELECT id FROM package_templates
      WHERE business_id = ? AND service_id = ?
      LIMIT 1
    `).bind(t.business_id,i).first()?Response.json({ok:!1,error:"This service is used by a package. Remove or change the package first."},{status:409}):await e.DB.prepare(`
      SELECT id FROM package_variants
      WHERE business_id = ? AND service_id = ?
      LIMIT 1
    `).bind(t.business_id,i).first()?Response.json({ok:!1,error:"This service is used by a package variant. Remove or change that package variant first."},{status:409}):await e.DB.prepare(`
      SELECT id FROM appointments
      WHERE business_id = ? AND service_id = ?
      LIMIT 1
    `).bind(t.business_id,i).first()?Response.json({ok:!1,error:"This service has booking history, so it cannot be permanently deleted. Turn off Service is active instead."},{status:409}):await e.DB.prepare(`
      SELECT id FROM customer_packages
      WHERE business_id = ? AND service_id = ?
      LIMIT 1
    `).bind(t.business_id,i).first()?Response.json({ok:!1,error:"This service is linked to a customer package, so it cannot be permanently deleted. Turn off Service is active instead."},{status:409}):(await e.DB.prepare(`
      DELETE FROM services
      WHERE id = ? AND business_id = ?
    `).bind(i,t.business_id).run(),Response.json({ok:!0,deleted_service_id:i})):Response.json({ok:!1,error:"Service not found."},{status:404}):Response.json({ok:!1,error:"Service id is required."},{status:400})}catch(t){return console.error("Service deletion failed:",t),Response.json({ok:!1,error:"This service cannot be deleted because other records still depend on it. Remove those links first, or turn off Service is active."},{status:409})}}c(Bo,"onRequestDelete");async function qo(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at)
            > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(qo,"getUserContext");function jo(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(jo,"unauthorized");async function Ho({request:s,env:e}){try{let t=await qo(s,e);if(!t)return jo();let i=await e.DB.prepare(`
          SELECT
            id,
            name,
            legal_name,
            email,
            phone,
            website,
            country_code,
            timezone,
            currency,
            locale

          FROM businesses

          WHERE id = ?

          LIMIT 1
        `).bind(t.business_id).first();return Response.json({ok:!0,business:i})}catch(t){return console.error("Settings GET failed:",t),Response.json({ok:!1,error:"Unable to load settings."},{status:500})}}c(Ho,"onRequestGet");async function Fo({request:s,env:e}){try{let t=await qo(s,e);if(!t)return jo();let i=await s.json(),n=String(i.name||"").trim(),r=String(i.legal_name||"").trim(),a=String(i.email||"").trim(),o=String(i.phone||"").trim(),u=String(i.website||"").trim(),d=String(i.country_code||"GB").trim(),l=String(i.timezone||"Europe/London").trim(),p=String(i.currency||"GBP").trim(),m=String(i.locale||"en-GB").trim();return n?(await e.DB.prepare(`
        UPDATE businesses

        SET
          name = ?,
          legal_name = ?,
          email = ?,
          phone = ?,
          website = ?,
          country_code = ?,
          timezone = ?,
          currency = ?,
          locale = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = ?
      `).bind(n,r||null,a||null,o||null,u||null,d,l,p,m,t.business_id).run(),Response.json({ok:!0})):Response.json({ok:!1,error:"Business name is required."},{status:400})}catch(t){return console.error("Settings update failed:",t),Response.json({ok:!1,error:"Unable to save settings."},{status:500})}}c(Fo,"onRequestPut");var Wo=["001_initial_schema","002_installer_state","003_payment_providers","004_authentication","005_service_payments","006_booking_buffers","007_payment_methods","008_provider_independent_payments","009_treatment_records","010_clinical_templates","011_branding_and_template_conditions","012_form_renderer_and_submissions","013_expand_clinical_field_types","014_clinical_submissions_viewer","015_clinical_integrity_cleanup","016_clinical_template_snapshots","017_form_requests","018_client_sendable_templates","019_consultation_email_delivery","020_independent_integrations","021_customer_communications","022_customer_self_service","023_service_form_rules","024_customer_photos","025_packages_courses","026_package_sales","027_automated_communications","028_consultation_package_booking","029_consultation_credit","030_clinic_balance_payment","031_treatment_aftercare_communications","032_service_public_booking_modes","033_service_consultation_pathways","034_package_variants","035_package_payment_rules","036_gmail_email_provider","037_password_reset","038_data_imports","039_update_recovery_points","040_r2_file_recovery","041_r2_recovery_source_metadata","042_google_review_requests"];async function qd(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.business_id,
        u.name AS user_name

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at)
            > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(qd,"getUserContext");function jd(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(jd,"unauthorized");function Ie({key:s,label:e,complete:t,status:i,detail:n,href:r=null,required:a=!0}){return{key:s,label:e,complete:!!t,status:i,detail:n,href:r,required:a}}c(Ie,"item");async function $o({request:s,env:e}){try{let t=await qd(s,e);if(!t)return jd();let i=t.business_id,n=e.DB.prepare(`
          SELECT
            status,
            last_tested_at,
            last_error,
            config_json
          FROM business_email_connections
          WHERE business_id = ?
            AND provider = 'gmail'
          LIMIT 1
        `).bind(i).first().catch(te=>(console.warn("Gmail health data is not available in this installation:",te?.message||te),null)),[r,a,o,u,d,l,p,m,_,g,E,f]=await Promise.all([e.DB.prepare(`
            SELECT
              id,
              name,
              legal_name,
              email,
              phone,
              website,
              country_code,
              timezone,
              currency,
              locale

            FROM businesses

            WHERE id = ?

            LIMIT 1
          `).bind(i).first(),e.DB.prepare(`
            SELECT
              business_id,
              primary_colour,
              accent_colour,
              background_colour,
              surface_colour,
              text_colour

            FROM business_branding

            WHERE business_id = ?

            LIMIT 1
          `).bind(i).first(),e.DB.prepare(`
            SELECT
              COUNT(*) AS total_rows,
              SUM(
                CASE
                  WHEN
                    is_open = 1
                    AND open_time IS NOT NULL
                    AND close_time IS NOT NULL
                  THEN 1
                  ELSE 0
                END
              ) AS open_days

            FROM working_hours

            WHERE business_id = ?
          `).bind(i).first(),e.DB.prepare(`
            SELECT
              COUNT(*) AS active_count

            FROM services

            WHERE
              business_id = ?
              AND is_active = 1
          `).bind(i).first(),e.DB.prepare(`
            SELECT
              provider,
              status,
              last_tested_at,
              last_error

            FROM business_integrations

            WHERE
              business_id = ?
              AND integration_type = 'email'

            LIMIT 1
          `).bind(i).first(),n,e.DB.prepare(`
            SELECT
              COUNT(
                CASE
                  WHEN is_enabled = 1
                  THEN 1
                END
              ) AS enabled_count,

              COUNT(
                CASE
                  WHEN
                    is_enabled = 1
                    AND is_default = 1
                  THEN 1
                END
              ) AS default_count,

              COUNT(
                CASE
                  WHEN
                    is_enabled = 1
                    AND is_default = 1
                    AND connection_status = 'connected'
                  THEN 1
                END
              ) AS connected_default_count,

              GROUP_CONCAT(
                CASE
                  WHEN is_enabled = 1
                  THEN provider_key
                END
              ) AS enabled_keys

            FROM business_payment_providers

            WHERE business_id = ?
          `).bind(i).first(),e.DB.prepare(`
            SELECT
              COUNT(
                CASE
                  WHEN is_active = 1
                  THEN 1
                END
              ) AS active_templates,

              COUNT(
                CASE
                  WHEN
                    name = 'General Consultation'
                    AND is_active = 1
                    AND is_published = 1
                    AND is_client_sendable = 1
                  THEN 1
                END
              ) AS ready_general_consultation

            FROM clinical_templates

            WHERE business_id = ?
          `).bind(i).first(),e.DB.prepare(`
            SELECT
              COUNT(*) AS upload_field_count

            FROM clinical_template_fields f

            JOIN clinical_templates t
              ON t.id = f.template_id

            WHERE
              f.business_id = ?
              AND f.field_type = 'file_upload'
              AND t.is_active = 1
          `).bind(i).first(),e.DB.prepare(`
            SELECT
              COUNT(*) AS owner_count

            FROM users

            WHERE
              business_id = ?
              AND role = 'owner'
              AND is_active = 1
          `).bind(i).first(),e.DB.prepare(`
            SELECT version

            FROM schema_migrations
          `).all(),e.DB.prepare(`
            SELECT
              current_step,
              is_complete,
              completed_at

            FROM installer_state

            WHERE id = 1

            LIMIT 1
          `).first()]),b=!!(r?.name&&r?.email&&r?.country_code&&r?.timezone&&r?.currency&&r?.locale),N=!!(a?.primary_colour&&a?.background_colour&&a?.text_colour),v=Number(o?.total_rows||0)>=7&&Number(o?.open_days||0)>=1,S=Number(u?.active_count||0)>=1,h=!!String(e.ESELRAM_ENCRYPTION_KEY||"").trim(),I=["configured","verified"].includes(String(l?.status||"")),R=d?.provider==="resend"&&d?.status==="verified",L=I||R,O=String(p?.enabled_keys||"").split(",").map(te=>te.trim()).filter(Boolean).includes("manual"),w=Number(p?.enabled_count||0)>=1&&Number(p?.default_count||0)===1&&(Number(p?.connected_default_count||0)===1||O&&Number(p?.enabled_count||0)===1),B=Number(m?.active_templates||0)>=1&&Number(m?.ready_general_consultation||0)>=1,j=Number(_?.upload_field_count||0),y=!1,F=!!e.FORM_UPLOADS,Z=Number(g?.owner_count||0)>=1,oe=new Set((E?.results||[]).map(te=>String(te.version||""))),H=Wo.filter(te=>!oe.has(te)),z=H.length===0,ie=new URL(s.url).host,$=String(e.ESELRAM_PUBLIC_BOOKING_URL||"").trim(),me="";if($)try{let te=new URL($),k=te.hostname.split(".");te.protocol==="https:"&&te.hostname.endsWith(".eselram.com")&&k.length>=3&&(me=`https://${k[0].replace(/-admin$/,"")}-admin.eselram.com`)}catch{}let Ve=[Ie({key:"business",label:"Business details",complete:b,status:b?"Complete":"Needs attention",detail:b?`${r.name} \xB7 ${r.email}`:"Add the business name, email, locale, timezone and currency.",href:"/settings/#business"}),Ie({key:"owner",label:"Owner account",complete:Z,status:Z?"Complete":"Needs attention",detail:Z?"An active owner account is available.":"Create at least one active owner account.",href:"/settings/#users"}),Ie({key:"branding",label:"Branding",complete:N,status:N?"Complete":"Needs attention",detail:N?"Client-facing branding is configured.":"Configure colours and client-facing branding.",href:"/settings/branding.html"}),Ie({key:"hours",label:"Working hours",complete:v,status:v?"Complete":"Needs attention",detail:v?`${Number(o.open_days||0)} open day(s) configured.`:"Configure all weekdays and make at least one day available.",href:"/settings/#hours"}),Ie({key:"services",label:"Services",complete:S,status:S?"Complete":"Needs attention",detail:S?`${Number(u.active_count||0)} active service(s).`:"Create at least one active bookable service.",href:"/services/"}),Ie({key:"encryption",label:"Credential encryption",complete:h,status:h?"Ready":"Missing secret",detail:h?"ESELRAM_ENCRYPTION_KEY is available to this installation.":"Add ESELRAM_ENCRYPTION_KEY as a Cloudflare secret before storing provider credentials.",href:null}),Ie({key:"email",label:"Email provider",complete:L,status:I?"Gmail ready":R?"Resend ready":d?.provider==="resend"?"Gmail or domain setup available":"Optional setup",detail:I?"Gmail is connected and can send automated client emails without a business domain.":R?"The business email connection is ready.":"Connect Gmail to send confirmations, reminders and other client emails. A website or sending domain is not required.",href:"/settings/#email",required:!1}),Ie({key:"payments",label:"Payments",complete:w,status:w?"Ready":"Needs attention",detail:w?`Default payment method is connected${p?.enabled_keys?` \xB7 ${p.enabled_keys}`:""}.`:"Enable a payment method and ensure the default method is connected.",href:"/settings/#payments"}),Ie({key:"clinical",label:"Clinical templates",complete:B,status:B?"Ready":"Needs attention",detail:B?"Clinical templates are available and General Consultation is ready for client use.":"Keep internal templates available and publish General Consultation for client forms.",href:"/clinical-templates/"}),Ie({key:"storage",label:"Photo & file storage",complete:F,status:F?"Connected":"Optional setup",detail:F?`Secure photo & file storage is connected${j?` \xB7 ${j} active clinical upload field(s)`:""}.`:"Optional. Enable buyer-owned Cloudflare storage when you want customer photos, treatment photos or file uploads.",href:"/settings/storage.html",required:y}),Ie({key:"database",label:"Database",complete:z,status:z?"Up to date":"Migrations missing",detail:z?`All ${Wo.length} required migrations are recorded.`:`Missing: ${H.join(", ")}`,href:null}),Ie({key:"domain",label:"Branded Eselram URLs",complete:!!$,status:$?"Ready":"Managed by Eselram",detail:$?`Booking: ${$}${me?` \xB7 Admin: ${me}`:""}`:"Your customer-facing booking and admin addresses are managed by Eselram.",href:null,required:!1})],ut=Ve.filter(te=>te.required),dt=ut.filter(te=>!te.complete);return Response.json({ok:!0,ready:dt.length===0,progress:{complete:ut.length-dt.length,total:ut.length,remaining:dt.length},installation:{is_complete:f?.is_complete===1,current_step:f?.current_step||"unknown",completed_at:f?.completed_at||null},business:{id:r?.id||null,name:r?.name||"Eselram"},user:{name:t?.user_name||""},environment:{public_booking_url:$||null,admin_url:me||null,encryption_ready:h,form_uploads_bound:!!e.FORM_UPLOADS},items:Ve},{headers:{"Cache-Control":"no-store"}})}catch(t){return console.error("Setup health check failed:",t),Response.json({ok:!1,error:"Unable to check installation health."},{status:500,headers:{"Cache-Control":"no-store"}})}}c($o,"onRequestGet");async function Jo({env:s}){try{let e=await s.DB.prepare(`
        SELECT current_step, is_complete
        FROM installer_state
        WHERE id = 1
      `).first(),t=await s.DB.prepare(`
        SELECT id, name
        FROM businesses
        LIMIT 1
      `).first();return Response.json({ok:!0,installation_required:!e||e.is_complete!==1,installation:{current_step:e?.current_step||"welcome",is_complete:e?.is_complete===1},business:t||null},{headers:{"Cache-Control":"no-store"}})}catch(e){return console.error("Eselram status check failed:",e),Response.json({ok:!1,error:"Unable to check the Eselram installation status."},{status:500,headers:{"Cache-Control":"no-store"}})}}c(Jo,"onRequestGet");function Hd(s={}){let e=String(s?.status||"active").trim().toLowerCase()||"active";return{ok:!0,subscription:{plan:"complimentary_tester",billing_interval:"complimentary",status:e,license_status:e,current_period_end:null,cancel_at_period_end:!1,grace_until:null,currency:"gbp",unit_amount:0,is_complimentary:!0},invoices:[]}}c(Hd,"complimentaryPayload");function Fd(s={}){let e=String(s?.plan||"").trim().toLowerCase(),t=String(s?.purchase_source||"").trim().toLowerCase();return e==="tester"||t==="complimentary_tester"}c(Fd,"isComplimentaryTester");async function Go({request:s,env:e}){try{let t=await pe(s,e);if(t.response)return t.response;let i=await $e(e),n=await Ee(e,"/api/installed-update/status",i,gs(e));if(Fd(n?.license))return Response.json(Hd(n.license),{headers:{"Cache-Control":"no-store"}});let r=await rt(e,"status"),a=await Ee(e,"/api/installed-billing/status",r,at(s,e));return Response.json({ok:!0,subscription:a.subscription||null,invoices:a.invoices||[]},{headers:{"Cache-Control":"no-store"}})}catch(t){return Response.json({ok:!1,error:t?.message||"Unable to load Eselram subscription details."},{status:Number(t?.status)||500,headers:{"Cache-Control":"no-store"}})}}c(Go,"onRequestGet");async function Os(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
      SELECT
        u.id AS user_id,
        u.name AS user_name,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id =
           s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(
          s.expires_at
        ) > datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `).bind(i).first()}c(Os,"getUserContext");function Is(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(Is,"unauthorized");function Cs(s){return Response.json({ok:!1,error:s},{status:400})}c(Cs,"badRequest");function Yo(s){return Response.json({ok:!1,error:s},{status:404})}c(Yo,"notFound");async function Ko({request:s,env:e}){try{let t=await Os(s,e);if(!t)return Is();let[i,n,r,a,o,u,d,l,p]=await Promise.all([e.DB.prepare(`
            SELECT
              tr.id,
              tr.business_id,
              tr.appointment_id,
              tr.customer_id,
              tr.service_id,
              tr.practitioner_user_id,
              tr.status,
              tr.treatment_date,
              tr.practitioner_name,
              tr.treatment_area,
              tr.device_name,
              tr.device_settings,
              tr.treatment_notes,
              tr.client_response,
              tr.client_tolerance,
              tr.aftercare_notes,
              tr.next_session_plan,
              tr.next_treatment_date,
              tr.created_at,
              tr.updated_at,

              c.first_name,
              c.last_name,

              s.name AS service_name,

              (
                SELECT COUNT(*)
                FROM customer_photos p
                WHERE p.business_id = tr.business_id
                  AND p.treatment_record_id = tr.id
              ) AS photo_count

            FROM treatment_records tr

            JOIN customers c
              ON c.id =
                 tr.customer_id

            LEFT JOIN services s
              ON s.id =
                 tr.service_id

            WHERE
              tr.business_id = ?

            ORDER BY
              date(
                tr.treatment_date
              ) DESC,
              datetime(
                tr.created_at
              ) DESC
          `).bind(t.business_id).all(),e.DB.prepare(`
            SELECT
              id,
              first_name,
              last_name

            FROM customers

            WHERE
              business_id = ?

            ORDER BY
              last_name COLLATE NOCASE,
              first_name COLLATE NOCASE
          `).bind(t.business_id).all(),e.DB.prepare(`
            SELECT
              a.id,
              a.customer_id,
              a.service_id,
              a.start_at,
              a.status,
              a.booking_kind,

              c.first_name,
              c.last_name,

              s.name AS service_name

            FROM appointments a

            JOIN customers c
              ON c.id =
                 a.customer_id

            JOIN services s
              ON s.id =
                 a.service_id

            WHERE
              a.business_id = ?
              AND a.status !=
                  'cancelled'
              AND a.booking_kind !=
                  'consultation'

            ORDER BY
              datetime(
                a.start_at
              ) DESC
          `).bind(t.business_id).all(),e.DB.prepare(`
            SELECT
              id,
              name

            FROM services

            WHERE
              business_id = ?
              AND is_active = 1

            ORDER BY
              name COLLATE NOCASE
          `).bind(t.business_id).all(),e.DB.prepare(`
            SELECT
              id,
              treatment_record_id,
              photo_type,
              taken_at,
              original_name

            FROM customer_photos

            WHERE
              business_id = ?
              AND treatment_record_id IS NOT NULL
              AND trim(treatment_record_id) != ''

            ORDER BY
              COALESCE(taken_at, created_at) DESC
          `).bind(t.business_id).all(),e.DB.prepare(`
            SELECT
              COUNT(*) AS count

            FROM treatment_records

            WHERE
              business_id = ?
          `).bind(t.business_id).first(),e.DB.prepare(`
            SELECT
              COUNT(*) AS count

            FROM treatment_records

            WHERE
              business_id = ?
              AND strftime(
                '%Y-%m',
                treatment_date
              ) =
              strftime(
                '%Y-%m',
                'now'
              )
          `).bind(t.business_id).first(),e.DB.prepare(`
            SELECT
              COUNT(*) AS count

            FROM treatment_records

            WHERE
              business_id = ?
              AND status = 'draft'
          `).bind(t.business_id).first(),e.DB.prepare(`
            SELECT
              COUNT(*) AS count

            FROM treatment_records

            WHERE
              business_id = ?
              AND next_treatment_date
                  IS NOT NULL
              AND trim(
                next_treatment_date
              ) != ''
          `).bind(t.business_id).first()]);return Response.json({ok:!0,user:{id:t.user_id,name:t.user_name},stats:{total_records:Number(u?.count||0),month_records:Number(d?.count||0),draft_records:Number(l?.count||0),followup_records:Number(p?.count||0)},records:i.results||[],customers:n.results||[],appointments:r.results||[],services:a.results||[],photos:(o.results||[]).map(m=>({...m,content_url:`/api/customer-photos?photo_id=${encodeURIComponent(m.id)}&content=1`}))})}catch(t){return console.error("Treatment records GET failed:",t),Response.json({ok:!1,error:"Unable to load treatment records."},{status:500})}}c(Ko,"onRequestGet");async function zo({request:s,env:e}){try{let t=await Os(s,e);if(!t)return Is();let i=await s.json(),n=await Zo({body:i,user:t,env:e});if(!n.ok)return Cs(n.error);if(n.appointment){let a=await e.DB.prepare(`
            SELECT id

            FROM treatment_records

            WHERE
              business_id = ?
              AND appointment_id = ?

            LIMIT 1
          `).bind(t.business_id,n.appointment.id).first();if(a)return Response.json({ok:!1,error:"A treatment record already exists for this appointment.",treatment_record_id:a.id},{status:409})}let r=`tr_${crypto.randomUUID()}`;return await e.DB.prepare(`
        INSERT INTO treatment_records (
          id,
          business_id,
          appointment_id,
          customer_id,
          service_id,
          practitioner_user_id,
          status,
          treatment_date,
          practitioner_name,
          treatment_area,
          device_name,
          device_settings,
          treatment_notes,
          client_response,
          client_tolerance,
          aftercare_notes,
          next_session_plan,
          next_treatment_date
        )

        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).bind(r,t.business_id,n.appointmentId||null,n.customerId,n.serviceId||null,t.user_id,n.status,n.treatmentDate,n.practitionerName,n.treatmentArea||null,n.deviceName||null,n.deviceSettings||null,n.treatmentNotes||null,n.clientResponse||null,n.clientTolerance||null,n.aftercareNotes||null,n.nextSessionPlan||null,n.nextTreatmentDate||null).run(),Response.json({ok:!0,treatment_record:{id:r}})}catch(t){return console.error("Treatment record creation failed:",t),Response.json({ok:!1,error:"Unable to create treatment record."},{status:500})}}c(zo,"onRequestPost");async function Vo({request:s,env:e}){try{let t=await Os(s,e);if(!t)return Is();let i=await s.json(),n=String(i.id||"").trim();if(!n)return Cs("Treatment record id is required.");if(!await e.DB.prepare(`
          SELECT id

          FROM treatment_records

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `).bind(n,t.business_id).first())return Yo("Treatment record not found.");let a=await Zo({body:i,user:t,env:e});return a.ok?a.appointment&&await e.DB.prepare(`
            SELECT id

            FROM treatment_records

            WHERE
              business_id = ?
              AND appointment_id = ?
              AND id != ?

            LIMIT 1
          `).bind(t.business_id,a.appointment.id,n).first()?Response.json({ok:!1,error:"Another treatment record already uses this appointment."},{status:409}):(await e.DB.prepare(`
        UPDATE treatment_records

        SET
          appointment_id = ?,
          customer_id = ?,
          service_id = ?,
          practitioner_user_id = ?,
          status = ?,
          treatment_date = ?,
          practitioner_name = ?,
          treatment_area = ?,
          device_name = ?,
          device_settings = ?,
          treatment_notes = ?,
          client_response = ?,
          client_tolerance = ?,
          aftercare_notes = ?,
          next_session_plan = ?,
          next_treatment_date = ?,
          updated_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
          AND business_id = ?
      `).bind(a.appointmentId||null,a.customerId,a.serviceId||null,t.user_id,a.status,a.treatmentDate,a.practitionerName,a.treatmentArea||null,a.deviceName||null,a.deviceSettings||null,a.treatmentNotes||null,a.clientResponse||null,a.clientTolerance||null,a.aftercareNotes||null,a.nextSessionPlan||null,a.nextTreatmentDate||null,n,t.business_id).run(),Response.json({ok:!0})):Cs(a.error)}catch(t){return console.error("Treatment record update failed:",t),Response.json({ok:!1,error:"Unable to update treatment record."},{status:500})}}c(Vo,"onRequestPut");async function Xo({request:s,env:e}){try{let t=await Os(s,e);if(!t)return Is();let i=new URL(s.url),n=String(i.searchParams.get("id")||"").trim();return n?await e.DB.prepare(`
          SELECT id
          FROM treatment_records
          WHERE
            id = ?
            AND business_id = ?
          LIMIT 1
        `).bind(n,t.business_id).first()?(await e.DB.batch([e.DB.prepare(`
          UPDATE customer_photos
          SET treatment_record_id = NULL
          WHERE
            treatment_record_id = ?
            AND business_id = ?
        `).bind(n,t.business_id),e.DB.prepare(`
          DELETE FROM treatment_records
          WHERE
            id = ?
            AND business_id = ?
        `).bind(n,t.business_id)]),Response.json({ok:!0})):Yo("Treatment record not found."):Cs("Treatment record id is required.")}catch(t){return console.error("Treatment record deletion failed:",t),Response.json({ok:!1,error:"Unable to delete treatment record."},{status:500})}}c(Xo,"onRequestDelete");async function Zo({body:s,user:e,env:t}){let i=String(s.customer_id||"").trim(),n=String(s.appointment_id||"").trim(),r=String(s.service_id||"").trim(),a=String(s.treatment_date||"").trim(),o=String(s.practitioner_name||"").trim(),u=String(s.status||"complete").trim(),d=String(s.treatment_area||"").trim(),l=String(s.device_name||"").trim(),p=String(s.device_settings||"").trim(),m=String(s.treatment_notes||"").trim(),_=String(s.client_response||"").trim(),g=String(s.client_tolerance||"").trim(),E=String(s.aftercare_notes||"").trim(),f=String(s.next_session_plan||"").trim(),b=String(s.next_treatment_date||"").trim();if(!i||!r||!a||!o)return{ok:!1,error:"Customer, service, treatment date and practitioner are required."};if(!/^\d{4}-\d{2}-\d{2}$/.test(a))return{ok:!1,error:"Treatment date is invalid."};if(b&&!/^\d{4}-\d{2}-\d{2}$/.test(b))return{ok:!1,error:"Next treatment date is invalid."};if(!["draft","complete"].includes(u))return{ok:!1,error:"Invalid record status."};if(!await t.DB.prepare(`
        SELECT id

        FROM customers

        WHERE
          id = ?
          AND business_id = ?

        LIMIT 1
      `).bind(i,e.business_id).first())return{ok:!1,error:"Customer not found."};if(!await t.DB.prepare(`
        SELECT id

        FROM services

        WHERE
          id = ?
          AND business_id = ?

        LIMIT 1
      `).bind(r,e.business_id).first())return{ok:!1,error:"Service not found."};let S=null;if(n){if(S=await t.DB.prepare(`
          SELECT
            id,
            customer_id,
            service_id,
            booking_kind

          FROM appointments

          WHERE
            id = ?
            AND business_id = ?

          LIMIT 1
        `).bind(n,e.business_id).first(),!S)return{ok:!1,error:"Appointment not found."};if(S.customer_id!==i)return{ok:!1,error:"Appointment does not belong to the selected customer."};if(S.service_id!==r)return{ok:!1,error:"Selected service does not match the appointment."};if(S.booking_kind==="consultation")return{ok:!1,error:"A treatment record cannot be linked to a consultation appointment."}}return{ok:!0,customerId:i,appointmentId:n,serviceId:r,treatmentDate:a,practitionerName:o,status:u,treatmentArea:d,deviceName:l,deviceSettings:p,treatmentNotes:m,clientResponse:_,clientTolerance:g,aftercareNotes:E,nextSessionPlan:f,nextTreatmentDate:b,appointment:S}}c(Zo,"validatePayload");async function Qo(s,e){let t=C(s);if(!t)return null;let i=await D(t);return await e.DB.prepare(`
    SELECT u.business_id
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND datetime(s.expires_at) > datetime('now')
      AND u.is_active = 1
    LIMIT 1
  `).bind(i).first()}c(Qo,"getUserContext");function ec(){return Response.json({ok:!1,error:"Authentication required."},{status:401})}c(ec,"unauthorized");async function tc({request:s,env:e}){let t=await Qo(s,e);return t?Response.json({ok:!0,vouchers:await Ws(e,t.business_id)}):ec()}c(tc,"onRequestGet");async function sc({request:s,env:e}){try{let t=await Qo(s,e);if(!t)return ec();let i=await s.json(),n=await hn(e,t.business_id,i.vouchers||[]);return Response.json({ok:!0,vouchers:n})}catch(t){return Response.json({ok:!1,error:t.message||"Unable to save vouchers."},{status:400})}}c(sc,"onRequestPut");function Wd(s){let e=String(s.headers.get("Origin")||"").trim();if(!e)return"";try{let t=new URL(e),i=t.hostname.toLowerCase();if(t.protocol==="https:"&&i.endsWith(".eselram.com")&&i!=="eselram.com")return t.origin}catch{}return""}c(Wd,"brandedOrigin");async function ic(s){let e=Wd(s.request);if(s.request.method==="OPTIONS")return e?new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":e,"Access-Control-Allow-Methods":"GET,HEAD,POST,OPTIONS","Access-Control-Allow-Headers":"Accept, Content-Type","Access-Control-Max-Age":"86400",Vary:"Origin"}}):new Response(null,{status:403});let t=await s.next();if(!e)return t;let i=new Headers(t.headers);return i.set("Access-Control-Allow-Origin",e),i.set("Vary","Origin"),new Response(t.body,{status:t.status,statusText:t.statusText,headers:i})}c(ic,"onRequest");function $d(s){let e=String(s.headers.get("Origin")||"").trim();if(!e)return"";try{let t=new URL(e),i=t.hostname.toLowerCase();if(t.protocol==="https:"&&i.endsWith(".eselram.com")&&i!=="eselram.com")return t.origin}catch{}return""}c($d,"brandedOrigin");async function nc(s){let e=$d(s.request);if(s.request.method==="OPTIONS")return e?new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":e,"Access-Control-Allow-Methods":"GET,HEAD,POST,OPTIONS","Access-Control-Allow-Headers":"Accept, Content-Type","Access-Control-Max-Age":"86400",Vary:"Origin"}}):new Response(null,{status:403});let t=await s.next();if(!e)return t;let i=new Headers(t.headers);return i.set("Access-Control-Allow-Origin",e),i.set("Vary","Origin"),new Response(t.body,{status:t.status,statusText:t.statusText,headers:i})}c(nc,"onRequest");async function rc({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
        SELECT s.id
        FROM user_sessions s
        JOIN users u
          ON u.id = s.user_id
        WHERE
          s.token_hash = ?
          AND s.revoked_at IS NULL
          AND datetime(s.expires_at) > datetime('now')
          AND u.is_active = 1
        LIMIT 1
      `).bind(n).first()?t():Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Branding page authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(rc,"onRequest");async function ac({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
          SELECT s.id

          FROM user_sessions s

          JOIN users u
            ON u.id =
              s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(n).first()?t():Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Dashboard authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(ac,"onRequest");async function oc({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
          SELECT s.id

          FROM user_sessions s

          JOIN users u
            ON u.id =
              s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(n).first()?t():Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Dashboard authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(oc,"onRequest");async function cc({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
      SELECT s.id FROM user_sessions s
      JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.revoked_at IS NULL
        AND datetime(s.expires_at)>datetime('now')
        AND u.is_active=1
      LIMIT 1
    `).bind(n).first()?t():Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Clinical records authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(cc,"onRequest");async function uc({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
          SELECT
            s.id

          FROM user_sessions s

          JOIN users u
            ON u.id =
               s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(n).first()?t():Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Clinical templates authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(uc,"onRequest");async function dc({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
          SELECT s.id

          FROM user_sessions s

          JOIN users u
            ON u.id =
              s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(n).first()?t():Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Customers authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(dc,"onRequest");async function lc({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
          SELECT s.id

          FROM user_sessions s

          JOIN users u
            ON u.id =
              s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(n).first()?Response.redirect(new URL("/bookings/",s.url).toString(),302):Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Dashboard authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(lc,"onRequest");async function pc({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
          SELECT
            s.id

          FROM user_sessions s

          JOIN users u
            ON u.id =
               s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(n).first()?t():Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Payments authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(pc,"onRequest");async function _c({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
          SELECT s.id

          FROM user_sessions s

          JOIN users u
            ON u.id =
              s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(n).first()?t():Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Dashboard authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(_c,"onRequest");async function mc({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
          SELECT
            s.id

          FROM user_sessions s

          JOIN users u
            ON u.id = s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(n).first()?t():Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Settings authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(mc,"onRequest");async function fc({request:s,env:e,next:t}){try{let i=C(s);if(!i)return Response.redirect(new URL("/auth/login.html",s.url).toString(),302);let n=await D(i);return await e.DB.prepare(`
          SELECT
            s.id

          FROM user_sessions s

          JOIN users u
            ON u.id =
               s.user_id

          WHERE
            s.token_hash = ?
            AND s.revoked_at IS NULL
            AND datetime(
              s.expires_at
            ) > datetime('now')
            AND u.is_active = 1

          LIMIT 1
        `).bind(n).first()?t():Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}catch(i){return console.error("Treatment records authentication failed:",i),Response.redirect(new URL("/auth/login.html",s.url).toString(),302)}}c(fc,"onRequest");var A=[{routePath:"/api/integrations/email/gmail/callback",mountPath:"/api/integrations/email/gmail",method:"GET",middlewares:[],modules:[zi]},{routePath:"/api/integrations/email/gmail/start",mountPath:"/api/integrations/email/gmail",method:"GET",middlewares:[],modules:[Vi]},{routePath:"/api/integrations/email/domain",mountPath:"/api/integrations/email",method:"GET",middlewares:[],modules:[sn]},{routePath:"/api/integrations/email/domain",mountPath:"/api/integrations/email",method:"POST",middlewares:[],modules:[nn]},{routePath:"/api/integrations/email/gmail",mountPath:"/api/integrations/email/gmail",method:"DELETE",middlewares:[],modules:[un]},{routePath:"/api/integrations/email/gmail",mountPath:"/api/integrations/email/gmail",method:"GET",middlewares:[],modules:[on]},{routePath:"/api/integrations/email/gmail",mountPath:"/api/integrations/email/gmail",method:"POST",middlewares:[],modules:[cn]},{routePath:"/api/integrations/email/provider",mountPath:"/api/integrations/email",method:"GET",middlewares:[],modules:[ln]},{routePath:"/api/integrations/email/provider",mountPath:"/api/integrations/email",method:"POST",middlewares:[],modules:[pn]},{routePath:"/api/integrations/payments/stripe",mountPath:"/api/integrations/payments/stripe",method:"DELETE",middlewares:[],modules:[gn]},{routePath:"/api/integrations/payments/stripe",mountPath:"/api/integrations/payments/stripe",method:"GET",middlewares:[],modules:[_n]},{routePath:"/api/integrations/payments/stripe",mountPath:"/api/integrations/payments/stripe",method:"PATCH",middlewares:[],modules:[mn]},{routePath:"/api/integrations/payments/stripe",mountPath:"/api/integrations/payments/stripe",method:"POST",middlewares:[],modules:[bn]},{routePath:"/api/integrations/payments/stripe",mountPath:"/api/integrations/payments/stripe",method:"PUT",middlewares:[],modules:[fn]},{routePath:"/api/payments/stripe/checkout",mountPath:"/api/payments/stripe",method:"POST",middlewares:[],modules:[Sn]},{routePath:"/api/payments/stripe/checkout-redirect",mountPath:"/api/payments/stripe",method:"GET",middlewares:[],modules:[Rn]},{routePath:"/api/payments/stripe/package-checkout",mountPath:"/api/payments/stripe",method:"POST",middlewares:[],modules:[Nn]},{routePath:"/api/payments/stripe/status",mountPath:"/api/payments/stripe",method:"GET",middlewares:[],modules:[Bn]},{routePath:"/api/payments/stripe/webhook",mountPath:"/api/payments/stripe",method:"POST",middlewares:[],modules:[Wn]},{routePath:"/api/auth/forgot-password",mountPath:"/api/auth/forgot-password",method:"POST",middlewares:[],modules:[Jn]},{routePath:"/api/auth/login",mountPath:"/api/auth",method:"POST",middlewares:[],modules:[Gn]},{routePath:"/api/auth/logout",mountPath:"/api/auth",method:"POST",middlewares:[],modules:[Yn]},{routePath:"/api/auth/me",mountPath:"/api/auth",method:"GET",middlewares:[],modules:[Kn]},{routePath:"/api/auth/reset-password",mountPath:"/api/auth/reset-password",method:"POST",middlewares:[],modules:[zn]},{routePath:"/api/bookings/availability",mountPath:"/api/bookings",method:"GET",middlewares:[],modules:[Xn]},{routePath:"/api/communications/aftercare",mountPath:"/api/communications",method:"DELETE",middlewares:[],modules:[ir]},{routePath:"/api/communications/aftercare",mountPath:"/api/communications",method:"GET",middlewares:[],modules:[tr]},{routePath:"/api/communications/aftercare",mountPath:"/api/communications",method:"PUT",middlewares:[],modules:[sr]},{routePath:"/api/communications/content",mountPath:"/api/communications",method:"DELETE",middlewares:[],modules:[ar]},{routePath:"/api/communications/content",mountPath:"/api/communications",method:"GET",middlewares:[],modules:[nr]},{routePath:"/api/communications/content",mountPath:"/api/communications",method:"PUT",middlewares:[],modules:[rr]},{routePath:"/api/communications/reminders",mountPath:"/api/communications",method:"POST",middlewares:[],modules:[or]},{routePath:"/api/form-requests/email",mountPath:"/api/form-requests",method:"POST",middlewares:[],modules:[cr]},{routePath:"/api/forms/public",mountPath:"/api/forms/public",method:"GET",middlewares:[],modules:[dr]},{routePath:"/api/forms/publish",mountPath:"/api/forms/publish",method:"POST",middlewares:[],modules:[lr]},{routePath:"/api/forms/submissions",mountPath:"/api/forms/submissions",method:"POST",middlewares:[],modules:[_r]},{routePath:"/api/install/branding",mountPath:"/api/install",method:"POST",middlewares:[],modules:[mr]},{routePath:"/api/install/business",mountPath:"/api/install",method:"POST",middlewares:[],modules:[fr]},{routePath:"/api/install/hours",mountPath:"/api/install",method:"POST",middlewares:[],modules:[br]},{routePath:"/api/install/owner",mountPath:"/api/install",method:"POST",middlewares:[],modules:[gr]},{routePath:"/api/install/payments",mountPath:"/api/install",method:"POST",middlewares:[],modules:[Er]},{routePath:"/api/integrations/email",mountPath:"/api/integrations/email",method:"DELETE",middlewares:[],modules:[Ar]},{routePath:"/api/integrations/email",mountPath:"/api/integrations/email",method:"GET",middlewares:[],modules:[Rr]},{routePath:"/api/integrations/email",mountPath:"/api/integrations/email",method:"POST",middlewares:[],modules:[Tr]},{routePath:"/api/integrations/email",mountPath:"/api/integrations/email",method:"PUT",middlewares:[],modules:[Nr]},{routePath:"/api/manage-booking/availability",mountPath:"/api/manage-booking",method:"GET",middlewares:[],modules:[Dr]},{routePath:"/api/package-payment/confirm",mountPath:"/api/package-payment",method:"GET",middlewares:[],modules:[vr]},{routePath:"/api/packages/sale",mountPath:"/api/packages",method:"DELETE",middlewares:[],modules:[Lr]},{routePath:"/api/packages/sale",mountPath:"/api/packages",method:"GET",middlewares:[],modules:[Or]},{routePath:"/api/packages/sale",mountPath:"/api/packages",method:"POST",middlewares:[],modules:[Ir]},{routePath:"/api/payments/email-link",mountPath:"/api/payments",method:"POST",middlewares:[],modules:[Mr]},{routePath:"/api/public-booking/availability",mountPath:"/api/public-booking",method:"GET",middlewares:[],modules:[xr]},{routePath:"/api/public-booking/cancel",mountPath:"/api/public-booking",method:"POST",middlewares:[],modules:[Pr]},{routePath:"/api/public-booking/config",mountPath:"/api/public-booking",method:"GET",middlewares:[],modules:[Ur]},{routePath:"/api/public-booking/create",mountPath:"/api/public-booking",method:"POST",middlewares:[],modules:[qr]},{routePath:"/api/public-booking/preview",mountPath:"/api/public-booking",method:"POST",middlewares:[],modules:[jr]},{routePath:"/api/public-booking/status",mountPath:"/api/public-booking",method:"GET",middlewares:[],modules:[Hr]},{routePath:"/api/public-branding/logo",mountPath:"/api/public-branding",method:"GET",middlewares:[],modules:[Fr]},{routePath:"/api/public-packages/availability",mountPath:"/api/public-packages",method:"GET",middlewares:[],modules:[Wr]},{routePath:"/api/public-packages/book-session",mountPath:"/api/public-packages",method:"POST",middlewares:[],modules:[$r]},{routePath:"/api/public-packages/cancel",mountPath:"/api/public-packages",method:"POST",middlewares:[],modules:[Jr]},{routePath:"/api/public-packages/config",mountPath:"/api/public-packages",method:"GET",middlewares:[],modules:[Gr]},{routePath:"/api/public-packages/confirm",mountPath:"/api/public-packages",method:"POST",middlewares:[],modules:[Yr]},{routePath:"/api/public-packages/create",mountPath:"/api/public-packages",method:"POST",middlewares:[],modules:[Kr]},{routePath:"/api/public-packages/status",mountPath:"/api/public-packages",method:"GET",middlewares:[],modules:[Vr]},{routePath:"/api/settings/hours",mountPath:"/api/settings",method:"GET",middlewares:[],modules:[Qr]},{routePath:"/api/settings/hours",mountPath:"/api/settings",method:"PUT",middlewares:[],modules:[ea]},{routePath:"/api/settings/notifications",mountPath:"/api/settings",method:"GET",middlewares:[],modules:[ra]},{routePath:"/api/settings/notifications",mountPath:"/api/settings",method:"POST",middlewares:[],modules:[aa]},{routePath:"/api/settings/notifications",mountPath:"/api/settings",method:"PUT",middlewares:[],modules:[oa]},{routePath:"/api/storage/handoff",mountPath:"/api/storage",method:"POST",middlewares:[],modules:[da]},{routePath:"/api/subscription/cancel",mountPath:"/api/subscription",method:"POST",middlewares:[],modules:[la]},{routePath:"/api/subscription/payment-method",mountPath:"/api/subscription",method:"POST",middlewares:[],modules:[pa]},{routePath:"/api/subscription/resume",mountPath:"/api/subscription",method:"POST",middlewares:[],modules:[_a]},{routePath:"/api/updates/handoff",mountPath:"/api/updates",method:"POST",middlewares:[],modules:[ma]},{routePath:"/api/updates/rollback-handoff",mountPath:"/api/updates",method:"POST",middlewares:[],modules:[fa]},{routePath:"/api/updates/status",mountPath:"/api/updates",method:"GET",middlewares:[],modules:[ba]},{routePath:"/api/bookings",mountPath:"/api/bookings",method:"GET",middlewares:[],modules:[Sa]},{routePath:"/api/bookings",mountPath:"/api/bookings",method:"POST",middlewares:[],modules:[Ra]},{routePath:"/api/bookings",mountPath:"/api/bookings",method:"PUT",middlewares:[],modules:[Na]},{routePath:"/api/branding",mountPath:"/api/branding",method:"GET",middlewares:[],modules:[wa]},{routePath:"/api/branding",mountPath:"/api/branding",method:"PUT",middlewares:[],modules:[Da]},{routePath:"/api/clinical-submissions",mountPath:"/api/clinical-submissions",method:"DELETE",middlewares:[],modules:[Ma]},{routePath:"/api/clinical-submissions",mountPath:"/api/clinical-submissions",method:"GET",middlewares:[],modules:[Ia]},{routePath:"/api/clinical-submissions",mountPath:"/api/clinical-submissions",method:"PUT",middlewares:[],modules:[La]},{routePath:"/api/clinical-templates",mountPath:"/api/clinical-templates",method:"DELETE",middlewares:[],modules:[ja]},{routePath:"/api/clinical-templates",mountPath:"/api/clinical-templates",method:"GET",middlewares:[],modules:[Ua]},{routePath:"/api/clinical-templates",mountPath:"/api/clinical-templates",method:"POST",middlewares:[],modules:[Ba]},{routePath:"/api/clinical-templates",mountPath:"/api/clinical-templates",method:"PUT",middlewares:[],modules:[qa]},{routePath:"/api/communications",mountPath:"/api/communications",method:"GET",middlewares:[],modules:[$a]},{routePath:"/api/communications",mountPath:"/api/communications",method:"POST",middlewares:[],modules:[Ja]},{routePath:"/api/customer-photos",mountPath:"/api/customer-photos",method:"DELETE",middlewares:[],modules:[Va]},{routePath:"/api/customer-photos",mountPath:"/api/customer-photos",method:"GET",middlewares:[],modules:[Ka]},{routePath:"/api/customer-photos",mountPath:"/api/customer-photos",method:"POST",middlewares:[],modules:[za]},{routePath:"/api/customers",mountPath:"/api/customers",method:"DELETE",middlewares:[],modules:[eo]},{routePath:"/api/customers",mountPath:"/api/customers",method:"GET",middlewares:[],modules:[Xa]},{routePath:"/api/customers",mountPath:"/api/customers",method:"POST",middlewares:[],modules:[Za]},{routePath:"/api/customers",mountPath:"/api/customers",method:"PUT",middlewares:[],modules:[Qa]},{routePath:"/api/dashboard",mountPath:"/api",method:"GET",middlewares:[],modules:[to]},{routePath:"/api/file-recovery",mountPath:"/api/file-recovery",method:"GET",middlewares:[],modules:[so]},{routePath:"/api/file-recovery",mountPath:"/api/file-recovery",method:"POST",middlewares:[],modules:[io]},{routePath:"/api/form-requests",mountPath:"/api/form-requests",method:"GET",middlewares:[],modules:[ao]},{routePath:"/api/form-requests",mountPath:"/api/form-requests",method:"POST",middlewares:[],modules:[oo]},{routePath:"/api/form-requests",mountPath:"/api/form-requests",method:"PUT",middlewares:[],modules:[co]},{routePath:"/api/import-data",mountPath:"/api/import-data",method:"GET",middlewares:[],modules:[Eo]},{routePath:"/api/import-data",mountPath:"/api/import-data",method:"POST",middlewares:[],modules:[ho]},{routePath:"/api/manage-booking",mountPath:"/api/manage-booking",method:"GET",middlewares:[],modules:[So]},{routePath:"/api/manage-booking",mountPath:"/api/manage-booking",method:"POST",middlewares:[],modules:[Ro]},{routePath:"/api/packages",mountPath:"/api/packages",method:"GET",middlewares:[],modules:[Do]},{routePath:"/api/packages",mountPath:"/api/packages",method:"POST",middlewares:[],modules:[vo]},{routePath:"/api/payments",mountPath:"/api/payments",method:"GET",middlewares:[],modules:[Io]},{routePath:"/api/payments",mountPath:"/api/payments",method:"POST",middlewares:[],modules:[Lo]},{routePath:"/api/services",mountPath:"/api",method:"DELETE",middlewares:[],modules:[Bo]},{routePath:"/api/services",mountPath:"/api",method:"GET",middlewares:[],modules:[Mo]},{routePath:"/api/services",mountPath:"/api",method:"POST",middlewares:[],modules:[Po]},{routePath:"/api/services",mountPath:"/api",method:"PUT",middlewares:[],modules:[Uo]},{routePath:"/api/settings",mountPath:"/api",method:"GET",middlewares:[],modules:[Ho]},{routePath:"/api/settings",mountPath:"/api",method:"PUT",middlewares:[],modules:[Fo]},{routePath:"/api/setup-health",mountPath:"/api/setup-health",method:"GET",middlewares:[],modules:[$o]},{routePath:"/api/status",mountPath:"/api",method:"GET",middlewares:[],modules:[Jo]},{routePath:"/api/subscription",mountPath:"/api/subscription",method:"GET",middlewares:[],modules:[Go]},{routePath:"/api/treatment-records",mountPath:"/api/treatment-records",method:"DELETE",middlewares:[],modules:[Xo]},{routePath:"/api/treatment-records",mountPath:"/api/treatment-records",method:"GET",middlewares:[],modules:[Ko]},{routePath:"/api/treatment-records",mountPath:"/api/treatment-records",method:"POST",middlewares:[],modules:[zo]},{routePath:"/api/treatment-records",mountPath:"/api/treatment-records",method:"PUT",middlewares:[],modules:[Vo]},{routePath:"/api/vouchers",mountPath:"/api/vouchers",method:"GET",middlewares:[],modules:[tc]},{routePath:"/api/vouchers",mountPath:"/api/vouchers",method:"PUT",middlewares:[],modules:[sc]},{routePath:"/api/public-booking",mountPath:"/api/public-booking",method:"",middlewares:[ic],modules:[]},{routePath:"/api/public-packages",mountPath:"/api/public-packages",method:"",middlewares:[nc],modules:[]},{routePath:"/settings/branding",mountPath:"/settings/branding",method:"",middlewares:[rc],modules:[]},{routePath:"/bookings",mountPath:"/bookings",method:"",middlewares:[ac],modules:[]},{routePath:"/calendar",mountPath:"/calendar",method:"",middlewares:[oc],modules:[]},{routePath:"/clinical-submissions",mountPath:"/clinical-submissions",method:"",middlewares:[cc],modules:[]},{routePath:"/clinical-templates",mountPath:"/clinical-templates",method:"",middlewares:[uc],modules:[]},{routePath:"/customers",mountPath:"/customers",method:"",middlewares:[dc],modules:[]},{routePath:"/dashboard",mountPath:"/dashboard",method:"",middlewares:[lc],modules:[]},{routePath:"/payments",mountPath:"/payments",method:"",middlewares:[pc],modules:[]},{routePath:"/services",mountPath:"/services",method:"",middlewares:[_c],modules:[]},{routePath:"/settings",mountPath:"/settings",method:"",middlewares:[mc],modules:[]},{routePath:"/treatment-records",mountPath:"/treatment-records",method:"",middlewares:[fc],modules:[]}];function Jd(s){for(var e=[],t=0;t<s.length;){var i=s[t];if(i==="*"||i==="+"||i==="?"){e.push({type:"MODIFIER",index:t,value:s[t++]});continue}if(i==="\\"){e.push({type:"ESCAPED_CHAR",index:t++,value:s[t++]});continue}if(i==="{"){e.push({type:"OPEN",index:t,value:s[t++]});continue}if(i==="}"){e.push({type:"CLOSE",index:t,value:s[t++]});continue}if(i===":"){for(var n="",r=t+1;r<s.length;){var a=s.charCodeAt(r);if(a>=48&&a<=57||a>=65&&a<=90||a>=97&&a<=122||a===95){n+=s[r++];continue}break}if(!n)throw new TypeError("Missing parameter name at ".concat(t));e.push({type:"NAME",index:t,value:n}),t=r;continue}if(i==="("){var o=1,u="",r=t+1;if(s[r]==="?")throw new TypeError('Pattern cannot start with "?" at '.concat(r));for(;r<s.length;){if(s[r]==="\\"){u+=s[r++]+s[r++];continue}if(s[r]===")"){if(o--,o===0){r++;break}}else if(s[r]==="("&&(o++,s[r+1]!=="?"))throw new TypeError("Capturing groups are not allowed at ".concat(r));u+=s[r++]}if(o)throw new TypeError("Unbalanced pattern at ".concat(t));if(!u)throw new TypeError("Missing pattern at ".concat(t));e.push({type:"PATTERN",index:t,value:u}),t=r;continue}e.push({type:"CHAR",index:t,value:s[t++]})}return e.push({type:"END",index:t,value:""}),e}c(Jd,"lexer");function Gd(s,e){e===void 0&&(e={});for(var t=Jd(s),i=e.prefixes,n=i===void 0?"./":i,r=e.delimiter,a=r===void 0?"/#?":r,o=[],u=0,d=0,l="",p=c(function(T){if(d<t.length&&t[d].type===T)return t[d++].value},"tryConsume"),m=c(function(T){var O=p(T);if(O!==void 0)return O;var w=t[d],B=w.type,j=w.index;throw new TypeError("Unexpected ".concat(B," at ").concat(j,", expected ").concat(T))},"mustConsume"),_=c(function(){for(var T="",O;O=p("CHAR")||p("ESCAPED_CHAR");)T+=O;return T},"consumeText"),g=c(function(T){for(var O=0,w=a;O<w.length;O++){var B=w[O];if(T.indexOf(B)>-1)return!0}return!1},"isSafe"),E=c(function(T){var O=o[o.length-1],w=T||(O&&typeof O=="string"?O:"");if(O&&!w)throw new TypeError('Must have text between two parameters, missing text after "'.concat(O.name,'"'));return!w||g(w)?"[^".concat(ct(a),"]+?"):"(?:(?!".concat(ct(w),")[^").concat(ct(a),"])+?")},"safePattern");d<t.length;){var f=p("CHAR"),b=p("NAME"),N=p("PATTERN");if(b||N){var v=f||"";n.indexOf(v)===-1&&(l+=v,v=""),l&&(o.push(l),l=""),o.push({name:b||u++,prefix:v,suffix:"",pattern:N||E(v),modifier:p("MODIFIER")||""});continue}var S=f||p("ESCAPED_CHAR");if(S){l+=S;continue}l&&(o.push(l),l="");var h=p("OPEN");if(h){var v=_(),I=p("NAME")||"",R=p("PATTERN")||"",L=_();m("CLOSE"),o.push({name:I||(R?u++:""),pattern:I&&!R?E(v):R,prefix:v,suffix:L,modifier:p("MODIFIER")||""});continue}m("END")}return o}c(Gd,"parse");function Jt(s,e){var t=[],i=gc(s,t,e);return Yd(i,t,e)}c(Jt,"match");function Yd(s,e,t){t===void 0&&(t={});var i=t.decode,n=i===void 0?function(r){return r}:i;return function(r){var a=s.exec(r);if(!a)return!1;for(var o=a[0],u=a.index,d=Object.create(null),l=c(function(m){if(a[m]===void 0)return"continue";var _=e[m-1];_.modifier==="*"||_.modifier==="+"?d[_.name]=a[m].split(_.prefix+_.suffix).map(function(g){return n(g,_)}):d[_.name]=n(a[m],_)},"_loop_1"),p=1;p<a.length;p++)l(p);return{path:o,index:u,params:d}}}c(Yd,"regexpToFunction");function ct(s){return s.replace(/([.+*?=^!:${}()[\]|/\\])/g,"\\$1")}c(ct,"escapeString");function bc(s){return s&&s.sensitive?"":"i"}c(bc,"flags");function Kd(s,e){if(!e)return s;for(var t=/\((?:\?<(.*?)>)?(?!\?)/g,i=0,n=t.exec(s.source);n;)e.push({name:n[1]||i++,prefix:"",suffix:"",modifier:"",pattern:""}),n=t.exec(s.source);return s}c(Kd,"regexpToRegexp");function zd(s,e,t){var i=s.map(function(n){return gc(n,e,t).source});return new RegExp("(?:".concat(i.join("|"),")"),bc(t))}c(zd,"arrayToRegexp");function Vd(s,e,t){return Xd(Gd(s,t),e,t)}c(Vd,"stringToRegexp");function Xd(s,e,t){t===void 0&&(t={});for(var i=t.strict,n=i===void 0?!1:i,r=t.start,a=r===void 0?!0:r,o=t.end,u=o===void 0?!0:o,d=t.encode,l=d===void 0?function(O){return O}:d,p=t.delimiter,m=p===void 0?"/#?":p,_=t.endsWith,g=_===void 0?"":_,E="[".concat(ct(g),"]|$"),f="[".concat(ct(m),"]"),b=a?"^":"",N=0,v=s;N<v.length;N++){var S=v[N];if(typeof S=="string")b+=ct(l(S));else{var h=ct(l(S.prefix)),I=ct(l(S.suffix));if(S.pattern)if(e&&e.push(S),h||I)if(S.modifier==="+"||S.modifier==="*"){var R=S.modifier==="*"?"?":"";b+="(?:".concat(h,"((?:").concat(S.pattern,")(?:").concat(I).concat(h,"(?:").concat(S.pattern,"))*)").concat(I,")").concat(R)}else b+="(?:".concat(h,"(").concat(S.pattern,")").concat(I,")").concat(S.modifier);else{if(S.modifier==="+"||S.modifier==="*")throw new TypeError('Can not repeat "'.concat(S.name,'" without a prefix and suffix'));b+="(".concat(S.pattern,")").concat(S.modifier)}else b+="(?:".concat(h).concat(I,")").concat(S.modifier)}}if(u)n||(b+="".concat(f,"?")),b+=t.endsWith?"(?=".concat(E,")"):"$";else{var L=s[s.length-1],T=typeof L=="string"?f.indexOf(L[L.length-1])>-1:L===void 0;n||(b+="(?:".concat(f,"(?=").concat(E,"))?")),T||(b+="(?=".concat(f,"|").concat(E,")"))}return new RegExp(b,bc(t))}c(Xd,"tokensToRegexp");function gc(s,e,t){return s instanceof RegExp?Kd(s,e):Array.isArray(s)?zd(s,e,t):Vd(s,e,t)}c(gc,"pathToRegexp");var Ls=/[.+?^${}()|[\]\\]/g;function*Zd(s){let e=new URL(s.url).pathname;for(let t of[...A].reverse()){if(t.method&&t.method!==s.method)continue;let i=Jt(t.routePath.replace(Ls,"\\$&"),{end:!1}),n=Jt(t.mountPath.replace(Ls,"\\$&"),{end:!1}),r=i(e),a=n(e);if(r&&a)for(let o of t.middlewares.flat())yield{handler:o,params:r.params,path:a.path}}for(let t of A){if(t.method&&t.method!==s.method)continue;let i=Jt(t.routePath.replace(Ls,"\\$&"),{end:!0}),n=Jt(t.mountPath.replace(Ls,"\\$&"),{end:!1}),r=i(e),a=n(e);if(r&&a&&t.modules.length){for(let o of t.modules.flat())yield{handler:o,params:r.params,path:r.path};break}}}c(Zd,"executeRequest");var KS={async fetch(s,e,t){let i=s,n=Zd(i),r={},a=!1,o=c(async(u,d)=>{if(u!==void 0){let p=u;typeof u=="string"&&(p=new URL(u,i.url).toString()),i=new Request(p,d)}let l=n.next();if(l.done===!1){let{handler:p,params:m,path:_}=l.value,g={request:new Request(i.clone()),functionPath:_,next:o,params:m,get data(){return r},set data(f){if(typeof f!="object"||f===null)throw new Error("context.data must be an object");r=f},env:e,waitUntil:t.waitUntil.bind(t),passThroughOnException:c(()=>{a=!0},"passThroughOnException")},E=await p(g);if(!(E instanceof Response))throw new Error("Your Pages function should return a Response");return qi(E)}else{let p=await e.ASSETS.fetch(i);return qi(p)}},"next");try{return await o()}catch(u){if(a){let d=await e.ASSETS.fetch(i);return qi(d)}throw u}}},qi=c(s=>new Response([101,204,205,304].includes(s.status)?null:s.body,s),"cloneResponse");export{KS as default};

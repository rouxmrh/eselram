(() => {
  const STORAGE_KEY = "eselram_booking_analytics_session";
  let gaMeasurementId = "";
  let gaReady = false;
  let consentDecision = null;
  const pendingGaEvents = [];

  function apiUrl(path) {
    const configured = String(window.__ESELRAM_API_ORIGIN__ || "").trim().replace(/\/+$/, "");
    if (!configured) return path;
    try { return new URL(path, `${configured}/`).toString(); } catch { return path; }
  }
  function safeStoredToken() {
    try { const existing=sessionStorage.getItem(STORAGE_KEY)||""; if (/^[A-Za-z0-9_-]{16,120}$/.test(existing)) return existing; const token=`v_${crypto.randomUUID().replace(/-/g,"")}`; sessionStorage.setItem(STORAGE_KEY,token); return token; }
    catch { return `v_${crypto.randomUUID().replace(/-/g,"")}`; }
  }
  function safeReferrer() { if (!document.referrer) return ""; try { const u=new URL(document.referrer); return `${u.origin}${u.pathname}`.slice(0,500); } catch { return ""; } }
  function inferredSource(params) {
    const explicit=String(params.get("utm_source")||"").trim().toLowerCase(); if (explicit) return explicit.slice(0,80); if (!document.referrer) return "direct";
    try { const host=new URL(document.referrer).hostname.toLowerCase(); if(host.includes("instagram.com")||host.includes("l.instagram.com"))return"instagram"; if(host.includes("facebook.com")||host.includes("fb.com"))return"facebook"; if(host.includes("google."))return"google"; if(host.includes("bing.com"))return"bing"; if(host===window.location.hostname.toLowerCase()||host.endsWith(".eselram.com")||host.endsWith(".pages.dev"))return"direct"; return"referral"; } catch{return"direct";}
  }
  async function post(path,body){try{await fetch(apiUrl(path),{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(body),keepalive:true});}catch(e){console.debug("Booking analytics unavailable.",e);}}

  function consentKey(){ return gaMeasurementId ? `eselram_ga_consent_${gaMeasurementId}` : ""; }
  function gaEvent(name, params={}) {
    if (!gaMeasurementId || consentDecision === "denied") return;
    if (!gaReady) { pendingGaEvents.push([name, params]); return; }
    window.gtag("event", name, params);
  }
  function loadGa() {
    if (!gaMeasurementId || gaReady) return;
    window.dataLayer=window.dataLayer||[]; window.gtag=window.gtag||function(){dataLayer.push(arguments);};
    window.gtag("js",new Date());
    window.gtag("config",gaMeasurementId,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
    const script=document.createElement("script"); script.async=true; script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`; document.head.appendChild(script);
    gaReady=true;
    window.gtag("event","page_view",{page_title:document.title,page_location:window.location.href,page_path:window.location.pathname});
    while(pendingGaEvents.length){const [n,p]=pendingGaEvents.shift();window.gtag("event",n,p);}
  }
  function showConsent() {
    if (document.getElementById("eselramGaConsent")) return;
    const wrap=document.createElement("div"); wrap.id="eselramGaConsent"; wrap.setAttribute("role","dialog"); wrap.setAttribute("aria-label","Analytics cookies");
    wrap.style.cssText="position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:760px;margin:auto;background:#fff;color:#18221f;border:1px solid rgba(24,34,31,.18);border-radius:16px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.16);font:inherit";
    wrap.innerHTML='<strong style="display:block;font-size:16px;margin-bottom:6px">Analytics cookies</strong><span style="display:block;line-height:1.45;margin-bottom:14px">This business would like to use Google Analytics to understand how its booking page is used. No names, email addresses, phone numbers or clinical information are sent to Google Analytics.</span><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" data-ga="accept" style="border:0;border-radius:10px;padding:10px 16px;background:#365178;color:#fff;font:inherit;font-weight:700;cursor:pointer">Accept analytics</button><button type="button" data-ga="decline" style="border:1px solid #ccd1cf;border-radius:10px;padding:10px 16px;background:#fff;color:#18221f;font:inherit;font-weight:700;cursor:pointer">Decline</button></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('[data-ga="accept"]').onclick=()=>{consentDecision="granted";try{localStorage.setItem(consentKey(),"granted");}catch{}wrap.remove();loadGa();};
    wrap.querySelector('[data-ga="decline"]').onclick=()=>{consentDecision="denied";pendingGaEvents.length=0;try{localStorage.setItem(consentKey(),"denied");}catch{}wrap.remove();};
  }
  async function initGa() {
    try { const r=await fetch(apiUrl("/api/public-booking/config"),{headers:{Accept:"application/json"},cache:"no-store"}); const d=await r.json(); gaMeasurementId=String(d?.analytics?.google_analytics_measurement_id||"").trim().toUpperCase(); if(!gaMeasurementId)return; try{consentDecision=localStorage.getItem(consentKey());}catch{} if(consentDecision==="granted")loadGa(); else if(consentDecision!=="denied")showConsent(); } catch(e){console.debug("Google Analytics configuration unavailable.",e);}
  }
  async function recordBookingPageView(){const params=new URLSearchParams(window.location.search);await post("/api/public-booking/analytics/session",{session_token:safeStoredToken(),source:inferredSource(params),medium:String(params.get("utm_medium")||"").slice(0,80),campaign:String(params.get("utm_campaign")||"").slice(0,120),content:String(params.get("utm_content")||"").slice(0,120),landing_page:window.location.pathname.slice(0,300),referrer:safeReferrer()});}

  window.EselramBookingAnalytics={
    track(eventType,details={}){ gaEvent(eventType,{service_id:details.service_id||undefined,package_template_id:details.package_template_id||undefined}); return post("/api/public-booking/analytics/event",{session_token:safeStoredToken(),event_type:eventType,service_id:details.service_id||null,package_template_id:details.package_template_id||null}); },
    complete(appointmentId){ if(!appointmentId)return Promise.resolve(); gaEvent("booking_complete",{}); return post("/api/public-booking/analytics/complete",{session_token:safeStoredToken(),appointment_id:appointmentId}); }
  };
  function start(){recordBookingPageView();initGa();}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true}); else start();
})();

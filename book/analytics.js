(() => {
  const STORAGE_KEY = "eselram_booking_analytics_session";
  const CONSENT_KEY = "eselram_analytics_consent_v1";
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
  function cleanPathAttribution() {
    const parts=window.location.pathname.split("/").filter(Boolean);
    if (!parts.length || parts[0]==="book") return null;
    const pathToSource={instagram:"instagram",facebook:"facebook",website:"website",google:"google",tiktok:"tiktok",whatsapp:"whatsapp",email:"email",sms:"sms","google-ads":"google_ads",other:"other"};
    const source=pathToSource[parts[0]]; if(!source)return null;
    const standard={instagram:["social","profile"],facebook:["social","profile"],website:["referral","booking_button"],google:["organic","business_profile"]};
    const medium=standard[source]?.[0] || (["instagram","facebook"].includes(source)?"social":source==="website"?"referral":source==="google"?"campaign":source);
    const campaign=parts[1] ? parts.slice(1).join("-").slice(0,120) : (standard[source]?.[1]||"");
    return {source,medium,campaign};
  }
  function inferredSource(params,clean) {
    // A recognised clean tracking path is authoritative. Meta in-app browsers may
    // append/alter attribution parameters (for example `ig` or `direct`), but
    // /instagram and /facebook should always retain their intended source.
    if(clean?.source)return clean.source;
    const explicit=String(params.get("utm_source")||"").trim().toLowerCase(); if (explicit) return explicit.slice(0,80); if (!document.referrer) return "direct";
    try { const host=new URL(document.referrer).hostname.toLowerCase(); if(host.includes("instagram.com")||host.includes("l.instagram.com"))return"instagram"; if(host.includes("facebook.com")||host.includes("fb.com"))return"facebook"; if(host.includes("google."))return"google"; if(host.includes("bing.com"))return"bing"; if(host===window.location.hostname.toLowerCase()||host.endsWith(".eselram.com")||host.endsWith(".pages.dev"))return"direct"; return"referral"; } catch{return"direct";}
  }
  async function post(path,body){try{await fetch(apiUrl(path),{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(body),keepalive:true});}catch(e){console.debug("Booking analytics unavailable.",e);}}

  function consentKey(){ return CONSENT_KEY; }
  function analyticsGranted(){ return consentDecision === "granted"; }
  function clearAnalyticsSession(){
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  }
  function gaEvent(name, params={}) {
    if (!gaMeasurementId || !analyticsGranted()) return;
    if (!gaReady) { pendingGaEvents.push([name, params]); return; }
    window.gtag("event", name, params);
  }
  function loadGa() {
    if (!gaMeasurementId || gaReady) return;
    window.dataLayer=window.dataLayer||[]; window.gtag=window.gtag||function(){dataLayer.push(arguments);};
    window.gtag("js",new Date());
    const gaConfig={send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false};
    const clean=cleanPathAttribution();
    if(clean){gaConfig.campaign_source=clean.source;gaConfig.campaign_medium=clean.medium;if(clean.campaign)gaConfig.campaign_name=clean.campaign;}
    window.gtag("config",gaMeasurementId,gaConfig);
    const script=document.createElement("script"); script.async=true; script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`; document.head.appendChild(script);
    gaReady=true;
    window.gtag("event","page_view",{page_title:document.title,page_location:window.location.href,page_path:window.location.pathname});
    while(pendingGaEvents.length){const [n,p]=pendingGaEvents.shift();window.gtag("event",n,p);}
  }
  function showConsent() {
    if (document.getElementById("eselramGaConsent")) return;
    const wrap=document.createElement("div"); wrap.id="eselramGaConsent"; wrap.setAttribute("role","dialog"); wrap.setAttribute("aria-label","Analytics cookies");
    wrap.style.cssText="position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;max-width:760px;margin:auto;background:#fff;color:#18221f;border:1px solid rgba(24,34,31,.18);border-radius:16px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.16);font:inherit";
    wrap.innerHTML='<strong style="display:block;font-size:16px;margin-bottom:6px">Analytics cookies</strong><span style="display:block;line-height:1.45;margin-bottom:14px">This business uses analytics to understand where bookings come from and how its booking page is used. If Google Analytics is connected, consented booking-page activity may also be sent to Google. Names, email addresses, phone numbers, clinical records and form answers are not sent to Google Analytics.</span><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" data-ga="accept" style="border:0;border-radius:10px;padding:10px 16px;background:#365178;color:#fff;font:inherit;font-weight:700;cursor:pointer">Accept analytics</button><button type="button" data-ga="decline" style="border:1px solid #ccd1cf;border-radius:10px;padding:10px 16px;background:#fff;color:#18221f;font:inherit;font-weight:700;cursor:pointer">Decline</button></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('[data-ga="accept"]').onclick=()=>{consentDecision="granted";try{localStorage.setItem(consentKey(),"granted");}catch{}wrap.remove();recordBookingPageView();loadGa();};
    wrap.querySelector('[data-ga="decline"]').onclick=()=>{consentDecision="denied";pendingGaEvents.length=0;clearAnalyticsSession();try{localStorage.setItem(consentKey(),"denied");}catch{}wrap.remove();};
  }
  function applyGaConfig(d) {
    if (gaMeasurementId) return;
    gaMeasurementId=String(d?.analytics?.google_analytics_measurement_id||"").trim().toUpperCase();
    if(!gaMeasurementId)return;
    if(analyticsGranted())loadGa();
  }
  function initGa() {
    // Reuse the config loaded by book.js instead of issuing a second config
    // request during startup. This is more reliable in mobile in-app browsers.
    if (window.__ESELRAM_PUBLIC_BOOKING_CONFIG__) {
      applyGaConfig(window.__ESELRAM_PUBLIC_BOOKING_CONFIG__);
      return;
    }
    window.addEventListener("eselram:public-booking-config",(event)=>applyGaConfig(event.detail),{once:true});
  }
  async function recordBookingPageView(){
    if(!analyticsGranted()) return;
    const params=new URLSearchParams(window.location.search),clean=cleanPathAttribution();
    await post("/api/public-booking/analytics/session",{session_token:safeStoredToken(),source:inferredSource(params,clean),medium:String(params.get("utm_medium")||clean?.medium||"").slice(0,80),campaign:String(params.get("utm_campaign")||clean?.campaign||"").slice(0,120),content:String(params.get("utm_content")||"").slice(0,120),landing_page:window.location.pathname.slice(0,300),referrer:safeReferrer()});
  }

  window.EselramBookingAnalytics={
    track(eventType,details={}){
      if(!analyticsGranted()) return Promise.resolve();
      gaEvent(eventType,{service_id:details.service_id||undefined,package_template_id:details.package_template_id||undefined});
      return post("/api/public-booking/analytics/event",{session_token:safeStoredToken(),event_type:eventType,service_id:details.service_id||null,package_template_id:details.package_template_id||null});
    },
    complete(appointmentId){
      if(!appointmentId || !analyticsGranted()) return Promise.resolve();
      gaEvent("booking_complete",{});
      return post("/api/public-booking/analytics/complete",{session_token:safeStoredToken(),appointment_id:appointmentId});
    }
  };
  function start(){
    try{consentDecision=localStorage.getItem(consentKey());}catch{}
    if(consentDecision==="denied") clearAnalyticsSession();
    initGa();
    if(consentDecision==="granted") recordBookingPageView();
    else if(consentDecision!=="denied") showConsent();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true}); else start();
})();

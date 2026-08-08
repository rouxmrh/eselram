const submissionList=document.getElementById("submissionList");
const submissionSearch=document.getElementById("submissionSearch");
const templateFilter=document.getElementById("templateFilter");
const statusFilter=document.getElementById("statusFilter");
const assignmentFilter=document.getElementById("assignmentFilter");
const recordDrawer=document.getElementById("recordDrawer");
const recordBackdrop=document.getElementById("recordBackdrop");
const recordTitle=document.getElementById("recordTitle");
const recordMeta=document.getElementById("recordMeta");
const recordSections=document.getElementById("recordSections");
const recordCustomer=document.getElementById("recordCustomer");
const recordAppointment=document.getElementById("recordAppointment");
const saveRecordAssignment=document.getElementById("saveRecordAssignment");
const markReviewedButton=document.getElementById("markReviewedButton");
const openCustomerButton=document.getElementById("openCustomerButton");

let submissions=[],templates=[],customers=[],appointments=[],activeSubmission=null;

document.getElementById("closeRecordDrawer").addEventListener("click",closeDrawer);
recordBackdrop.addEventListener("click",closeDrawer);
submissionSearch.addEventListener("input",renderSubmissions);
templateFilter.addEventListener("change",renderSubmissions);
statusFilter.addEventListener("change",renderSubmissions);
assignmentFilter.addEventListener("change",renderSubmissions);
recordCustomer.addEventListener("change",renderAppointmentOptions);
saveRecordAssignment.addEventListener("click",saveAssignment);
markReviewedButton.addEventListener("click",toggleReviewed);

async function loadSubmissions(){
  try{
    const response=await fetch("/api/clinical-submissions",{headers:{Accept:"application/json"},cache:"no-store"});
    if(response.status===401){location.href="/auth/login.html";return}
    const data=await response.json();
    if(!response.ok||!data.ok)throw new Error(data.error||"Unable to load clinical records.");
    submissions=data.submissions||[];templates=data.templates||[];customers=data.customers||[];appointments=data.appointments||[];
    renderStats(data.stats||{});renderTemplateOptions();renderCustomerOptions();renderAppointmentOptions();renderSubmissions();
  }catch(error){
    submissionList.className="es-status error";
    submissionList.textContent=error.message||"Unable to load clinical records.";
  }
}

function renderStats(stats){
  document.getElementById("totalSubmissions").textContent=stats.total_submissions||0;
  document.getElementById("awaitingReview").textContent=stats.awaiting_review||0;
  document.getElementById("reviewedSubmissions").textContent=stats.reviewed_submissions||0;
  document.getElementById("unassignedSubmissions").textContent=stats.unassigned_submissions||0;
}

function renderTemplateOptions(){
  const current=templateFilter.value;
  templateFilter.innerHTML=`<option value="all">All forms</option>${templates.map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join("")}`;
  if(current&&[...templateFilter.options].some(o=>o.value===current))templateFilter.value=current;
}

function renderCustomerOptions(){
  const current=recordCustomer.value;
  recordCustomer.innerHTML=`<option value="">Not assigned</option>${customers.map(c=>`<option value="${escapeHtml(c.id)}">${escapeHtml(`${c.first_name} ${c.last_name}`)}</option>`).join("")}`;
  if(current)recordCustomer.value=current;
}

function renderAppointmentOptions(){
  const customerId=recordCustomer.value;
  const filtered=appointments.filter(a=>!customerId||a.customer_id===customerId);
  const current=recordAppointment.value;
  recordAppointment.innerHTML=`<option value="">Not assigned</option>${filtered.map(a=>`<option value="${escapeHtml(a.id)}">${escapeHtml(`${formatDateTime(a.start_at)} · ${a.service_name}`)}</option>`).join("")}`;
  if(current&&filtered.some(a=>a.id===current))recordAppointment.value=current;
}

function renderSubmissions(){
  const query=submissionSearch.value.trim().toLowerCase(),templateId=templateFilter.value,status=statusFilter.value,assignment=assignmentFilter.value;
  const filtered=submissions.filter(s=>{
    if(templateId!=="all"&&s.template_id!==templateId)return false;
    if(status!=="all"&&s.status!==status)return false;
    if(assignment==="assigned"&&!s.customer_id)return false;
    if(assignment==="unassigned"&&s.customer_id)return false;
    if(!query)return true;
    return [s.template_name,s.template_type,s.customer_first_name,s.customer_last_name,s.client_name,s.client_email,s.service_name].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
  if(!filtered.length){
    submissionList.className="es-empty-state";
    submissionList.innerHTML="<strong>No clinical records found.</strong><span>Submitted forms will appear here.</span>";
    return;
  }
  submissionList.className="es-clinical-record-list";
  submissionList.innerHTML=filtered.map(s=>`
    <article class="es-clinical-record-row">
      <div class="es-clinical-record-cell"><strong>${formatDate(s.submitted_at)}</strong><span>${formatTime(s.submitted_at)}</span></div>
      <div class="es-clinical-record-cell"><strong>${escapeHtml(s.template_name||"Clinical form")}</strong><span>${escapeHtml(formatTemplateType(s.template_type))}</span></div>
      <div class="es-clinical-record-cell"><strong>${escapeHtml(s.customer_id?`${s.customer_first_name||""} ${s.customer_last_name||""}`.trim():s.client_name||"Unassigned")}</strong><span>${escapeHtml(s.service_name||s.client_email||(s.customer_id?"Customer record":"No customer linked"))}</span></div>
      <div><span class="es-clinical-record-status ${s.status==="reviewed"?"reviewed":""}">${escapeHtml(s.status)}</span></div>
      <div class="es-clinical-record-cell"><strong>${Number(s.answer_count||0)}</strong><span>answers · ${Number(s.signature_count||0)} signature</span></div>
      <div><button class="es-clinical-record-action" type="button" data-open-submission="${escapeHtml(s.id)}">View</button></div>
    </article>`).join("");
  document.querySelectorAll("[data-open-submission]").forEach(b=>b.addEventListener("click",()=>openSubmission(b.dataset.openSubmission)));
}

async function openSubmission(id){
  try{
    const response=await fetch(`/api/clinical-submissions?id=${encodeURIComponent(id)}`,{headers:{Accept:"application/json"},cache:"no-store"});
    const data=await response.json();
    if(!response.ok||!data.ok)throw new Error(data.error||"Unable to load clinical record.");
    activeSubmission=data.submission;
    recordTitle.textContent=activeSubmission.template_name||"Clinical record";
    renderMeta();renderCustomerOptions();recordCustomer.value=activeSubmission.customer_id||"";renderAppointmentOptions();recordAppointment.value=activeSubmission.appointment_id||"";renderSections();
    markReviewedButton.textContent=activeSubmission.status==="reviewed"?"Mark awaiting review":"Mark reviewed";
    if(activeSubmission.customer_id){openCustomerButton.hidden=false;openCustomerButton.href=`/customers/?customer=${encodeURIComponent(activeSubmission.customer_id)}`}else{openCustomerButton.hidden=true}
    openDrawer();
  }catch(error){alert(error.message||"Unable to load clinical record.")}
}

function renderMeta(){
  const s=activeSubmission;
  recordMeta.innerHTML=[
    ["Submitted",formatDateTime(s.submitted_at)],
    ["Status",formatStatus(s.status)],
    ["Submitted by",formatStatus(s.submitted_by)],
    ["Form",s.template_name||"Clinical form"],
    ["Customer",s.customer_name||"Not assigned"],
    ["Appointment",s.appointment_label||"Not assigned"]
  ].map(([l,v])=>`<div class="es-clinical-record-meta-item"><span>${escapeHtml(l)}</span><strong>${escapeHtml(v)}</strong></div>`).join("");
}

function renderSections(){
  const signatureMap=new Map((activeSubmission.signatures||[]).map(sig=>[sig.field_key,sig.signature_data_url]));
  recordSections.innerHTML=(activeSubmission.sections||[]).map(section=>`
    <section class="es-clinical-record-section">
      <h3>${escapeHtml(section.title)}</h3>
      ${(section.fields||[]).map(field=>{
        if(field.field_type==="signature"){
          const sig=signatureMap.get(field.field_key);
          return `<div class="es-clinical-record-answer"><span>${escapeHtml(field.label)}</span>${sig?`<div class="es-clinical-record-signature"><strong>Signed</strong><img src="${sig}" alt="${escapeHtml(field.label)}"></div>`:"<strong>Not signed</strong>"}</div>`;
        }
        return `<div class="es-clinical-record-answer"><span>${escapeHtml(field.label)}</span><strong>${escapeHtml(field.value||"—")}</strong></div>`;
      }).join("")}
    </section>`).join("");
}

async function saveAssignment(){
  if(!activeSubmission)return;
  saveRecordAssignment.disabled=true;saveRecordAssignment.textContent="Saving…";
  const id=activeSubmission.id;
  try{
    const response=await fetch("/api/clinical-submissions",{method:"PUT",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({action:"assign",submission_id:id,customer_id:recordCustomer.value||null,appointment_id:recordAppointment.value||null})});
    const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"Unable to save assignment.");
    await loadSubmissions();await openSubmission(id);
  }catch(error){alert(error.message||"Unable to save assignment.")}
  finally{saveRecordAssignment.disabled=false;saveRecordAssignment.textContent="Save assignment"}
}

async function toggleReviewed(){
  if(!activeSubmission)return;
  const id=activeSubmission.id,nextStatus=activeSubmission.status==="reviewed"?"submitted":"reviewed";
  markReviewedButton.disabled=true;
  try{
    const response=await fetch("/api/clinical-submissions",{method:"PUT",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({action:"status",submission_id:id,status:nextStatus})});
    const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"Unable to update review status.");
    await loadSubmissions();await openSubmission(id);
  }catch(error){alert(error.message||"Unable to update review status.")}
  finally{markReviewedButton.disabled=false}
}

function openDrawer(){recordDrawer.classList.add("is-open");recordBackdrop.classList.add("is-open");recordDrawer.setAttribute("aria-hidden","false")}
function closeDrawer(){activeSubmission=null;recordDrawer.classList.remove("is-open");recordBackdrop.classList.remove("is-open");recordDrawer.setAttribute("aria-hidden","true")}
function formatTemplateType(v){return{consultation:"Consultation",patch_test:"Patch test",treatment_record:"Treatment record",custom:"Custom"}[v]||v||"Clinical form"}
function formatStatus(v){return String(v||"").replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}
function toDate(v){if(!v)return null;const n=String(v).includes("T")?String(v):`${String(v).replace(" ","T")}Z`;const d=new Date(n);return Number.isNaN(d.getTime())?null:d}
function formatDate(v){const d=toDate(v);return d?new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(d):"—"}
function formatTime(v){const d=toDate(v);return d?new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit"}).format(d):""}
function formatDateTime(v){const d=toDate(v);return d?new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d):"—"}
function escapeHtml(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
loadSubmissions();

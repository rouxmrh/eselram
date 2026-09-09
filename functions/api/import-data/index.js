import { readSessionToken, hashSessionToken } from "../../../lib/auth.js";

const MAX_ROWS = 500;
const BOOKING_STATUSES = new Set(["confirmed","completed","cancelled","no_show"]);
const PACKAGE_STATUSES = new Set(["active","completed","cancelled","expired"]);
const TREATMENT_STATUSES = new Set(["draft","complete"]);

async function getUserContext(request, env) {
  const token = readSessionToken(request); if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  return env.DB.prepare(`SELECT u.id AS user_id,u.business_id,b.currency FROM user_sessions s JOIN users u ON u.id=s.user_id JOIN businesses b ON b.id=u.business_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND u.is_active=1 LIMIT 1`).bind(tokenHash).first();
}
const unauthorized=()=>Response.json({ok:false,error:"Authentication required."},{status:401});
const clean=(v,max=500)=>String(v??"").trim().slice(0,max);
const key=v=>clean(v,300).toLowerCase();
function cleanEmail(v){const e=clean(v,254).toLowerCase();if(!e)return"";return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)?e:null;}
const cleanPhone=v=>clean(v,80);
const phoneKey=v=>cleanPhone(v).replace(/[^0-9+]/g,"");
function yesNo(v,f=false){const t=clean(v,20).toLowerCase();if(!t)return f;return ["yes","y","true","1","on"].includes(t);}
function excelDate(v){const n=Number(v);if(!Number.isFinite(n))return null;const d=new Date(Date.UTC(1899,11,30)+Math.round(n*86400000));return Number.isNaN(d.getTime())?null:d.toISOString().slice(0,10);}
function dateOnly(v){const t=clean(v,50);if(!t)return null;if(/^\d+(?:\.\d+)?$/.test(t))return excelDate(t);if(/^\d{4}-\d{2}-\d{2}$/.test(t))return t;const m=t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`:null;}
function timeOnly(v){const t=clean(v,50);if(!t)return null;if(/^\d+(?:\.\d+)?$/.test(t)){const f=((Number(t)%1)+1)%1,total=Math.round(f*1440)%1440;return`${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;}const m=t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);if(!m)return null;let h=Number(m[1]);const min=Number(m[2]);if(min>59)return null;if(m[3]){if(h<1||h>12)return null;if(m[3].toLowerCase()==="pm"&&h!==12)h+=12;if(m[3].toLowerCase()==="am"&&h===12)h=0;}if(h>23)return null;return`${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;}
function money(v,fallback=null){const t=clean(v,40).replace(/[£,$\s]/g,"");if(!t)return fallback;const n=Number(t);return Number.isFinite(n)&&n>=0?Math.round(n*100):null;}
function addMinutes(date,time,mins){const d=new Date(`${date}T${time}:00Z`);return Number.isNaN(d.getTime())?null:new Date(d.getTime()+mins*60000).toISOString().slice(0,19);}
function noteWithDiscount(notes, discountMinor, voucher){const parts=[clean(notes,3000)];if(discountMinor>0)parts.push(`Imported discount £${(discountMinor/100).toFixed(2)}${voucher?` · voucher ${voucher}`:""}`);else if(voucher)parts.push(`Imported voucher ${voucher}`);return parts.filter(Boolean).join(" · ")||null;}
function discountPaymentNotes(baseNotes,discountMinor,voucher,amountBeforeDiscountMinor,currentVouchers){
  const parts=[clean(baseNotes,3000)];
  const amount=Math.max(0,Number(discountMinor||0));
  const code=clean(voucher,80).toUpperCase();
  if(amount>0){
    const configured=(currentVouchers||[]).find(v=>String(v?.code||"").trim().toUpperCase()===code);
    let type="amount",label="Imported discount";
    const base=Math.max(0,Number(amountBeforeDiscountMinor||0));
    const inferredPercent=base>0?amount*100/base:0;
    const roundedPercent=Math.round(inferredPercent*100)/100;
    if(code){
      type="voucher";
      if(configured?.discount_type==="percent")label=`${code} · ${Number(configured.value||0)}% voucher`;
      else if(roundedPercent>0&&roundedPercent<=100&&Math.abs(inferredPercent-roundedPercent)<0.001)label=`${code} · ${roundedPercent}% voucher`;
      else label=`${code} · voucher`;
    }else if(roundedPercent>0&&roundedPercent<=100&&Math.abs(inferredPercent-roundedPercent)<0.001){type="percent";label=`${roundedPercent}% discount`;}
    parts.push(`discount_minor=${amount}`);
    parts.push(`deduction_type=${type}`);
    if(code)parts.push(`voucher=${code}`);
    parts.push(`label=${label}`);
    parts.push("discount_balance_applied=1");
  }
  return parts.filter(Boolean).join(" · ")||null;
}
function err(errors,sheet,row,field,message){errors.push({sheet,row,field,message});}
function autoRef(type,parts){let h=1469598103934665603n;const text=parts.map(x=>String(x??"").trim().toLowerCase()).join("|");for(let i=0;i<text.length;i++){h^=BigInt(text.charCodeAt(i));h=BigInt.asUintN(64,h*1099511628211n);}return `${type}_${h.toString(16).padStart(16,"0")}`;}
function normalizedStatus(v, fallback){return clean(v,40).toLowerCase().replaceAll(" ","_")||fallback;}

export async function onRequestGet({request,env}){
  const user=await getUserContext(request,env);if(!user)return unauthorized();
  const [services, templates, variants] = await Promise.all([
    env.DB.prepare(`SELECT id,name,duration_minutes,price_minor,service_type,consultation_service_id,is_active FROM services WHERE business_id=? AND is_active=1 ORDER BY sort_order,name COLLATE NOCASE`).bind(user.business_id).all(),
    env.DB.prepare(`SELECT pt.id,pt.service_id,pt.name,pt.sessions_total,pt.price_minor,pt.deposit_minor,pt.is_active,s.name AS service_name FROM package_templates pt JOIN services s ON s.id=pt.service_id AND s.business_id=pt.business_id WHERE pt.business_id=? AND pt.is_active=1 ORDER BY pt.name COLLATE NOCASE`).bind(user.business_id).all(),
    env.DB.prepare(`SELECT pv.id,pv.package_template_id,pv.service_id,pv.name,pv.price_minor,pv.deposit_minor,pv.is_active,pt.name AS template_name,pt.sessions_total,s.name AS service_name FROM package_variants pv JOIN package_templates pt ON pt.id=pv.package_template_id AND pt.business_id=pv.business_id JOIN services s ON s.id=pv.service_id AND s.business_id=pv.business_id WHERE pv.business_id=? AND pv.is_active=1 AND pt.is_active=1 ORDER BY pt.name COLLATE NOCASE,pv.sort_order,pv.name COLLATE NOCASE`).bind(user.business_id).all()
  ]);
  return Response.json({ok:true,max_rows:MAX_ROWS,services:services.results||[],package_templates:templates.results||[],package_variants:variants.results||[]});
}

export async function onRequestPost({request,env}){
 try{
  const user=await getUserContext(request,env);if(!user)return unauthorized();
  const body=await request.json().catch(()=>({})), sheets=body.sheets&&typeof body.sheets==="object"?body.sheets:{}, filename=clean(body.filename,255)||"eselram-import-template.xlsx";
  const rows={
    Customers:Array.isArray(sheets.Customers)?sheets.Customers:[],
    Bookings:Array.isArray(sheets.Bookings)?sheets.Bookings:[],
    Packages:Array.isArray(sheets["Packages & Courses"])?sheets["Packages & Courses"]:[],
    Treatments:Array.isArray(sheets["Treatment History"])?sheets["Treatment History"]:[],
    Vouchers:Array.isArray(sheets.Vouchers)?sheets.Vouchers:[]
  };
  const total=Object.values(rows).reduce((n,a)=>n+a.length,0);if(!total)return Response.json({ok:false,error:"No import rows were supplied."},{status:400});if(total>MAX_ROWS)return Response.json({ok:false,error:`Import a maximum of ${MAX_ROWS} total rows at a time.`},{status:400});

  const [serviceRes,customerRes,refRes,voucherSetting,templateRes,variantRes,existingPackageRes,existingConsultationRes]=await Promise.all([
    env.DB.prepare(`SELECT id,name,duration_minutes,price_minor,service_type,consultation_service_id FROM services WHERE business_id=? AND is_active=1`).bind(user.business_id).all(),
    env.DB.prepare(`SELECT id,first_name,last_name,email,phone FROM customers WHERE business_id=?`).bind(user.business_id).all(),
    env.DB.prepare(`SELECT entity_type,external_reference,internal_id FROM data_import_references WHERE business_id=?`).bind(user.business_id).all(),
    env.DB.prepare(`SELECT setting_value FROM business_settings WHERE business_id=? AND setting_key='payment_vouchers' LIMIT 1`).bind(user.business_id).first(),
    env.DB.prepare(`SELECT id,service_id,name,sessions_total,price_minor FROM package_templates WHERE business_id=? AND is_active=1`).bind(user.business_id).all(),
    env.DB.prepare(`SELECT id,package_template_id,service_id,name,price_minor FROM package_variants WHERE business_id=? AND is_active=1`).bind(user.business_id).all(),
    env.DB.prepare(`SELECT cp.id,cp.customer_id,cp.service_id,cp.name_snapshot,cp.package_template_id,cp.package_variant_id FROM customer_packages cp WHERE cp.business_id=? AND cp.status IN ('active','completed')`).bind(user.business_id).all(),
    env.DB.prepare(`
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
    `).bind(user.business_id).all()
  ]);
  const serviceRows=serviceRes.results||[];const services=new Map(serviceRows.map(s=>[key(s.name),s]));const servicesById=new Map(serviceRows.map(s=>[s.id,s]));
  const templates=templateRes.results||[],variants=variantRes.results||[];
  const packageChoices=new Map();
  for(const t of templates){packageChoices.set(key(t.name),{label:t.name,template:t,variant:null,serviceId:t.service_id,sessions:Number(t.sessions_total),price:Number(t.price_minor||0)});for(const v of variants.filter(v=>v.package_template_id===t.id)){const label=`${t.name} · ${v.name}`;packageChoices.set(key(label),{label,template:t,variant:v,serviceId:v.service_id,sessions:Number(t.sessions_total),price:Number(v.price_minor||0)});}}
  const customersByEmail=new Map(),customersByPhone=new Map(),customersById=new Map();
  for(const c of customerRes.results||[]){customersById.set(c.id,c);if(c.email)customersByEmail.set(key(c.email),c);if(c.phone)customersByPhone.set(phoneKey(c.phone),c);}
  const existingRefs=new Map((refRes.results||[]).map(r=>[`${r.entity_type}:${key(r.external_reference)}`,r.internal_id]));
  let currentVouchers=[];try{currentVouchers=JSON.parse(voucherSetting?.setting_value||"[]");if(!Array.isArray(currentVouchers))currentVouchers=[];}catch{currentVouchers=[];}
  const errors=[],statements=[],batchId=`imp_${crypto.randomUUID()}`;let customersCreated=0,paymentsCreated=0;

  // Customers are entered once. Other sheets use one email-or-phone key.
  for(const input of rows.Customers){
    const rn=Number(input.__row||0),first=clean(input.first_name,100),last=clean(input.last_name,100),email=cleanEmail(input.email),ph=cleanPhone(input.phone);
    if(!first)err(errors,"Customers",rn,"first_name","Enter the customer's first name.");
    if(!last)err(errors,"Customers",rn,"last_name","Enter the customer's last name.");
    if(email===null)err(errors,"Customers",rn,"email","The email address is not valid.");
    if(!email&&!ph)err(errors,"Customers",rn,"email","Enter an email address or phone number so other sheets can identify this customer.");
    let customer=null;if(email)customer=customersByEmail.get(key(email));if(!customer&&ph)customer=customersByPhone.get(phoneKey(ph));
    if(!customer&&first&&last&&email!==null&&(email||ph)){
      const id=`cus_${crypto.randomUUID()}`;customer={id,first_name:first,last_name:last,email:email||null,phone:ph||null};customersCreated++;
      statements.push(env.DB.prepare(`INSERT INTO customers(id,business_id,first_name,last_name,email,phone,notes,marketing_consent) VALUES(?,?,?,?,?,?,?,?)`).bind(id,user.business_id,first,last,email||null,ph||null,clean(input.notes,4000)||null,yesNo(input.marketing_consent,false)?1:0));
      customersById.set(id,customer);if(email)customersByEmail.set(key(email),customer);if(ph)customersByPhone.set(phoneKey(ph),customer);
    }
  }
  function resolveCustomer(raw,sheet,rn){const value=clean(raw,254);if(!value){err(errors,sheet,rn,"customer_email_or_phone","Choose the customer using their email address or phone number.");return null;}let c=null;if(value.includes("@")){const e=cleanEmail(value);if(e===null){err(errors,sheet,rn,"customer_email_or_phone","The customer email address is not valid.");return null;}c=customersByEmail.get(key(e));}else c=customersByPhone.get(phoneKey(value));if(!c)err(errors,sheet,rn,"customer_email_or_phone",`Customer '${value}' was not found. Add them on the Customers sheet first, or use the email/phone already stored in Eselram.`);return c?.id||null;}
  function lookupCustomer(raw){const value=clean(raw,254);if(!value)return null;if(value.includes("@")){const e=cleanEmail(value);return e?customersByEmail.get(key(e))||null:null;}return customersByPhone.get(phoneKey(value))||null;}

  const plannedBookingIds=new Map(),importedConsultations=[];
  for(const input of rows.Bookings){
    const customer=lookupCustomer(input.customer_email_or_phone),service=services.get(key(input.eselram_service)),status=normalizedStatus(input.status,"confirmed"),date=dateOnly(input.appointment_date),time=timeOnly(input.start_time),paid=money(input.amount_already_paid,0);
    if(customer&&service?.service_type==="consultation"&&status==="completed"&&date&&time&&paid!==null&&paid>0){
      const external=autoRef("booking",[customer.id,service.id,date,time]);
      if(!existingRefs.has(`booking:${key(external)}`)){const id=`apt_${crypto.randomUUID()}`;plannedBookingIds.set(input,id);importedConsultations.push({id,customerId:customer.id,serviceId:service.id,paidMinor:paid,startAt:`${date}T${time}:00`});}
    }
  }
  const availableExistingConsultations=(existingConsultationRes.results||[]).map(r=>({id:r.id,customerId:r.customer_id,serviceId:r.service_id,paidMinor:Number(r.paid_minor||0),startAt:r.start_at||""}));
  const usedConsultationSources=new Set(),pendingPackageCredits=[];

  const importedPackageByCustomerChoice=new Map();
  const existingPackages=existingPackageRes.results||[];

  // Package/course balances. Package details come from the selected Eselram package rather than duplicated spreadsheet fields.
  for(const input of rows.Packages){
    const rn=Number(input.__row||0),customerId=resolveCustomer(input.customer_email_or_phone,"Packages & Courses",rn),choiceText=clean(input.eselram_package_or_course,250),choice=packageChoices.get(key(choiceText)),status=normalizedStatus(input.status,"active"),starts=clean(input.start_date)?dateOnly(input.start_date):null,expires=clean(input.expiry_date)?dateOnly(input.expiry_date):null,discount=money(input.discount,0),voucher=clean(input.voucher_used,80).toUpperCase(),consultationCredit=money(input.consultation_credit,0),paid=money(input.amount_already_paid,0),method=clean(input.payment_method,80)||"imported";
    if(!choice)err(errors,"Packages & Courses",rn,"eselram_package_or_course",`'${choiceText||"blank"}' does not match a current Eselram package/course. Choose a value from the dropdown.`);
    if(!PACKAGE_STATUSES.has(status))err(errors,"Packages & Courses",rn,"status","Status must be Active, Completed, Cancelled or Expired.");
    if(clean(input.start_date)&&!starts)err(errors,"Packages & Courses",rn,"start_date","Start date is invalid.");if(clean(input.expiry_date)&&!expires)err(errors,"Packages & Courses",rn,"expiry_date","Expiry date is invalid.");
    const basePrice=money(input.package_price,choice?.price??0);if(basePrice===null||discount===null||discount>basePrice)err(errors,"Packages & Courses",rn,"package_price","Package price or discount is invalid.");
    const finalPrice=basePrice===null||discount===null?null:Math.max(basePrice-discount,0);
    if(consultationCredit===null)err(errors,"Packages & Courses",rn,"consultation_credit","Consultation credit is invalid.");
    if(finalPrice!==null&&consultationCredit!==null&&consultationCredit>finalPrice)err(errors,"Packages & Courses",rn,"consultation_credit","Consultation credit cannot be greater than the package value after discount.");
    const remainingAfterCredit=finalPrice===null||consultationCredit===null?null:Math.max(finalPrice-consultationCredit,0);
    if(paid===null||(remainingAfterCredit!==null&&paid>remainingAfterCredit))err(errors,"Packages & Courses",rn,"amount_already_paid","Amount already paid cannot be greater than the package balance after consultation credit.");
    let creditSource=null;
    if(customerId&&choice&&consultationCredit>0){
      const treatmentService=servicesById.get(choice.serviceId);
      const explicitConsultationServiceId=clean(treatmentService?.consultation_service_id,120);
      const allUnused=[...importedConsultations,...availableExistingConsultations]
        .filter(c=>c.customerId===customerId&&!usedConsultationSources.has(c.id));

      // Prefer the consultation explicitly linked to the standard treatment.
      // Older/migrated businesses may not have that relationship configured, so
      // the importer safely falls back to a single unused paid consultation for
      // the same customer rather than changing any live booking/payment rules.
      let candidates=explicitConsultationServiceId
        ? allUnused.filter(c=>c.serviceId===explicitConsultationServiceId)
        : [];

      if(!candidates.length){
        const consultationServicesForCustomer=allUnused.filter(c=>servicesById.get(c.serviceId)?.service_type==="consultation");
        if(consultationServicesForCustomer.length===1)candidates=consultationServicesForCustomer;
        else if(consultationServicesForCustomer.length>1){
          const treatmentName=key(treatmentService?.name||choice.label);
          const nameMatched=consultationServicesForCustomer.filter(c=>{
            const consultationName=key(servicesById.get(c.serviceId)?.name||"");
            return treatmentName&&consultationName&&(consultationName.includes(treatmentName)||treatmentName.includes(consultationName.replace(/\bconsultation\b/g,"").trim()));
          });
          if(nameMatched.length===1)candidates=nameMatched;
        }
      }

      candidates.sort((a,b)=>String(b.startAt||"").localeCompare(String(a.startAt||"")));
      creditSource=candidates[0]||null;
      if(!creditSource)err(errors,"Packages & Courses",rn,"consultation_credit","No unique unused paid completed consultation could be matched to this package. Import the consultation booking too, or link the treatment to its consultation in Services.");
      else if(consultationCredit>creditSource.paidMinor)err(errors,"Packages & Courses",rn,"consultation_credit",`Consultation credit cannot exceed the consultation payment of £${(creditSource.paidMinor/100).toFixed(2)}.`);
    }
    if(customerId&&choice&&PACKAGE_STATUSES.has(status)&&finalPrice!==null&&consultationCredit!==null&&remainingAfterCredit!==null&&paid!==null&&paid<=remainingAfterCredit&&(!consultationCredit||creditSource)){
      const mapKey=`${customerId}|${key(choice.label)}`;if(importedPackageByCustomerChoice.has(mapKey)){err(errors,"Packages & Courses",rn,"eselram_package_or_course","This customer already has the same package/course in this workbook. Import each package purchase once.");continue;}
      const external=autoRef("package",[customerId,choice.variant?.id||choice.template.id,starts||"",expires||"",finalPrice]);
      if(existingRefs.has(`package:${key(external)}`)){err(errors,"Packages & Courses",rn,"eselram_package_or_course","This package/course appears to have already been imported.");continue;}
      const id=`cpk_${crypto.randomUUID()}`;importedPackageByCustomerChoice.set(mapKey,{id,customerId,serviceId:choice.serviceId,label:choice.label});
      statements.push(env.DB.prepare(`INSERT INTO customer_packages(id,business_id,customer_id,package_template_id,service_id,name_snapshot,sessions_total,price_minor,status,starts_on,expires_on,notes,package_variant_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,user.business_id,customerId,choice.template.id,choice.serviceId,choice.label,choice.sessions,finalPrice,status,starts,expires,noteWithDiscount(input.notes,discount,voucher),choice.variant?.id||null));
      statements.push(env.DB.prepare(`INSERT INTO data_import_references(business_id,import_batch_id,entity_type,external_reference,internal_id) VALUES(?,?,?,?,?)`).bind(user.business_id,batchId,"package",external,id));
      let packagePaymentId=null;
      if(paid>0){const pid=`pay_${crypto.randomUUID()}`,ptype=paid+consultationCredit>=finalPrice?"full":"deposit",amountBeforeDiscount=Math.max(0,basePrice-consultationCredit);packagePaymentId=pid;paymentsCreated++;statements.push(env.DB.prepare(`INSERT INTO payments(id,business_id,appointment_id,customer_id,provider,payment_type,amount_minor,currency,status,provider_reference,paid_at,payment_method,notes) VALUES(?,?,NULL,?,'manual',?,?,?,'paid',?,CURRENT_TIMESTAMP,?,?)`).bind(pid,user.business_id,customerId,ptype,paid,String(user.currency||"GBP").toUpperCase(),`import:${external}`,method,discountPaymentNotes("Imported historical package payment",discount,voucher,amountBeforeDiscount,currentVouchers)));statements.push(env.DB.prepare(`INSERT INTO customer_package_payments(customer_package_id,payment_id) VALUES(?,?)`).bind(id,pid));}
      if(consultationCredit>0&&creditSource){usedConsultationSources.add(creditSource.id);pendingPackageCredits.push({customerPackageId:id,customerId,packageTemplateId:choice.template.id,packageVariantId:choice.variant?.id||null,paymentId:packagePaymentId,paymentChoice:paid+consultationCredit>=finalPrice?"full":"deposit",amountMinor:paid,sourceAppointmentId:creditSource.id,creditMinor:consultationCredit});}
    }
  }

  function findPackageForBooking(customerId,label){if(!label)return null;const imported=importedPackageByCustomerChoice.get(`${customerId}|${key(label)}`);if(imported)return imported;const choice=packageChoices.get(key(label));if(!choice)return null;const matches=existingPackages.filter(p=>p.customer_id===customerId&&(p.package_variant_id&&choice.variant?.id===p.package_variant_id||!p.package_variant_id&&p.package_template_id===choice.template.id||key(p.name_snapshot)===key(label)));if(matches.length===1)return{id:matches[0].id,customerId,serviceId:matches[0].service_id,label};return null;}

  // Bookings. Amount paid is converted into one historical manual payment automatically.
  for(const input of rows.Bookings){
    const rn=Number(input.__row||0),customerId=resolveCustomer(input.customer_email_or_phone,"Bookings",rn),serviceName=clean(input.eselram_service,200),service=services.get(key(serviceName)),date=dateOnly(input.appointment_date),time=timeOnly(input.start_time),status=normalizedStatus(input.status,"confirmed"),packageLabel=clean(input.package_or_course,250),pkg=customerId&&packageLabel?findPackageForBooking(customerId,packageLabel):null,discount=money(input.discount,0),voucher=clean(input.voucher_used,80).toUpperCase(),paid=money(input.amount_already_paid,0),method=clean(input.payment_method,80)||"imported";
    if(!service)err(errors,"Bookings",rn,"eselram_service",`'${serviceName||"blank"}' does not match an active Eselram service. Choose a value from the dropdown.`);if(!date)err(errors,"Bookings",rn,"appointment_date","Appointment date is invalid.");if(!time)err(errors,"Bookings",rn,"start_time","Start time is invalid.");if(!BOOKING_STATUSES.has(status))err(errors,"Bookings",rn,"status","Status must be Confirmed, Completed, Cancelled or No show.");
    if(packageLabel&&!packageChoices.has(key(packageLabel)))err(errors,"Bookings",rn,"package_or_course",`'${packageLabel}' is not a current Eselram package/course.`);else if(packageLabel&&!pkg)err(errors,"Bookings",rn,"package_or_course","The selected package/course is not attached to this customer. Add it on Packages & Courses first, or make sure the customer already owns it in Eselram.");
    if(pkg&&service&&pkg.serviceId!==service.id)err(errors,"Bookings",rn,"package_or_course","The selected package/course belongs to a different service.");
    const basePrice=money(input.price,service?Number(service.price_minor||0):0);if(basePrice===null||discount===null||discount>basePrice)err(errors,"Bookings",rn,"price","Price or discount is invalid.");const finalPrice=pkg?0:(basePrice===null||discount===null?null:Math.max(basePrice-discount,0));if(paid===null||(finalPrice!==null&&paid>finalPrice))err(errors,"Bookings",rn,"amount_already_paid","Amount already paid cannot be greater than the appointment price.");if(pkg&&paid>0)err(errors,"Bookings",rn,"amount_already_paid","Leave Amount already paid blank for package-linked appointments. Package payments belong on Packages & Courses.");
    if(customerId&&service&&date&&time&&BOOKING_STATUSES.has(status)&&finalPrice!==null&&paid!==null&&paid<=finalPrice&&(!packageLabel||pkg)){
      const external=autoRef("booking",[customerId,service.id,date,time]);if(existingRefs.has(`booking:${key(external)}`)){err(errors,"Bookings",rn,"appointment_date","This booking appears to have already been imported.");continue;}
      const id=plannedBookingIds.get(input)||`apt_${crypto.randomUUID()}`,duration=Number(service.duration_minutes||30),start=`${date}T${time}:00`,end=addMinutes(date,time,duration),kind=service.service_type==="consultation"?"consultation":"service";
      statements.push(env.DB.prepare(`INSERT INTO appointments(id,business_id,customer_id,service_id,status,start_at,end_at,price_minor,deposit_due_minor,booking_source,booking_kind,customer_notes,internal_notes,cancelled_at,cancellation_reason,import_batch_id,external_reference,reminders_enabled) VALUES(?,?,?,?,?,?,?,?,0,'import',?,?,?,CASE WHEN ?='cancelled' THEN CURRENT_TIMESTAMP ELSE NULL END,?,?,?,?)`).bind(id,user.business_id,customerId,service.id,status,start,end,finalPrice,kind,clean(input.notes,3000)||null,noteWithDiscount(null,discount,voucher),status,clean(input.cancellation_reason,500)||null,batchId,external,yesNo(input.send_future_reminder,false)?1:0));
      statements.push(env.DB.prepare(`INSERT INTO data_import_references(business_id,import_batch_id,entity_type,external_reference,internal_id) VALUES(?,?,?,?,?)`).bind(user.business_id,batchId,"booking",external,id));
      if(pkg?.id)statements.push(env.DB.prepare(`INSERT INTO customer_package_appointments(customer_package_id,appointment_id) VALUES(?,?)`).bind(pkg.id,id));
      if(paid>0){const pid=`pay_${crypto.randomUUID()}`,ptype=paid>=finalPrice?"full":"deposit";paymentsCreated++;statements.push(env.DB.prepare(`INSERT INTO payments(id,business_id,appointment_id,customer_id,provider,payment_type,amount_minor,currency,status,provider_reference,paid_at,payment_method,notes) VALUES(?,?,?,?,'manual',?,?,?,'paid',?,CURRENT_TIMESTAMP,?,?)`).bind(pid,user.business_id,id,customerId,ptype,paid,String(user.currency||"GBP").toUpperCase(),`import:${external}`,method,"Imported historical booking payment"));}
    }
  }

  for(const credit of pendingPackageCredits){
    statements.push(env.DB.prepare(`INSERT INTO package_sales(id,business_id,customer_id,package_template_id,package_variant_id,source,payment_choice,amount_minor,currency,status,payment_id,customer_package_id,created_by_user_id,paid_at,consultation_credit_source_appointment_id,consultation_credit_minor) VALUES(?,?,?,?,?,'staff',?,?,?,'paid',?,?,?,CURRENT_TIMESTAMP,?,?)`).bind(`psl_${crypto.randomUUID()}`,user.business_id,credit.customerId,credit.packageTemplateId,credit.packageVariantId,credit.paymentChoice,credit.amountMinor,String(user.currency||"GBP").toUpperCase(),credit.paymentId,credit.customerPackageId,user.user_id,credit.sourceAppointmentId,credit.creditMinor));
  }

  // Optional standard treatment history.
  for(const input of rows.Treatments){
    const rn=Number(input.__row||0),customerId=resolveCustomer(input.customer_email_or_phone,"Treatment History",rn),serviceName=clean(input.eselram_service,200),service=services.get(key(serviceName)),status=normalizedStatus(input.status,"complete"),date=dateOnly(input.treatment_date),nextDate=clean(input.next_treatment_date)?dateOnly(input.next_treatment_date):null;
    if(!service)err(errors,"Treatment History",rn,"eselram_service",`'${serviceName||"blank"}' does not match an active Eselram service.`);if(!TREATMENT_STATUSES.has(status))err(errors,"Treatment History",rn,"status","Status must be Complete or Draft.");if(!date)err(errors,"Treatment History",rn,"treatment_date","Treatment date is invalid.");if(clean(input.next_treatment_date)&&!nextDate)err(errors,"Treatment History",rn,"next_treatment_date","Next treatment date is invalid.");
    if(customerId&&service&&TREATMENT_STATUSES.has(status)&&date){const external=autoRef("treatment",[customerId,service.id,date,clean(input.practitioner,200),clean(input.treatment_area,300)]);if(existingRefs.has(`treatment_record:${key(external)}`)){err(errors,"Treatment History",rn,"treatment_date","This treatment record appears to have already been imported.");continue;}const id=`tr_${crypto.randomUUID()}`;statements.push(env.DB.prepare(`INSERT INTO treatment_records(id,business_id,appointment_id,customer_id,service_id,status,treatment_date,practitioner_name,treatment_area,device_name,device_settings,treatment_notes,client_response,client_tolerance,aftercare_notes,next_session_plan,next_treatment_date,import_batch_id,external_reference) VALUES(?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,user.business_id,customerId,service.id,status,date,clean(input.practitioner,200)||null,clean(input.treatment_area,500)||null,clean(input.device,300)||null,clean(input.device_settings,3000)||null,clean(input.treatment_notes,5000)||null,clean(input.client_response,3000)||null,clean(input.client_tolerance,1000)||null,clean(input.aftercare_notes,3000)||null,clean(input.next_session_plan,3000)||null,nextDate,batchId,external));statements.push(env.DB.prepare(`INSERT INTO data_import_references(business_id,import_batch_id,entity_type,external_reference,internal_id) VALUES(?,?,?,?,?)`).bind(user.business_id,batchId,"treatment_record",external,id));}
  }

  const voucherCodes=new Set(currentVouchers.map(v=>String(v.code||"").trim().toUpperCase()));const importedVouchers=[];
  for(const input of rows.Vouchers){const rn=Number(input.__row||0),code=clean(input.code,80).toUpperCase().replace(/\s+/g,""),name=clean(input.name,80)||code,type=clean(input.discount_type,30).toLowerCase(),value=Number(String(input.value??"").replace(/[£,%,$\s]/g,"")),active=yesNo(input.active,true);if(!code)err(errors,"Vouchers",rn,"code","Voucher code is required.");if(!["amount","percent"].includes(type))err(errors,"Vouchers",rn,"discount_type","Discount type must be Amount or Percent.");if(!Number.isFinite(value)||value<=0||(type==="percent"&&value>100))err(errors,"Vouchers",rn,"value","Voucher value is invalid.");if(voucherCodes.has(code))err(errors,"Vouchers",rn,"code",`Voucher code ${code} already exists or is duplicated.`);if(code&&["amount","percent"].includes(type)&&Number.isFinite(value)&&value>0&&(type!=="percent"||value<=100)){voucherCodes.add(code);importedVouchers.push({id:`vch_${crypto.randomUUID()}`,code,name,discount_type:type,value,is_active:active});}}

  if(errors.length)return Response.json({ok:false,error:"Nothing was imported. Fix the highlighted workbook rows and try again.",errors},{status:400});
  statements.unshift(env.DB.prepare(`INSERT INTO data_import_batches(id,business_id,created_by_user_id,source_filename,customers_imported,bookings_imported,packages_imported,payments_imported,vouchers_imported,treatment_records_imported) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(batchId,user.business_id,user.user_id,filename,rows.Customers.length,rows.Bookings.length,rows.Packages.length,paymentsCreated,rows.Vouchers.length,rows.Treatments.length));
  if(importedVouchers.length){const merged=[...currentVouchers,...importedVouchers];statements.push(env.DB.prepare(`INSERT INTO business_settings(id,business_id,setting_key,setting_value,value_type) VALUES(?,?,'payment_vouchers',?,'json') ON CONFLICT(business_id,setting_key) DO UPDATE SET setting_value=excluded.setting_value,value_type='json',updated_at=CURRENT_TIMESTAMP`).bind(`set_${crypto.randomUUID()}`,user.business_id,JSON.stringify(merged)));}
  await env.DB.batch(statements);
  return Response.json({ok:true,batch_id:batchId,customers_imported:rows.Customers.length,customers_created:customersCreated,bookings_imported:rows.Bookings.length,packages_imported:rows.Packages.length,payments_created:paymentsCreated,vouchers_imported:rows.Vouchers.length,treatment_records_imported:rows.Treatments.length});
 }catch(error){console.error("Data import failed:",error);return Response.json({ok:false,error:"Unable to import data. Nothing was intentionally sent to Stripe or email providers."},{status:500});}
}

import {readSessionToken,hashSessionToken} from "../../../lib/auth.js";

async function getUserContext(request,env){
  const token=readSessionToken(request);if(!token)return null;
  const tokenHash=await hashSessionToken(token);
  return await env.DB.prepare(`
    SELECT u.id AS user_id,u.business_id
    FROM user_sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL
      AND datetime(s.expires_at)>datetime('now')
      AND u.is_active=1
    LIMIT 1
  `).bind(tokenHash).first();
}
function unauthorized(){return Response.json({ok:false,error:"Authentication required."},{status:401})}
function badRequest(message){return Response.json({ok:false,error:message},{status:400})}

export async function onRequestGet({request,env}){
  try{
    const user=await getUserContext(request,env);if(!user)return unauthorized();
    const url=new URL(request.url),id=String(url.searchParams.get("id")||"").trim();
    if(id)return await getSubmissionDetail({id,user,env});

    const [submissionRows,templateRows,customerRows,appointmentRows,totalRow,submittedRow,reviewedRow,unassignedRow]=await Promise.all([
      env.DB.prepare(`
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
      `).bind(user.business_id).all(),
      env.DB.prepare(`SELECT id,name,template_type FROM clinical_templates WHERE business_id=? ORDER BY name COLLATE NOCASE`).bind(user.business_id).all(),
      env.DB.prepare(`SELECT id,first_name,last_name FROM customers WHERE business_id=? ORDER BY last_name COLLATE NOCASE,first_name COLLATE NOCASE`).bind(user.business_id).all(),
      env.DB.prepare(`
        SELECT a.id,a.customer_id,a.start_at,a.status,sv.name AS service_name
        FROM appointments a JOIN services sv ON sv.id=a.service_id
        WHERE a.business_id=? AND a.status!='cancelled'
        ORDER BY datetime(a.start_at) DESC
      `).bind(user.business_id).all(),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM clinical_form_submissions WHERE business_id=?`).bind(user.business_id).first(),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM clinical_form_submissions WHERE business_id=? AND status='submitted'`).bind(user.business_id).first(),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM clinical_form_submissions WHERE business_id=? AND status='reviewed'`).bind(user.business_id).first(),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM clinical_form_submissions WHERE business_id=? AND customer_id IS NULL`).bind(user.business_id).first()
    ]);

    return Response.json({
      ok:true,
      stats:{
        total_submissions:Number(totalRow?.count||0),
        awaiting_review:Number(submittedRow?.count||0),
        reviewed_submissions:Number(reviewedRow?.count||0),
        unassigned_submissions:Number(unassignedRow?.count||0)
      },
      submissions:submissionRows.results||[],
      templates:templateRows.results||[],
      customers:customerRows.results||[],
      appointments:appointmentRows.results||[]
    });
  }catch(error){
    console.error("Clinical submissions GET failed:",error);
    return Response.json({ok:false,error:"Unable to load clinical records."},{status:500});
  }
}

async function getSubmissionDetail({id,user,env}){
  const submission=await env.DB.prepare(`
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
  `).bind(id,user.business_id).first();

  if(!submission)return Response.json({ok:false,error:"Clinical record not found."},{status:404});

  const [answerRows,signatureRows,uploadRows]=await Promise.all([
    env.DB.prepare(`SELECT field_key,field_label,field_type,value_text,value_json FROM clinical_form_answers WHERE submission_id=? AND business_id=?`).bind(submission.id,user.business_id).all(),
    env.DB.prepare(`SELECT field_key,signature_data_url,created_at FROM clinical_form_signatures WHERE submission_id=? AND business_id=?`).bind(submission.id,user.business_id).all(),
    env.DB.prepare(`SELECT id,field_key,original_name,mime_type,size_bytes,storage_provider,created_at FROM clinical_form_uploads WHERE submission_id=? AND business_id=?`).bind(submission.id,user.business_id).all()
  ]);

  const answerMap=new Map((answerRows.results||[]).map(a=>[a.field_key,a]));
  const snapshot=parseJson(submission.template_snapshot_json,null);
  let sections=[];

  if(snapshot&&Array.isArray(snapshot.sections)){
    sections=snapshot.sections.map((section,sectionIndex)=>({
      id:`snapshot_section_${sectionIndex}`,
      title:section.title||`Section ${sectionIndex+1}`,
      description:section.description||null,
      sort_order:Number(section.sort_order??sectionIndex),
      fields:(Array.isArray(section.fields)?section.fields:[]).map((field,fieldIndex)=>{
        const answer=answerMap.get(field.field_key);
        return {
          id:`snapshot_field_${sectionIndex}_${fieldIndex}`,
          section_id:`snapshot_section_${sectionIndex}`,
          label:field.label||answer?.field_label||"Field",
          field_key:field.field_key,
          field_type:field.field_type||answer?.field_type||"short_text",
          sort_order:Number(field.sort_order??fieldIndex),
          value:answer?.value_text||"",
          value_json:answer?.value_json||null
        };
      })
    }));
  }else{
    const [sectionRows,fieldRows]=await Promise.all([
      env.DB.prepare(`SELECT id,title,description,sort_order FROM clinical_template_sections WHERE business_id=? AND template_id=? ORDER BY sort_order ASC`).bind(user.business_id,submission.template_id).all(),
      env.DB.prepare(`SELECT id,section_id,label,field_key,field_type,sort_order FROM clinical_template_fields WHERE business_id=? AND template_id=? ORDER BY sort_order ASC`).bind(user.business_id,submission.template_id).all()
    ]);

    sections=(sectionRows.results||[]).map(s=>({...s,fields:[]}));
    const sectionMap=new Map(sections.map(s=>[s.id,s]));
    for(const field of fieldRows.results||[]){
      const section=sectionMap.get(field.section_id);if(!section)continue;
      const answer=answerMap.get(field.field_key);
      section.fields.push({...field,value:answer?.value_text||"",value_json:answer?.value_json||null});
    }
  }

  const customerName=submission.customer_id?`${submission.customer_first_name||""} ${submission.customer_last_name||""}`.trim():null;

  return Response.json({ok:true,submission:{...submission,customer_name:customerName,sections,signatures:signatureRows.results||[],uploads:uploadRows.results||[]}});
}


function parseJson(value,fallback){
  if(!value)return fallback;
  try{return JSON.parse(value)}catch{return fallback}
}

export async function onRequestPut({request,env}){
  try{
    const user=await getUserContext(request,env);if(!user)return unauthorized();
    const body=await request.json(),action=String(body.action||"").trim(),submissionId=String(body.submission_id||"").trim();
    if(!submissionId)return badRequest("submission_id is required.");

    const exists=await env.DB.prepare(`SELECT id FROM clinical_form_submissions WHERE id=? AND business_id=? LIMIT 1`).bind(submissionId,user.business_id).first();
    if(!exists)return Response.json({ok:false,error:"Clinical record not found."},{status:404});

    if(action==="status"){
      const status=String(body.status||"").trim();
      if(!["submitted","reviewed"].includes(status))return badRequest("Invalid review status.");
      if(status==="reviewed"){
        await env.DB.prepare(`
          UPDATE clinical_form_submissions
          SET status='reviewed',reviewed_at=CURRENT_TIMESTAMP,reviewed_by_user_id=?,updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND business_id=?
        `).bind(user.user_id,submissionId,user.business_id).run();
      }else{
        await env.DB.prepare(`
          UPDATE clinical_form_submissions
          SET status='submitted',reviewed_at=NULL,reviewed_by_user_id=NULL,updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND business_id=?
        `).bind(submissionId,user.business_id).run();
      }
      return Response.json({ok:true});
    }

    if(action==="assign"){
      const customerId=body.customer_id===null||body.customer_id===""?null:String(body.customer_id).trim();
      const appointmentId=body.appointment_id===null||body.appointment_id===""?null:String(body.appointment_id).trim();

      if(customerId){
        const customer=await env.DB.prepare(`SELECT id FROM customers WHERE id=? AND business_id=? LIMIT 1`).bind(customerId,user.business_id).first();
        if(!customer)return badRequest("Customer not found.");
      }

      if(appointmentId){
        const appointment=await env.DB.prepare(`SELECT id,customer_id FROM appointments WHERE id=? AND business_id=? LIMIT 1`).bind(appointmentId,user.business_id).first();
        if(!appointment)return badRequest("Appointment not found.");
        if(customerId&&appointment.customer_id!==customerId)return badRequest("Appointment does not belong to the selected customer.");
      }

      await env.DB.prepare(`
        UPDATE clinical_form_submissions
        SET customer_id=?,appointment_id=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND business_id=?
      `).bind(customerId,appointmentId,submissionId,user.business_id).run();

      return Response.json({ok:true});
    }

    return badRequest("Invalid action.");
  }catch(error){
    console.error("Clinical submissions PUT failed:",error);
    return Response.json({ok:false,error:"Unable to update clinical record."},{status:500});
  }
}

export async function onRequestDelete({request,env}){
  try{
    const user=await getUserContext(request,env);if(!user)return unauthorized();
    const url=new URL(request.url),submissionId=String(url.searchParams.get("id")||"").trim();
    if(!submissionId)return badRequest("Clinical record id is required.");

    const submission=await env.DB.prepare(`
      SELECT id,submitted_by
      FROM clinical_form_submissions
      WHERE id=? AND business_id=?
      LIMIT 1
    `).bind(submissionId,user.business_id).first();

    if(!submission)return Response.json({ok:false,error:"Clinical record not found."},{status:404});

    if(submission.submitted_by!=="staff"){
      return Response.json(
        {ok:false,error:"Client-submitted forms cannot be deleted from this action."},
        {status:403}
      );
    }

    const uploadRows=await env.DB.prepare(`
      SELECT id,storage_provider,storage_key
      FROM clinical_form_uploads
      WHERE submission_id=? AND business_id=?
    `).bind(submissionId,user.business_id).all();

    for(const upload of uploadRows.results||[]){
      if(upload.storage_provider==="r2"&&upload.storage_key&&env.FORM_UPLOADS){
        try{await env.FORM_UPLOADS.delete(upload.storage_key)}catch(error){
          console.error("Unable to delete clinical upload:",error);
        }
      }
    }

    await env.DB.batch([
      env.DB.prepare(`DELETE FROM clinical_form_uploads WHERE submission_id=? AND business_id=?`).bind(submissionId,user.business_id),
      env.DB.prepare(`DELETE FROM clinical_form_signatures WHERE submission_id=? AND business_id=?`).bind(submissionId,user.business_id),
      env.DB.prepare(`DELETE FROM clinical_form_answers WHERE submission_id=? AND business_id=?`).bind(submissionId,user.business_id),
      env.DB.prepare(`DELETE FROM clinical_form_requests WHERE submission_id=? AND business_id=?`).bind(submissionId,user.business_id),
      env.DB.prepare(`DELETE FROM clinical_form_submissions WHERE id=? AND business_id=?`).bind(submissionId,user.business_id)
    ]);

    return Response.json({ok:true});
  }catch(error){
    console.error("Clinical record DELETE failed:",error);
    return Response.json({ok:false,error:"Unable to delete clinical record."},{status:500});
  }
}


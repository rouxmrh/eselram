import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

const STARTERS = [{"key":"general_consultation","name":"General Consultation","template_type":"consultation","description":"A neutral client consultation covering goals, relevant history, treatment safety, photos and acknowledgement.","sections":[{"title":"Client Details","fields":[{"label":"Full name","field_type":"short_text","field_key":"full_name_1_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Date of birth","field_type":"date","field_key":"date_of_birth_1_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Email address","field_type":"short_text","field_key":"email_address_1_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Contact number","field_type":"short_text","field_key":"contact_number_1_4","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null},{"title":"Treatment Goals","fields":[{"label":"What would you like to achieve from treatment?","field_type":"long_text","field_key":"what_would_you_like_to_achieve_from_treatment_2_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Have you had this treatment before?","field_type":"yes_no","field_key":"have_you_had_this_treatment_before_2_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Previous treatment details","field_type":"long_text","field_key":"previous_treatment_details_2_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Relevant Medical History","fields":[{"label":"Do you have any medical conditions relevant to treatment?","field_type":"yes_no","field_key":"do_you_have_any_medical_conditions_relevant_to_t_3_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Medical conditions or relevant history","field_type":"long_text","field_key":"medical_conditions_or_relevant_history_3_2","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Current medication or therapy","field_type":"long_text","field_key":"current_medication_or_therapy_3_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Known allergies","field_type":"long_text","field_key":"known_allergies_3_4","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Treatment Safety","fields":[{"label":"Currently pregnant or breastfeeding","field_type":"yes_no","field_key":"currently_pregnant_or_breastfeeding_4_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Recent sun exposure or tanning","field_type":"yes_no","field_key":"recent_sun_exposure_or_tanning_4_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Active infection or irritation in treatment area","field_type":"yes_no","field_key":"active_infection_or_irritation_in_treatment_area_4_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"History of poor wound healing or abnormal scarring","field_type":"yes_no","field_key":"history_of_poor_wound_healing_or_abnormal_scarri_4_4","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Any other safety information the practitioner should know","field_type":"long_text","field_key":"any_other_safety_information_the_practitioner_sh_4_5","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Clinical Photos","fields":[{"label":"I consent to clinical photographs for treatment monitoring","field_type":"yes_no","field_key":"i_consent_to_clinical_photographs_for_treatment__5_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null},{"title":"Acknowledgement","fields":[{"label":"I confirm the information provided is accurate to the best of my knowledge","field_type":"checkbox","field_key":"i_confirm_the_information_provided_is_accurate_t_6_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand that treatment outcomes vary and cannot be guaranteed","field_type":"checkbox","field_key":"i_understand_that_treatment_outcomes_vary_and_ca_6_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I agree to follow the aftercare instructions provided","field_type":"checkbox","field_key":"i_agree_to_follow_the_aftercare_instructions_pro_6_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null}]},{"key":"laser_consultation","name":"Laser Consultation","template_type":"consultation","description":"A laser-focused consultation with skin assessment, Fitzpatrick result, treatment safety and preparation questions.","sections":[{"title":"Client Details","fields":[{"label":"Full name","field_type":"short_text","field_key":"full_name_1_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Date of birth","field_type":"date","field_key":"date_of_birth_1_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Email address","field_type":"short_text","field_key":"email_address_1_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Contact number","field_type":"short_text","field_key":"contact_number_1_4","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null},{"title":"Treatment Information","fields":[{"label":"Treatment area","field_type":"short_text","field_key":"treatment_area_2_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Treatment goal","field_type":"long_text","field_key":"treatment_goal_2_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Previous treatment attempted","field_type":"yes_no","field_key":"previous_treatment_attempted_2_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Previous treatment details","field_type":"long_text","field_key":"previous_treatment_details_2_4","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Fitzpatrick Skin Assessment","fields":[{"label":"Fitzpatrick skin type","field_type":"dropdown","options":["I","II","III","IV","V","VI"],"field_key":"fitzpatrick_skin_type_3_1","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"Fitzpatrick score","field_type":"number","field_key":"fitzpatrick_score_3_2","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Medical & Treatment Safety","fields":[{"label":"Current medication or therapy","field_type":"long_text","field_key":"current_medication_or_therapy_4_1","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Currently pregnant or breastfeeding","field_type":"yes_no","field_key":"currently_pregnant_or_breastfeeding_4_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Recent sun exposure or tanning in the treatment area","field_type":"yes_no","field_key":"recent_sun_exposure_or_tanning_in_the_treatment__4_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Skin unusually sensitive to sunlight or UV","field_type":"yes_no","field_key":"skin_unusually_sensitive_to_sunlight_or_uv_4_4","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Moles or suspicious lesions in treatment area","field_type":"yes_no","field_key":"moles_or_suspicious_lesions_in_treatment_area_4_5","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Active infection in treatment area","field_type":"yes_no","field_key":"active_infection_in_treatment_area_4_6","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"History of poor wound healing or abnormal scarring","field_type":"yes_no","field_key":"history_of_poor_wound_healing_or_abnormal_scarri_4_7","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null},{"title":"Consent & Acknowledgement","fields":[{"label":"I consent to my personal and health information being used to assess treatment suitability","field_type":"checkbox","field_key":"i_consent_to_my_personal_and_health_information__5_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand a patch test may be required before treatment","field_type":"checkbox","field_key":"i_understand_a_patch_test_may_be_required_before_5_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand there are treatment risks and results vary","field_type":"checkbox","field_key":"i_understand_there_are_treatment_risks_and_resul_5_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I agree to follow the aftercare guidance provided","field_type":"checkbox","field_key":"i_agree_to_follow_the_aftercare_guidance_provide_5_4","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null}]},{"key":"patch_test","name":"Patch Test","template_type":"patch_test","description":"A practical patch-test record covering treatment area, device settings, reaction, eye protection and practitioner notes.","sections":[{"title":"Patch Test Details","fields":[{"label":"Practitioner","field_type":"short_text","field_key":"practitioner_1_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Test date","field_type":"date","field_key":"test_date_1_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Treatment area","field_type":"short_text","field_key":"treatment_area_1_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Skin type","field_type":"short_text","field_key":"skin_type_1_4","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Device & Settings","fields":[{"label":"Device serial number","field_type":"short_text","field_key":"device_serial_number_2_1","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Wavelength","field_type":"short_text","field_key":"wavelength_2_2","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Energy / fluence / joules","field_type":"short_text","field_key":"energy_fluence_joules_2_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Number of test shots","field_type":"number","field_key":"number_of_test_shots_2_4","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Response & Safety","fields":[{"label":"Immediate reaction","field_type":"long_text","field_key":"immediate_reaction_3_1","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Eye protection used","field_type":"yes_no","field_key":"eye_protection_used_3_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Earliest treatment date","field_type":"date","field_key":"earliest_treatment_date_3_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Practitioner notes","field_type":"long_text","field_key":"practitioner_notes_3_4","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Sign-off","fields":[{"label":"Patch test outcome","field_type":"dropdown","options":["Suitable to proceed","Review required","Not suitable"],"field_key":"patch_test_outcome_4_1","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"Practitioner sign-off confirmed","field_type":"checkbox","field_key":"practitioner_sign_off_confirmed_4_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null}]},{"key":"fitzpatrick_assessment","name":"Fitzpatrick Skin Assessment","template_type":"custom","description":"A configurable skin-type assessment based on the Fitzpatrick questionnaire structure. Scoring automation will be connected when forms are rendered.","sections":[{"title":"Skin Type Questionnaire","fields":[{"label":"Natural hair colour","field_type":"dropdown","options":["Red or strawberry blonde","Blonde","Dark blonde or light brown","Dark brown to black","Black"],"field_key":"natural_hair_colour_1_1","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"Natural eye colour","field_type":"dropdown","options":["Very light blue / grey / green","Blue / grey / green","Hazel or light brown","Dark brown","Very dark brown or black"],"field_key":"natural_eye_colour_1_2","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"Natural skin colour on an area not usually exposed to sun","field_type":"short_text","field_key":"natural_skin_colour_on_an_area_not_usually_expos_1_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"How does your skin usually respond to sun exposure?","field_type":"dropdown","options":["Always burns","Usually burns","Sometimes burns","Rarely burns","Never burns"],"field_key":"how_does_your_skin_usually_respond_to_sun_exposu_1_4","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"How easily does your skin tan?","field_type":"dropdown","options":["Never","Slightly","Gradually","Easily","Very easily"],"field_key":"how_easily_does_your_skin_tan_1_5","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"How recently has the treatment area been exposed to sun or tanning?","field_type":"short_text","field_key":"how_recently_has_the_treatment_area_been_exposed_1_6","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"How often is the treatment area exposed to sunlight?","field_type":"dropdown","options":["Never","Rarely","Sometimes","Often","Almost every day"],"field_key":"how_often_is_the_treatment_area_exposed_to_sunli_1_7","help_text":"","placeholder":"","is_required":1,"condition":null}],"description":"","condition":null},{"title":"Assessment Result","fields":[{"label":"Calculated Fitzpatrick type","field_type":"dropdown","options":["I","II","III","IV","V","VI"],"field_key":"calculated_fitzpatrick_type_2_1","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"Assessment score","field_type":"number","field_key":"assessment_score_2_2","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Practitioner comments","field_type":"long_text","field_key":"practitioner_comments_2_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null}]},{"key":"treatment_aftercare","name":"Treatment Aftercare","template_type":"custom","description":"A reusable aftercare template that businesses can adapt for any treatment or service.","sections":[{"title":"Aftercare Instructions","fields":[{"label":"Immediate aftercare instructions","field_type":"long_text","field_key":"immediate_aftercare_instructions_1_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Products or activities to avoid","field_type":"long_text","field_key":"products_or_activities_to_avoid_1_2","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Recommended products or care","field_type":"long_text","field_key":"recommended_products_or_care_1_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Expected temporary reactions","field_type":"long_text","field_key":"expected_temporary_reactions_1_4","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"When the client should contact the clinic","field_type":"long_text","field_key":"when_the_client_should_contact_the_clinic_1_5","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Client Acknowledgement","fields":[{"label":"I have received and understood the aftercare instructions","field_type":"checkbox","field_key":"i_have_received_and_understood_the_aftercare_ins_2_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand when to contact the clinic if I have concerns","field_type":"checkbox","field_key":"i_understand_when_to_contact_the_clinic_if_i_hav_2_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null}]},{"key":"incident_accident_log","name":"Incident / Accident Log","template_type":"custom","description":"A generic incident, accident, near-miss and adverse-event record with follow-up and sign-off.","sections":[{"title":"Incident Details","fields":[{"label":"Date and time of incident","field_type":"short_text","field_key":"date_and_time_of_incident_1_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Location","field_type":"short_text","field_key":"location_1_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Person or people involved","field_type":"long_text","field_key":"person_or_people_involved_1_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Type of event","field_type":"dropdown","options":["Accident","Incident","Near miss","Adverse reaction","Equipment event","Other"],"field_key":"type_of_event_1_4","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"What happened?","field_type":"long_text","field_key":"what_happened_1_5","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null},{"title":"Immediate Action","fields":[{"label":"Immediate action taken","field_type":"long_text","field_key":"immediate_action_taken_2_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"First aid required","field_type":"yes_no","field_key":"first_aid_required_2_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Equipment isolated or removed from use","field_type":"yes_no","field_key":"equipment_isolated_or_removed_from_use_2_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"External notification required","field_type":"yes_no","field_key":"external_notification_required_2_4","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Post-Incident Review","fields":[{"label":"Root cause / contributing factors","field_type":"long_text","field_key":"root_cause_contributing_factors_3_1","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Corrective action implemented","field_type":"long_text","field_key":"corrective_action_implemented_3_2","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Documents or procedures updated","field_type":"long_text","field_key":"documents_or_procedures_updated_3_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Further follow-up required","field_type":"yes_no","field_key":"further_follow_up_required_3_4","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Sign-off","fields":[{"label":"Recorded by","field_type":"short_text","field_key":"recorded_by_4_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Date signed","field_type":"date","field_key":"date_signed_4_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Record reviewed","field_type":"checkbox","field_key":"record_reviewed_4_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null}]}];

const allowedTemplateTypes = [
  "consultation",
  "patch_test",
  "treatment_record",
  "custom"
];

const allowedFieldTypes = [
  "short_text",
  "long_text",
  "yes_no",
  "checkbox",
  "dropdown",
  "date",
  "number"
];

async function getUserContext(request, env) {
  const token = readSessionToken(request);

  if (!token) return null;

  const tokenHash = await hashSessionToken(token);

  return await env.DB
    .prepare(`
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
    `)
    .bind(tokenHash)
    .first();
}

function unauthorized() {
  return Response.json(
    { ok: false, error: "Authentication required." },
    { status: 401 }
  );
}

function badRequest(message) {
  return Response.json(
    { ok: false, error: message },
    { status: 400 }
  );
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserContext(request, env);

    if (!user) return unauthorized();

    const templateRows = await env.DB
      .prepare(`
        SELECT
          id,
          name,
          template_type,
          description,
          is_active,
          is_default,
          created_at,
          updated_at
        FROM clinical_templates
        WHERE business_id = ?
        ORDER BY is_active DESC, name COLLATE NOCASE
      `)
      .bind(user.business_id)
      .all();

    const sectionRows = await env.DB
      .prepare(`
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
      `)
      .bind(user.business_id)
      .all();

    const fieldRows = await env.DB
      .prepare(`
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
      `)
      .bind(user.business_id)
      .all();

    const sectionsByTemplate = new Map();

    for (const row of sectionRows.results || []) {
      const section = {
        ...row,
        condition: parseJson(row.condition_json, null),
        fields: []
      };

      sectionsByTemplate.set(
        row.template_id,
        [
          ...(sectionsByTemplate.get(row.template_id) || []),
          section
        ]
      );
    }

    const sectionLookup = new Map();

    for (const sections of sectionsByTemplate.values()) {
      for (const section of sections) {
        sectionLookup.set(section.id, section);
      }
    }

    for (const row of fieldRows.results || []) {
      const section = sectionLookup.get(row.section_id);

      if (!section) continue;

      section.fields.push({
        ...row,
        options: parseJson(row.options_json, []),
        condition: parseJson(row.condition_json, null)
      });
    }

    const templates = (templateRows.results || []).map(template => ({
      ...template,
      sections: sectionsByTemplate.get(template.id) || []
    }));

    const starters = STARTERS.map(starter => ({
      key: starter.key,
      name: starter.name,
      template_type: starter.template_type,
      description: starter.description,
      section_count: starter.sections.length,
      field_count: starter.sections.reduce(
        (total, section) => total + section.fields.length,
        0
      )
    }));

    return Response.json({
      ok: true,
      templates,
      starters
    });
  } catch (error) {
    console.error("Clinical templates GET failed:", error);

    return Response.json(
      { ok: false, error: "Unable to load clinical templates." },
      { status: 500 }
    );
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserContext(request, env);

    if (!user) return unauthorized();

    const body = await request.json();

    if (body.action === "clone_starter") {
      const starter = STARTERS.find(item => item.key === body.starter_key);

      if (!starter) {
        return badRequest("Starter template not found.");
      }

      const templateId = `ct_${crypto.randomUUID()}`;

      const payload = {
        name: starter.name,
        template_type: starter.template_type,
        description: starter.description,
        is_active: 1,
        is_default: 0,
        sections: structuredClone(starter.sections)
      };

      await saveTemplateStructure({
        env,
        businessId: user.business_id,
        templateId,
        payload,
        isUpdate: false
      });

      return Response.json({
        ok: true,
        template: { id: templateId }
      });
    }

    const validation = validateTemplate(body);

    if (!validation.ok) {
      return badRequest(validation.error);
    }

    const templateId = `ct_${crypto.randomUUID()}`;

    await saveTemplateStructure({
      env,
      businessId: user.business_id,
      templateId,
      payload: validation.payload,
      isUpdate: false
    });

    return Response.json({
      ok: true,
      template: { id: templateId }
    });
  } catch (error) {
    console.error("Clinical template creation failed:", error);

    return Response.json(
      { ok: false, error: "Unable to create clinical template." },
      { status: 500 }
    );
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const user = await getUserContext(request, env);

    if (!user) return unauthorized();

    const body = await request.json();
    const templateId = String(body.id || "").trim();

    if (!templateId) {
      return badRequest("Template id is required.");
    }

    const existing = await env.DB
      .prepare(`
        SELECT id
        FROM clinical_templates
        WHERE id = ?
          AND business_id = ?
        LIMIT 1
      `)
      .bind(templateId, user.business_id)
      .first();

    if (!existing) {
      return Response.json(
        { ok: false, error: "Clinical template not found." },
        { status: 404 }
      );
    }

    const validation = validateTemplate(body);

    if (!validation.ok) {
      return badRequest(validation.error);
    }

    await saveTemplateStructure({
      env,
      businessId: user.business_id,
      templateId,
      payload: validation.payload,
      isUpdate: true
    });

    return Response.json({
      ok: true,
      template: { id: templateId }
    });
  } catch (error) {
    console.error("Clinical template update failed:", error);

    return Response.json(
      { ok: false, error: "Unable to update clinical template." },
      { status: 500 }
    );
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const user = await getUserContext(request, env);

    if (!user) return unauthorized();

    const id = String(
      new URL(request.url).searchParams.get("id") || ""
    ).trim();

    if (!id) {
      return badRequest("Template id is required.");
    }

    await env.DB
      .prepare(`
        DELETE FROM clinical_templates
        WHERE id = ?
          AND business_id = ?
      `)
      .bind(id, user.business_id)
      .run();

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Clinical template deletion failed:", error);

    return Response.json(
      { ok: false, error: "Unable to delete clinical template." },
      { status: 500 }
    );
  }
}

async function saveTemplateStructure({
  env,
  businessId,
  templateId,
  payload,
  isUpdate
}) {
  const statements = [];

  if (payload.is_default === 1) {
    statements.push(
      env.DB
        .prepare(`
          UPDATE clinical_templates
          SET
            is_default = 0,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            business_id = ?
            AND template_type = ?
            AND id != ?
        `)
        .bind(
          businessId,
          payload.template_type,
          templateId
        )
    );
  }

  if (isUpdate) {
    statements.push(
      env.DB
        .prepare(`
          UPDATE clinical_templates
          SET
            name = ?,
            template_type = ?,
            description = ?,
            is_active = ?,
            is_default = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(
          payload.name,
          payload.template_type,
          payload.description || null,
          payload.is_active,
          payload.is_default,
          templateId,
          businessId
        )
    );

    statements.push(
      env.DB
        .prepare(`
          DELETE FROM clinical_template_fields
          WHERE template_id = ?
            AND business_id = ?
        `)
        .bind(templateId, businessId)
    );

    statements.push(
      env.DB
        .prepare(`
          DELETE FROM clinical_template_sections
          WHERE template_id = ?
            AND business_id = ?
        `)
        .bind(templateId, businessId)
    );
  } else {
    statements.push(
      env.DB
        .prepare(`
          INSERT INTO clinical_templates (
            id,
            business_id,
            name,
            template_type,
            description,
            is_active,
            is_default
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          templateId,
          businessId,
          payload.name,
          payload.template_type,
          payload.description || null,
          payload.is_active,
          payload.is_default
        )
    );
  }

  for (
    let sectionIndex = 0;
    sectionIndex < payload.sections.length;
    sectionIndex += 1
  ) {
    const section = payload.sections[sectionIndex];
    const sectionId = `cts_${crypto.randomUUID()}`;

    statements.push(
      env.DB
        .prepare(`
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
        `)
        .bind(
          sectionId,
          businessId,
          templateId,
          section.title,
          section.description || null,
          sectionIndex,
          section.condition ? JSON.stringify(section.condition) : null
        )
    );

    for (
      let fieldIndex = 0;
      fieldIndex < section.fields.length;
      fieldIndex += 1
    ) {
      const field = section.fields[fieldIndex];
      const fieldId = `ctf_${crypto.randomUUID()}`;
      const fieldKey =
        String(field.field_key || "").trim() ||
        makeFieldKey(field.label, sectionIndex, fieldIndex);

      statements.push(
        env.DB
          .prepare(`
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
          `)
          .bind(
            fieldId,
            businessId,
            templateId,
            sectionId,
            field.label,
            fieldKey,
            field.field_type,
            field.help_text || null,
            field.placeholder || null,
            field.field_type === "dropdown"
              ? JSON.stringify(field.options || [])
              : null,
            field.is_required,
            fieldIndex,
            field.condition ? JSON.stringify(field.condition) : null
          )
      );
    }
  }

  await env.DB.batch(statements);
}

function validateTemplate(body) {
  const name = String(body.name || "").trim();
  const templateType = String(body.template_type || "").trim();
  const description = String(body.description || "").trim();

  const isActive = body.is_active === 0 ? 0 : 1;
  const isDefault = body.is_default === 1 ? 1 : 0;

  const sections = Array.isArray(body.sections) ? body.sections : [];

  if (!name) {
    return { ok: false, error: "Template name is required." };
  }

  if (!allowedTemplateTypes.includes(templateType)) {
    return { ok: false, error: "Invalid template type." };
  }

  if (!sections.length) {
    return { ok: false, error: "Add at least one section." };
  }

  const cleanSections = [];
  const knownFieldKeys = new Set();

  for (const section of sections) {
    const title = String(section.title || "").trim();

    if (!title) {
      return { ok: false, error: "Every section needs a title." };
    }

    const cleanFields = [];

    for (const field of Array.isArray(section.fields) ? section.fields : []) {
      const label = String(field.label || "").trim();
      const fieldType = String(field.field_type || "").trim();

      if (!label) {
        return { ok: false, error: "Every field needs a label." };
      }

      if (!allowedFieldTypes.includes(fieldType)) {
        return { ok: false, error: "Invalid field type." };
      }

      let fieldKey = String(field.field_key || "").trim();

      if (!fieldKey || knownFieldKeys.has(fieldKey)) {
        fieldKey = `field_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
      }

      knownFieldKeys.add(fieldKey);

      cleanFields.push({
        label,
        field_key: fieldKey,
        field_type: fieldType,
        help_text: String(field.help_text || "").trim(),
        placeholder: String(field.placeholder || "").trim(),
        options:
          fieldType === "dropdown" && Array.isArray(field.options)
            ? field.options.map(value => String(value).trim()).filter(Boolean)
            : [],
        is_required: field.is_required === 1 ? 1 : 0,
        condition: cleanCondition(field.condition)
      });
    }

    cleanSections.push({
      title,
      description: String(section.description || "").trim(),
      condition: cleanCondition(section.condition),
      fields: cleanFields
    });
  }

  return {
    ok: true,
    payload: {
      name,
      template_type: templateType,
      description,
      is_active: isActive,
      is_default: isDefault,
      sections: cleanSections
    }
  };
}

function cleanCondition(condition) {
  if (!condition || typeof condition !== "object") {
    return null;
  }

  const fieldKey = String(condition.field_key || "").trim();
  const operator = String(condition.operator || "equals").trim();
  const value = String(condition.value || "").trim();

  if (!fieldKey) {
    return null;
  }

  if (!["equals", "not_equals"].includes(operator)) {
    return null;
  }

  return {
    field_key: fieldKey,
    operator,
    value
  };
}

function makeFieldKey(label, sectionIndex, fieldIndex) {
  const base =
    String(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 42) ||
    "field";

  return `${base}_${sectionIndex + 1}_${fieldIndex + 1}`;
}

function parseJson(value, fallback) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

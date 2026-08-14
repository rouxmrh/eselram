import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

const STARTERS = [{"key":"general_consultation","name":"General Consultation","template_type":"consultation","description":"A comprehensive consultation and treatment-suitability form covering client details, treatment-specific screening, medical history, safety, medications, photos, consent, aftercare acknowledgement and signature.","sections":[{"title":"Choose Your Treatment","fields":[{"label":"Treatment type","field_type":"dropdown","field_key":"treatment_type","help_text":"","placeholder":"","options":["Tattoo Removal","Carbon Facial","Fungal Nail Treatment"],"is_required":1,"condition":null}],"description":"Select the treatment this consultation relates to.","condition":null},{"title":"Client Details","fields":[{"label":"Full name","field_type":"short_text","field_key":"full_name","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Email address","field_type":"short_text","field_key":"email_address","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Date of birth","field_type":"date","field_key":"date_of_birth","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Contact number","field_type":"short_text","field_key":"contact_number","help_text":"","placeholder":"e.g. 07...","options":[],"is_required":1,"condition":null}],"description":"","condition":null},{"title":"Tattoo Information","fields":[{"label":"Approximate age of the tattoo (years)","field_type":"number","field_key":"tattoo_age","help_text":"","placeholder":"e.g. 5","options":[],"is_required":1,"condition":null},{"label":"Location on body","field_type":"short_text","field_key":"tattoo_location","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Have you attempted removal before? (Laser, saline, excision or other)","field_type":"yes_no","field_key":"previous_removal","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"If yes, please describe","field_type":"long_text","field_key":"previous_removal_details","help_text":"","placeholder":"Laser, saline, excision or other","options":[],"is_required":0,"condition":{"field_key":"previous_removal","operator":"equals","value":"Yes"}}],"description":"","condition":{"field_key":"treatment_type","operator":"equals","value":"Tattoo Removal"}},{"title":"Tattoo Characteristics","fields":[{"label":"Type of tattoo","field_type":"dropdown","field_key":"tattoo_type","help_text":"","placeholder":"","options":["Professional","Amateur","Cosmetic / PMU","Not sure"],"is_required":1,"condition":null},{"label":"Black","field_type":"checkbox","field_key":"ink_black","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Blue","field_type":"checkbox","field_key":"ink_blue","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Green","field_type":"checkbox","field_key":"ink_green","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Red","field_type":"checkbox","field_key":"ink_red","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Yellow","field_type":"checkbox","field_key":"ink_yellow","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"White","field_type":"checkbox","field_key":"ink_white","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Multi-colour","field_type":"checkbox","field_key":"ink_multicolour","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Not sure of tattoo colours","field_type":"checkbox","field_key":"ink_not_sure","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Is the tattoo raised or scarred?","field_type":"yes_no","field_key":"tattoo_raised_scarred","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Have you ever had a reaction to your tattoo ink?","field_type":"yes_no","field_key":"tattoo_ink_reaction","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"If yes, please describe the reaction","field_type":"long_text","field_key":"tattoo_ink_reaction_details","help_text":"","placeholder":"e.g. swelling, itching, rash, raised areas","options":[],"is_required":0,"condition":{"field_key":"tattoo_ink_reaction","operator":"equals","value":"Yes"}},{"label":"Is this tattoo a cover-up of another tattoo?","field_type":"dropdown","field_key":"tattoo_coverup","help_text":"","placeholder":"","options":["No","Yes","Not sure"],"is_required":1,"condition":null}],"description":"Select all tattoo colours that apply.","condition":{"field_key":"treatment_type","operator":"equals","value":"Tattoo Removal"}},{"title":"Consent & Privacy","fields":[{"label":"I consent to the business storing and processing my personal and health-related information to assess treatment suitability and respond to my enquiry.","field_type":"checkbox","field_key":"gdpr_consent","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I confirm that I am over 18 years of age.","field_type":"checkbox","field_key":"age_confirm","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I give informed consent to undergo the selected treatment, understanding the risks, healing process, and that results vary.","field_type":"checkbox","field_key":"explicit_consent","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"Please do not submit urgent medical information here. This form is for consultation screening only.","condition":null},{"title":"Medical History","fields":[{"label":"Lupus","field_type":"checkbox","field_key":"lupus","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Psoriasis","field_type":"checkbox","field_key":"psoriasis","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Vitiligo","field_type":"checkbox","field_key":"vitiligo_condition","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Eczema / dermatitis","field_type":"checkbox","field_key":"eczema_dermatitis","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Keloid scarring","field_type":"checkbox","field_key":"keloid_scarring","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Autoimmune disorder","field_type":"checkbox","field_key":"autoimmune_disorder","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Immunosuppressive medication or therapy (e.g. biologics, chemotherapy, steroid therapy)","field_type":"checkbox","field_key":"immunosuppressive_therapy","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"None of the above","field_type":"checkbox","field_key":"medical_history_none","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Other (please specify)","field_type":"short_text","field_key":"autoimmune_other","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"Do you have or have you ever been diagnosed with any of the following conditions? Medical screening helps ensure treatment is safe and appropriate for your skin and medical history.","condition":null},{"title":"Treatment Safety","fields":[{"label":"Currently pregnant or breastfeeding","field_type":"checkbox","field_key":"pregnant_nursing","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Recent sun exposure or tanning beds in the last 4 weeks","field_type":"checkbox","field_key":"sun_exposure","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Skin becomes unusually sensitive to sunlight or UV light","field_type":"checkbox","field_key":"photosensitising_meds","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Moles or suspicious lesions in treatment area","field_type":"checkbox","field_key":"moles_lesions_area","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Active infection in treatment area","field_type":"checkbox","field_key":"active_infection_area","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Tattoo done within the last 6–8 weeks","field_type":"checkbox","field_key":"recent_tattoo_6weeks","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"History of poor wound healing or abnormal scarring","field_type":"checkbox","field_key":"poor_wound_healing","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"None of the above","field_type":"checkbox","field_key":"treatment_safety_none","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"Select every statement that applies.","condition":null},{"title":"Recent Skin Preparation","fields":[{"label":"Have you used fake tan on the treatment area within the last 2 weeks?","field_type":"yes_no","field_key":"fake_tan_last_2_weeks","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":{"field_key":"treatment_type","operator":"not_equals","value":"Fungal Nail Treatment"}},{"title":"Carbon Facial Screening","fields":[{"label":"Have you had Botox or dermal filler in the treatment area within the last 2 weeks?","field_type":"yes_no","field_key":"recent_botox_filler","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Are you currently using exfoliating acids, benzoyl peroxide or prescription acne medication on your face?","field_type":"yes_no","field_key":"active_skincare_products","help_text":"Examples include AHA/BHA acids, benzoyl peroxide, retinoids or prescription acne products.","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Have you had microneedling, laser treatment, a chemical peel or dermabrasion on your face within the last 4 weeks?","field_type":"yes_no","field_key":"recent_cosmetic_procedure","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":{"field_key":"treatment_type","operator":"equals","value":"Carbon Facial"}},{"title":"Fungal Nail Screening","fields":[{"label":"Has the nail condition been diagnosed as a fungal infection by a GP, podiatrist or other qualified healthcare professional?","field_type":"dropdown","field_key":"fungal_diagnosis","help_text":"","placeholder":"","options":["Yes","No","Unsure"],"is_required":1,"condition":null},{"label":"Are you currently using or taking antifungal medication?","field_type":"yes_no","field_key":"current_antifungal_medication","help_text":"Examples include Terbinafine, Amorolfine/Loceryl or Canesten.","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"If yes, please list the antifungal medication","field_type":"short_text","field_key":"antifungal_medication_details","help_text":"","placeholder":"Medication name and how long you have used it","options":[],"is_required":0,"condition":{"field_key":"current_antifungal_medication","operator":"equals","value":"Yes"}}],"description":"","condition":{"field_key":"treatment_type","operator":"equals","value":"Fungal Nail Treatment"}},{"title":"Viral & Blood-Borne Conditions","fields":[{"label":"History of cold sores (Herpes Simplex Virus)","field_type":"checkbox","field_key":"cold_sores_hsv","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Hepatitis B","field_type":"checkbox","field_key":"hepatitis_b","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Hepatitis C","field_type":"checkbox","field_key":"hepatitis_c","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"HIV","field_type":"checkbox","field_key":"hiv","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"None of the above","field_type":"checkbox","field_key":"viral_conditions_none","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Other blood-borne condition (please specify)","field_type":"short_text","field_key":"other_blood_borne","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"Select every statement that applies.","condition":null},{"title":"Chronic Health Conditions","fields":[{"label":"Diabetes (Type I or II)","field_type":"checkbox","field_key":"diabetes","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Epilepsy or history of seizures","field_type":"checkbox","field_key":"epilepsy_seizures","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Heart condition or pacemaker","field_type":"checkbox","field_key":"heart_condition_pacemaker","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Bleeding disorder (e.g. haemophilia)","field_type":"checkbox","field_key":"bleeding_disorder","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"History of skin cancer","field_type":"checkbox","field_key":"skin_cancer_history","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"None of the above","field_type":"checkbox","field_key":"chronic_conditions_none","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Other chronic health conditions (please specify)","field_type":"short_text","field_key":"other_chronic_health_conditions","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"Select every statement that applies.","condition":null},{"title":"Allergies","fields":[{"label":"Tattoo ink allergy","field_type":"checkbox","field_key":"tattoo_ink_allergy","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Lidocaine / numbing cream allergy","field_type":"checkbox","field_key":"lidocaine_numbing_allergy","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Latex allergy","field_type":"checkbox","field_key":"latex_allergy","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"No known allergies","field_type":"checkbox","field_key":"allergies_none","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Other allergies (please specify)","field_type":"short_text","field_key":"other_allergies","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"Select every statement that applies.","condition":null},{"title":"Medications & Supplements","fields":[{"label":"Have you taken Accutane (Isotretinoin) in the last 6 months?","field_type":"yes_no","field_key":"accutane","help_text":"If yes, treatment may need to be postponed until your practitioner has confirmed it is safe to proceed.","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Blood thinners (e.g. Warfarin, Apixaban, Rivaroxaban)","field_type":"checkbox","field_key":"blood_thinners","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Gold therapy (for rheumatoid arthritis)","field_type":"checkbox","field_key":"gold_therapy","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Antibiotics in the last 2 weeks (e.g. Doxycycline, Lymecycline, Minocycline)","field_type":"checkbox","field_key":"antibiotics_last_2_weeks","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Steroid medication (e.g. Prednisolone)","field_type":"checkbox","field_key":"steroid_medication","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Prescription skin creams used on the treatment area (e.g. Retin-A, Tretinoin, Adapalene, Hydroquinone)","field_type":"checkbox","field_key":"retinol_retina_area","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Supplements that may increase bleeding (e.g. Fish Oil/Omega-3, Vitamin E, Ginkgo Biloba)","field_type":"checkbox","field_key":"bleeding_supplements","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"None of the above","field_type":"checkbox","field_key":"medications_none","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"List all current prescription medications, over-the-counter medicines, herbs, vitamins and supplements","field_type":"long_text","field_key":"current_medications","help_text":"","placeholder":"e.g. Aspirin, Metformin, Doxycycline, Prednisolone, Fish Oil, Vitamin D, St John's Wort","options":[],"is_required":0,"condition":null}],"description":"Select every medication or supplement category that applies.","condition":null},{"title":"Lifestyle Factors","fields":[{"label":"Do you currently smoke or vape?","field_type":"dropdown","field_key":"smoke_vape","help_text":"","placeholder":"","options":["No","Yes - cigarettes","Yes - vape","Yes - both"],"is_required":1,"condition":null},{"label":"If yes: approximate daily use","field_type":"short_text","field_key":"smoke_vape_frequency","help_text":"","placeholder":"e.g. 5 cigarettes per day or vape daily","options":[],"is_required":0,"condition":null}],"description":"Smoking and vaping can affect healing and treatment outcomes. For tattoo removal, it may also slow the body’s ability to clear tattoo pigment.","condition":null},{"title":"Additional Information","fields":[{"label":"Is there anything else I should know?","field_type":"long_text","field_key":"additional_info","help_text":"","placeholder":"Optional","options":[],"is_required":0,"condition":null},{"label":"What outcome are you hoping for?","field_type":"long_text","field_key":"treatment_goal","help_text":"","placeholder":"Full removal, fading for cover-up, lightening, clearer skin, improved nail appearance, etc.","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Photos","fields":[{"label":"Upload treatment photos (optional)","field_type":"file_upload","field_key":"treatment_photos","help_text":"Please upload clear, unedited photos taken in good lighting. Avoid filters or beauty enhancements. Include a close-up and an image showing the surrounding area where possible.","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"I consent to clinical photos being taken for treatment monitoring","field_type":"yes_no","field_key":"photo_consent","help_text":"Clinical photos are used for treatment documentation and monitoring unless separate written consent is provided for marketing or educational purposes.","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"Photos can help the practitioner assess treatment suitability before consultation.","condition":null},{"title":"Treatment & Aftercare Acknowledgement","fields":[{"label":"I understand that I must follow the aftercare instructions provided for my selected treatment.","field_type":"checkbox","field_key":"aftercare_understood","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand that a patch test is required before treatment. Treatment can only proceed after my consultation and patch test have been completed and approved.","field_type":"checkbox","field_key":"patch_test_acknowledgement","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand that treatments carry potential risks and that these will be explained for my selected treatment.","field_type":"checkbox","field_key":"risk_acknowledgement","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand that no guarantee has been made regarding the outcome of treatment and that results vary between individuals.","field_type":"checkbox","field_key":"no_guarantee_results","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I accept responsibility for following all aftercare guidance provided for my selected treatment.","field_type":"checkbox","field_key":"client_responsibility","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I confirm that all information provided is accurate and complete to the best of my knowledge. I understand that withholding or providing incorrect information may increase the risk of complications and may invalidate my treatment.","field_type":"checkbox","field_key":"medical_accuracy","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Client signature","field_type":"signature","field_key":"client_signature","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"Treatment will only proceed once suitability has been confirmed by the practitioner during consultation.","condition":null}]},{"key":"patch_test","name":"Patch Test","template_type":"patch_test","description":"A comprehensive patch-test record based on the BARE clinical form, including client details, device settings, immediate response, safety compliance, treatment-specific declarations and client signature.","sections":[{"title":"Patch Test Details","fields":[{"label":"Practitioner name","field_type":"short_text","field_key":"patch_practitioner","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Date of test","field_type":"date","field_key":"patch_test_date","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Client name","field_type":"short_text","field_key":"patch_client_name","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Date of birth","field_type":"date","field_key":"patch_date_of_birth","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Treatment type","field_type":"dropdown","field_key":"patch_treatment_type","help_text":"","placeholder":"","options":["Tattoo Removal","Carbon Facial","Fungal Toenail Treatment"],"is_required":1,"condition":null},{"label":"Test area","field_type":"short_text","field_key":"patch_test_area","help_text":"","placeholder":"e.g. left forearm tattoo, full face, right big toenail","options":[],"is_required":1,"condition":null},{"label":"Fitzpatrick type","field_type":"dropdown","field_key":"patch_fitzpatrick_type","help_text":"","placeholder":"","options":["Type I","Type II","Type III","Type IV","Type V","Type VI"],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Device & Settings","fields":[{"label":"Machine serial no.","field_type":"short_text","field_key":"patch_machine_serial","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Wavelength","field_type":"dropdown","field_key":"patch_wavelength","help_text":"","placeholder":"","options":["1064nm","532nm"],"is_required":0,"condition":null},{"label":"Joules (J/cm²)","field_type":"short_text","field_key":"patch_joules","help_text":"","placeholder":"e.g. 1.2J","options":[],"is_required":0,"condition":null},{"label":"Number of test shots","field_type":"short_text","field_key":"patch_test_shots","help_text":"","placeholder":"e.g. 3 pulses","options":[],"is_required":0,"condition":null},{"label":"Earliest safe treatment date","field_type":"date","field_key":"patch_earliest_treatment_date","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Immediate Reaction & Safety","fields":[{"label":"Normal erythema","field_type":"checkbox","field_key":"patch_reaction_normal_erythema","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Perifollicular edema","field_type":"checkbox","field_key":"patch_reaction_perifollicular_edema","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Mild swelling","field_type":"checkbox","field_key":"patch_reaction_mild_swelling","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Warmth","field_type":"checkbox","field_key":"patch_reaction_warmth","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Mild blistering","field_type":"checkbox","field_key":"patch_reaction_mild_blistering","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Frosting","field_type":"checkbox","field_key":"patch_reaction_frosting","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Pinpoint bleeding","field_type":"checkbox","field_key":"patch_reaction_pinpoint_bleeding","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"No significant reaction","field_type":"checkbox","field_key":"patch_reaction_none","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Laser eye protection worn (practitioner & client)","field_type":"checkbox","field_key":"patch_eye_protection","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Practitioner's notes","field_type":"long_text","field_key":"patch_practitioner_notes","help_text":"","placeholder":"Clinical observations, client feedback, parameter adjustments, skin response, advice given, recommendations, or any additional notes.","options":[],"is_required":0,"condition":null}],"description":"Select all immediate reactions that apply and confirm safety compliance.","condition":null},{"title":"Tattoo Removal Declaration & Consent","fields":[{"label":"I acknowledge that a patch test has been performed to test for adverse reactions or pigment changes.","field_type":"checkbox","field_key":"patch_tattoo_ack_test","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand laser tattoo removal carries risks including blistering, scarring, pigmentation changes, infection and incomplete removal, and that complete removal cannot be guaranteed.","field_type":"checkbox","field_key":"patch_tattoo_ack_risks","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I will monitor the area for 24–48 hours and report any adverse reactions before proceeding with full treatment.","field_type":"checkbox","field_key":"patch_tattoo_ack_monitor","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I consent to photographs being taken of the treated area for my clinical records and insurance purposes.","field_type":"checkbox","field_key":"patch_tattoo_ack_photos","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I confirm that I have received and understood the aftercare instructions and agree to follow them to minimise the risk of complications.","field_type":"checkbox","field_key":"patch_tattoo_ack_aftercare","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I confirm there have been no changes to my medical history, medication, or recent sun exposure since my initial consultation.","field_type":"checkbox","field_key":"patch_tattoo_ack_changes","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":{"field_key":"patch_treatment_type","operator":"equals","value":"Tattoo Removal"}},{"title":"Carbon Facial Declaration & Consent","fields":[{"label":"I acknowledge that a patch test has been performed to assess skin suitability before Carbon Facial treatment.","field_type":"checkbox","field_key":"patch_carbon_ack_test","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand Carbon Facial treatment may cause temporary redness, warmth, sensitivity, dryness, tingling or mild irritation, and that results vary and cannot be guaranteed.","field_type":"checkbox","field_key":"patch_carbon_ack_risks","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I will monitor the area for 24–48 hours and report any unexpected reaction before proceeding with full treatment.","field_type":"checkbox","field_key":"patch_carbon_ack_monitor","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I consent to photographs being taken of the treated area for my clinical records and insurance purposes.","field_type":"checkbox","field_key":"patch_carbon_ack_photos","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I confirm that I have received and understood the aftercare instructions and agree to follow them to minimise the risk of complications.","field_type":"checkbox","field_key":"patch_carbon_ack_aftercare","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I confirm there have been no changes to my medical history, medication, skincare products, active skin conditions, or recent sun exposure since my initial consultation.","field_type":"checkbox","field_key":"patch_carbon_ack_changes","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":{"field_key":"patch_treatment_type","operator":"equals","value":"Carbon Facial"}},{"title":"Fungal Toenail Declaration & Consent","fields":[{"label":"I acknowledge that a patch test has been performed to assess suitability before Fungal Toenail treatment.","field_type":"checkbox","field_key":"patch_fungal_ack_test","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand laser treatment for fungal toenails may cause temporary warmth, sensitivity, mild discomfort, redness around the nail or temporary nail changes, and that results vary and cannot be guaranteed.","field_type":"checkbox","field_key":"patch_fungal_ack_risks","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand that fungal nail improvement can take time and may require multiple sessions, good foot hygiene and ongoing aftercare.","field_type":"checkbox","field_key":"patch_fungal_ack_time","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I will monitor the treated area for 24–48 hours and report any unexpected reaction before proceeding with full treatment.","field_type":"checkbox","field_key":"patch_fungal_ack_monitor","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I consent to photographs being taken of the treated area for my clinical records and insurance purposes.","field_type":"checkbox","field_key":"patch_fungal_ack_photos","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I confirm that I have received and understood the aftercare instructions and agree to follow them to minimise the risk of complications.","field_type":"checkbox","field_key":"patch_fungal_ack_aftercare","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I confirm there have been no changes to my medical history, medication, nail condition, skin condition, or recent sun exposure since my initial consultation.","field_type":"checkbox","field_key":"patch_fungal_ack_changes","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":{"field_key":"patch_treatment_type","operator":"equals","value":"Fungal Toenail Treatment"}},{"title":"Client Signature","fields":[{"label":"Client signature","field_type":"signature","field_key":"patch_client_signature","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"Client signature confirming the patch-test record and applicable declaration.","condition":null}]},{"key":"treatment_record","name":"Treatment Record","template_type":"treatment_record","description":"A comprehensive treatment-session record based on the BARE clinical record, with appointment details, laser settings, treatment-specific observations and next-session planning.","sections":[{"title":"Client & Appointment","fields":[{"label":"Practitioner","field_type":"short_text","field_key":"treatment_practitioner","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Treatment date","field_type":"date","field_key":"treatment_date","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Client name","field_type":"short_text","field_key":"treatment_client_name","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Treatment","field_type":"dropdown","field_key":"treatment_type","help_text":"","placeholder":"","options":["Tattoo Removal","Carbon Facial","Fungal Nail Laser"],"is_required":1,"condition":null},{"label":"Treatment option","field_type":"short_text","field_key":"treatment_option","help_text":"","placeholder":"e.g. Small Tattoo · 6 Sessions","options":[],"is_required":1,"condition":null},{"label":"Session","field_type":"number","field_key":"treatment_session_number","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Treatment area","field_type":"short_text","field_key":"treatment_area","help_text":"","placeholder":"e.g. left forearm, full face, right big toenail","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Laser Settings","fields":[{"label":"Machine","field_type":"short_text","field_key":"treatment_machine","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Wavelength","field_type":"dropdown","field_key":"treatment_wavelength","help_text":"","placeholder":"","options":["1064nm","532nm","1064nm + 532nm"],"is_required":0,"condition":null},{"label":"Fluence / Energy (J/cm²)","field_type":"short_text","field_key":"treatment_fluence","help_text":"","placeholder":"e.g. 1.2","options":[],"is_required":0,"condition":null},{"label":"Air cooling","field_type":"checkbox","field_key":"treatment_cooling_air","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Ice pack","field_type":"checkbox","field_key":"treatment_cooling_ice","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"No cooling","field_type":"checkbox","field_key":"treatment_cooling_none","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"Record the device and settings used during this treatment.","condition":null},{"title":"Tattoo Removal Details","fields":[{"label":"Black ink","field_type":"checkbox","field_key":"treatment_tattoo_colour_black","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Blue ink","field_type":"checkbox","field_key":"treatment_tattoo_colour_blue","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Green ink","field_type":"checkbox","field_key":"treatment_tattoo_colour_green","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Red ink","field_type":"checkbox","field_key":"treatment_tattoo_colour_red","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Yellow ink","field_type":"checkbox","field_key":"treatment_tattoo_colour_yellow","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"White ink","field_type":"checkbox","field_key":"treatment_tattoo_colour_white","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Mixed ink colours","field_type":"checkbox","field_key":"treatment_tattoo_colour_mixed","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Frosting","field_type":"checkbox","field_key":"treatment_tattoo_response_frosting","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Mild erythema","field_type":"checkbox","field_key":"treatment_tattoo_response_erythema","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Mild oedema","field_type":"checkbox","field_key":"treatment_tattoo_response_oedema","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Pinpoint bleeding","field_type":"checkbox","field_key":"treatment_tattoo_response_pinpoint_bleeding","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Blistering","field_type":"checkbox","field_key":"treatment_tattoo_response_blistering","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"No unusual reaction","field_type":"checkbox","field_key":"treatment_tattoo_response_none","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"Select all ink colours and treatment responses that apply.","condition":{"field_key":"treatment_type","operator":"equals","value":"Tattoo Removal"}},{"title":"Carbon Facial Details","fields":[{"label":"Carbon layer","field_type":"dropdown","field_key":"treatment_carbon_layer","help_text":"","placeholder":"","options":["Thin","Medium","Heavy"],"is_required":0,"condition":null},{"label":"Mild redness","field_type":"checkbox","field_key":"treatment_carbon_response_redness","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Warmth","field_type":"checkbox","field_key":"treatment_carbon_response_warmth","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Tightening","field_type":"checkbox","field_key":"treatment_carbon_response_tightening","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Good response","field_type":"checkbox","field_key":"treatment_carbon_response_good","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Sensitive","field_type":"checkbox","field_key":"treatment_carbon_response_sensitive","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"Record the carbon layer and all skin responses that apply.","condition":{"field_key":"treatment_type","operator":"equals","value":"Carbon Facial"}},{"title":"Fungal Nail Details","fields":[{"label":"Left foot","field_type":"checkbox","field_key":"treatment_fungal_foot_left","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Right foot","field_type":"checkbox","field_key":"treatment_fungal_foot_right","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Both feet","field_type":"checkbox","field_key":"treatment_fungal_foot_both","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Big toe","field_type":"checkbox","field_key":"treatment_fungal_nail_big_toe","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"2nd toe","field_type":"checkbox","field_key":"treatment_fungal_nail_2","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"3rd toe","field_type":"checkbox","field_key":"treatment_fungal_nail_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"4th toe","field_type":"checkbox","field_key":"treatment_fungal_nail_4","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"5th toe","field_type":"checkbox","field_key":"treatment_fungal_nail_5","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Thickened","field_type":"checkbox","field_key":"treatment_fungal_appearance_thickened","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Yellow","field_type":"checkbox","field_key":"treatment_fungal_appearance_yellow","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"White","field_type":"checkbox","field_key":"treatment_fungal_appearance_white","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Brittle","field_type":"checkbox","field_key":"treatment_fungal_appearance_brittle","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Lifting","field_type":"checkbox","field_key":"treatment_fungal_appearance_lifting","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Improving","field_type":"checkbox","field_key":"treatment_fungal_appearance_improving","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"Select the affected foot/feet, nails treated and all appearance observations that apply.","condition":{"field_key":"treatment_type","operator":"equals","value":"Fungal Nail Laser"}},{"title":"Treatment Outcome","fields":[{"label":"Client tolerance","field_type":"dropdown","field_key":"treatment_client_tolerance","help_text":"","placeholder":"","options":["Excellent","Good","Fair","Poor"],"is_required":0,"condition":null},{"label":"Plan for next session","field_type":"long_text","field_key":"treatment_next_session_plan","help_text":"","placeholder":"Settings to repeat or adjust, areas to focus on and recommendations.","options":[],"is_required":0,"condition":null},{"label":"Recommended next treatment date","field_type":"date","field_key":"treatment_next_date","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Recommended interval","field_type":"dropdown","field_key":"treatment_recommended_interval","help_text":"","placeholder":"","options":["4 weeks","6 weeks","8 weeks","10 weeks","12 weeks","Other"],"is_required":0,"condition":null}],"description":"","condition":null}]},{"key":"fitzpatrick_assessment","name":"Fitzpatrick Skin Assessment","template_type":"custom","description":"A configurable skin-type assessment based on the Fitzpatrick questionnaire structure. Scoring automation will be connected when forms are rendered.","sections":[{"title":"Skin Type Questionnaire","fields":[{"label":"Natural hair colour","field_type":"dropdown","options":["Red or strawberry blonde","Blonde","Dark blonde or light brown","Dark brown to black","Black"],"field_key":"natural_hair_colour_1_1","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"Natural eye colour","field_type":"dropdown","options":["Very light blue / grey / green","Blue / grey / green","Hazel or light brown","Dark brown","Very dark brown or black"],"field_key":"natural_eye_colour_1_2","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"Natural skin colour on an area not usually exposed to sun","field_type":"short_text","field_key":"natural_skin_colour_on_an_area_not_usually_expos_1_3","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"How does your skin usually respond to sun exposure?","field_type":"dropdown","options":["Always burns","Usually burns","Sometimes burns","Rarely burns","Never burns"],"field_key":"how_does_your_skin_usually_respond_to_sun_exposu_1_4","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"How easily does your skin tan?","field_type":"dropdown","options":["Never","Slightly","Gradually","Easily","Very easily"],"field_key":"how_easily_does_your_skin_tan_1_5","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"How recently has the treatment area been exposed to sun or tanning?","field_type":"short_text","field_key":"how_recently_has_the_treatment_area_been_exposed_1_6","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"How often is the treatment area exposed to sunlight?","field_type":"dropdown","options":["Never","Rarely","Sometimes","Often","Almost every day"],"field_key":"how_often_is_the_treatment_area_exposed_to_sunli_1_7","help_text":"","placeholder":"","is_required":1,"condition":null}],"description":"","condition":null},{"title":"Assessment Result","fields":[{"label":"Calculated Fitzpatrick type","field_type":"dropdown","options":["I","II","III","IV","V","VI"],"field_key":"calculated_fitzpatrick_type_2_1","help_text":"","placeholder":"","is_required":1,"condition":null},{"label":"Assessment score","field_type":"number","field_key":"assessment_score_2_2","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Practitioner comments","field_type":"long_text","field_key":"practitioner_comments_2_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null}]},{"key":"treatment_aftercare","name":"Treatment Aftercare","template_type":"custom","description":"A reusable aftercare template that businesses can adapt for any treatment or service.","sections":[{"title":"Aftercare Instructions","fields":[{"label":"Immediate aftercare instructions","field_type":"long_text","field_key":"immediate_aftercare_instructions_1_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Products or activities to avoid","field_type":"long_text","field_key":"products_or_activities_to_avoid_1_2","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Recommended products or care","field_type":"long_text","field_key":"recommended_products_or_care_1_3","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Expected temporary reactions","field_type":"long_text","field_key":"expected_temporary_reactions_1_4","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"When the client should contact the clinic","field_type":"long_text","field_key":"when_the_client_should_contact_the_clinic_1_5","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Client Acknowledgement","fields":[{"label":"I have received and understood the aftercare instructions","field_type":"checkbox","field_key":"i_have_received_and_understood_the_aftercare_ins_2_1","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"I understand when to contact the clinic if I have concerns","field_type":"checkbox","field_key":"i_understand_when_to_contact_the_clinic_if_i_hav_2_2","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null}]},{"key":"incident_accident_log","name":"Incident / Accident Log","template_type":"custom","description":"A comprehensive incident, accident, near-miss and adverse-event record with register details, immediate action, follow-up, post-incident review and signed sign-off.","sections":[{"title":"Log Book Details","fields":[{"label":"Business name","field_type":"short_text","field_key":"incident_business_name","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Responsible person","field_type":"short_text","field_key":"incident_responsible_person","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Log start date","field_type":"date","field_key":"incident_log_start_date","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Review date","field_type":"date","field_key":"incident_review_date","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"How to Use This Log","fields":[{"label":"Log instructions / notes","field_type":"long_text","field_key":"incident_how_to_use","help_text":"Record all accidents, incidents, near misses, adverse reactions, unexpected equipment events, spills, electrical concerns, client injuries, practitioner injuries and first aid events connected with the business. Complete each entry as soon as practicable, record immediate actions taken and note whether the event requires follow-up, insurer notification, maintenance action or report under RIDDOR.","placeholder":"","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Incident / Accident Register","fields":[{"label":"Date","field_type":"date","field_key":"incident_date","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Time","field_type":"short_text","field_key":"incident_time","help_text":"","placeholder":"e.g. 14:30","options":[],"is_required":1,"condition":null},{"label":"Person(s) involved","field_type":"long_text","field_key":"incident_persons_involved","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Type of event","field_type":"dropdown","field_key":"incident_type","help_text":"","placeholder":"","options":["Accident","Incident","Near miss","Adverse reaction","Equipment issue","Spill","Electrical concern","Client injury","Practitioner injury","First aid event","Other"],"is_required":1,"condition":null},{"label":"Details / injury / damage","field_type":"long_text","field_key":"incident_details_injury_damage","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Immediate action taken","field_type":"long_text","field_key":"incident_immediate_action","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Follow-up / outcome","field_type":"long_text","field_key":"incident_follow_up_outcome","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"RIDDOR / insurer review","field_type":"dropdown","field_key":"incident_riddor_insurer_review","help_text":"","placeholder":"","options":["Yes","No","Not applicable"],"is_required":1,"condition":null}],"description":"","condition":null},{"title":"Post-Incident Review","fields":[{"label":"Root cause / contributing factors","field_type":"long_text","field_key":"incident_root_cause","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Corrective action implemented","field_type":"long_text","field_key":"incident_corrective_action","help_text":"","placeholder":"","options":[],"is_required":0,"condition":null},{"label":"Documents updated","field_type":"long_text","field_key":"incident_documents_updated","help_text":"","placeholder":"Risk assessment / COSHH / local rules / maintenance log / training records / client notes","options":[],"is_required":0,"condition":null}],"description":"","condition":null},{"title":"Sign Off","fields":[{"label":"Recorded by","field_type":"short_text","field_key":"incident_recorded_by","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Date signed","field_type":"date","field_key":"incident_date_signed","help_text":"","placeholder":"","options":[],"is_required":1,"condition":null},{"label":"Signature","field_type":"signature","field_key":"incident_signature","help_text":"Sign using a finger, mouse or stylus.","placeholder":"","options":[],"is_required":1,"condition":null}],"description":"","condition":null}]}];

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
  "number",
  "signature",
  "file_upload"
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
        is_client_sendable: starter.key === "general_consultation" ? 1 : 0,
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

    if (body.action === "archive") {
      await env.DB
        .prepare(`
          UPDATE clinical_templates
          SET
            is_active = 0,
            is_default = 0,
            is_published = 0,
            published_at = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND business_id = ?
        `)
        .bind(templateId, user.business_id)
        .run();

      return Response.json({
        ok: true,
        template: {
          id: templateId,
          is_active: 0,
          is_default: 0,
          is_published: 0
        }
      });
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
  const user = await getUserContext(request, env);

  if (!user) return unauthorized();

  return Response.json(
    {
      ok: false,
      error:
        "Clinical templates cannot be permanently deleted. Archive the template instead."
    },
    {
      status: 405
    }
  );
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
            is_client_sendable = ?,
            version = version + 1,
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
          payload.is_client_sendable,
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
            is_default,
            is_client_sendable
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          templateId,
          businessId,
          payload.name,
          payload.template_type,
          payload.description || null,
          payload.is_active,
          payload.is_default,
          payload.is_client_sendable
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
  const isClientSendable = body.is_client_sendable === 1 ? 1 : 0;

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
      is_client_sendable: isClientSendable,
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

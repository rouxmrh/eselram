CREATE TRIGGER IF NOT EXISTS prevent_delete_used_clinical_template
BEFORE DELETE ON clinical_templates
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM clinical_form_submissions
  WHERE template_id = OLD.id
)
BEGIN
  SELECT RAISE(
    ABORT,
    'Cannot delete a clinical template with historical submissions'
  );
END;

import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";


const EXPECTED_MIGRATIONS = [
  "001_initial_schema",
  "002_installer_state",
  "003_payment_providers",
  "004_authentication",
  "005_service_payments",
  "006_booking_buffers",
  "007_payment_methods",
  "008_provider_independent_payments",
  "009_treatment_records",
  "010_clinical_templates",
  "011_branding_and_template_conditions",
  "012_form_renderer_and_submissions",
  "013_expand_clinical_field_types",
  "014_clinical_submissions_viewer",
  "015_clinical_integrity_cleanup",
  "016_clinical_template_snapshots",
  "017_form_requests",
  "018_client_sendable_templates",
  "019_consultation_email_delivery",
  "020_independent_integrations",
  "021_customer_communications",
  "022_customer_self_service",
  "023_service_form_rules",
  "024_customer_photos",
  "025_packages_courses",
  "026_package_sales",
  "027_automated_communications",
  "028_consultation_package_booking",
  "029_consultation_credit",
  "030_clinic_balance_payment",
  "031_treatment_aftercare_communications",
  "032_service_public_booking_modes",
  "033_service_consultation_pathways",
  "034_package_variants",
  "035_package_payment_rules"
];


async function getUserContext(
  request,
  env
) {

  const token =
    readSessionToken(request);


  if (!token) {
    return null;
  }


  const tokenHash =
    await hashSessionToken(
      token
    );


  return await env.DB
    .prepare(`
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
    `)
    .bind(
      tokenHash
    )
    .first();
}


function unauthorized() {

  return Response.json(
    {
      ok: false,
      error:
        "Authentication required."
    },
    {
      status: 401
    }
  );
}


function item({
  key,
  label,
  complete,
  status,
  detail,
  href = null,
  required = true
}) {

  return {
    key,
    label,
    complete:
      Boolean(complete),
    status,
    detail,
    href,
    required
  };
}


export async function onRequestGet({
  request,
  env
}) {

  try {

    const user =
      await getUserContext(
        request,
        env
      );


    if (!user) {
      return unauthorized();
    }


    const businessId =
      user.business_id;


    const [
      business,
      branding,
      hours,
      services,
      emailIntegration,
      paymentSummary,
      templateSummary,
      fileUploadSummary,
      ownerSummary,
      migrations,
      installerState
    ] =
      await Promise.all([

        env.DB
          .prepare(`
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
          `)
          .bind(
            businessId
          )
          .first(),


        env.DB
          .prepare(`
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
          `)
          .bind(
            businessId
          )
          .first(),


        env.DB
          .prepare(`
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
          `)
          .bind(
            businessId
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS active_count

            FROM services

            WHERE
              business_id = ?
              AND is_active = 1
          `)
          .bind(
            businessId
          )
          .first(),


        env.DB
          .prepare(`
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
          `)
          .bind(
            businessId
          )
          .first(),


        env.DB
          .prepare(`
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
          `)
          .bind(
            businessId
          )
          .first(),


        env.DB
          .prepare(`
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
          `)
          .bind(
            businessId
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS upload_field_count

            FROM clinical_template_fields f

            JOIN clinical_templates t
              ON t.id = f.template_id

            WHERE
              f.business_id = ?
              AND f.field_type = 'file_upload'
              AND t.is_active = 1
          `)
          .bind(
            businessId
          )
          .first(),


        env.DB
          .prepare(`
            SELECT
              COUNT(*) AS owner_count

            FROM users

            WHERE
              business_id = ?
              AND role = 'owner'
              AND is_active = 1
          `)
          .bind(
            businessId
          )
          .first(),


        env.DB
          .prepare(`
            SELECT version

            FROM schema_migrations
          `)
          .all(),


        env.DB
          .prepare(`
            SELECT
              current_step,
              is_complete,
              completed_at

            FROM installer_state

            WHERE id = 1

            LIMIT 1
          `)
          .first()
      ]);


    const businessComplete =
      Boolean(
        business?.name &&
        business?.email &&
        business?.country_code &&
        business?.timezone &&
        business?.currency &&
        business?.locale
      );


    const brandingComplete =
      Boolean(
        branding?.primary_colour &&
        branding?.background_colour &&
        branding?.text_colour
      );


    const hoursComplete =
      Number(
        hours?.total_rows || 0
      ) >= 7 &&
      Number(
        hours?.open_days || 0
      ) >= 1;


    const servicesComplete =
      Number(
        services?.active_count || 0
      ) >= 1;


    const encryptionComplete =
      Boolean(
        String(
          env.ESELRAM_ENCRYPTION_KEY ||
          ""
        ).trim()
      );


    const emailComplete =
      emailIntegration?.provider ===
        "resend" &&
      emailIntegration?.status ===
        "verified";


    const enabledPaymentKeys = String(
      paymentSummary?.enabled_keys || ""
    )
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);

    const manualPaymentEnabled =
      enabledPaymentKeys.includes("manual");

    // Pay at appointment is an internal/manual method and does not need an
    // external provider connection. Treat it as ready when it is the only
    // enabled/default method, including older provisioned installations whose
    // connection_status may not have been persisted correctly.
    const paymentsComplete =
      Number(paymentSummary?.enabled_count || 0) >= 1 &&
      Number(paymentSummary?.default_count || 0) === 1 &&
      (
        Number(paymentSummary?.connected_default_count || 0) === 1 ||
        (manualPaymentEnabled && Number(paymentSummary?.enabled_count || 0) === 1)
      );


    const templatesComplete =
      Number(
        templateSummary
          ?.active_templates || 0
      ) >= 1 &&
      Number(
        templateSummary
          ?.ready_general_consultation ||
          0
      ) >= 1;


    const uploadFields =
      Number(
        fileUploadSummary
          ?.upload_field_count || 0
      );


    const storageRequired =
      true;


    const storageComplete =
      Boolean(
        env.FORM_UPLOADS
      );


    const ownerComplete =
      Number(
        ownerSummary?.owner_count || 0
      ) >= 1;


    const installedVersions =
      new Set(
        (
          migrations?.results ||
          []
        ).map(
          row =>
            String(
              row.version || ""
            )
        )
      );


    const missingMigrations =
      EXPECTED_MIGRATIONS.filter(
        version =>
          !installedVersions.has(
            version
          )
      );


    const databaseComplete =
      missingMigrations.length === 0;


    const url =
      new URL(
        request.url
      );


    const host =
      url.host;


    const customDomain =
      !host.endsWith(
        ".pages.dev"
      ) &&
      host !==
        "localhost";


    const items = [

      item({
        key:
          "business",
        label:
          "Business details",
        complete:
          businessComplete,
        status:
          businessComplete
            ? "Complete"
            : "Needs attention",
        detail:
          businessComplete
            ? `${business.name} · ${business.email}`
            : "Add the business name, email, locale, timezone and currency.",
        href:
          "/settings/#business"
      }),


      item({
        key:
          "owner",
        label:
          "Owner account",
        complete:
          ownerComplete,
        status:
          ownerComplete
            ? "Complete"
            : "Needs attention",
        detail:
          ownerComplete
            ? "An active owner account is available."
            : "Create at least one active owner account.",
        href:
          "/settings/#users"
      }),


      item({
        key:
          "branding",
        label:
          "Branding",
        complete:
          brandingComplete,
        status:
          brandingComplete
            ? "Complete"
            : "Needs attention",
        detail:
          brandingComplete
            ? "Client-facing branding is configured."
            : "Configure colours and client-facing branding.",
        href:
          "/settings/branding.html"
      }),


      item({
        key:
          "hours",
        label:
          "Working hours",
        complete:
          hoursComplete,
        status:
          hoursComplete
            ? "Complete"
            : "Needs attention",
        detail:
          hoursComplete
            ? `${Number(hours.open_days || 0)} open day(s) configured.`
            : "Configure all weekdays and make at least one day available.",
        href:
          "/settings/#hours"
      }),


      item({
        key:
          "services",
        label:
          "Services",
        complete:
          servicesComplete,
        status:
          servicesComplete
            ? "Complete"
            : "Needs attention",
        detail:
          servicesComplete
            ? `${Number(services.active_count || 0)} active service(s).`
            : "Create at least one active bookable service.",
        href:
          "/services/"
      }),


      item({
        key:
          "encryption",
        label:
          "Credential encryption",
        complete:
          encryptionComplete,
        status:
          encryptionComplete
            ? "Ready"
            : "Missing secret",
        detail:
          encryptionComplete
            ? "ESELRAM_ENCRYPTION_KEY is available to this installation."
            : "Add ESELRAM_ENCRYPTION_KEY as a Cloudflare secret before storing provider credentials.",
        href:
          null
      }),


      item({
        key:
          "email",
        label:
          "Email provider",
        complete:
          emailComplete,
        status:
          emailComplete
            ? "Ready to send"
            : emailIntegration?.provider === "resend"
              ? "Sending setup required"
              : "Optional setup",
        detail:
          emailComplete
            ? "The business's own Resend connection and sending address have passed a test."
            : emailIntegration?.provider === "resend"
              ? "Resend is connected. Verify a business sending domain before automated client emails are enabled."
              : "Email can be configured later. A verified business sending domain is required before automated client emails are enabled.",
        href:
          "/settings/#email",
        required:
          false
      }),


      item({
        key:
          "payments",
        label:
          "Payments",
        complete:
          paymentsComplete,
        status:
          paymentsComplete
            ? "Ready"
            : "Needs attention",
        detail:
          paymentsComplete
            ? `Default payment method is connected${paymentSummary?.enabled_keys ? ` · ${paymentSummary.enabled_keys}` : ""}.`
            : "Enable a payment method and ensure the default method is connected.",
        href:
          "/settings/#payments"
      }),


      item({
        key:
          "clinical",
        label:
          "Clinical templates",
        complete:
          templatesComplete,
        status:
          templatesComplete
            ? "Ready"
            : "Needs attention",
        detail:
          templatesComplete
            ? "Clinical templates are available and General Consultation is ready for client use."
            : "Keep internal templates available and publish General Consultation for client forms.",
        href:
          "/clinical-templates/"
      }),


      item({
        key:
          "storage",
        label:
          "Photo & file storage",
        complete:
          storageComplete,
        status:
          storageComplete
            ? "Connected"
            : "Missing binding",
        detail:
          storageComplete
            ? `FORM_UPLOADS R2 storage is connected${
                uploadFields
                  ? ` · ${uploadFields} active clinical upload field(s)`
                  : ""
              }.`
            : "Connect a buyer-owned Cloudflare R2 bucket using the FORM_UPLOADS binding for customer photos and form uploads.",
        href:
          null,
        required:
          true
      }),


      item({
        key:
          "database",
        label:
          "Database",
        complete:
          databaseComplete,
        status:
          databaseComplete
            ? "Up to date"
            : "Migrations missing",
        detail:
          databaseComplete
            ? `All ${EXPECTED_MIGRATIONS.length} required migrations are recorded.`
            : `Missing: ${missingMigrations.join(", ")}`,
        href:
          null
      }),


      item({
        key:
          "domain",
        label:
          "Public URL",
        complete:
          true,
        status:
          customDomain
            ? "Custom domain"
            : "Pages domain",
        detail:
          customDomain
            ? `Running at ${host}.`
            : `Running at ${host}. A custom domain is recommended before launch.`,
        href:
          null,
        required:
          false
      })
    ];


    const requiredItems =
      items.filter(
        entry =>
          entry.required
      );


    const incompleteItems =
      requiredItems.filter(
        entry =>
          !entry.complete
      );


    return Response.json(
      {
        ok: true,

        ready:
          incompleteItems.length === 0,

        progress: {
          complete:
            requiredItems.length -
            incompleteItems.length,
          total:
            requiredItems.length,
          remaining:
            incompleteItems.length
        },

        installation: {
          is_complete:
            installerState?.is_complete ===
            1,
          current_step:
            installerState?.current_step ||
            "unknown",
          completed_at:
            installerState?.completed_at ||
            null
        },

        business: {
          id:
            business?.id || null,
          name:
            business?.name ||
            "Eselram"
        },

        user: {
          name:
            user?.user_name ||
            ""
        },

        environment: {
          host,
          custom_domain:
            customDomain,
          encryption_ready:
            encryptionComplete,
          form_uploads_bound:
            Boolean(
              env.FORM_UPLOADS
            )
        },

        items
      },
      {
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );


  } catch (error) {

    console.error(
      "Setup health check failed:",
      error
    );


    return Response.json(
      {
        ok: false,
        error:
          "Unable to check installation health."
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }
}

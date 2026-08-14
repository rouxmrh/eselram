const form =
  document.getElementById(
    "fitzForm"
  );

const resultBox =
  document.getElementById(
    "fitzResult"
  );

const resultPill =
  document.getElementById(
    "fitzResultPill"
  );

const resultTitle =
  document.getElementById(
    "fitzResultTitle"
  );

const resultDescription =
  document.getElementById(
    "fitzResultDescription"
  );

const resetButton =
  document.getElementById(
    "fitzResetButton"
  );

const brand =
  document.getElementById(
    "fitzBrand"
  );

const brandLogo =
  document.getElementById(
    "fitzBrandLogo"
  );

const businessName =
  document.getElementById(
    "fitzBusinessName"
  );


const fitzLabelMap = {
  I:
    "Type I — Very fair skin, always burns, never tans",
  II:
    "Type II — Fair skin, burns easily, tans minimally",
  III:
    "Type III — Medium skin, sometimes burns, gradually tans",
  IV:
    "Type IV — Olive skin, rarely burns, tans easily",
  V:
    "Type V — Brown skin, very rarely burns",
  VI:
    "Type VI — Dark brown/black skin, never burns"
};


function calculateFitzType(
  score
) {
  if (score <= 7) {
    return "I";
  }

  if (score <= 16) {
    return "II";
  }

  if (score <= 25) {
    return "III";
  }

  if (score <= 30) {
    return "IV";
  }

  if (score <= 35) {
    return "V";
  }

  return "VI";
}


function scrollToFirstMissing() {
  const firstMissing =
    [
      "q1",
      "q2",
      "q3",
      "q4",
      "q5",
      "q6",
      "q7",
      "q8",
      "q9",
      "q10"
    ]
      .map(
        name =>
          form.querySelector(
            `input[name="${name}"]`
          )
      )
      .find(
        input =>
          !form.querySelector(
            `input[name="${input.name}"]:checked`
          )
      );

  firstMissing
    ?.closest(
      ".es-fitz-question"
    )
    ?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
}


form.addEventListener(
  "submit",
  event => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      scrollToFirstMissing();
      return;
    }

    let score = 0;

    [
      "q1",
      "q2",
      "q3",
      "q4",
      "q5",
      "q6",
      "q7",
      "q8",
      "q9",
      "q10"
    ].forEach(
      question => {
        const selected =
          form.querySelector(
            `input[name="${question}"]:checked`
          );

        score +=
          Number(
            selected?.value ||
            0
          );
      }
    );

    const type =
      calculateFitzType(score);

    resultPill.textContent =
      `Type ${type}`;

    resultTitle.textContent =
      `Fitzpatrick Type ${type} · Score ${score}/40`;

    resultDescription.textContent =
      fitzLabelMap[type] ||
      `Type ${type}`;

    resultBox.hidden = false;

    resultBox.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }
);


resetButton.addEventListener(
  "click",
  () => {
    form.reset();

    resultBox.hidden = true;
    resultPill.textContent =
      "Type";
    resultTitle.textContent =
      "";
    resultDescription.textContent =
      "";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }
);


async function loadBranding() {
  try {
    const response =
      await fetch(
        "/api/branding",
        {
          headers: {
            Accept:
              "application/json"
          },
          cache: "no-store"
        }
      );

    if (
      response.status === 401
    ) {
      window.location.href =
        "/auth/login.html";
      return;
    }

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.ok
    ) {
      return;
    }

    businessName.textContent =
      data.business?.name ||
      "";

    const logo =
      data.branding
        ?.logo_data_url;

    if (logo) {
      brandLogo.src = logo;
      brandLogo.hidden = false;
    }

    brand.hidden = false;
  } catch (error) {
    console.error(
      "Unable to load branding:",
      error
    );
  }
}


loadBranding();

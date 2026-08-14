const app =
  document.getElementById(
    "fitzApp"
  );

const calculateButton =
  document.getElementById(
    "fitzCalculateButton"
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

const message =
  document.getElementById(
    "fitzMessage"
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


const questions = [
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
];


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


function selectedAnswer(
  question
) {
  return app.querySelector(
    `input[name="${question}"]:checked`
  );
}


function showMessage(
  text,
  type = "error"
) {
  message.hidden = false;
  message.className =
    `es-status ${type}`;
  message.textContent = text;
}


function hideMessage() {
  message.hidden = true;
  message.textContent = "";
}


function calculateResult() {
  hideMessage();

  const missing =
    questions.filter(
      question =>
        !selectedAnswer(
          question
        )
    );

  if (missing.length) {
    showMessage(
      `Please answer all 10 questions before calculating the skin type. ${missing.length} question${missing.length === 1 ? "" : "s"} still unanswered.`
    );

    const firstMissing =
      app.querySelector(
        `input[name="${missing[0]}"]`
      );

    firstMissing
      ?.closest(
        ".es-fitz-question"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    return;
  }

  const score =
    questions.reduce(
      (total, question) =>
        total +
        Number(
          selectedAnswer(
            question
          ).value
        ),
      0
    );

  const type =
    calculateFitzType(
      score
    );

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


function resetTest() {
  app
    .querySelectorAll(
      'input[type="radio"]'
    )
    .forEach(
      input => {
        input.checked = false;
      }
    );

  hideMessage();

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


calculateButton.addEventListener(
  "click",
  calculateResult
);


resetButton.addEventListener(
  "click",
  resetTest
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

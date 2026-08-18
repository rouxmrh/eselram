const form =
  document.getElementById("ownerForm");

const statusBox =
  document.getElementById("formStatus");

const submitButton =
  document.getElementById(
    "createAccountButton"
  );


document
  .querySelectorAll(
    ".es-password-toggle"
  )
  .forEach((button) => {

    button.addEventListener(
      "click",
      () => {

        const input =
          document.getElementById(
            button.dataset.target
          );

        const showing =
          input.type === "text";

        input.type =
          showing
            ? "password"
            : "text";

        button.textContent =
          showing
            ? "Show"
            : "Hide";
      }
    );

  });


form.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const name =
      document
        .getElementById("ownerName")
        .value
        .trim();


    const email =
      document
        .getElementById("ownerEmail")
        .value
        .trim();


    const password =
      document
        .getElementById("password")
        .value;


    const confirmPassword =
      document
        .getElementById(
          "confirmPassword"
        )
        .value;


    if (password.length < 12) {

      showError(
        "Your password must contain at least 12 characters."
      );

      return;
    }


    if (
      password !==
      confirmPassword
    ) {

      showError(
        "The passwords do not match."
      );

      return;
    }


    statusBox.hidden = false;
    statusBox.className =
      "es-status";

    statusBox.textContent =
      "Creating your owner account…";

    submitButton.disabled = true;


    try {

      const response =
        await fetch(
          "/api/install/owner",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json"
            },

            body:
              JSON.stringify({
                name,
                email,
                password
              })
          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.ok
      ) {

        throw new Error(
          data.error ||
          "Unable to create the owner account."
        );
      }


      statusBox.classList.add(
        "success"
      );

      statusBox.textContent =
        "Eselram is ready.";


      window.location.href =
        "/setup/";


    } catch (error) {

      console.error(error);

      showError(
        error.message ||
        "Something went wrong."
      );

      submitButton.disabled =
        false;
    }

  }
);


function showError(message) {

  statusBox.hidden = false;

  statusBox.className =
    "es-status error";

  statusBox.textContent =
    message;
}

const form =
  document.getElementById("loginForm");

const statusBox =
  document.getElementById("formStatus");

const loginButton =
  document.getElementById("loginButton");


document
  .querySelectorAll(".es-password-toggle")
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


    statusBox.hidden = false;
    statusBox.className =
      "es-status";

    statusBox.textContent =
      "Signing you in…";

    loginButton.disabled = true;


    const payload = {
      email:
        document
          .getElementById("email")
          .value
          .trim(),

      password:
        document
          .getElementById("password")
          .value
    };


    try {

      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json"
            },

            body:
              JSON.stringify(payload)
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
          "Unable to sign in."
        );
      }


      window.location.href =
        "/dashboard/";


    } catch (error) {

      console.error(error);

      statusBox.className =
        "es-status error";

      statusBox.textContent =
        error.message ||
        "Unable to sign in.";

      loginButton.disabled =
        false;
    }

  }
);

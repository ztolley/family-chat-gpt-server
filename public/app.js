(() => {
  const googleButton = document.getElementById("google-signin");
  const appleButton = document.getElementById("apple-signin");
  const appSection = document.getElementById("app");
  const loginSection = document.getElementById("login-section");
  const statusSection = document.getElementById("status");
  const itemsList = document.getElementById("items-list");
  const itemForm = document.getElementById("item-form");
  const itemTitleInput = document.getElementById("item-title");
  const itemDescriptionInput = document.getElementById("item-description");
  const logoutButton = document.getElementById("logout");
  const userEmailSpan = document.getElementById("user-email");

  let authToken = null;
  let userProfile = null;

  const TOKEN_STORAGE_KEY = "familychat_token";
  const PROFILE_STORAGE_KEY = "familychat_profile";

  function setStatus(message, type) {
    if (!message) {
      statusSection.textContent = "";
      statusSection.className = "";
      return;
    }

    statusSection.textContent = message;
    statusSection.className = type ?? "";
  }

  function decodeJwt(token) {
    try {
      const payload = token.split(".")[1];
      const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(normalized)
          .split("")
          .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join(""),
      );
      return JSON.parse(json);
    } catch (error) {
      return null;
    }
  }

  function updateUiForAuth() {
    const signedIn = Boolean(authToken);
    loginSection.hidden = signedIn;
    appSection.hidden = !signedIn;

    if (signedIn && userProfile) {
      userEmailSpan.textContent = userProfile.email ?? "Unknown user";
    } else {
      userEmailSpan.textContent = "Unknown user";
    }

    if (signedIn) {
      loadItems();
    } else {
      itemsList.innerHTML = "";
    }
  }

  function isTokenExpired(payload) {
    if (!payload || typeof payload.exp !== "number") {
      return true;
    }
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSeconds;
  }

  function saveSession(token, profile) {
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      sessionStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch (_) {
      // Failing to persist should not break the runtime session.
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch (_) {
      // Ignore storage errors.
    }
  }

  function restoreSession() {
    let storedToken;
    try {
      storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (_) {
      storedToken = null;
    }

    if (!storedToken) {
      return false;
    }

    const payload = decodeJwt(storedToken);
    if (!payload || isTokenExpired(payload)) {
      clearSession();
      return false;
    }

    authToken = storedToken;

    let storedProfile;
    try {
      storedProfile = JSON.parse(sessionStorage.getItem(PROFILE_STORAGE_KEY));
    } catch (_) {
      storedProfile = null;
    }

    userProfile = storedProfile ?? {
      provider: payload.iss,
      email: payload.email,
      name: payload.name,
    };

    updateUiForAuth();
    setStatus("Session restored.", "success");
    return true;
  }

  async function authorizedFetch(url, options = {}) {
    if (!authToken) {
      throw new Error("Not authenticated");
    }
    const opts = { ...options };
    const headers = new Headers(opts.headers || {});
    headers.set("Authorization", `Bearer ${authToken}`);

    if (opts.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    opts.headers = headers;
    const response = await fetch(url, opts);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body.error || response.statusText;
      throw new Error(message);
    }

    return response.status === 204 ? null : response.json();
  }

  function renderItems(items) {
    itemsList.innerHTML = "";

    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "No items yet.";
      itemsList.appendChild(li);
      return;
    }

    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "item";

      const info = document.createElement("div");
      info.className = "item-info";
      info.innerHTML = `<strong>${item.title}</strong>${
        item.description ? `<span>${item.description}</span>` : ""
      }`;

      const actions = document.createElement("div");
      actions.className = "item-actions";

      const editButton = document.createElement("button");
      editButton.className = "edit";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", async () => {
        const newTitle = prompt("Update the item title", item.title);
        if (newTitle === null) {
          return;
        }
        const newDescription = prompt(
          "Update the description (optional)",
          item.description ?? "",
        );

        try {
          setStatus("Saving changes…");
          await authorizedFetch(`/api/items/${item.id}`, {
            method: "PUT",
            body: JSON.stringify({
              title: newTitle.trim(),
              description: newDescription?.trim() || undefined,
            }),
          });
          setStatus("Item updated.", "success");
          loadItems();
        } catch (error) {
          setStatus(error.message || "Failed to update item.", "error");
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", async () => {
        const confirmed = confirm("Delete this item?");
        if (!confirmed) {
          return;
        }
        try {
          setStatus("Deleting item…");
          await authorizedFetch(`/api/items/${item.id}`, { method: "DELETE" });
          setStatus("Item deleted.", "success");
          loadItems();
        } catch (error) {
          setStatus(error.message || "Failed to delete item.", "error");
        }
      });

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);

      li.appendChild(info);
      li.appendChild(actions);
      itemsList.appendChild(li);
    });
  }

  async function loadItems() {
    try {
      setStatus("Loading items…");
      const items = await authorizedFetch("/api/items");
      renderItems(items);
      setStatus("Items loaded.", "success");
    } catch (error) {
      setStatus(error.message || "Unable to load items.", "error");
    }
  }

  function handleCredential(provider, token) {
    authToken = token;
    const payload = decodeJwt(token) || {};
    userProfile = {
      provider,
      email: payload.email,
      name: payload.name,
    };
    saveSession(token, userProfile);
    setStatus("Signed in.", "success");
    updateUiForAuth();
  }

  function initGoogleLogin(clientId) {
    if (!clientId) {
      googleButton.innerHTML =
        '<p class="error">Google Sign-In not configured.</p>';
      return;
    }

    const start = () => {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            handleCredential("google", response.credential);
          } else {
            setStatus("Google Sign-In failed.", "error");
          }
        },
      });

      google.accounts.id.renderButton(googleButton, {
        theme: "filled_blue",
        size: "large",
        type: "standard",
      });
    };

    if (window.google?.accounts?.id) {
      start();
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts += 1;
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          start();
        } else if (attempts > 20) {
          clearInterval(interval);
          googleButton.innerHTML =
            '<p class="error">Google Sign-In failed to load.</p>';
        }
      }, 200);
    }
  }

  function initAppleLogin(clientId) {
    if (!window.AppleID) {
      appleButton.disabled = true;
      appleButton.textContent = "Apple Sign-In unavailable";
      return;
    }

    if (!clientId) {
      appleButton.disabled = true;
      appleButton.textContent = "Apple Sign-In not configured";
      return;
    }

    try {
      AppleID.auth.init({
        clientId,
        scope: "name email",
        redirectURI: `${window.location.origin}/auth/apple/callback`,
        usePopup: true,
      });

      AppleID.auth.onAppleIDSignIn = (event) => {
        const token = event?.authorization?.id_token;
        if (token) {
          handleCredential("apple", token);
        } else {
          setStatus("Apple Sign-In failed.", "error");
        }
      };

      appleButton.addEventListener("click", () => {
        AppleID.auth.signIn();
      });
    } catch (error) {
      appleButton.disabled = true;
      appleButton.textContent = "Apple Sign-In setup error";
      console.error(error);
    }
  }

  async function bootstrap() {
    setStatus("Loading configuration…");
    try {
      const response = await fetch("/config");
      const config = await response.json();
      setStatus("Ready.");
      initGoogleLogin(config.googleClientId);
      initAppleLogin(config.appleClientId);
      if (!authToken) {
        restoreSession();
      }
    } catch (error) {
      setStatus("Unable to load configuration.", "error");
    }
  }

  itemForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = itemTitleInput.value.trim();
    const description = itemDescriptionInput.value.trim();

    if (!title) {
      setStatus("Please provide a title.", "error");
      return;
    }

    try {
      setStatus("Saving item…");
      await authorizedFetch("/api/items", {
        method: "POST",
        body: JSON.stringify({ title, description: description || undefined }),
      });
      itemTitleInput.value = "";
      itemDescriptionInput.value = "";
      setStatus("Item added.", "success");
      loadItems();
    } catch (error) {
      setStatus(error.message || "Failed to add item.", "error");
    }
  });

  logoutButton.addEventListener("click", () => {
    authToken = null;
    userProfile = null;
    clearSession();
    updateUiForAuth();
    setStatus("Signed out.");
  });

  bootstrap();
})();

/* ==========================================================================
   App: autenticação via API, navegação entre telas, cards dinâmicos, PWA
   ========================================================================== */

const App = {
  usuario: null,
  fluxos: [],

  async init() {
    Chat.init(() => App.showScreen("home"));
    this.bindLogin();
    this.bindNav();

    document.getElementById("btn-logout").addEventListener("click", () => this.logout());
    document.getElementById("btn-logout-perfil").addEventListener("click", () => this.logout());

    const token = localStorage.getItem("gbs_token");
    if (token) {
      API.token = token;
      try {
        this.usuario = await API.req("/api/auth/eu");
        await this.carregarFluxos();
        this.showScreen("home");
      } catch {
        this.logout(true);
      }
    } else {
      this.showScreen("login");
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  },

  async carregarFluxos() {
    this.fluxos = await API.req("/api/fluxos");
    const container = document.getElementById("home-cards");
    container.innerHTML = "";
    for (const [i, f] of this.fluxos.entries()) {
      const btn = document.createElement("button");
      btn.className = `card card-${f.cor}`;
      btn.style.animationDelay = `${120 + i * 75}ms`; // entrada em cascata
      btn.innerHTML = `
        <span class="card-icon" aria-hidden="true"><svg class="icon"><use href="#i-${f.icone}"/></svg></span>
        <span class="card-text">
          <span class="card-title">${escapeHtml(f.titulo)}</span>
          <span class="card-desc">${escapeHtml(f.descricao)}</span>
        </span>
        <svg class="icon card-chevron" aria-hidden="true"><use href="#i-chevron-right"/></svg>`;
      btn.addEventListener("click", () => {
        this.showScreen("chat");
        Chat.start(f);
      });
      container.appendChild(btn);
    }
  },

  logout(silencioso = false) {
    if (!silencioso && API.token) {
      API.req("/api/auth/logout", { method: "POST" }).catch(() => {});
    }
    localStorage.removeItem("gbs_token");
    API.token = null;
    this.usuario = null;
    this.showScreen("login");
  },

  /* ---------- telas ---------- */

  showScreen(name) {
    ["login", "home", "perfil", "config", "chat"].forEach((s) => {
      const el = document.getElementById("screen-" + s);
      if (s === name) {
        if (el.hidden) {
          el.hidden = false;
          el.classList.remove("enter");
          void el.offsetWidth; // reinicia a animação de entrada
          el.classList.add("enter");
        }
      } else {
        el.hidden = true;
        el.classList.remove("enter");
      }
    });

    this.atualizarNav(name);

    if (name === "home" && this.usuario) {
      document.getElementById("home-greeting").textContent =
        `${saudacao()}, ${primeiroNome(this.usuario.nome)}`;
    }
    if (name === "perfil" && this.usuario) {
      document.getElementById("perfil-nome").textContent = this.usuario.nome;
      document.getElementById("perfil-matricula").textContent = "Matrícula: " + this.usuario.matricula;
    }
    window.scrollTo(0, 0);
  },

  /* Desliza o recorte + bolha da navbar até o item ativo */
  atualizarNav(name) {
    const nav = document.getElementById("bottom-nav");
    nav.hidden = !["home", "perfil", "config"].includes(name);
    if (nav.hidden) return;

    const itens = [...nav.querySelectorAll(".nav-item")];
    const idx = itens.findIndex((b) => b.dataset.screen === name);
    if (idx < 0) return;

    itens.forEach((b, i) => {
      if (i === idx) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });

    const xAntes = nav.style.getPropertyValue("--nav-x");
    const xNovo = `${(((idx + 0.5) / itens.length) * 100).toFixed(3)}%`;
    nav.style.setProperty("--nav-x", xNovo);

    document.getElementById("nav-bubble-icon")
      .setAttribute("href", "#i-" + itens[idx].dataset.icon);

    if (xAntes && xAntes !== xNovo) {
      const bolha = document.getElementById("nav-bubble");
      bolha.classList.remove("pulse");
      void bolha.offsetWidth;
      bolha.classList.add("pulse");
    }
  },

  /* ---------- eventos ---------- */

  bindLogin() {
    const form = document.getElementById("login-form");
    const erro = document.getElementById("login-error");
    const botao = form.querySelector("button[type=submit]");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      erro.hidden = true;
      botao.disabled = true;
      botao.textContent = "Entrando…";

      try {
        const r = await API.req("/api/auth/login", {
          method: "POST",
          body: {
            matricula: document.getElementById("login-matricula").value.trim(),
            senha: document.getElementById("login-senha").value
          }
        });
        API.token = r.token;
        localStorage.setItem("gbs_token", r.token);
        this.usuario = r.usuario;
        form.reset();
        await this.carregarFluxos();
        this.showScreen("home");
      } catch (err) {
        erro.textContent = err.message;
        erro.hidden = false;
      } finally {
        botao.disabled = false;
        botao.textContent = "Entrar";
      }
    });
  },

  bindNav() {
    document.querySelectorAll("#bottom-nav .nav-item").forEach((btn) => {
      btn.addEventListener("click", () => this.showScreen(btn.dataset.screen));
    });
  }
};

/* ---------- utilidades ---------- */

function primeiroNome(nome) {
  return String(nome).split(" ")[0];
}

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

window.App = App;
document.addEventListener("DOMContentLoaded", () => App.init());

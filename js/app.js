/* ==========================================================================
   App: autenticação, navegação entre telas, PWA
   ========================================================================== */

const App = {
  usuario: null,

  init() {
    Chat.init(() => App.showScreen("home"));
    this.bindLogin();
    this.bindHome();
    this.bindNav();

    const sessao = this.lerSessao();
    if (sessao) {
      this.usuario = sessao;
      this.showScreen("home");
    } else {
      this.showScreen("login");
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  },

  /* ---------- sessão (token local) ---------- */

  lerSessao() {
    try {
      const raw = localStorage.getItem("gbs_sessao");
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.token ? s : null;
    } catch {
      return null;
    }
  },

  criarSessao(motorista) {
    const sessao = {
      token: "mock-" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      matricula: motorista.matricula,
      nome: motorista.nome
    };
    localStorage.setItem("gbs_sessao", JSON.stringify(sessao));
    return sessao;
  },

  logout() {
    localStorage.removeItem("gbs_sessao");
    this.usuario = null;
    this.showScreen("login");
  },

  /* ---------- telas ---------- */

  showScreen(name) {
    const screens = ["login", "home", "perfil", "config", "chat"];
    screens.forEach((s) => {
      document.getElementById("screen-" + s).hidden = s !== name;
    });

    const nav = document.getElementById("bottom-nav");
    const comNav = ["home", "perfil", "config"];
    nav.hidden = !comNav.includes(name);
    nav.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("active", b.dataset.screen === name);
    });

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

  /* ---------- eventos ---------- */

  bindLogin() {
    const form = document.getElementById("login-form");
    const erro = document.getElementById("login-error");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const mat = document.getElementById("login-matricula").value.trim();
      const senha = document.getElementById("login-senha").value;

      const motorista = DB.motoristas.find(
        (m) => m.matricula === mat && m.senha === senha
      );

      if (!motorista) {
        erro.hidden = false;
        return;
      }

      erro.hidden = true;
      form.reset();
      this.usuario = this.criarSessao(motorista);
      this.showScreen("home");
    });
  },

  bindHome() {
    document.querySelectorAll(".card[data-flow]").forEach((card) => {
      card.addEventListener("click", () => {
        const flow = FLOWS[card.dataset.flow];
        this.showScreen("chat");
        Chat.start(flow, {
          motorista: primeiroNome(this.usuario.nome),
          matricula: this.usuario.matricula
        });
      });
    });

    document.getElementById("btn-logout").addEventListener("click", () => this.logout());
    document.getElementById("btn-logout-perfil").addEventListener("click", () => this.logout());
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

document.addEventListener("DOMContentLoaded", () => App.init());

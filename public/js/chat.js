/* ==========================================================================
   Cliente da API + tela de chat.
   Os fluxos rodam no servidor; este arquivo apenas apresenta as mensagens
   e envia as entradas do usuário.
   ========================================================================== */

const API = {
  token: null,

  async req(caminho, opcoes = {}) {
    const headers = opcoes.headers || {};
    if (this.token) headers["Authorization"] = "Bearer " + this.token;
    if (opcoes.body && !(opcoes.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      opcoes.body = JSON.stringify(opcoes.body);
    }
    const resp = await fetch(caminho, { ...opcoes, headers });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw Object.assign(new Error(dados.erro || "Falha na comunicação com o servidor."), { status: resp.status });
    return dados;
  }
};

const Chat = {
  conversaId: null,
  busy: false,
  onExit: null,
  els: {},

  init(onExit) {
    this.onExit = onExit;
    this.els = {
      messages: document.getElementById("chat-messages"),
      options: document.getElementById("chat-options"),
      form: document.getElementById("chat-form"),
      input: document.getElementById("chat-input"),
      photoInput: document.getElementById("chat-photo-input"),
      title: document.getElementById("chat-title"),
      back: document.getElementById("chat-back")
    };

    this.els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const valor = this.els.input.value.trim();
      if (!valor || this.busy) return;
      this.els.input.value = "";
      this.renderUser(valor);
      this.enviar({ tipo: "texto", valor });
    });

    this.els.photoInput.addEventListener("change", () => {
      const file = this.els.photoInput.files[0];
      if (!file) return;
      this.els.photoInput.value = "";
      this.renderUserPhoto(URL.createObjectURL(file));
      this.enviarFoto(file);
    });

    this.els.back.addEventListener("click", () => this.exit());
  },

  async start(fluxo) {
    this.conversaId = null;
    this.els.messages.innerHTML = "";
    this.els.options.innerHTML = "";
    this.els.title.textContent = fluxo.titulo;
    this.setInputEnabled(false);

    try {
      const saida = await this.comIndicador(() => API.req("/api/conversas", { method: "POST", body: { fluxo: fluxo.id } }));
      this.conversaId = saida.conversaId;
      await this.apresentar(saida);
    } catch (e) {
      this.falha(e);
    }
  },

  exit() {
    this.conversaId = null;
    if (this.onExit) this.onExit();
  },

  /* ---------- comunicação ---------- */

  async enviar(entrada) {
    try {
      const saida = await this.comIndicador(() =>
        API.req(`/api/conversas/${this.conversaId}/mensagens`, { method: "POST", body: entrada })
      );
      await this.apresentar(saida);
    } catch (e) {
      this.falha(e);
    }
  },

  async enviarFoto(file) {
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const saida = await this.comIndicador(() =>
        API.req(`/api/conversas/${this.conversaId}/fotos`, { method: "POST", body: fd })
      );
      await this.apresentar(saida);
    } catch (e) {
      this.falha(e);
    }
  },

  /* Mostra o indicador "digitando" enquanto a requisição roda */
  async comIndicador(fn) {
    this.busy = true;
    this.els.options.innerHTML = "";
    const typing = this.criarTyping();
    const inicio = Date.now();
    try {
      const saida = await fn();
      const resta = 450 - (Date.now() - inicio);
      if (resta > 0) await new Promise((r) => setTimeout(r, resta));
      return saida;
    } finally {
      typing.remove();
      this.busy = false;
    }
  },

  criarTyping() {
    const typing = document.createElement("div");
    typing.className = "bubble bubble-bot typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    this.els.messages.appendChild(typing);
    this.scrollDown();
    return typing;
  },

  /* ---------- apresentação ---------- */

  async apresentar(saida) {
    for (let i = 0; i < saida.mensagens.length; i++) {
      if (i > 0) {
        const typing = this.criarTyping();
        await new Promise((r) => setTimeout(r, 420));
        typing.remove();
      }
      this.bubble("bubble-bot", formatMsg(saida.mensagens[i].conteudo));
    }

    if (saida.status === "cancelada") {
      this.setInputEnabled(false);
      setTimeout(() => this.exit(), 1000);
      return;
    }

    if (saida.status === "concluida" || !saida.entrada) {
      this.setInputEnabled(false);
      this.addOptionButton({ label: "Voltar ao menu", wide: true }, () => this.exit());
      return;
    }

    this.mostrarEntrada(saida.entrada);
  },

  mostrarEntrada(entrada) {
    this.els.options.innerHTML = "";

    if (entrada.tipo === "botoes") {
      this.setInputEnabled(true); // permite digitar "sair"
      entrada.opcoes.forEach((o) => {
        this.addOptionButton(o, () => {
          this.renderUser(o.label);
          this.enviar({ tipo: "opcao", valor: o.value });
        });
      });
      return;
    }

    if (entrada.tipo === "foto") {
      this.setInputEnabled(true);
      this.addOptionButton({ label: "Tirar / anexar foto", wide: true }, () => this.els.photoInput.click());
      this.addOptionButton({ label: "Voltar" }, () => {
        this.renderUser("sair");
        this.enviar({ tipo: "texto", valor: "sair" });
      });
      return;
    }

    // texto
    this.setInputEnabled(true);
    if (entrada.opcaoPular) {
      this.addOptionButton({ label: entrada.opcaoPular }, () => {
        this.renderUser(entrada.opcaoPular);
        this.enviar({ tipo: "opcao", valor: "" });
      });
    }
    this.els.input.focus();
  },

  falha(e) {
    if (e.status === 401) { this.exit(); if (window.App) window.App.logout(true); return; }
    this.bubble("bubble-bot", escapeHtml(e.message));
    this.addOptionButton({ label: "Voltar ao menu", wide: true }, () => this.exit());
  },

  /* ---------- renderização ---------- */

  timestamp() {
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  },

  scrollDown() {
    this.els.messages.scrollTop = this.els.messages.scrollHeight;
  },

  bubble(cls, html) {
    const div = document.createElement("div");
    div.className = "bubble " + cls;
    div.innerHTML = html + `<span class="bubble-time">${this.timestamp()}</span>`;
    this.els.messages.appendChild(div);
    this.scrollDown();
    return div;
  },

  renderUser(texto) {
    this.bubble("bubble-user", escapeHtml(texto));
  },

  renderUserPhoto(url) {
    this.bubble("bubble-user", `<img class="bubble-photo" src="${url}" alt="Foto enviada" />`);
  },

  addOptionButton(opt, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chat-option-btn" + (opt.wide ? " option-wide" : "");
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      if (this.busy) return;
      onClick();
    });
    this.els.options.appendChild(btn);
  },

  setInputEnabled(enabled) {
    this.els.input.disabled = !enabled;
    this.els.form.querySelector(".chat-send").disabled = !enabled;
  }
};

/* ---------- utilidades ---------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// *negrito* + links de telefone [tel:...|(44) 0000-0000]
function formatMsg(s) {
  let html = escapeHtml(s);
  html = html.replace(/\[tel:([^|]+)\|([^\]]+)\]/g,
    '<a class="tel-link" href="tel:$1"><svg class="icon" style="width:18px;height:18px;vertical-align:-3px"><use href="#i-phone"/></svg> $2</a>');
  html = html.replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
  return html;
}

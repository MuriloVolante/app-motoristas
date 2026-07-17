/* ==========================================================================
   Motor de chat — fluxos sequenciais controlados (estilo WhatsApp)
   ========================================================================== */

const Chat = {
  flow: null,
  state: {},
  history: [],       // etapas anteriores (para o comando "sair")
  currentStepId: null,
  busy: false,       // bloqueia entradas enquanto o bot "digita"
  onExit: null,

  els: {},

  init(onExit) {
    this.onExit = onExit;
    this.els = {
      screen: document.getElementById("screen-chat"),
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
      const value = this.els.input.value.trim();
      if (!value || this.busy) return;
      this.els.input.value = "";
      this.handleText(value);
    });

    this.els.photoInput.addEventListener("change", () => {
      const file = this.els.photoInput.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      this.els.photoInput.value = "";
      this.renderUserPhoto(url);
      this.answer(file.name || "foto", { fotoUrl: url });
    });

    this.els.back.addEventListener("click", () => this.exit());
  },

  /* ---------- ciclo de vida ---------- */

  start(flow, contexto = {}) {
    this.flow = flow;
    this.state = { ...contexto };
    this.history = [];
    this.currentStepId = null;
    this.busy = false;
    this.els.messages.innerHTML = "";
    this.els.options.innerHTML = "";
    this.els.title.textContent = flow.titulo || "Assistente GBS";
    this.goTo(flow.inicio);
  },

  exit() {
    this.flow = null;
    if (this.onExit) this.onExit();
  },

  step(id) {
    return this.flow.etapas[id];
  },

  goTo(stepId, { pushHistory = true } = {}) {
    if (pushHistory && this.currentStepId) this.history.push(this.currentStepId);
    this.currentStepId = stepId;
    this.showStep();
  },

  showStep() {
    const step = this.step(this.currentStepId);
    if (step.aoEntrar) step.aoEntrar(this.state);

    let prompt = typeof step.mensagem === "function" ? step.mensagem(this.state) : step.mensagem;
    const msgs = Array.isArray(prompt) ? prompt : [prompt];

    this.botSay(msgs, () => this.presentInput(step));
  },

  presentInput(step) {
    this.els.options.innerHTML = "";

    if (step.tipo === "fim") {
      this.setInputEnabled(false);
      this.addOptionButton({ label: "Voltar ao menu", wide: true }, () => this.exit());
      return;
    }

    if (step.tipo === "foto") {
      this.setInputEnabled(false);
      this.addOptionButton({ label: "Tirar / anexar foto", wide: true }, () => {
        this.els.photoInput.click();
      });
      this.addOptionButton({ label: "Voltar" }, () => this.goBack());
      return;
    }

    if (step.tipo === "botoes") {
      this.setInputEnabled(true); // permite digitar "sair"
      const opts = typeof step.opcoes === "function" ? step.opcoes(this.state) : step.opcoes;
      opts.forEach((opt) => {
        const o = typeof opt === "string" ? { label: opt, value: opt } : opt;
        this.addOptionButton(o, () => {
          this.renderUser(o.label);
          this.answer(o.value !== undefined ? o.value : o.label);
        });
      });
      return;
    }

    // tipo === "texto"
    this.setInputEnabled(true);
    if (step.opcaoPular) {
      this.addOptionButton({ label: step.opcaoPular }, () => {
        this.renderUser(step.opcaoPular);
        this.answer("");
      });
    }
    this.els.input.focus();
  },

  /* ---------- entradas do usuário ---------- */

  handleText(value) {
    const step = this.step(this.currentStepId);

    this.renderUser(value);

    if (value.toLowerCase() === "sair") {
      this.goBack();
      return;
    }

    if (step.tipo !== "texto") {
      this.botSay(["Por favor, use os botões acima para responder.\n(Ou digite *sair* para voltar.)"], () => this.presentInput(step));
      return;
    }

    if (step.validar) {
      const res = step.validar(value, this.state);
      if (res !== true) {
        this.botSay([res], () => this.presentInput(step));
        return;
      }
    }

    this.answer(value);
  },

  answer(value, extra = {}) {
    const step = this.step(this.currentStepId);
    if (step.salvar) this.state[step.salvar] = value;
    Object.assign(this.state, extra);

    const nextId = typeof step.proxima === "function" ? step.proxima(this.state, value) : step.proxima;
    this.els.options.innerHTML = "";
    this.goTo(nextId);
  },

  goBack() {
    this.els.options.innerHTML = "";
    if (this.history.length === 0) {
      // Na primeira etapa, "sair" cancela o fluxo
      this.botSay(["Tudo bem, atendimento cancelado.\nVoltando ao menu principal…"], () => {
        setTimeout(() => this.exit(), 900);
      });
      return;
    }
    const prevId = this.history.pop();
    this.currentStepId = prevId;
    this.botSay(["Certo, voltando uma etapa."], () => this.showStep2(prevId));
  },

  // Reapresenta a etapa sem executar aoEntrar de novo
  showStep2(stepId) {
    const step = this.step(stepId);
    let prompt = typeof step.mensagem === "function" ? step.mensagem(this.state) : step.mensagem;
    const msgs = Array.isArray(prompt) ? prompt : [prompt];
    this.botSay(msgs, () => this.presentInput(step));
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

  renderUser(text) {
    this.bubble("bubble-user", escapeHtml(text));
  },

  renderUserPhoto(url) {
    this.bubble("bubble-user", `<img class="bubble-photo" src="${url}" alt="Foto enviada" />`);
  },

  // Mensagens do bot em sequência, com indicador "digitando"
  botSay(messages, done) {
    this.busy = true;
    const next = (i) => {
      if (i >= messages.length) {
        this.busy = false;
        if (done) done();
        return;
      }
      const typing = document.createElement("div");
      typing.className = "bubble bubble-bot typing";
      typing.innerHTML = "<span></span><span></span><span></span>";
      this.els.messages.appendChild(typing);
      this.scrollDown();

      setTimeout(() => {
        typing.remove();
        this.bubble("bubble-bot", formatMsg(messages[i]));
        next(i + 1);
      }, 550);
    };
    next(0);
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

// *negrito* estilo WhatsApp + links de telefone [tel:...|(44) 0000-0000]
function formatMsg(s) {
  let html = escapeHtml(s);
  html = html.replace(/\[tel:([^|]+)\|([^\]]+)\]/g,
    '<a class="tel-link" href="tel:$1"><svg class="icon" style="width:18px;height:18px;vertical-align:-3px"><use href="#i-phone"/></svg> $2</a>');
  html = html.replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
  return html;
}

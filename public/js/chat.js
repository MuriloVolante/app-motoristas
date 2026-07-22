/* ==========================================================================
   Cliente da API + palco de diálogo do Sr. Assis.
   Os fluxos rodam no servidor; aqui apresentamos a fala do personagem
   (com a expressão certa) e as opções de resposta, estilo diálogo de jogo.
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
      speech: document.getElementById("chat-speech"),
      echo: document.getElementById("chat-echo"),
      stageImg: document.getElementById("assis-stage"),
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
      this.mostrarEco(valor);
      this.enviar({ tipo: "texto", valor });
    });

    this.els.photoInput.addEventListener("change", () => {
      const file = this.els.photoInput.files[0];
      if (!file) return;
      this.els.photoInput.value = "";
      this.mostrarEcoFoto(URL.createObjectURL(file));
      this.enviarFoto(file);
    });

    this.els.back.addEventListener("click", () => this.exit());
  },

  async start(fluxo) {
    this.conversaId = null;
    this.els.speech.innerHTML = "";
    this.els.options.innerHTML = "";
    this.els.echo.hidden = true;
    this.els.title.textContent = fluxo.titulo;
    this.setExpressao("fala");
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

  /* Limpa a fala e mostra o indicador "pensando" enquanto a requisição roda */
  async comIndicador(fn) {
    this.busy = true;
    this.els.options.innerHTML = "";
    this.els.speech.innerHTML = "";
    const typing = document.createElement("div");
    typing.className = "typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    this.els.speech.appendChild(typing);
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

  /* ---------- palco ---------- */

  /* Troca a expressão do Sr. Assis (arquivos em public/assets/assis/).
     Se a imagem não existir, cai no placeholder ilustrado. */
  setExpressao(nome) {
    const img = this.els.stageImg;
    if (img.dataset.expr === nome) return;
    img.dataset.expr = nome;
    img.classList.add("trocando");
    setTimeout(() => {
      img.onerror = () => {
        img.onerror = null;
        img.src = `assets/assis/placeholder-${nome}.svg`;
      };
      img.src = `assets/assis/${nome}.png`;
      img.classList.remove("trocando");
    }, 160);
  },

  async apresentar(saida) {
    this.busy = true; // bloqueia entradas até a fala terminar de aparecer
    for (let i = 0; i < saida.mensagens.length; i++) {
      const m = saida.mensagens[i];
      if (m.expressao) this.setExpressao(m.expressao);
      if (i > 0) await new Promise((r) => setTimeout(r, 380));
      const p = document.createElement("div");
      p.className = "bubble-bot";
      p.innerHTML = formatMsg(m.conteudo);
      this.els.speech.appendChild(p);
      this.els.speech.scrollTop = this.els.speech.scrollHeight;
    }
    this.busy = false;

    if (saida.status === "cancelada") {
      this.setInputEnabled(false);
      setTimeout(() => this.exit(), 1100);
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
      entrada.opcoes.forEach((o, i) => {
        this.addOptionButton(o, () => {
          this.mostrarEco(o.label);
          this.enviar({ tipo: "opcao", valor: o.value });
        }, i);
      });
      return;
    }

    if (entrada.tipo === "foto") {
      this.setInputEnabled(true);
      this.addOptionButton({ label: "📷 Tirar / anexar foto", wide: true }, () => this.els.photoInput.click());
      this.addOptionButton({ label: "Voltar" }, () => {
        this.mostrarEco("sair");
        this.enviar({ tipo: "texto", valor: "sair" });
      }, 1);
      return;
    }

    // texto livre
    this.setInputEnabled(true);
    if (entrada.opcaoPular) {
      this.addOptionButton({ label: entrada.opcaoPular }, () => {
        this.mostrarEco(entrada.opcaoPular);
        this.enviar({ tipo: "opcao", valor: "" });
      });
    }
    this.els.input.focus();
  },

  falha(e) {
    if (e.status === 401) { this.exit(); if (window.App) window.App.logout(true); return; }
    this.setExpressao("triste");
    const p = document.createElement("div");
    p.className = "bubble-bot";
    p.textContent = e.message;
    this.els.speech.appendChild(p);
    this.addOptionButton({ label: "Voltar ao menu", wide: true }, () => this.exit());
  },

  /* eco da resposta do motorista, no canto do palco */
  mostrarEco(texto) {
    this.els.echo.hidden = false;
    this.els.echo.textContent = texto;
  },

  mostrarEcoFoto(url) {
    this.els.echo.hidden = false;
    this.els.echo.innerHTML = `<img src="${url}" alt="Foto enviada" />`;
  },

  addOptionButton(opt, onClick, indice = 0) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chat-option-btn" + (opt.wide ? " option-wide" : "");
    btn.textContent = opt.label;
    btn.style.animationDelay = `${indice * 55}ms`;
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
    '<a class="tel-link" href="tel:$1"><svg class="icon" style="width:17px;height:17px;vertical-align:-3px"><use href="#i-phone"/></svg> $2</a>');
  html = html.replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
  return html;
}

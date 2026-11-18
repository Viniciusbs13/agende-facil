// Estrutura do painel: entrada, criação da empresa, menu, início e minha conta.
import { html, render, useState, useEffect, db, q, tentar, toast, copiar, useForm, Campo, APP_NOME, linkPublico, aplicarTema, SeletorRamo, SeletorCor, COR_POR_RAMO,
  brl, fone, fData, hoje, addDias, h5, DIAS_C, dt, NIVEIS, seloStatus } from './lib.js';
import { Clientes, Categorias, Servicos, Adicionais, Profissionais } from './cadastros.js';
import { Agenda, Agendamentos, AgModal } from './agenda.js';
import { Configuracoes, Financeiro, Logs } from './gestao.js';
import { RelatorioOperacional, RelatorioFinanceiro } from './relatorios.js';

const ERROS_AUTH = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  'User already registered': 'Já existe uma conta com esse e-mail. Use “Entrar”.',
};
const erroAuth = e => new Error(ERROS_AUTH[e.message] || (/at least 6/.test(e.message) ? 'A senha deve ter ao menos 6 caracteres.' : e.message));

/* ---------- entrada ---------- */
function Entrar() {
  const [modo, setModo] = useState('entrar');
  const [aviso, setAviso] = useState('');
  const [oc, setOc] = useState(false);
  const f = useForm({ email: '', senha: '' });
  const enviar = async e => {
    e.preventDefault();
    setOc(true); setAviso('');
    await tentar(async () => {
      const email = f.v.email.trim().toLowerCase();
      const volta = location.origin + location.pathname;
      if (modo === 'entrar') {
        const { error } = await db.auth.signInWithPassword({ email, password: f.v.senha });
        if (error) throw erroAuth(error);
      } else if (modo === 'criar') {
        const { data, error } = await db.auth.signUp({ email, password: f.v.senha, options: { emailRedirectTo: volta } });
        if (error) throw erroAuth(error);
        if (!data.session) { setAviso('Conta criada. Enviamos um link de confirmação para o seu e-mail; depois de confirmar, volte aqui e entre.'); setModo('entrar'); }
      } else {
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: volta });
        if (error) throw erroAuth(error);
        setAviso('Se existir uma conta com esse e-mail, enviamos um link para criar uma nova senha.'); setModo('entrar');
      }
    });
    setOc(false);
  };
  return html`
    <div class="entrada">
      <form class="cartao-entrada" onSubmit=${enviar}>
        <div class="marca">${APP_NOME}</div>
        <h1>${modo === 'entrar' ? 'Entrar no painel' : modo === 'criar' ? 'Criar conta' : 'Recuperar senha'}</h1>
        ${aviso ? html`<p class="aviso">${aviso}</p>` : ''}
        <${Campo} label="E-mail"><input type="email" required autocomplete="email" ...${f.txt('email')} /><//>
        ${modo !== 'esqueci' ? html`<${Campo} label="Senha"><input type="password" required minlength="6"
          autocomplete=${modo === 'criar' ? 'new-password' : 'current-password'} ...${f.txt('senha')} /><//>` : ''}
        <button class="btn largo" disabled=${oc}>${oc ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}</button>
        <div class="trocas">
          ${modo !== 'entrar' ? html`<button type="button" class="btn link" onClick=${() => setModo('entrar')}>Já tenho conta</button>` : ''}
          ${modo !== 'criar' ? html`<button type="button" class="btn link" onClick=${() => setModo('criar')}>Criar conta</button>` : ''}
          ${modo === 'entrar' ? html`<button type="button" class="btn link" onClick=${() => setModo('esqueci')}>Esqueci a senha</button>` : ''}
        </div>
      </form>
    </div>`;
}

function NovaSenha({ onFim }) {
  const [s, setS] = useState('');
  const salvar = async e => {
    e.preventDefault();
    if (await tentar(async () => { const { error } = await db.auth.updateUser({ password: s }); if (error) throw erroAuth(error); }, 'Senha alterada.')) onFim();
  };
  return html`<div class="entrada"><form class="cartao-entrada" onSubmit=${salvar}><div class="marca">${APP_NOME}</div><h1>Criar nova senha</h1>
    <${Campo} label="Nova senha"><input type="password" required minlength="6" value=${s} onInput=${e => setS(e.target.value)} /><//>
    <button class="btn largo">Salvar senha</button></form></div>`;
}

function CriarEmpresa({ onPronto, email }) {
  const f = useForm({ empresa: '', nome: '', telefone: '', ramo: '', cor: '#5b4bff', corEscolhida: false });
  useEffect(() => { aplicarTema(f.v.cor); }, [f.v.cor]);
  // ao escolher o ramo, sugere uma cor que combina, até a pessoa escolher a dela
  const mudarRamo = r => f.setV(o => ({ ...o, ramo: r, cor: !o.corEscolhida && COR_POR_RAMO[r] ? COR_POR_RAMO[r] : o.cor }));
  const [oc, setOc] = useState(false);
  const enviar = async e => {
    e.preventDefault(); setOc(true);
    const ok = await tentar(() => q(db.rpc('criar_empresa', { p_empresa: f.v.empresa, p_nome: f.v.nome, p_telefone: f.v.telefone || null, p_ramo: f.v.ramo || null, p_cor: f.v.cor })));
    setOc(false);
    if (ok) onPronto();
  };
  return html`
    <div class="entrada">
      <form class="cartao-entrada" onSubmit=${enviar}>
        <div class="marca">${APP_NOME}</div>
        <h1>Vamos configurar sua empresa</h1>
        <p class="mudo">Conta: ${email}. Se você foi convidado por uma empresa, peça para cadastrarem este mesmo e-mail no seu perfil de profissional e entre novamente.</p>
        <${Campo} label="Nome da empresa" req><input required ...${f.txt('empresa')} /><//>
        <${Campo} label="Seu nome" req><input required ...${f.txt('nome')} /><//>
        <${Campo} label="Telefone / WhatsApp"><input ...${f.tel('telefone')} /><//>
        <${Campo} label="O que a sua empresa faz?"><${SeletorRamo} valor=${f.v.ramo} onChange=${mudarRamo} /><//>
        <${Campo} label="Cor do seu sistema" dica="Vale para o painel e para a página que seus clientes veem. Dá para trocar depois.">
          <${SeletorCor} valor=${f.v.cor} onChange=${c => f.setV(o => ({ ...o, cor: c, corEscolhida: true }))} />
        <//>
        <button class="btn largo" disabled=${oc}>${oc ? 'Criando…' : 'Criar empresa'}</button>
        <div class="trocas"><button type="button" class="btn link" onClick=${() => db.auth.signOut()}>Sair</button></div>
      </form>
    </div>`;
}

/* ---------- início ---------- */
function Var({ atual, anterior }) {
  if (atual == null || anterior == null) return html`<small class="mudo">vs. 7 dias anteriores</small>`;
  const d = anterior ? Math.round(((atual - anterior) / Math.abs(anterior)) * 100) : atual ? 100 : 0;
  return html`<small class=${d > 0 ? 'sobe' : d < 0 ? 'desce' : 'mudo'}>${d > 0 ? '+' : ''}${d}% <span class="mudo">vs. 7 dias anteriores</span></small>`;
}
function Inicio({ ctx }) {
  const [d, setD] = useState(null);
  const carregar = () => tentar(async () => {
    const h = hoje();
    const [prox, atual, ant, nServ, nAg] = await Promise.all([
      q(db.from('agendamentos').select('id,data,hora_inicio,servicos,status,cliente:clientes(nome),profissional:profissionais(nome)')
        .eq('status', 'agendado').gte('data', h).order('data').order('hora_inicio').limit(6)),
      q(db.rpc('estatisticas', { p_inicio: addDias(h, -6), p_fim: h })),
      q(db.rpc('estatisticas', { p_inicio: addDias(h, -13), p_fim: addDias(h, -7) })),
      q(db.from('servicos').select('id', { count: 'exact', head: true }).then(r => ({ data: r.count, error: r.error }))),
      q(db.from('agendamentos').select('id', { count: 'exact', head: true }).then(r => ({ data: r.count, error: r.error }))),
    ]);
    setD({ prox, atual, ant, nServ, nAg });
  });
  useEffect(() => { carregar(); const f = () => carregar(); window.addEventListener('ag-mudou', f); return () => window.removeEventListener('ag-mudou', f); }, []);
  const e = ctx.empresa;
  const link = linkPublico(e.slug);
  const passos = d && [
    ['Adicionar dados básicos da empresa', !!e.telefone, '#/configuracoes'],
    ['Adicionar um profissional', true, '#/profissionais'],
    ['Adicionar um serviço', d.nServ > 0, '#/servicos'],
    ['Conferir horário de funcionamento', true, '#/configuracoes'],
    ['Personalizar seu link de agendamento', !!(e.logo_url || e.capa_url), '#/configuracoes'],
    ['Criar seu primeiro agendamento', d.nAg > 0, '#/agenda'],
  ];
  const feitos = passos ? passos.filter(p => p[1]).length : 0;
  const m = (k, rot, fmt = x => x) => html`
    <div class="cartao"><span>${rot}</span><b>${d.atual[k] == null ? '—' : fmt(d.atual[k])}</b><${Var} atual=${d.atual[k]} anterior=${d.ant[k]} /></div>`;
  return html`
    <div class="pagina">
      <div class="titulo"><div><h1>Olá, ${ctx.prof.nome.split(' ')[0]}</h1><p class="mudo">Você faz parte da empresa ${e.nome}.</p></div></div>
      ${!d ? html`<p class="mudo">Carregando…</p>` : html`
        ${ctx.nivel === 4 && feitos < passos.length ? html`
          <section class="bloco">
            <h2>Configure sua conta</h2>
            <div class="progresso"><i style=${`width:${(feitos / passos.length) * 100}%`}></i></div>
            <p class="mudo peq">${feitos} de ${passos.length} etapas concluídas</p>
            <ul class="passos">${passos.map(([t, ok, href]) => html`<li class=${ok ? 'ok' : ''}><a href=${href}>${ok ? '✓' : '○'} ${t}</a></li>`)}</ul>
          </section>` : ''}
        <div class="duas">
          <section class="bloco">
            <h2>Acesso rápido</h2>
            <div class="rapido">
              ${ctx.nivel >= 2 ? html`<button class="btn" onClick=${() => ctx.abrirAg({})}>+ Novo agendamento</button>` : ''}
              <a class="btn sec" href="#/agenda">Agenda</a>
              <a class="btn sec" href="#/agendamentos">Todos os agendamentos</a>
            </div>
            <h2>Link de agendamento</h2>
            <p class="mudo peq">Compartilhe este link com seus clientes para agendarem online.</p>
            <div class="linha"><input readonly value=${link} onFocus=${ev => ev.target.select()} />
              <button class="btn sec" onClick=${() => copiar(link, 'Link copiado!')}>Copiar</button>
              <a class="btn sec" href=${link} target="_blank">Abrir</a></div>
          </section>
          <section class="bloco">
            <h2>Próximos agendamentos</h2>
            ${d.prox.length === 0 ? html`<p class="mudo">Nenhum agendamento futuro.</p>` : html`
              <ul class="proximos">${d.prox.map(a => html`
                <li onClick=${() => ctx.abrirAg({ id: a.id })}>
                  <span class="quando"><b>${a.data.slice(8)}/${a.data.slice(5, 7)}</b>${DIAS_C[dt(a.data).getDay()]} ${h5(a.hora_inicio)}</span>
                  <span><b>${a.cliente?.nome}</b><br /><small class="mudo">${a.servicos.map(s => s.nome).join(', ')} · ${a.profissional?.nome}</small></span>
                </li>`)}</ul>`}
          </section>
        </div>
        <section class="bloco">
          <h2>Estatísticas <small class="mudo">últimos 7 dias</small></h2>
          <div class="cartoes">
            ${m('agendamentos', 'Agendamentos')}${m('concluidos', 'Concluídos')}${m('cancelados', 'Cancelados')}${m('ausentes', 'Ausentes')}
            ${m('ocupacao', 'Taxa de ocupação', x => x + '%')}${m('cancelamento', 'Taxa de cancelamento', x => x + '%')}${m('retorno', 'Taxa de retorno', x => x + '%')}
            ${m('valor_concluidos', 'Agendamentos concluídos', brl)}${ctx.nivel >= 3 ? m('recebido', 'Pagamentos recebidos', brl) : ''}${m('ticket_medio', 'Ticket médio', brl)}
          </div>
        </section>`}
    </div>`;
}

/* ---------- minha conta ---------- */
function Conta({ ctx }) {
  const f = useForm({ nome: ctx.prof.nome, telefone: ctx.prof.telefone || '', cpf: ctx.prof.cpf || '', senha: '' });
  const salvar = async () => {
    if (await tentar(() => q(db.rpc('minha_conta_salvar', { p_nome: f.v.nome, p_telefone: f.v.telefone, p_cpf: f.v.cpf })), 'Dados salvos.')) ctx.recarregar();
  };
  const trocarSenha = () => tentar(async () => {
    if (f.v.senha.length < 6) throw new Error('A senha deve ter ao menos 6 caracteres.');
    const { error } = await db.auth.updateUser({ password: f.v.senha });
    if (error) throw erroAuth(error);
    f.set('senha', '');
  }, 'Senha alterada.');
  return html`
    <div class="pagina estreita">
      <div class="titulo"><h1>Minha conta</h1></div>
      <section class="bloco">
        <h2>Dados básicos</h2>
        <${Campo} label="Nome"><input ...${f.txt('nome')} /><//>
        <div class="grade2">
          <${Campo} label="Telefone"><input ...${f.tel('telefone')} /><//>
          <${Campo} label="CPF"><input ...${f.txt('cpf')} /><//>
        </div>
        <button class="btn" onClick=${salvar}>Salvar</button>
      </section>
      <section class="bloco">
        <h2>Dados de acesso</h2>
        <${Campo} label="E-mail"><input disabled value=${ctx.email} /><//>
        <${Campo} label="Nova senha"><input type="password" autocomplete="new-password" ...${f.txt('senha')} placeholder="Mínimo de 6 caracteres" /><//>
        <button class="btn sec" onClick=${trocarSenha}>Alterar senha</button>
        <p class="mudo peq">Nível de acesso: ${NIVEIS[ctx.nivel]}</p>
      </section>
      <button class="btn sec" onClick=${() => db.auth.signOut()}>Sair da conta</button>
    </div>`;
}

/* ---------- menu e rotas ---------- */
const MENU = [
  [null, [['inicio', 'Início', 1, Inicio], ['agenda', 'Agenda', 1, Agenda], ['agendamentos', 'Agendamentos', 1, Agendamentos]]],
  ['Cadastros', [['clientes', 'Clientes', 3, Clientes], ['servicos', 'Serviços', 4, Servicos], ['categorias', 'Categorias', 4, Categorias],
    ['adicionais', 'Adicionais', 4, Adicionais], ['profissionais', 'Profissionais', 4, Profissionais]]],
  ['Gestão', [['financeiro', 'Financeiro', 3, Financeiro], ['relatorio-operacional', 'Relatório operacional', 1, RelatorioOperacional],
    ['relatorio-financeiro', 'Relatório financeiro', 3, RelatorioFinanceiro], ['logs', 'Logs', 4, Logs], ['configuracoes', 'Configurações', 4, Configuracoes]]],
  ['Conta', [['conta', 'Minha conta', 1, Conta]]],
];
const lerRota = () => location.hash.replace(/^#\/?/, '') || 'inicio';

function App() {
  const [sessao, setSessao] = useState(undefined);
  const [eu, setEu] = useState(undefined);
  const [rota, setRota] = useState(lerRota());
  const [ag, setAg] = useState(null);
  const [menu, setMenu] = useState(false);
  const [recuperar, setRecuperar] = useState(false);

  useEffect(() => {
    db.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: { subscription } } = db.auth.onAuthStateChange((ev, s) => { setSessao(s); if (ev === 'PASSWORD_RECOVERY') setRecuperar(true); });
    const f = () => { setRota(lerRota()); setMenu(false); };
    window.addEventListener('hashchange', f);
    return () => { subscription.unsubscribe(); window.removeEventListener('hashchange', f); };
  }, []);
  const recarregar = async () => { const d = await tentar(() => q(db.rpc('minha_sessao'))); setEu(d || null); };
  const uid = sessao?.user?.id;
  useEffect(() => { if (uid) recarregar(); else setEu(undefined); }, [uid]);
  const corEmpresa = eu && eu.empresa ? eu.empresa.cor_tema : null;
  useEffect(() => { aplicarTema(corEmpresa); }, [corEmpresa]);

  if (sessao === undefined) return html`<div class="entrada"><p class="mudo">Carregando…</p></div>`;
  if (recuperar) return html`<${NovaSenha} onFim=${() => setRecuperar(false)} />`;
  if (!sessao) return html`<${Entrar} />`;
  if (eu === undefined) return html`<div class="entrada"><p class="mudo">Carregando…</p></div>`;
  if (!eu || !eu.profissional) return html`<${CriarEmpresa} email=${sessao.user.email} onPronto=${recarregar} />`;

  const ctx = { prof: eu.profissional, empresa: eu.empresa, nivel: eu.profissional.nivel_acesso, email: sessao.user.email, recarregar, abrirAg: p => setAg(p) };
  const itens = MENU.flatMap(g => g[1]);
  const atual = itens.find(i => i[0] === rota && ctx.nivel >= i[2]) || itens[0];
  const Pagina = atual[3];
  const link = linkPublico(ctx.empresa.slug);
  return html`
    <div class="app ${menu ? 'menu-aberto' : ''}">
      <aside class="lateral">
        <a class="marca" href="#/inicio">${APP_NOME}</a>
        <nav>
          ${MENU.map(([grupo, its]) => {
            const vis = its.filter(i => ctx.nivel >= i[2]);
            if (!vis.length) return '';
            return html`${grupo ? html`<span class="grupo">${grupo}</span>` : ''}
              ${vis.map(i => html`<a href=${'#/' + i[0]} class=${i[0] === atual[0] ? 'on' : ''}>${i[1]}</a>`)}`;
          })}
        </nav>
        <button class="btn sec peq" onClick=${() => copiar(link, 'Link de agendamento copiado!')}>Copiar link de agendamento</button>
      </aside>
      <div class="veu" onClick=${() => setMenu(false)}></div>
      <main>
        <header class="topo">
          <button class="btn sec peq so-celular" onClick=${() => setMenu(!menu)} aria-label="Menu">☰</button>
          <b class="empresa">${ctx.empresa.nome}</b>
          <span class="espaco"></span>
          ${ctx.nivel >= 2 ? html`<button class="btn peq" onClick=${() => setAg({})}>+ Novo agendamento</button>` : ''}
          <a class="usuario" href="#/conta">${ctx.prof.nome.split(' ')[0]}</a>
        </header>
        <${Pagina} ctx=${ctx} key=${atual[0]} />
      </main>
      ${ag ? html`<${AgModal} ctx=${ctx} pref=${ag} onClose=${() => setAg(null)}
        onSalvo=${() => { setAg(null); window.dispatchEvent(new Event('ag-mudou')); }} />` : ''}
    </div>`;
}

document.title = `${APP_NOME} — painel`;
render(html`<${App} />`, document.getElementById('raiz'));

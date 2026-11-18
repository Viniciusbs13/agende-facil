// Base compartilhada: conexão com o banco, utilidades e componentes de interface.
import { html, render, useState, useEffect, useRef, useMemo } from 'https://unpkg.com/htm@3.1.1/preact/standalone.module.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export { html, render, useState, useEffect, useRef, useMemo };

// Nome do app, usado em todas as telas.
export const APP_NOME = 'Agende Fácil';

export const db = createClient(
  'https://wgdfdgfxelmjaxhkdpen.supabase.co',
  'sb_publishable_SwU5fTnYDCL4kXO36UUVqw_D6l6mU48',
  // A página pública nunca usa o login do painel: o cliente final é sempre anônimo.
  { auth: /agendar\.html$/.test(location.pathname) ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } : {} }
);

/* ---------- datas, horas, dinheiro, telefone ---------- */
const p2 = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hoje = () => iso(new Date());
export const dt = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDias = (s, n) => { const d = dt(s); d.setDate(d.getDate() + n); return iso(d); };
export const addMeses = (s, n) => { const d = dt(s); d.setMonth(d.getMonth() + n); return iso(d); };
export const fData = s => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');
export const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const DIAS_C = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const min = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
export const hm = m => `${p2(Math.floor(m / 60) % 24)}:${p2(m % 60)}`;
export const h5 = t => (t || '').slice(0, 5);
export const agoraHM = () => { const d = new Date(); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export const brl = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
export const digitos = s => String(s || '').replace(/\D/g, '');
export const fone = s => {
  const d = digitos(s);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
};
export const duracaoTxt = m => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'min' : ''}` : `${m} min`);

export const STATUS = { agendado: 'Agendado', concluido: 'Concluído', ausente: 'Ausente', cancelado: 'Cancelado' };
export const FORMAS = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência', 'Outro'];
export const NIVEIS = {
  1: 'Ver a própria agenda',
  2: 'Ver e criar agendamentos',
  3: 'Recepção',
  4: 'Acesso total',
};

/* ---------- banco ---------- */
const ERROS = {
  23505: 'Já existe um registro com esses dados.',
  23503: 'Não é possível excluir: existem registros ligados a este item.',
  42501: 'Você não tem permissão para fazer isso.',
};
export async function q(promessa) {
  const { data, error } = await promessa;
  if (error) throw new Error(ERROS[error.code] || error.message || 'Erro inesperado.');
  return data;
}
export async function tentar(fn, msgOk) {
  try {
    const r = await fn();
    if (msgOk) toast(msgOk);
    return r == null ? true : r; // gravações sem retorno (inserir, excluir) também contam como sucesso
  } catch (e) {
    toast(e.message || String(e), 'erro');
    return false;
  }
}

/* ---------- avisos ---------- */
export function toast(msg, tipo = 'ok') {
  let c = document.querySelector('.toasts');
  if (!c) { c = document.createElement('div'); c.className = 'toasts'; document.body.append(c); }
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  c.append(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 6000 : 3200);
}
export async function copiar(texto, msg = 'Copiado!') {
  try { await navigator.clipboard.writeText(texto); toast(msg); }
  catch { window.prompt('Copie o texto abaixo:', texto); }
}

/* ---------- formulários ---------- */
export function useForm(inicial) {
  const [v, setV] = useState(inicial);
  const set = (k, val) => setV(o => ({ ...o, [k]: val }));
  const txt = k => ({ value: v[k] ?? '', onInput: e => set(k, e.target.value) });
  const num = k => ({ value: v[k] ?? '', onInput: e => set(k, e.target.value === '' ? '' : Number(e.target.value)) });
  const tel = k => ({ value: fone(v[k]), onInput: e => set(k, digitos(e.target.value).slice(0, 11)), inputmode: 'tel', placeholder: '(00) 00000-0000' });
  const chk = k => ({ checked: !!v[k], onChange: e => set(k, e.target.checked) });
  return { v, set, setV, txt, num, tel, chk };
}

export const Campo = ({ label, dica, req, cls, children }) => html`
  <div class="campo ${cls || ''}">
    <label class="rot">${label}${req ? html`<b class="req"> *</b>` : ''}</label>
    ${children}
    ${dica ? html`<small>${dica}</small>` : ''}
  </div>`;

export const Chk = ({ label, dica, ...p }) => html`
  <label class="chk"><input type="checkbox" ...${p} /><span>${label}${dica ? html`<small>${dica}</small>` : ''}</span></label>`;

export function Modal({ titulo, onClose, largura, rodape, children }) {
  useEffect(() => {
    const f = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', f);
    document.body.classList.add('sem-rolagem');
    return () => { document.removeEventListener('keydown', f); document.body.classList.remove('sem-rolagem'); };
  }, []);
  return html`
    <div class="fundo-modal">
      <div class="modal" style=${largura ? `max-width:${largura}px` : ''} role="dialog" aria-label=${titulo}>
        <header><h2>${titulo}</h2><button class="x" onClick=${onClose} aria-label="Fechar">×</button></header>
        <div class="corpo">${children}</div>
        ${rodape ? html`<footer>${rodape}</footer>` : ''}
      </div>
    </div>`;
}

export function Imagem({ valor, onChange, pasta, redonda }) {
  const [env, setEnv] = useState(false);
  const enviar = async e => {
    const arq = e.target.files[0];
    if (!arq) return;
    if (arq.size > 8 * 1024 * 1024) return toast('A imagem deve ter até 8 MB.', 'erro');
    setEnv(true);
    await tentar(async () => {
      const ext = (arq.name.split('.').pop() || 'jpg').toLowerCase();
      const caminho = `${pasta}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from('imagens').upload(caminho, arq);
      if (error) throw new Error(error.message);
      onChange(db.storage.from('imagens').getPublicUrl(caminho).data.publicUrl);
    });
    setEnv(false);
    e.target.value = '';
  };
  return html`
    <div class="imagem">
      <div class="previa ${redonda ? 'redonda' : ''}" style=${valor ? `background-image:url('${valor}')` : ''}>${valor ? '' : 'Sem foto'}</div>
      <div>
        <label class="btn sec peq">${env ? 'Enviando…' : 'Alterar'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange=${enviar} disabled=${env} /></label>
        ${valor ? html` <button type="button" class="btn link peq" onClick=${() => onChange(null)}>Remover</button>` : ''}
        <small>PNG ou JPG, até 8 MB.</small>
      </div>
    </div>`;
}

// Editor de horários por dia da semana: { "1": [{ i: "08:00", f: "18:00" }], ... }
export function Horarios({ valor, onChange, fechado = 'Fechado' }) {
  const h = valor || {};
  const set = (d, faixas) => onChange({ ...h, [d]: faixas });
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  return html`
    <div class="horarios">
      ${ordem.map(d => {
        const fx = h[d] || [];
        return html`
          <div class="dia">
            <label class="chk nome"><input type="checkbox" checked=${fx.length > 0}
              onChange=${e => set(d, e.target.checked ? [{ i: '08:00', f: '18:00' }] : [])} /><span>${DIAS[d]}</span></label>
            <div class="faixas">
              ${fx.length === 0 ? html`<span class="mudo">${fechado}</span>` : ''}
              ${fx.map((f, i) => html`
                <div class="faixa">
                  <input type="time" value=${f.i} onInput=${e => set(d, fx.map((x, j) => (j === i ? { ...x, i: e.target.value } : x)))} />
                  <span>às</span>
                  <input type="time" value=${f.f} onInput=${e => set(d, fx.map((x, j) => (j === i ? { ...x, f: e.target.value } : x)))} />
                  ${fx.length > 1 ? html`<button type="button" class="btn link peq" onClick=${() => set(d, fx.filter((_, j) => j !== i))}>Remover</button>` : ''}
                </div>`)}
              ${fx.length > 0 ? html`
                <div class="acoes-dia">
                  <button type="button" class="btn link peq" onClick=${() => set(d, [...fx, { i: fx[fx.length - 1].f, f: '20:00' }])}>+ Adicionar faixa</button>
                  <button type="button" class="btn link peq" onClick=${() => onChange(Object.fromEntries(ordem.map(x => [x, fx.map(y => ({ ...y }))])))}>Copiar para todos os dias</button>
                </div>` : ''}
            </div>
          </div>`;
      })}
    </div>`;
}
export function horariosValidos(h) {
  return Object.values(h || {}).every(fx => fx.every(f => f.i && f.f && f.i < f.f));
}

/* ---------- lista com busca, paginação e exportação ---------- */
export function Lista({ colunas, linhas, onLinha, vazio = 'Nenhum registro encontrado.', filtros, nomeArquivo = 'exportacao' }) {
  const [busca, setBusca] = useState('');
  const [pag, setPag] = useState(0);
  const [tam, setTam] = useState(20);
  const texto = (c, l) => { const x = c.txt ? c.txt(l) : l[c.k]; return x == null ? '' : String(x); };
  const filtradas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (!b) return linhas || [];
    return (linhas || []).filter(l => colunas.some(c => texto(c, l).toLowerCase().includes(b)));
  }, [linhas, busca]);
  useEffect(() => setPag(0), [busca, tam, linhas]);
  const total = filtradas.length;
  const pagina = filtradas.slice(pag * tam, pag * tam + tam);
  const exportar = () => {
    const cols = colunas.filter(c => !c.semExport);
    const csv = [cols.map(c => c.label), ...filtradas.map(l => cols.map(c => texto(c, l)))]
      .map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${nomeArquivo}.csv`;
    a.click();
  };
  return html`
    <div class="lista">
      <div class="barra">
        <input type="search" placeholder="Pesquisar…" value=${busca} onInput=${e => setBusca(e.target.value)} />
        ${filtros || ''}
        <button class="btn sec peq" onClick=${exportar}>Exportar</button>
      </div>
      <div class="tabela-rolagem">
        <table>
          <thead><tr>${colunas.map(c => html`<th>${c.label}</th>`)}</tr></thead>
          <tbody>
            ${linhas == null ? html`<tr><td colspan=${colunas.length} class="mudo centro">Carregando…</td></tr>` : ''}
            ${linhas != null && total === 0 ? html`<tr><td colspan=${colunas.length} class="mudo centro">${vazio}</td></tr>` : ''}
            ${pagina.map(l => html`
              <tr class=${onLinha ? 'clicavel' : ''} onClick=${() => onLinha && onLinha(l)}>
                ${colunas.map(c => html`<td>${c.render ? c.render(l) : texto(c, l)}</td>`)}
              </tr>`)}
          </tbody>
        </table>
      </div>
      <div class="rodape-lista">
        <span class="mudo">${total === 0 ? '0 registros' : `${pag * tam + 1}–${Math.min(total, pag * tam + tam)} de ${total}`}</span>
        <span>
          <select value=${tam} onChange=${e => setTam(Number(e.target.value))}>
            ${[20, 50, 100].map(n => html`<option value=${n}>${n} por página</option>`)}
          </select>
          <button class="btn sec peq" disabled=${pag === 0} onClick=${() => setPag(pag - 1)}>‹</button>
          <button class="btn sec peq" disabled=${(pag + 1) * tam >= total} onClick=${() => setPag(pag + 1)}>›</button>
        </span>
      </div>
    </div>`;
}

export const Selo = ({ tipo, children }) => html`<span class="selo ${tipo || ''}">${children}</span>`;
export const seloStatus = s => html`<${Selo} tipo=${s}>${STATUS[s] || s}<//>`;
export function statusPagamento(total, recebido) {
  if (!recebido || recebido <= 0) return ['nao', 'Não pago'];
  if (recebido + 0.005 < Number(total)) return ['parcial', 'Pago parcial'];
  return ['pago', 'Pago total'];
}
export const linkPublico = slug => new URL(`agendar.html?e=${slug}`, location.href).href;

/* ---------- campos personalizados ---------- */
export const TIPOS_CAMPO = [['texto', 'Texto'], ['numero', 'Número'], ['data', 'Data'], ['sim_nao', 'Sim ou não']];
export function CamposExtras({ campos, valor, onChange }) {
  const v = valor || {};
  const set = (k, x) => onChange({ ...v, [k]: x });
  return html`${(campos || []).map(c => html`
    <${Campo} label=${c.nome} req=${c.obrigatorio}>
      ${c.tipo === 'sim_nao'
        ? html`<select value=${v[c.nome] ?? ''} onChange=${e => set(c.nome, e.target.value)}><option value="">Selecione</option><option value="Sim">Sim</option><option value="Não">Não</option></select>`
        : html`<input type=${c.tipo === 'numero' ? 'number' : c.tipo === 'data' ? 'date' : 'text'} value=${v[c.nome] ?? ''} onInput=${e => set(c.nome, e.target.value)} />`}
    <//>`)}`;
}
export const camposFaltando = (campos, valor) => (campos || []).filter(c => c.obrigatorio && !String((valor || {})[c.nome] ?? '').trim()).map(c => c.nome);

/* ---------- mensagens de WhatsApp ---------- */
export const MSG_TIPOS = [
  ['confirmacao', 'Confirmação de agendamento', 'Para enviar quando o agendamento é criado.'],
  ['lembrete', 'Lembrete de agendamento próximo', 'Para avisar o cliente antes do horário marcado.'],
  ['cancelamento', 'Cancelamento de agendamento', 'Para avisar que o agendamento foi cancelado.'],
  ['remarcacao', 'Remarcação de agendamento', 'Para avisar a nova data e horário.'],
  ['conclusao', 'Agendamento concluído', 'Agradecimento depois do atendimento.'],
  ['convite', 'Convite para agendar de novo', 'Para clientes que não voltam há algum tempo.'],
  ['aniversario', 'Mensagem de aniversário', 'Para o dia do aniversário do cliente.'],
];
const ASS = '\n\n[nome_empresa]';
export const MSG_PADRAO = {
  confirmacao: { ativo: true, texto: 'Olá, [nome_cliente]! Seu agendamento está confirmado.\n\n[nome_serviços]\n[dia_semana], [data_agendamento] às [hora_inicio]\nProfissional: [nome_profissional]' + ASS },
  lembrete: { ativo: true, texto: 'Olá, [nome_cliente]! Passando para lembrar do seu horário: [nome_serviços], [dia_semana] ([data_agendamento]) às [hora_inicio], com [nome_profissional].' + ASS },
  cancelamento: { ativo: true, texto: 'Olá, [nome_cliente]. Seu agendamento de [data_agendamento] às [hora_inicio] foi cancelado. Para marcar outro horário: [link_agendamento]' + ASS },
  remarcacao: { ativo: true, texto: 'Olá, [nome_cliente]! Seu agendamento foi remarcado para [dia_semana], [data_agendamento] às [hora_inicio], com [nome_profissional].' + ASS },
  conclusao: { ativo: true, texto: 'Obrigado pela visita, [nome_cliente]! Quando quiser voltar, é só agendar: [link_agendamento]' + ASS },
  convite: { ativo: true, texto: 'Olá, [nome_cliente]! Já faz um tempo desde a sua última visita. Que tal agendar um novo horário? [link_agendamento]' + ASS },
  aniversario: { ativo: true, texto: 'Feliz aniversário, [nome_cliente]! Toda a equipe deseja um dia muito especial.' + ASS },
};
export const VARIAVEIS = [
  ['[nome_cliente]', 'Nome do cliente'], ['[telefone_cliente]', 'Telefone do cliente'], ['[nome_serviços]', 'Serviços agendados'], ['[adicionais]', 'Serviços adicionais'],
  ['[data_agendamento]', 'Data do agendamento'], ['[dia_semana]', 'Dia da semana'], ['[hora_inicio]', 'Hora de início'], ['[hora_fim]', 'Hora final'],
  ['[valor_agendamento]', 'Valor total'], ['[observacoes_agendamento]', 'Observações do agendamento'], ['[nome_profissional]', 'Nome do profissional'],
  ['[nome_empresa]', 'Nome da empresa'], ['[link_agendamento]', 'Link de agendamento'], ['[pix_chave]', 'Chave PIX'], ['[pix_valor_pagamento]', 'Valor a pagar no PIX'], ['[pix_instrucoes]', 'Instruções do PIX'],
];
export const modeloMsg = (empresa, tipo) => ({ ...MSG_PADRAO[tipo], ...((empresa.config.mensagens || {})[tipo] || {}) });
export function montarMensagem(texto, { ag = {}, cliente = {}, prof = {}, empresa }) {
  const pix = empresa.config.pix || {};
  const v = {
    nome_cliente: cliente.nome, telefone_cliente: fone(cliente.telefone), 'nome_serviços': (ag.servicos || []).map(x => x.nome).join(', '), nome_servicos: (ag.servicos || []).map(x => x.nome).join(', '),
    adicionais: (ag.adicionais || []).map(x => x.nome).join(', '), data_agendamento: fData(ag.data), dia_semana: ag.data ? DIAS[dt(ag.data).getDay()] : '',
    hora_inicio: h5(ag.hora_inicio), hora_fim: h5(ag.hora_fim), valor_agendamento: brl(ag.valor_total), observacoes_agendamento: ag.observacoes || '',
    nome_profissional: prof?.nome, telefone_profissional: fone(prof?.telefone), nome_empresa: empresa.nome, link_agendamento: linkPublico(empresa.slug),
    pix_chave: pix.chave || '', pix_valor_pagamento: brl(valorPix(pix, ag.valor_total)), pix_instrucoes: pix.instrucoes || '',
  };
  return String(texto || '').replace(/\[([^\]]+)\]/g, (m, k) => (k in v ? v[k] ?? '' : m)).replace(/\n{3,}/g, '\n\n').trim();
}
export const abrirZap = (tel, texto) => window.open(`https://wa.me/55${digitos(tel)}?text=${encodeURIComponent(texto)}`, '_blank');

/* ---------- PIX (cobrança manual: código copia e cola) ---------- */
export function valorPix(pix, total) {
  const t = Number(total) || 0;
  if (!pix) return 0;
  if (pix.tipo === 'fixo') return Math.min(t, Number(pix.valor_fixo) || 0);
  if (pix.tipo === 'percentual') return Math.round(t * (Number(pix.percentual) || 0)) / 100;
  return t;
}
const limpo = (t, n) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, n);
const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
function crc16(s) {
  let c = 0xffff;
  for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (let b = 0; b < 8; b++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; }
  return c.toString(16).toUpperCase().padStart(4, '0');
}
export function pixCopiaCola(pix, valor, nomePadrao) {
  let chave = String(pix.chave || '').trim();
  if (!chave) return '';
  if (pix.tipo_chave === 'telefone') chave = '+55' + digitos(chave).replace(/^55(?=\d{10,11}$)/, '');
  else if (pix.tipo_chave === 'cpf' || pix.tipo_chave === 'cnpj') chave = digitos(chave);
  else if (pix.tipo_chave === 'email') chave = chave.toLowerCase();
  const corpo = tlv('00', '01') + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', chave)) + tlv('52', '0000') + tlv('53', '986')
    + tlv('54', Number(valor).toFixed(2)) + tlv('58', 'BR') + tlv('59', limpo(pix.nome || nomePadrao, 25) || 'RECEBEDOR') + tlv('60', limpo(pix.cidade, 15) || 'BRASIL')
    + tlv('62', tlv('05', '***')) + '6304';
  return corpo + crc16(corpo);
}

/* ---------- ramo e cor da empresa ---------- */
export const RAMOS = ['Barbearia', 'Salão de beleza', 'Cabeleireiro(a)', 'Nail Designer / Esmalteria', 'Designer de Sobrancelhas', 'Lash Designer / Cílios', 'Trancista',
  'Maquiagem', 'Estética / Depilação', 'Massoterapia / Massagem', 'Podologia', 'Saúde / Consultório', 'Psicologia / Terapia', 'Nutrição', 'Personal / Academia',
  'Tatuagem / Piercing', 'Pet Shop / Banho e tosa', 'Fotografia', 'Lava-jato / Estética Automotiva', 'Aulas / Consultoria'];
export const CORES_TEMA = ['#5b4bff', '#7c3aed', '#c026d3', '#e0457b', '#dc2626', '#ea580c', '#b45309', '#0d9488', '#059669', '#0284c7', '#2563eb', '#1f2937'];
export const COR_POR_RAMO = { 'Barbearia': '#b45309', 'Salão de beleza': '#c026d3', 'Cabeleireiro(a)': '#7c3aed', 'Nail Designer / Esmalteria': '#e0457b', 'Designer de Sobrancelhas': '#b45309',
  'Lash Designer / Cílios': '#c026d3', 'Trancista': '#ea580c', 'Maquiagem': '#e0457b', 'Estética / Depilação': '#0d9488', 'Massoterapia / Massagem': '#059669', 'Podologia': '#0284c7',
  'Saúde / Consultório': '#2563eb', 'Psicologia / Terapia': '#0d9488', 'Nutrição': '#059669', 'Personal / Academia': '#dc2626', 'Tatuagem / Piercing': '#1f2937',
  'Pet Shop / Banho e tosa': '#ea580c', 'Fotografia': '#1f2937', 'Lava-jato / Estética Automotiva': '#0284c7', 'Aulas / Consultoria': '#5b4bff' };

// Aplica a cor da empresa em toda a tela e escolhe texto claro ou escuro para manter a leitura.
export function aplicarTema(cor) {
  const c = /^#[0-9a-f]{6}$/i.test(cor || '') ? cor : '#5b4bff';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  const st = document.documentElement.style;
  st.setProperty('--tema', c); st.setProperty('--marca', c);
  st.setProperty('--sobre', 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#15142b' : '#fff');
}

export function SeletorRamo({ valor, onChange }) {
  const [outro, setOutro] = useState(!!valor && !RAMOS.includes(valor));
  return html`
    <select value=${outro ? '__outro' : valor || ''} onChange=${e => { const x = e.target.value; setOutro(x === '__outro'); onChange(x === '__outro' ? '' : x); }}>
      <option value="">Selecione</option>
      ${RAMOS.map(r => html`<option value=${r}>${r}</option>`)}
      <option value="__outro">Outro (escrever)</option>
    </select>
    ${outro ? html`<input value=${valor || ''} onInput=${e => onChange(e.target.value)} placeholder="Escreva o que a sua empresa faz" maxlength="60" />` : ''}`;
}

export function SeletorCor({ valor, onChange }) {
  const v = (valor || '').toLowerCase();
  return html`
    <div class="cores">
      ${CORES_TEMA.map(c => html`<button type="button" class="cor ${c === v ? 'on' : ''}" style=${`background:${c}`} aria-label=${`Usar a cor ${c}`} aria-pressed=${c === v} onClick=${() => onChange(c)}></button>`)}
      <label class="cor-livre" title="Escolher outra cor"><input type="color" value=${/^#[0-9a-f]{6}$/.test(v) ? v : '#5b4bff'} onInput=${e => onChange(e.target.value)} /><span>Outra cor</span></label>
    </div>`;
}

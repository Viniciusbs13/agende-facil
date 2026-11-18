// Relatórios operacional e financeiro, com gráficos, exportação e impressão (salvar em PDF).
import { html, useState, useEffect, useMemo, db, q, tentar, brl, fData, hoje, dt, addDias, h5, DIAS_C, MESES, STATUS } from './lib.js';

const diasEntre = (a, b) => Math.round((dt(b) - dt(a)) / 864e5);
const pct = x => (x == null ? '—' : `${x}%`);

function Ind({ rot, atual, anterior, fmt = x => x, inverso }) {
  let d = null;
  if (atual != null && anterior != null) d = anterior ? Math.round(((atual - anterior) / Math.abs(anterior)) * 100) : atual ? 100 : 0;
  const bom = inverso ? d < 0 : d > 0, ruim = inverso ? d > 0 : d < 0;
  return html`<div class="cartao"><span>${rot}</span><b>${atual == null ? '—' : fmt(atual)}</b>
    <small class=${bom ? 'sobe' : ruim ? 'desce' : 'mudo'}>${d == null ? '' : `${d > 0 ? '+' : ''}${d}% `}<span class="mudo">vs. período anterior</span></small></div>`;
}

function Colunas({ dados, fmt = x => x, legenda }) {
  const max = Math.max(1, ...dados.flatMap(d => [d.v, d.v2 || 0]));
  const passo = Math.ceil(dados.length / 12);
  if (!dados.some(d => d.v || d.v2)) return html`<p class="mudo">Sem dados no período.</p>`;
  return html`
    ${legenda ? html`<div class="legenda"><span><i></i>${legenda[0]}</span><span><i class="b2"></i>${legenda[1]}</span></div>` : ''}
    <div class="graf-col">${dados.map((d, i) => html`
      <div class="gc" title=${`${d.t || d.r}: ${fmt(d.v)}${d.v2 != null ? ` / ${fmt(d.v2)}` : ''}`}>
        <div class="pilha"><i style=${`height:${(d.v / max) * 100}%`}></i>${d.v2 != null ? html`<i class="b2" style=${`height:${(d.v2 / max) * 100}%`}></i>` : ''}</div>
        <span>${i % passo === 0 ? d.r : ''}</span>
      </div>`)}</div>`;
}
function Barras({ dados, fmt = x => x }) {
  const max = Math.max(1, ...dados.map(d => d.v));
  if (!dados.length) return html`<p class="mudo">Sem dados no período.</p>`;
  return html`<div class="graf-bar">${dados.map(d => html`
    <div class="gb"><span class="rot">${d.r}</span><div class="trilho"><i style=${`width:${(d.v / max) * 100}%`}></i></div><b>${fmt(d.v)}</b></div>`)}</div>`;
}

function Periodo({ de, ate, setDe, setAte, children }) {
  const atalho = (n, t) => html`<button class="btn sec peq" onClick=${() => { setDe(addDias(hoje(), -n + 1)); setAte(hoje()); }}>${t}</button>`;
  return html`
    <div class="barra-agenda nao-imprimir">
      <label class="filtro">De <input type="date" value=${de} onInput=${e => e.target.value && setDe(e.target.value)} /></label>
      <label class="filtro">Até <input type="date" value=${ate} onInput=${e => e.target.value && setAte(e.target.value)} /></label>
      ${atalho(7, '7 dias')}${atalho(30, '30 dias')}${atalho(90, '90 dias')}
      ${children}
    </div>`;
}
function exportarCsv(nome, cab, linhas) {
  const csv = [cab, ...linhas].map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${nome}.csv`;
  a.click();
}
// série por dia (ou por mês, quando o período é longo)
function serie(de, ate, itens, valor = () => 1, valor2) {
  const porMes = diasEntre(de, ate) > 62;
  const mapa = new Map();
  if (porMes) { for (let d = de.slice(0, 7); d <= ate.slice(0, 7);) { mapa.set(d, [0, 0]); const [y, m] = d.split('-').map(Number); d = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; } }
  else for (let d = de; d <= ate; d = addDias(d, 1)) mapa.set(d, [0, 0]);
  itens.forEach(x => { const k = porMes ? x.data.slice(0, 7) : x.data; const c = mapa.get(k); if (c) { c[0] += valor(x); if (valor2) c[1] += valor2(x); } });
  return [...mapa].map(([k, [v, v2]]) => ({ r: porMes ? `${MESES[Number(k.slice(5)) - 1].slice(0, 3)}/${k.slice(2, 4)}` : `${k.slice(8)}/${k.slice(5, 7)}`, t: porMes ? k : fData(k), v, ...(valor2 ? { v2 } : {}) }));
}

/* ================= operacional ================= */
export function RelatorioOperacional({ ctx }) {
  const [de, setDe] = useState(addDias(hoje(), -29));
  const [ate, setAte] = useState(hoje());
  const [prof, setProf] = useState('');
  const [serv, setServ] = useState('');
  const [base, setBase] = useState(null);
  const [d, setD] = useState(null);
  useEffect(() => { tentar(async () => {
    const [profs, servicos] = await Promise.all([q(db.from('profissionais').select('id,nome,comissao').order('nome')), q(db.from('servicos').select('id,nome,comissao').order('nome'))]);
    setBase({ profs: ctx.nivel >= 3 ? profs : profs.filter(p => p.id === ctx.prof.id), servicos });
  }); }, []);
  useEffect(() => { tentar(async () => {
    const n = diasEntre(de, ate) + 1;
    const arg = (a, b) => ({ p_inicio: a, p_fim: b, p_prof: prof || null, p_servico: serv || null });
    const [ags, atual, ant] = await Promise.all([
      q(db.from('agendamentos').select('id,data,hora_inicio,status,valor_total,servicos,profissional_id,cliente:clientes(nome)').gte('data', de).lte('data', ate).order('data').limit(5000)),
      q(db.rpc('estatisticas', arg(de, ate))), q(db.rpc('estatisticas', arg(addDias(de, -n), addDias(de, -1)))),
    ]);
    setD({ ags, atual, ant });
  }); }, [de, ate, prof, serv]);

  const r = useMemo(() => {
    if (!d || !base) return null;
    const ags = d.ags.filter(a => (!prof || a.profissional_id === prof) && (!serv || a.servicos.some(s => s.id === serv)));
    const validos = ags.filter(a => a.status !== 'cancelado');
    const horas = validos.map(a => Number(h5(a.hora_inicio).slice(0, 2)));
    const h0 = horas.length ? Math.min(...horas) : 8, h1 = horas.length ? Math.max(...horas) : 18;
    const modoServico = ctx.empresa.config.modo_comissao === 'servico';
    const comissao = a => {
      if (!modoServico) return Number(a.valor_total) * (Number(base.profs.find(p => p.id === a.profissional_id)?.comissao) || 0) / 100;
      const soma = a.servicos.reduce((t, s) => t + Number(s.preco), 0);
      return a.servicos.reduce((t, s) => t + Number(a.valor_total) * (soma ? Number(s.preco) / soma : 1 / a.servicos.length) * (Number(base.servicos.find(x => x.id === s.id)?.comissao) || 0) / 100, 0);
    };
    return {
      ags,
      porDia: serie(de, ate, validos),
      porSemana: [1, 2, 3, 4, 5, 6, 0].map(n => ({ r: DIAS_C[n], v: validos.filter(a => dt(a.data).getDay() === n).length })),
      porHora: Array.from({ length: h1 - h0 + 1 }, (_, i) => ({ r: `${String(h0 + i).padStart(2, '0')}h`, v: horas.filter(h => h === h0 + i).length })),
      porProf: base.profs.map(p => ({ r: p.nome, v: validos.filter(a => a.profissional_id === p.id).length })).filter(x => x.v).sort((a, b) => b.v - a.v),
      porServ: base.servicos.map(s => ({ r: s.nome, v: validos.filter(a => a.servicos.some(x => x.id === s.id)).length })).filter(x => x.v).sort((a, b) => b.v - a.v),
      equipe: base.profs.map(p => {
        const c = ags.filter(a => a.profissional_id === p.id && a.status === 'concluido');
        const receita = c.reduce((t, a) => t + Number(a.valor_total), 0), com = c.reduce((t, a) => t + comissao(a), 0);
        return { nome: p.nome, n: c.length, receita, com, perc: receita ? Math.round((com / receita) * 100) : 0 };
      }),
    };
  }, [d, base, prof, serv]);

  const exportar = () => exportarCsv('relatorio-operacional', ['ID', 'Data', 'Hora', 'Status', 'Cliente', 'Profissional', 'Serviços', 'Valor'],
    r.ags.map(a => [a.id, fData(a.data), h5(a.hora_inicio), STATUS[a.status], a.cliente?.nome, base.profs.find(p => p.id === a.profissional_id)?.nome, a.servicos.map(s => s.nome).join(', '), String(a.valor_total).replace('.', ',')]));

  return html`
    <div class="pagina larga relatorio">
      <div class="titulo"><div><h1>Relatório operacional</h1><p class="mudo so-impressao">${ctx.empresa.nome} — ${fData(de)} a ${fData(ate)}</p></div>
        <button class="btn sec nao-imprimir" disabled=${!r} onClick=${exportar}>Exportar</button>
        <button class="btn nao-imprimir" onClick=${() => window.print()}>Imprimir ou salvar PDF</button></div>
      <${Periodo} de=${de} ate=${ate} setDe=${setDe} setAte=${setAte}>
        ${base && base.profs.length > 1 ? html`<select value=${prof} onChange=${e => setProf(e.target.value)}><option value="">Profissional (todos)</option>${base.profs.map(p => html`<option value=${p.id}>${p.nome}</option>`)}</select>` : ''}
        ${base ? html`<select value=${serv} onChange=${e => setServ(e.target.value)}><option value="">Serviços (todos)</option>${base.servicos.map(s => html`<option value=${s.id}>${s.nome}</option>`)}</select>` : ''}
      <//>
      ${!r ? html`<p class="mudo">Carregando…</p>` : html`
        <div class="cartoes">
          <${Ind} rot="Agendamentos" atual=${d.atual.agendamentos} anterior=${d.ant.agendamentos} />
          <${Ind} rot="Concluídos" atual=${d.atual.concluidos} anterior=${d.ant.concluidos} />
          <${Ind} rot="Cancelados" atual=${d.atual.cancelados} anterior=${d.ant.cancelados} inverso />
          <${Ind} rot="Ausentes" atual=${d.atual.ausentes} anterior=${d.ant.ausentes} inverso />
          <${Ind} rot="Taxa de ocupação" atual=${d.atual.ocupacao} anterior=${d.ant.ocupacao} fmt=${pct} />
          <${Ind} rot="Taxa de cancelamento" atual=${d.atual.cancelamento} anterior=${d.ant.cancelamento} fmt=${pct} inverso />
          <${Ind} rot="Taxa de retorno" atual=${d.atual.retorno} anterior=${d.ant.retorno} fmt=${pct} />
          <${Ind} rot="Agendamentos concluídos" atual=${d.atual.valor_concluidos} anterior=${d.ant.valor_concluidos} fmt=${brl} />
          ${ctx.nivel >= 3 ? html`<${Ind} rot="Pagamentos recebidos" atual=${d.atual.recebido} anterior=${d.ant.recebido} fmt=${brl} />` : ''}
          <${Ind} rot="Ticket médio" atual=${d.atual.ticket_medio} anterior=${d.ant.ticket_medio} fmt=${brl} />
        </div>
        <section class="bloco"><h2>Agendamentos por dia</h2><${Colunas} dados=${r.porDia} /></section>
        <div class="duas">
          <section class="bloco"><h2>Por dia da semana</h2><${Colunas} dados=${r.porSemana} /></section>
          <section class="bloco"><h2>Por hora do dia</h2><${Colunas} dados=${r.porHora} /></section>
          <section class="bloco"><h2>Por profissional</h2><${Barras} dados=${r.porProf} /></section>
          <section class="bloco"><h2>Por serviço</h2><${Barras} dados=${r.porServ} /></section>
        </div>
        <section class="bloco"><h2>Profissionais</h2>
          <div class="tabela-rolagem"><table>
            <thead><tr><th>Profissional</th><th>Agendamentos concluídos</th><th>Receita total</th><th>Comissão</th></tr></thead>
            <tbody>${r.equipe.map(p => html`<tr><td>${p.nome}</td><td>${p.n}</td><td>${brl(p.receita)}</td><td>${brl(p.com)} <span class="mudo">(${p.perc}%)</span></td></tr>`)}</tbody>
          </table></div>
          <p class="mudo peq">Comissão calculada ${ctx.empresa.config.modo_comissao === 'servico' ? 'por serviço' : 'por profissional'}, sobre agendamentos concluídos.</p>
        </section>`}
    </div>`;
}

/* ================= financeiro ================= */
export function RelatorioFinanceiro({ ctx }) {
  const [de, setDe] = useState(addDias(hoje(), -29));
  const [ate, setAte] = useState(hoje());
  const [d, setD] = useState(null);
  useEffect(() => { tentar(async () => {
    const n = diasEntre(de, ate) + 1;
    const busca = (a, b) => q(db.from('lancamentos').select('id,tipo,data,categoria,descricao,forma_pagamento,valor,status').gte('data', a).lte('data', b).order('data').limit(10000));
    const [atual, ant] = await Promise.all([busca(de, ate), busca(addDias(de, -n), addDias(de, -1))]);
    setD({ atual, ant });
  }); }, [de, ate]);
  const r = useMemo(() => {
    if (!d) return null;
    const soma = (ls, t, s = 'pago') => ls.filter(l => l.tipo === t && l.status === s).reduce((x, l) => x + Number(l.valor), 0);
    const agrupar = (ls, campo) => Object.entries(ls.reduce((m, l) => ({ ...m, [l[campo]]: (m[l[campo]] || 0) + Number(l.valor) }), {})).map(([r, v]) => ({ r, v })).sort((a, b) => b.v - a.v);
    const pagos = d.atual.filter(l => l.status === 'pago');
    return {
      rec: soma(d.atual, 'receita'), des: soma(d.atual, 'despesa'), pend: soma(d.atual, 'despesa', 'pendente'),
      recA: soma(d.ant, 'receita'), desA: soma(d.ant, 'despesa'),
      porDia: serie(de, ate, pagos, l => (l.tipo === 'receita' ? Number(l.valor) : 0), l => (l.tipo === 'despesa' ? Number(l.valor) : 0)),
      porForma: agrupar(pagos.filter(l => l.tipo === 'receita'), 'forma_pagamento'),
      porCat: agrupar(d.atual.filter(l => l.tipo === 'despesa'), 'categoria'),
    };
  }, [d]);
  const exportar = () => exportarCsv('relatorio-financeiro', ['Tipo', 'Data', 'Categoria', 'Descrição', 'Forma de pagamento', 'Valor', 'Status'],
    d.atual.map(l => [l.tipo === 'receita' ? 'Receita' : 'Despesa', fData(l.data), l.categoria, l.descricao, l.forma_pagamento, String(l.valor).replace('.', ','), l.status === 'pago' ? 'Pago' : 'Pendente']));
  return html`
    <div class="pagina larga relatorio">
      <div class="titulo"><div><h1>Relatório financeiro</h1><p class="mudo so-impressao">${ctx.empresa.nome} — ${fData(de)} a ${fData(ate)}</p></div>
        <button class="btn sec nao-imprimir" disabled=${!r} onClick=${exportar}>Exportar</button>
        <button class="btn nao-imprimir" onClick=${() => window.print()}>Imprimir ou salvar PDF</button></div>
      <${Periodo} de=${de} ate=${ate} setDe=${setDe} setAte=${setAte} />
      ${!r ? html`<p class="mudo">Carregando…</p>` : html`
        <div class="cartoes">
          <${Ind} rot="Receitas" atual=${r.rec} anterior=${r.recA} fmt=${brl} />
          <${Ind} rot=${`Despesas (${brl(r.pend)} pendente)`} atual=${r.des} anterior=${r.desA} fmt=${brl} inverso />
          <${Ind} rot="Lucro" atual=${r.rec - r.des} anterior=${r.recA - r.desA} fmt=${brl} />
        </div>
        <section class="bloco"><h2>Receitas e despesas</h2><${Colunas} dados=${r.porDia} fmt=${brl} legenda=${['Receitas', 'Despesas']} /></section>
        <div class="duas">
          <section class="bloco"><h2>Receita por forma de pagamento</h2><${Barras} dados=${r.porForma} fmt=${brl} /></section>
          <section class="bloco"><h2>Despesas por categoria</h2><${Barras} dados=${r.porCat} fmt=${brl} /></section>
        </div>`}
    </div>`;
}

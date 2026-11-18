// Agenda (dia/semana/mês), criação e edição de agendamentos, bloqueios e lista de agendamentos.
import { html, useState, useEffect, useMemo, useRef, db, q, tentar, toast, useForm, Campo, Chk, Modal, Lista, Selo, seloStatus, statusPagamento,
  brl, fone, digitos, fData, hoje, iso, dt, addDias, addMeses, min, hm, h5, agoraHM, duracaoTxt, DIAS, DIAS_C, MESES, STATUS, FORMAS,
  CamposExtras, camposFaltando, MSG_TIPOS, modeloMsg, montarMensagem, abrirZap } from './lib.js';

const PERIODOS = { semanas: 'Semanas', quinzenas: 'Quinzenas', d21: 'A cada 21 dias', meses: 'Meses', semestres: 'Semestres' };
const proximaData = (base, periodo, n) => ({
  semanas: () => addDias(base, 7 * n), quinzenas: () => addDias(base, 14 * n), d21: () => addDias(base, 21 * n),
  meses: () => addMeses(base, n), semestres: () => addMeses(base, 6 * n),
}[periodo]());

/* ================= modal de agendamento ================= */
export function AgModal({ ctx, pref, onClose, onSalvo }) {
  const [cat, setCat] = useState(null); // catálogo: serviços, adicionais, profissionais
  const [oc, setOc] = useState(false);
  const [livres, setLivres] = useState(null);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState([]);
  const [np, setNp] = useState(null); // novo pagamento em edição
  const f = useForm({
    id: pref.id || null, tipo: 'agendamento', status: 'agendado',
    profissional_id: pref.profissional_id || (ctx.nivel < 3 ? ctx.prof.id : ''),
    data: pref.data || hoje(), hora_inicio: pref.hora || '', hora_fim: '', fimManual: false,
    servs: [], adics: [], valor_total: 0, valorManual: false, observacoes: '',
    cliente: null, novoCli: { nome: '', telefone: '', nascimento: '' },
    rec: { ativo: false, vezes: 4, periodo: 'semanas', remarcar: false },
    pagamentos: [], novosPag: [], antigos: { servicos: [], adicionais: [] }, campos: {}, msgTipo: 'confirmacao',
  });
  const v = f.v;
  const podeEditar = ctx.nivel >= 2;
  const podePagar = ctx.nivel >= 3;

  useEffect(() => { tentar(async () => {
    const [servicos, adicionais, profissionais, campos] = await Promise.all([
      q(db.from('servicos').select('id,nome,preco,duracao,sob_consulta,ativo,servico_profissional(profissional_id),adicional_servico(adicional_id)').order('ordem').order('nome')),
      q(db.from('adicionais').select('id,nome,preco,duracao,ativo').order('nome')),
      q(db.from('profissionais').select('id,nome,telefone,ativo').order('nome')),
      q(db.from('campos_personalizados').select('*').order('ordem').order('nome')),
    ]);
    if (pref.id) {
      const a = await q(db.from('agendamentos').select('*, cliente:clientes(id,nome,telefone,nascimento)').eq('id', pref.id).single());
      const pagamentos = ctx.nivel >= 3 ? await q(db.from('lancamentos').select('*').eq('agendamento_id', pref.id).order('data')) : [];
      f.setV(o => ({ ...o, ...a, hora_inicio: h5(a.hora_inicio), hora_fim: h5(a.hora_fim), fimManual: true, valorManual: true,
        servs: a.servicos.map(s => s.id), adics: a.adicionais.map(s => s.id), cliente: a.cliente, pagamentos,
        antigos: { servicos: a.servicos, adicionais: a.adicionais }, observacoes: a.observacoes || '' }));
    }
    setCat({ servicos, adicionais, profissionais, campos });
  }); }, []);

  // duração e valor acompanham os serviços escolhidos
  const totais = useMemo(() => {
    if (!cat) return { dur: 0, valor: 0 };
    const item = (lista, antigos, id) => lista.find(x => x.id === id) || antigos.find(x => x.id === id) || { preco: 0, duracao: 0 };
    const ss = v.servs.map(id => item(cat.servicos, v.antigos.servicos, id));
    const aa = v.adics.map(id => item(cat.adicionais, v.antigos.adicionais, id));
    return { dur: [...ss, ...aa].reduce((t, x) => t + Number(x.duracao || 0), 0),
      valor: [...ss.filter(s => !s.sob_consulta), ...aa].reduce((t, x) => t + Number(x.preco || 0), 0) };
  }, [cat, v.servs, v.adics]);
  useEffect(() => {
    if (!cat) return;
    f.setV(o => ({ ...o,
      hora_fim: !o.fimManual && o.hora_inicio && totais.dur ? hm(min(o.hora_inicio) + totais.dur) : o.hora_fim,
      valor_total: o.valorManual ? o.valor_total : totais.valor }));
  }, [totais, v.hora_inicio]);

  // busca de cliente
  useEffect(() => {
    const t = busca.trim().replace(/[,()%*]/g, '');
    if (t.length < 2) return setAchados([]);
    const id = setTimeout(async () => {
      const d = digitos(t);
      const filtro = d.length >= 3 ? `nome.ilike.%${t}%,telefone.ilike.%${d}%` : `nome.ilike.%${t}%`;
      const { data } = await db.from('clientes').select('id,nome,telefone,nascimento').or(filtro).order('nome').limit(8);
      setAchados(data || []);
    }, 250);
    return () => clearTimeout(id);
  }, [busca]);

  const alternar = (k, id) => f.setV(o => ({ ...o, [k]: o[k].includes(id) ? o[k].filter(x => x !== id) : [...o[k], id], fimManual: false, valorManual: false }));
  const adicsPossiveis = cat ? cat.adicionais.filter(a => a.ativo && v.servs.some(sid => cat.servicos.find(s => s.id === sid)?.adicional_servico.some(x => x.adicional_id === a.id))) : [];
  const profsPossiveis = cat ? cat.profissionais.filter(p => (p.ativo || p.id === v.profissional_id)
    && v.servs.every(sid => { const s = cat.servicos.find(x => x.id === sid); return !s || s.servico_profissional.some(x => x.profissional_id === p.id); })) : [];

  const verLivres = () => tentar(async () => {
    if (!v.data) throw new Error('Escolha a data primeiro.');
    const r = await q(db.rpc('horarios_livres', { p_data: v.data, p_servicos: v.servs, p_adicionais: v.adics, p_prof: v.profissional_id || null, p_ignorar: v.id }));
    setLivres([...new Set(r.map(x => x.hora))]);
  });

  const recebido = [...v.pagamentos, ...v.novosPag].reduce((t, p) => t + Number(p.valor || 0), 0);
  const [spTipo, spTxt] = statusPagamento(v.valor_total, recebido);

  const snapshot = (ids, lista, antigos) => ids.map(id => {
    const x = lista.find(i => i.id === id) || antigos.find(i => i.id === id);
    return { id, nome: x?.nome || 'Item removido', preco: Number(x?.preco || 0), duracao: Number(x?.duracao || 0) };
  });

  const salvar = async () => {
    if (!v.servs.length) return toast('Escolha ao menos um serviço.', 'erro');
    if (!v.profissional_id) return toast('Escolha o profissional.', 'erro');
    if (!v.data || !v.hora_inicio || !v.hora_fim) return toast('Informe data, hora de início e hora final.', 'erro');
    if (v.hora_fim <= v.hora_inicio) return toast('A hora final deve ser depois da hora de início.', 'erro');
    if (!v.cliente && (!v.novoCli.nome.trim() || digitos(v.novoCli.telefone).length < 10)) return toast('Selecione um cliente ou informe nome e telefone com DDD.', 'erro');
    const falta = camposFaltando(cat.campos, v.campos);
    if (falta.length) return toast(`Preencha: ${falta.join(', ')}.`, 'erro');
    setOc(true);
    const ok = await tentar(async () => {
      let clienteId = v.cliente?.id;
      if (!clienteId) {
        const tel = digitos(v.novoCli.telefone);
        const existe = await q(db.from('clientes').select('id').eq('telefone', tel).maybeSingle());
        clienteId = existe?.id || (await q(db.from('clientes').insert({ empresa_id: ctx.empresa.id, nome: v.novoCli.nome.trim(), telefone: tel,
          nascimento: v.novoCli.nascimento || null }).select('id').single())).id;
      }
      const base = { cliente_id: clienteId, profissional_id: v.profissional_id, tipo: v.tipo, status: v.status, data: v.data,
        hora_inicio: v.hora_inicio, hora_fim: v.hora_fim, servicos: snapshot(v.servs, cat.servicos, v.antigos.servicos),
        adicionais: snapshot(v.adics, cat.adicionais, v.antigos.adicionais), valor_total: Number(v.valor_total) || 0,
        observacoes: v.observacoes.trim() || null, campos: v.campos || {} };
      let id = v.id;
      const avisos = [];
      if (id) {
        await q(db.from('agendamentos').update(base).eq('id', id));
      } else {
        const rec = v.rec.ativo && Number(v.rec.vezes) > 0 ? crypto.randomUUID() : null;
        id = (await q(db.from('agendamentos').insert({ ...base, empresa_id: ctx.empresa.id, recorrencia_id: rec }).select('id').single())).id;
        if (rec) {
          const dur = min(v.hora_fim) - min(v.hora_inicio);
          for (let n = 1; n <= Math.min(Number(v.rec.vezes), 52); n++) {
            const data = proximaData(v.data, v.rec.periodo, n);
            const linha = { ...base, empresa_id: ctx.empresa.id, recorrencia_id: rec, data, status: 'agendado' };
            const { error } = await db.from('agendamentos').insert(linha);
            if (!error) continue;
            if (!v.rec.remarcar) { avisos.push(`${fData(data)}: horário ocupado, não criado`); continue; }
            const { data: lv } = await db.rpc('horarios_livres', { p_data: data, p_servicos: v.servs, p_adicionais: v.adics, p_prof: v.profissional_id });
            const horas = [...new Set((lv || []).map(x => x.hora))];
            const nova = horas.find(h => h >= v.hora_inicio) || horas[0];
            if (!nova) { avisos.push(`${fData(data)}: sem horário livre, não criado`); continue; }
            const r2 = await db.from('agendamentos').insert({ ...linha, hora_inicio: nova, hora_fim: hm(min(nova) + dur) });
            avisos.push(r2.error ? `${fData(data)}: não criado` : `${fData(data)}: remarcado para ${nova}`);
          }
        }
      }
      if (v.novosPag.length) {
        await q(db.from('lancamentos').insert(v.novosPag.map(p => ({ empresa_id: ctx.empresa.id, tipo: 'receita', categoria: 'Agendamentos',
          agendamento_id: id, cliente_id: clienteId, data: p.data, valor: Number(p.valor), forma_pagamento: p.forma_pagamento,
          observacoes: p.observacoes || null, descricao: `Agendamento #${id}`, status: 'pago' }))));
      }
      if (avisos.length) toast('Recorrência: ' + avisos.join(' · '), 'aviso');
    }, v.id ? 'Agendamento atualizado.' : 'Agendamento criado.');
    setOc(false);
    if (ok) onSalvo();
  };

  const excluir = async () => {
    if (!confirm('Excluir este agendamento e os pagamentos ligados a ele? Essa ação não pode ser desfeita.')) return;
    if (await tentar(() => q(db.from('agendamentos').delete().eq('id', v.id)), 'Agendamento excluído.')) onSalvo();
  };
  const removerPag = async p => {
    if (!confirm(`Remover o pagamento de ${brl(p.valor)}?`)) return;
    if (await tentar(() => q(db.from('lancamentos').delete().eq('id', p.id)), 'Pagamento removido.'))
      f.set('pagamentos', v.pagamentos.filter(x => x.id !== p.id));
  };

  const enviarMsg = () => abrirZap(v.cliente.telefone, montarMensagem(modeloMsg(ctx.empresa, v.msgTipo).texto, {
    ag: { ...v, servicos: snapshot(v.servs, cat.servicos, v.antigos.servicos), adicionais: snapshot(v.adics, cat.adicionais, v.antigos.adicionais) },
    cliente: v.cliente, prof: cat.profissionais.find(p => p.id === v.profissional_id), empresa: ctx.empresa }));

  if (!cat) return html`<${Modal} titulo="Agendamento" onClose=${onClose}><p class="mudo">Carregando…</p><//>`;
  const servAtivos = cat.servicos.filter(s => s.ativo || v.servs.includes(s.id));
  return html`
    <${Modal} titulo=${v.id ? `Agendamento #${v.id}` : 'Criar agendamento'} onClose=${onClose} largura=${760}
      rodape=${html`
        ${v.id && ctx.nivel === 4 ? html`<button class="btn perigo-link" onClick=${excluir}>Excluir</button>` : ''}
        <span class="espaco"></span>
        <button class="btn sec" onClick=${onClose}>Fechar</button>
        ${podeEditar ? html`<button class="btn" disabled=${oc} onClick=${salvar}>${oc ? 'Salvando…' : v.id ? 'Salvar' : 'Agendar'}</button>` : ''}`}>
      <fieldset disabled=${!podeEditar} class="sem-borda">
      <div class="grade2">
        <${Campo} label="Tipo de agendamento" req dica=${v.tipo === 'encaixe' ? 'Encaixe permite marcar em horário já ocupado.' : ''}>
          <select ...${f.txt('tipo')} onChange=${e => f.set('tipo', e.target.value)}><option value="agendamento">Agendamento</option><option value="encaixe">Encaixe</option></select>
        <//>
        <${Campo} label="Status" req>
          <select ...${f.txt('status')} onChange=${e => f.set('status', e.target.value)}>${Object.entries(STATUS).map(([k, t]) => html`<option value=${k}>${t}</option>`)}</select>
        <//>
      </div>
      <${Campo} label="Serviços" req>
        <div class="grade-chk caixa">
          ${servAtivos.length === 0 ? html`<span class="mudo">Cadastre um serviço primeiro, em Serviços.</span>` : ''}
          ${servAtivos.map(s => html`<${Chk} checked=${v.servs.includes(s.id)} onChange=${() => alternar('servs', s.id)}
            label=${html`${s.nome} <small class="lado">${duracaoTxt(s.duracao)} · ${s.sob_consulta ? 'sob consulta' : brl(s.preco)}</small>`} />`)}
        </div>
      <//>
      ${adicsPossiveis.length ? html`
        <${Campo} label="Adicionais">
          <div class="grade-chk caixa">
            ${adicsPossiveis.map(a => html`<${Chk} checked=${v.adics.includes(a.id)} onChange=${() => alternar('adics', a.id)}
              label=${html`${a.nome} <small class="lado">+${brl(a.preco)}${a.duracao ? ` · +${a.duracao} min` : ''}</small>`} />`)}
          </div>
        <//>` : ''}
      <div class="grade2">
        <${Campo} label="Profissional" req>
          <select value=${v.profissional_id} onChange=${e => { f.set('profissional_id', e.target.value); setLivres(null); }} disabled=${ctx.nivel < 3}>
            <option value="">Selecione um profissional</option>
            ${profsPossiveis.map(p => html`<option value=${p.id}>${p.nome}</option>`)}
          </select>
        <//>
        <${Campo} label="Data" req><input type="date" value=${v.data} onInput=${e => { f.set('data', e.target.value); setLivres(null); }} /><//>
        <${Campo} label="Hora de início" req><input type="time" value=${v.hora_inicio} onInput=${e => f.set('hora_inicio', e.target.value)} /><//>
        <${Campo} label="Hora final" req dica="Calculada pela duração dos serviços; pode ser editada.">
          <input type="time" value=${v.hora_fim} onInput=${e => f.setV(o => ({ ...o, hora_fim: e.target.value, fimManual: true }))} />
        <//>
      </div>
      <div class="linha">
        <button type="button" class="btn sec peq" onClick=${verLivres}>Escolher horário livre</button>
        ${livres && livres.length === 0 ? html`<span class="mudo">Nenhum horário livre neste dia.</span>` : ''}
      </div>
      ${livres && livres.length ? html`<div class="chips">${livres.map(h => html`
        <button type="button" class="chip ${h === v.hora_inicio ? 'on' : ''}" onClick=${() => f.setV(o => ({ ...o, hora_inicio: h, fimManual: false }))}>${h}</button>`)}</div>` : ''}

      ${!v.id ? html`
        <${Chk} label="Repetir agendamento" checked=${v.rec.ativo} onChange=${e => f.set('rec', { ...v.rec, ativo: e.target.checked })} />
        ${v.rec.ativo ? html`
          <div class="grade3 recuo">
            <${Campo} label="Repetir mais"><input type="number" min="1" max="52" value=${v.rec.vezes} onInput=${e => f.set('rec', { ...v.rec, vezes: e.target.value })} /><//>
            <${Campo} label="vezes, a cada">
              <select value=${v.rec.periodo} onChange=${e => f.set('rec', { ...v.rec, periodo: e.target.value })}>
                ${Object.entries(PERIODOS).map(([k, t]) => html`<option value=${k}>${t}</option>`)}
              </select>
            <//>
            <${Chk} label="Remarcar automaticamente em caso de conflito" checked=${v.rec.remarcar} onChange=${e => f.set('rec', { ...v.rec, remarcar: e.target.checked })} />
          </div>` : ''}` : ''}
      <${Campo} label="Observações" dica="Opcional. O cliente poderá ver esse campo."><textarea rows="2" ...${f.txt('observacoes')}></textarea><//>

      <h3>Dados do cliente</h3>
      ${v.cliente ? html`
        <div class="selecionado">
          <div><b>${v.cliente.nome}</b><br /><span class="mudo">${fone(v.cliente.telefone)}</span></div>
          ${!v.id ? html`<button type="button" class="btn link peq" onClick=${() => f.set('cliente', null)}>Trocar cliente</button>` : ''}
        </div>` : html`
        <${Campo} label="Buscar cliente já cadastrado">
          <input value=${busca} onInput=${e => setBusca(e.target.value)} placeholder="Digite o nome ou telefone do cliente" />
        <//>
        ${achados.length ? html`<div class="achados">${achados.map(c => html`
          <button type="button" onClick=${() => { f.set('cliente', c); setBusca(''); setAchados([]); }}><b>${c.nome}</b> <span class="mudo">${fone(c.telefone)}</span></button>`)}</div>` : ''}
        <p class="mudo peq">Ou cadastre um novo cliente:</p>
        <div class="grade3">
          <${Campo} label="Nome" req><input value=${v.novoCli.nome} onInput=${e => f.set('novoCli', { ...v.novoCli, nome: e.target.value })} placeholder="Nome do cliente" /><//>
          <${Campo} label="Telefone" req><input value=${fone(v.novoCli.telefone)} inputmode="tel" placeholder="(00) 00000-0000"
            onInput=${e => f.set('novoCli', { ...v.novoCli, telefone: digitos(e.target.value).slice(0, 11) })} /><//>
          <${Campo} label="Nascimento"><input type="date" value=${v.novoCli.nascimento} onInput=${e => f.set('novoCli', { ...v.novoCli, nascimento: e.target.value })} /><//>
        </div>`}

      ${cat.campos.length ? html`<h3>Campos personalizados</h3><${CamposExtras} campos=${cat.campos} valor=${v.campos} onChange=${x => f.set('campos', x)} />` : ''}
      ${Object.keys(v.campos || {}).filter(k => !cat.campos.some(c => c.nome === k)).map(k => html`<p class="mudo peq">${k}: ${v.campos[k]}</p>`)}

      <h3>Pagamento</h3>
      <div class="grade2">
        <${Campo} label="Preço total (R$)" req dica="Soma dos serviços; pode ser editado.">
          <input type="number" min="0" step="0.01" value=${v.valor_total} onInput=${e => f.setV(o => ({ ...o, valor_total: e.target.value, valorManual: true }))} />
        <//>
        <div class="resumo-pag">
          <span>Preço <b>${brl(v.valor_total)}</b></span>
          <span>Recebido <b>${brl(recebido)}</b></span>
          <span>A receber <b>${brl(Math.max(0, Number(v.valor_total) - recebido))}</b></span>
          <${Selo} tipo=${spTipo}>${spTxt}<//>
        </div>
      </div>
      ${podePagar ? html`
        ${[...v.pagamentos, ...v.novosPag].map(p => html`
          <div class="pag">
            <span>${fData(p.data)} · ${p.forma_pagamento} · <b>${brl(p.valor)}</b>${p.observacoes ? ` · ${p.observacoes}` : ''}</span>
            ${p.id ? (ctx.nivel === 4 ? html`<button type="button" class="btn link peq" onClick=${() => removerPag(p)}>Remover</button>` : '')
              : html`<button type="button" class="btn link peq" onClick=${() => f.set('novosPag', v.novosPag.filter(x => x !== p))}>Desfazer</button>`}
          </div>`)}
        ${np ? html`
          <div class="caixa">
            <div class="grade3">
              <${Campo} label="Valor recebido (R$)" req><input type="number" min="0" step="0.01" value=${np.valor} onInput=${e => setNp({ ...np, valor: e.target.value })} /><//>
              <${Campo} label="Forma de pagamento" req>
                <select value=${np.forma_pagamento} onChange=${e => setNp({ ...np, forma_pagamento: e.target.value })}>${FORMAS.map(x => html`<option value=${x}>${x}</option>`)}</select>
              <//>
              <${Campo} label="Data" req><input type="date" value=${np.data} onInput=${e => setNp({ ...np, data: e.target.value })} /><//>
            </div>
            <${Campo} label="Observações"><input value=${np.observacoes} onInput=${e => setNp({ ...np, observacoes: e.target.value })} /><//>
            <div class="linha">
              <button type="button" class="btn peq" onClick=${() => {
                if (!(Number(np.valor) > 0) || !np.data) return toast('Informe o valor e a data do pagamento.', 'erro');
                f.set('novosPag', [...v.novosPag, np]); setNp(null);
              }}>Confirmar</button>
              <button type="button" class="btn sec peq" onClick=${() => setNp(null)}>Cancelar</button>
            </div>
          </div>` : html`
          <button type="button" class="btn sec peq" onClick=${() => setNp({ valor: Math.max(0, Number(v.valor_total) - recebido) || '', forma_pagamento: 'Pix', data: hoje(), observacoes: '' })}>+ Inserir um pagamento</button>`}
      ` : ''}
      ${v.id && v.cliente ? html`
        <h3>Mensagem para o cliente</h3>
        <div class="linha">
          <select value=${v.msgTipo} onChange=${e => f.set('msgTipo', e.target.value)} style="flex:1;min-width:200px">
            ${MSG_TIPOS.filter(([k]) => modeloMsg(ctx.empresa, k).ativo !== false).map(([k, t]) => html`<option value=${k}>${t}</option>`)}
          </select>
          <button type="button" class="btn zap peq" onClick=${enviarMsg}>Enviar no WhatsApp</button>
        </div>
        <p class="mudo peq">Abre o WhatsApp com a mensagem pronta para ${fone(v.cliente.telefone)}. Os textos ficam em Configurações, na aba Mensagens.</p>` : ''}
      </fieldset>
    <//>`;
}

/* ================= bloqueio de horário ================= */
function BloqueioModal({ ctx, profs, pref, onClose, onSalvo }) {
  const f = useForm({ profissional_id: pref.profissional_id || (ctx.nivel < 3 ? ctx.prof.id : ''), data_inicio: pref.data || hoje(), data_fim: pref.data || hoje(),
    diaInteiro: false, hora_inicio: pref.hora || '12:00', hora_fim: pref.hora ? hm(min(pref.hora) + 60) : '13:00', motivo: '' });
  const v = f.v;
  const salvar = async () => {
    if (v.data_fim < v.data_inicio) return toast('A data final deve ser igual ou depois da inicial.', 'erro');
    if (!v.diaInteiro && v.hora_fim <= v.hora_inicio) return toast('A hora final deve ser depois da inicial.', 'erro');
    const ok = await tentar(() => q(db.from('bloqueios').insert({ empresa_id: ctx.empresa.id, profissional_id: v.profissional_id || null,
      data_inicio: v.data_inicio, data_fim: v.data_fim, hora_inicio: v.diaInteiro ? null : v.hora_inicio, hora_fim: v.diaInteiro ? null : v.hora_fim,
      motivo: v.motivo.trim() || null })), 'Horário bloqueado.');
    if (ok) onSalvo();
  };
  return html`
    <${Modal} titulo="Bloquear horário" onClose=${onClose} largura=${520}
      rodape=${html`<span class="espaco"></span><button class="btn sec" onClick=${onClose}>Fechar</button><button class="btn" onClick=${salvar}>Bloquear</button>`}>
      <${Campo} label="Profissional" req>
        <select ...${f.txt('profissional_id')} onChange=${e => f.set('profissional_id', e.target.value)} disabled=${ctx.nivel < 3}>
          ${ctx.nivel >= 3 ? html`<option value="">Toda a empresa</option>` : ''}
          ${profs.map(p => html`<option value=${p.id}>${p.nome}</option>`)}
        </select>
      <//>
      <div class="grade2">
        <${Campo} label="Data de início" req><input type="date" ...${f.txt('data_inicio')} /><//>
        <${Campo} label="Data de fim" req><input type="date" ...${f.txt('data_fim')} /><//>
      </div>
      <${Chk} label="Dia inteiro" ...${f.chk('diaInteiro')} />
      ${!v.diaInteiro ? html`
        <div class="grade2">
          <${Campo} label="Hora de início" req><input type="time" ...${f.txt('hora_inicio')} /><//>
          <${Campo} label="Hora final" req><input type="time" ...${f.txt('hora_fim')} /><//>
        </div>` : ''}
      <${Campo} label="Motivo"><input ...${f.txt('motivo')} placeholder="Opcional" /><//>
    <//>`;
}

/* ================= agenda ================= */
function organizar(evs) { // distribui eventos sobrepostos em colunas lado a lado
  const lista = [...evs].sort((a, b) => a.i - b.i || b.f - a.f);
  let grupo = [], fim = -1;
  const fechar = () => { const n = Math.max(...grupo.map(e => e.l)) + 1; grupo.forEach(e => (e.n = n)); grupo = []; fim = -1; };
  for (const e of lista) {
    if (grupo.length && e.i >= fim) fechar();
    const usados = grupo.filter(g => g.f > e.i).map(g => g.l);
    let l = 0; while (usados.includes(l)) l++;
    e.l = l; grupo.push(e); fim = Math.max(fim, e.f);
  }
  if (grupo.length) fechar();
  return lista;
}
const CORES = ['#5b4bff', '#00a38d', '#e0603a', '#c026d3', '#2f7de1', '#c79200', '#e0457b', '#4d7c0f'];

export function Agenda({ ctx }) {
  const [visao, setVisao] = useState(window.innerWidth < 760 ? 'dia' : 'semana');
  const [data, setData] = useState(hoje());
  const [profs, setProfs] = useState([]);
  const [sel, setSel] = useState(null);
  const [dados, setDados] = useState({ ags: [], bloqs: [] });
  const [bloq, setBloq] = useState(null);
  const [cfg, setCfg] = useState(false);
  const slot = Number(ctx.empresa.config.slot_agenda) || 30;

  const semanaIni = addDias(data, -((dt(data).getDay() + 6) % 7));
  const [ini, fim] = visao === 'dia' ? [data, data] : visao === 'semana' ? [semanaIni, addDias(semanaIni, 6)]
    : (() => { const p = data.slice(0, 8) + '01'; const pi = addDias(p, -((dt(p).getDay() + 6) % 7)); return [pi, addDias(pi, 41)]; })();

  const carregar = () => tentar(async () => {
    const [ags, bloqs] = await Promise.all([
      q(db.from('agendamentos').select('*, cliente:clientes(nome,telefone)').gte('data', ini).lte('data', fim).neq('status', 'cancelado').order('hora_inicio')),
      q(db.from('bloqueios').select('*').lte('data_inicio', fim).gte('data_fim', ini)),
    ]);
    setDados({ ags, bloqs });
  });
  useEffect(() => { tentar(async () => {
    const ps = await q(db.from('profissionais').select('id,nome,horarios,ativo').eq('ativo', true).order('nome'));
    const meus = ctx.nivel < 3 ? ps.filter(p => p.id === ctx.prof.id) : ps;
    setProfs(meus); setSel(meus.map(p => p.id));
  }); }, []);
  useEffect(() => { carregar(); }, [ini, fim]);
  useEffect(() => { const f = () => carregar(); window.addEventListener('ag-mudou', f); return () => window.removeEventListener('ag-mudou', f); }, [ini, fim]);

  const cor = id => CORES[Math.max(0, profs.findIndex(p => p.id === id)) % CORES.length];
  const visiveis = profs.filter(p => (sel || []).includes(p.id));
  const mover = n => setData(visao === 'dia' ? addDias(data, n) : visao === 'semana' ? addDias(data, 7 * n) : addMeses(data.slice(0, 8) + '01', n));
  const titulo = visao === 'mes' ? `${MESES[dt(data).getMonth()]} ${data.slice(0, 4)}`
    : visao === 'dia' ? `${DIAS[dt(data).getDay()]}, ${fData(data)}` : `${fData(ini)} a ${fData(fim)}`;

  const removerBloqueio = async b => {
    if (!confirm(`Remover o bloqueio${b.motivo ? ` “${b.motivo}”` : ''}?`)) return;
    if (await tentar(() => q(db.from('bloqueios').delete().eq('id', b.id)), 'Bloqueio removido.')) carregar();
  };
  const salvarSlot = async n => {
    setCfg(false);
    if (ctx.nivel !== 4) return toast('Só administradores alteram essa configuração.', 'erro');
    if (await tentar(() => q(db.from('empresas').update({ config: { ...ctx.empresa.config, slot_agenda: n } }).eq('id', ctx.empresa.id)))) ctx.recarregar();
  };

  // limites de horário exibidos
  const [hIni, hFim] = useMemo(() => {
    let a = 24 * 60, b = 0;
    const olhar = h => Object.values(h || {}).forEach(fx => fx.forEach(f => { a = Math.min(a, min(f.i)); b = Math.max(b, min(f.f)); }));
    olhar(ctx.empresa.horarios); profs.forEach(p => olhar(p.horarios));
    dados.ags.forEach(g => { a = Math.min(a, min(h5(g.hora_inicio))); b = Math.max(b, min(h5(g.hora_fim))); });
    if (a >= b) { a = 8 * 60; b = 18 * 60; }
    return [Math.floor(a / 60) * 60, Math.ceil(b / 60) * 60];
  }, [profs, dados]);
  const ALT = 30; // altura de cada slot em pixels
  const ppm = ALT / slot;
  const colunas = visao === 'dia' ? visiveis.map(p => ({ chave: p.id, titulo: p.nome, data, profs: [p] }))
    : Array.from({ length: 7 }, (_, i) => { const d = addDias(ini, i); return { chave: d, titulo: `${DIAS_C[dt(d).getDay()]} ${d.slice(8)}`, data: d, profs: visiveis, hoje: d === hoje() }; });

  const clicarGrade = (e, col) => {
    if (e.target !== e.currentTarget) return;
    const m = hIni + Math.floor((e.offsetY / ppm) / slot) * slot;
    ctx.abrirAg({ data: col.data, hora: hm(m), profissional_id: col.profs.length === 1 ? col.profs[0].id : '' });
  };

  const grade = () => html`
    <div class="grade-agenda" style=${`--cols:${colunas.length}`}>
      <div class="cab-hora"></div>
      ${colunas.map(c => html`<div class="cab-col ${c.hoje ? 'hoje' : ''}" onClick=${() => visao === 'semana' && (setData(c.data), setVisao('dia'))}>${c.titulo}</div>`)}
      <div class="col-horas" style=${`height:${(hFim - hIni) * ppm}px`}>
        ${Array.from({ length: (hFim - hIni) / 60 }, (_, i) => html`<span style=${`top:${i * 60 * ppm}px`}>${hm(hIni + i * 60)}</span>`)}
      </div>
      ${colunas.map(c => {
        const ids = c.profs.map(p => p.id);
        const dow = dt(c.data).getDay();
        const evs = organizar(dados.ags.filter(a => a.data === c.data && ids.includes(a.profissional_id))
          .map(a => ({ a, i: min(h5(a.hora_inicio)), f: min(h5(a.hora_fim)) })));
        const bl = dados.bloqs.filter(b => c.data >= b.data_inicio && c.data <= b.data_fim && (!b.profissional_id || ids.includes(b.profissional_id)));
        // faixas fora do expediente (união do expediente dos profissionais da coluna)
        const trab = c.profs.flatMap(p => (p.horarios?.[dow] || []).map(f => [min(f.i), min(f.f)])).sort((x, y) => x[0] - y[0]);
        const fora = []; let cur = hIni;
        trab.forEach(([i, f]) => { if (i > cur) fora.push([cur, i]); cur = Math.max(cur, f); });
        if (cur < hFim) fora.push([cur, hFim]);
        return html`
          <div class="col-dia" style=${`height:${(hFim - hIni) * ppm}px;background-size:100% ${ALT * (60 / slot)}px`} onClick=${e => clicarGrade(e, c)}>
            ${fora.map(([i, f]) => html`<div class="fora" style=${`top:${(i - hIni) * ppm}px;height:${(f - i) * ppm}px`}></div>`)}
            ${bl.map(b => { const i = b.hora_inicio ? min(h5(b.hora_inicio)) : hIni, f = b.hora_fim ? min(h5(b.hora_fim)) : hFim;
              return html`<div class="bloqueio" title="Clique para remover" style=${`top:${(Math.max(i, hIni) - hIni) * ppm}px;height:${(Math.min(f, hFim) - Math.max(i, hIni)) * ppm}px`}
                onClick=${() => removerBloqueio(b)}>${b.motivo || 'Bloqueado'}</div>`; })}
            ${c.data === hoje() && min(agoraHM()) > hIni && min(agoraHM()) < hFim ? html`<div class="agora" style=${`top:${(min(agoraHM()) - hIni) * ppm}px`}></div>` : ''}
            ${evs.map(({ a, i, f, l, n }) => html`
              <button class="evento ${a.status} ${a.tipo}" onClick=${() => ctx.abrirAg({ id: a.id })}
                style=${`top:${(i - hIni) * ppm}px;height:${Math.max(18, (f - i) * ppm - 2)}px;left:calc(${(l / n) * 100}% + 2px);width:calc(${100 / n}% - 4px);--cor:${cor(a.profissional_id)}`}>
                <b>${h5(a.hora_inicio)} ${a.cliente?.nome}</b>
                <span>${a.servicos.map(s => s.nome).join(', ')}${a.tipo === 'encaixe' ? ' · encaixe' : ''}</span>
              </button>`)}
          </div>`;
      })}
    </div>`;

  const mes = () => {
    const mesAtual = data.slice(0, 7);
    return html`
      <div class="mes">
        ${[1, 2, 3, 4, 5, 6, 0].map(d => html`<div class="cab-mes">${DIAS_C[d]}</div>`)}
        ${Array.from({ length: 42 }, (_, i) => {
          const d = addDias(ini, i);
          const evs = dados.ags.filter(a => a.data === d && (sel || []).includes(a.profissional_id));
          return html`
            <div class="cel ${d.slice(0, 7) !== mesAtual ? 'outro' : ''} ${d === hoje() ? 'hoje' : ''}" onClick=${() => { setData(d); setVisao('dia'); }}>
              <span class="num">${Number(d.slice(8))}</span>
              ${evs.slice(0, 3).map(a => html`<span class="mini" style=${`--cor:${cor(a.profissional_id)}`}>${h5(a.hora_inicio)} ${a.cliente?.nome}</span>`)}
              ${evs.length > 3 ? html`<span class="mais">+${evs.length - 3}</span>` : ''}
            </div>`;
        })}
      </div>`;
  };

  return html`
    <div class="pagina larga">
      <div class="titulo">
        <h1>Agenda</h1>
        <div class="seg">${[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([k, t]) => html`<button class=${visao === k ? 'on' : ''} onClick=${() => setVisao(k)}>${t}</button>`)}</div>
        <span class="espaco"></span>
        <button class="btn sec" onClick=${() => setBloq({ data })}>Bloquear horário</button>
        ${ctx.nivel >= 2 ? html`<button class="btn" onClick=${() => ctx.abrirAg({ data })}>+ Novo agendamento</button>` : ''}
      </div>
      <div class="barra-agenda">
        <button class="btn sec peq" onClick=${() => mover(-1)}>‹</button>
        <button class="btn sec peq" onClick=${() => setData(hoje())}>Hoje</button>
        <button class="btn sec peq" onClick=${() => mover(1)}>›</button>
        <input type="date" value=${data} onInput=${e => e.target.value && setData(e.target.value)} />
        <b class="periodo">${titulo}</b>
        <span class="espaco"></span>
        ${profs.length > 1 ? html`
          <details class="menu-prof"><summary class="btn sec peq">Profissionais (${visiveis.length})</summary>
            <div class="flutua">${profs.map(p => html`<${Chk} label=${html`<i class="bola" style=${`background:${cor(p.id)}`}></i> ${p.nome}`}
              checked=${(sel || []).includes(p.id)} onChange=${() => setSel(sel.includes(p.id) ? sel.filter(x => x !== p.id) : [...sel, p.id])} />`)}</div>
          </details>` : ''}
        <button class="btn sec peq" onClick=${() => carregar()} title="Atualizar">↻</button>
        <button class="btn sec peq" onClick=${() => setCfg(true)} title="Configurar visualização">⚙</button>
      </div>
      ${sel && visiveis.length === 0 ? html`<p class="mudo">Selecione ao menos um profissional.</p>` : visao === 'mes' ? mes() : html`<div class="agenda-rolagem">${grade()}</div>`}
      ${bloq ? html`<${BloqueioModal} ctx=${ctx} profs=${profs} pref=${bloq} onClose=${() => setBloq(null)} onSalvo=${() => { setBloq(null); carregar(); }} />` : ''}
      ${cfg ? html`
        <${Modal} titulo="Visualização da agenda" onClose=${() => setCfg(false)} largura=${380}>
          <${Campo} label="Duração do slot">
            <select value=${slot} onChange=${e => salvarSlot(Number(e.target.value))}>
              ${[[5, '5 minutos'], [10, '10 minutos'], [20, '20 minutos'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [180, '3 horas']].map(([n, t]) => html`<option value=${n}>${t}</option>`)}
            </select>
          <//>
        <//>` : ''}
    </div>`;
}

/* ================= lista de agendamentos ================= */
export function Agendamentos({ ctx }) {
  const [linhas, setLinhas] = useState(null);
  const [de, setDe] = useState(addDias(hoje(), -30));
  const [ate, setAte] = useState('');
  const [st, setSt] = useState('');
  const [sp, setSp] = useState('');
  const carregar = () => tentar(async () => {
    let c = db.from('agendamentos').select(`*, cliente:clientes(nome,telefone), profissional:profissionais(nome)${ctx.nivel >= 3 ? ', lancamentos(valor,status)' : ''}`)
      .order('data', { ascending: false }).order('hora_inicio', { ascending: false }).limit(2000);
    if (de) c = c.gte('data', de);
    if (ate) c = c.lte('data', ate);
    const r = await q(c);
    r.forEach(a => { a.recebido = (a.lancamentos || []).filter(l => l.status === 'pago').reduce((t, l) => t + Number(l.valor), 0); a.sp = statusPagamento(a.valor_total, a.recebido); });
    setLinhas(r);
  });
  useEffect(() => { carregar(); }, [de, ate]);
  useEffect(() => { const f = () => carregar(); window.addEventListener('ag-mudou', f); return () => window.removeEventListener('ag-mudou', f); }, [de, ate]);
  const filtradas = linhas && linhas.filter(a => (!st || a.status === st) && (!sp || a.sp[0] === sp));
  return html`
    <div class="pagina larga">
      <div class="titulo"><h1>Agendamentos</h1>
        ${ctx.nivel >= 2 ? html`<button class="btn" onClick=${() => ctx.abrirAg({})}>+ Novo agendamento</button>` : ''}</div>
      <${Lista} linhas=${filtradas} nomeArquivo="agendamentos" onLinha=${a => ctx.abrirAg({ id: a.id })}
        filtros=${html`
          <label class="filtro">De <input type="date" value=${de} onInput=${e => setDe(e.target.value)} /></label>
          <label class="filtro">Até <input type="date" value=${ate} onInput=${e => setAte(e.target.value)} /></label>
          <select value=${st} onChange=${e => setSt(e.target.value)}><option value="">Todos os status</option>${Object.entries(STATUS).map(([k, t]) => html`<option value=${k}>${t}</option>`)}</select>
          <select value=${sp} onChange=${e => setSp(e.target.value)}><option value="">Todos os pagamentos</option><option value="nao">Não pago</option><option value="parcial">Pago parcial</option><option value="pago">Pago total</option></select>`}
        colunas=${[
          { label: 'ID', k: 'id' },
          { label: 'Status', txt: a => STATUS[a.status], render: a => seloStatus(a.status) },
          { label: 'Data', txt: a => fData(a.data) },
          { label: 'Hora', txt: a => `${h5(a.hora_inicio)}–${h5(a.hora_fim)}` },
          { label: 'Serviços', txt: a => a.servicos.map(s => s.nome).join(', ') + (a.tipo === 'encaixe' ? ' (encaixe)' : '') },
          { label: 'Profissional', txt: a => a.profissional?.nome || '' },
          { label: 'Cliente', txt: a => a.cliente?.nome || '' },
          { label: 'Preço', txt: a => brl(a.valor_total) },
          { label: 'Recebido', txt: a => brl(a.recebido) },
          { label: 'Status pag.', txt: a => a.sp[1], render: a => html`<${Selo} tipo=${a.sp[0]}>${a.sp[1]}<//>` },
        ]} />
    </div>`;
}

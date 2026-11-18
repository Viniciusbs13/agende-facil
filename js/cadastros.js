// Cadastros: clientes, serviços, categorias, adicionais e profissionais.
import { html, useState, useEffect, db, q, tentar, toast, useForm, Campo, Chk, Modal, Imagem, Horarios, horariosValidos, Lista, Selo,
  brl, fone, fData, hoje, duracaoTxt, DIAS_C, NIVEIS, CamposExtras, Midias } from './lib.js';

/* ---------- estrutura genérica de cadastro ---------- */
function Crud(p) {
  const [linhas, setLinhas] = useState(null);
  const [extra, setExtra] = useState({});
  const [ed, setEd] = useState(null);
  const carregar = () => tentar(async () => {
    const [l, x] = await Promise.all([
      q(db.from(p.tabela).select(p.select || '*').order(p.ordem || 'nome')),
      p.extra ? p.extra() : {},
    ]);
    setExtra(x);
    setLinhas(l);
  });
  useEffect(() => { carregar(); }, []);
  const pode = p.ctx.nivel >= (p.nivelEditar || 4);
  return html`
    <div class="pagina">
      <div class="titulo">
        <h1>${p.titulo}</h1>
        ${pode && p.extraBtn && linhas ? html`<${p.extraBtn} linhas=${linhas} carregar=${carregar} />` : ''}
        ${pode ? html`<button class="btn" onClick=${() => setEd(p.novo(extra))}>${p.btnNovo}</button>` : ''}
      </div>
      ${p.topo ? p.topo(linhas || []) : ''}
      <${Lista} colunas=${p.colunas(extra)} linhas=${linhas} nomeArquivo=${p.tabela}
        onLinha=${pode ? l => setEd(p.abrir ? p.abrir(l) : l) : null} />
      ${ed ? html`<${Editor} p=${p} extra=${extra} inicial=${ed} onClose=${() => setEd(null)}
        onSalvo=${() => { setEd(null); carregar(); }} />` : ''}
    </div>`;
}

function Editor({ p, extra, inicial, onClose, onSalvo }) {
  const f = useForm(inicial);
  const [oc, setOc] = useState(false);
  const novo = !inicial.id;
  const gravar = async () => {
    const erro = p.validar && p.validar(f.v);
    if (erro) return toast(erro, 'erro');
    setOc(true);
    const ok = await tentar(async () => {
      let v = f.v;
      if (p.antes) v = { ...v, ...(await p.antes(v, p.ctx)) };
      const dados = Object.fromEntries(p.campos.map(k => [k, (p.numeros || []).includes(k) ? Number(v[k]) || 0 : v[k] === '' ? null : v[k]]));
      let id = v.id;
      if (id) await q(db.from(p.tabela).update(dados).eq('id', id));
      else id = (await q(db.from(p.tabela).insert({ ...dados, empresa_id: p.ctx.empresa.id }).select('id').single())).id;
      if (p.depois) await p.depois(id, v, p.ctx);
    }, 'Salvo com sucesso.');
    setOc(false);
    if (ok) onSalvo();
  };
  const excluir = async () => {
    if (!confirm(`Excluir "${f.v.nome}"? Essa ação não pode ser desfeita.`)) return;
    if (await tentar(() => q(db.from(p.tabela).delete().eq('id', f.v.id)), 'Excluído.')) onSalvo();
  };
  const podeExcluir = !novo && p.ctx.nivel === 4 && !(p.naoExcluir && p.naoExcluir(f.v, p.ctx));
  return html`
    <${Modal} titulo=${(novo ? 'Adicionar ' : 'Editar ') + p.singular} onClose=${onClose} largura=${p.largura || 640}
      rodape=${html`
        ${podeExcluir ? html`<button class="btn perigo-link" onClick=${excluir}>Excluir</button>` : ''}
        <span class="espaco"></span>
        <button class="btn sec" onClick=${onClose}>Cancelar</button>
        <button class="btn" disabled=${oc} onClick=${gravar}>${oc ? 'Salvando…' : novo ? 'Cadastrar' : 'Salvar'}</button>`}>
      <${p.Form} f=${f} extra=${extra} ctx=${p.ctx} novo=${novo} />
    <//>`;
}

function Marcar({ itens, valor, onChange, todos }) {
  const v = valor || [];
  const alt = id => onChange(v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
  if (!itens.length) return html`<p class="mudo">Nenhum item cadastrado.</p>`;
  return html`
    <div class="marcar">
      <${Chk} label=${todos} checked=${v.length === itens.length} onChange=${e => onChange(e.target.checked ? itens.map(i => i.id) : [])} />
      <div class="grade-chk">${itens.map(i => html`<${Chk} label=${i.nome} checked=${v.includes(i.id)} onChange=${() => alt(i.id)} />`)}</div>
    </div>`;
}

async function sincronizar(tabela, colFixa, idFixo, colVar, ids, empresaId) {
  await q(db.from(tabela).delete().eq(colFixa, idFixo));
  if (ids && ids.length) await q(db.from(tabela).insert(ids.map(x => ({ empresa_id: empresaId, [colFixa]: idFixo, [colVar]: x }))));
}

const ativoSelo = l => html`<${Selo} tipo=${l.ativo ? 'ok' : 'off'}>${l.ativo ? 'Ativo' : 'Inativo'}<//>`;
const Obs = ({ f }) => html`
  <${Campo} label="Observações" dica="Opcional. Apenas os membros da empresa veem essas observações.">
    <textarea rows="2" ...${f.txt('observacoes')}></textarea>
  <//>`;

/* ---------- clientes ---------- */
export const Clientes = ({ ctx }) => html`<${Crud} ctx=${ctx} titulo="Clientes" singular="cliente" btnNovo="Adicionar cliente"
  tabela="clientes" select="*, agendamentos(data, hora_inicio, status)" nivelEditar=${3} largura=${560}
  campos=${['nome', 'telefone', 'nascimento', 'cpf', 'aceita_msgs', 'bloqueado', 'observacoes', 'campos']}
  extra=${async () => ({ campos: await q(db.from('campos_personalizados').select('*').order('ordem').order('nome')) })}
  novo=${() => ({ nome: '', telefone: '', nascimento: '', cpf: '', aceita_msgs: true, bloqueado: false, observacoes: '', campos: {} })}
  validar=${v => (!v.nome?.trim() ? 'Informe o nome.' : (v.telefone || '').length < 10 ? 'Informe o telefone com DDD.' : null)}
  topo=${ls => {
    const mes = hoje().slice(0, 7);
    return html`
      <div class="cartoes">
        <div class="cartao"><span>Total de clientes</span><b>${ls.length}</b></div>
        <div class="cartao"><span>Novos no mês</span><b>${ls.filter(c => (c.criado_em || '').slice(0, 7) === mes).length}</b></div>
        <div class="cartao"><span>Aniversariantes do mês</span><b>${ls.filter(c => (c.nascimento || '').slice(5, 7) === mes.slice(5)).length}</b></div>
      </div>`;
  }}
  colunas=${() => {
    const validos = c => (c.agendamentos || []).filter(a => a.status !== 'cancelado');
    const ultimo = c => validos(c).filter(a => a.data <= hoje() && a.status !== 'agendado').map(a => a.data).sort().pop();
    const proximo = c => validos(c).filter(a => a.data >= hoje() && a.status === 'agendado').map(a => a.data).sort()[0];
    return [
      { label: 'Nome', k: 'nome' },
      { label: 'Telefone', txt: c => fone(c.telefone) },
      { label: 'Status', txt: c => (c.bloqueado ? 'Bloqueado' : 'Ativo'), render: c => html`<${Selo} tipo=${c.bloqueado ? 'off' : 'ok'}>${c.bloqueado ? 'Bloqueado' : 'Ativo'}<//>` },
      { label: 'Histórico', txt: c => `${validos(c).length} agendamento(s)` },
      { label: 'Último atendimento', txt: c => fData(ultimo(c)) || '—' },
      { label: 'Próximo atendimento', txt: c => fData(proximo(c)) || '—' },
    ];
  }}
  Form=${({ f, extra }) => html`
    <div class="grade2">
      <${Campo} label="Status">
        <select value=${f.v.bloqueado ? '1' : '0'} onChange=${e => f.set('bloqueado', e.target.value === '1')}>
          <option value="0">Ativo</option><option value="1">Bloqueado (não agenda pelo link)</option>
        </select>
      <//>
      <${Campo} label="Nome" req><input ...${f.txt('nome')} placeholder="Nome do cliente" /><//>
      <${Campo} label="Telefone" req><input ...${f.tel('telefone')} /><//>
      <${Campo} label="Data de nascimento"><input type="date" ...${f.txt('nascimento')} /><//>
      <${Campo} label="CPF"><input ...${f.txt('cpf')} placeholder="000.000.000-00" /><//>
    </div>
    <${Chk} label="Aceita receber mensagens de notificação" ...${f.chk('aceita_msgs')} />
    <${Obs} f=${f} />
    ${(extra.campos || []).length ? html`<h3>Campos personalizados</h3><${CamposExtras} campos=${extra.campos} valor=${f.v.campos} onChange=${x => f.set('campos', x)} />` : ''}`} />`;

/* ---------- categorias ---------- */
export const Categorias = ({ ctx }) => html`<${Crud} ctx=${ctx} titulo="Categorias" singular="categoria" btnNovo="Adicionar categoria"
  tabela="categorias" ordem="ordem" largura=${560}
  campos=${['nome', 'descricao', 'foto_url', 'observacoes', 'ativo']}
  novo=${() => ({ nome: '', descricao: '', foto_url: null, observacoes: '', ativo: true })}
  validar=${v => (!v.nome?.trim() ? 'Informe o nome da categoria.' : null)}
  colunas=${() => [
    { label: 'Nome', k: 'nome' },
    { label: 'Status', txt: l => (l.ativo ? 'Ativo' : 'Inativo'), render: ativoSelo },
    { label: 'Criada em', txt: l => fData(l.criado_em) },
  ]}
  Form=${({ f, ctx }) => html`
    <div class="grade2">
      <${Campo} label="Status">
        <select value=${f.v.ativo ? '1' : '0'} onChange=${e => f.set('ativo', e.target.value === '1')}>
          <option value="1">Ativa</option><option value="0">Inativa (não aparece para agendar)</option>
        </select>
      <//>
      <${Campo} label="Nome da categoria" req><input ...${f.txt('nome')} /><//>
    </div>
    <${Campo} label="Descrição" dica="Opcional. Aparece para os clientes."><textarea rows="2" ...${f.txt('descricao')}></textarea><//>
    <${Campo} label="Foto da categoria"><${Imagem} valor=${f.v.foto_url} onChange=${u => f.set('foto_url', u)} pasta=${ctx.empresa.id} /><//>
    <${Obs} f=${f} />`} />`;

/* ---------- serviços ---------- */
function Ordenar({ linhas, carregar }) {
  const [ls, setLs] = useState(null);
  const mover = (i, d) => { const n = [...ls]; [n[i], n[i + d]] = [n[i + d], n[i]]; setLs(n); };
  const salvar = async () => {
    const ok = await tentar(() => Promise.all(ls.map((s, i) => q(db.from('servicos').update({ ordem: i + 1 }).eq('id', s.id)))), 'Ordem salva.');
    if (ok) { setLs(null); carregar(); }
  };
  return html`
    <button class="btn sec" onClick=${() => setLs([...linhas])}>Ordenar</button>
    ${ls ? html`
      <${Modal} titulo="Ordenar serviços" onClose=${() => setLs(null)} largura=${460}
        rodape=${html`<span class="espaco"></span><button class="btn sec" onClick=${() => setLs(null)}>Cancelar</button><button class="btn" onClick=${salvar}>Salvar ordem</button>`}>
        <p class="mudo peq">A ordem vale para a lista do painel e para a página de agendamento.</p>
        ${ls.map((s, i) => html`
          <div class="pag"><span>${i + 1}. ${s.nome}</span>
            <span><button type="button" class="btn sec peq" disabled=${i === 0} onClick=${() => mover(i, -1)} aria-label="Subir">↑</button> <button type="button" class="btn sec peq" disabled=${i === ls.length - 1} onClick=${() => mover(i, 1)} aria-label="Descer">↓</button></span>
          </div>`)}
      <//>` : ''}`;
}

export const Servicos = ({ ctx }) => html`<${Crud} ctx=${ctx} titulo="Serviços" singular="serviço" btnNovo="Adicionar serviço"
  tabela="servicos" ordem="ordem" largura=${720} extraBtn=${Ordenar}
  select="*, categoria:categorias(nome), servico_profissional(profissional_id), adicional_servico(adicional_id)"
  campos=${['nome', 'descricao', 'categoria_id', 'duracao', 'preco', 'sob_consulta', 'a_partir_de', 'exigir_pix', 'comissao', 'foto_url', 'midias', 'observacoes', 'ativo', 'visivel']}
  numeros=${['duracao', 'preco', 'comissao']}
  extra=${async () => {
    const [categorias, profissionais, adicionais] = await Promise.all([
      q(db.from('categorias').select('id,nome').order('nome')),
      q(db.from('profissionais').select('id,nome').order('nome')),
      q(db.from('adicionais').select('id,nome').order('nome')),
    ]);
    return { categorias, profissionais, adicionais };
  }}
  novo=${x => ({ nome: '', descricao: '', categoria_id: x.categorias?.[0]?.id || '', duracao: 30, preco: '', sob_consulta: false, a_partir_de: false,
    exigir_pix: false, comissao: '', foto_url: null, midias: [], observacoes: '', ativo: true, visivel: true,
    _profs: (x.profissionais || []).map(p => p.id), _adics: [], _nova: '' })}
  abrir=${l => ({ ...l, _profs: l.servico_profissional.map(x => x.profissional_id), _adics: l.adicional_servico.map(x => x.adicional_id), _nova: '' })}
  validar=${v => (!v.nome?.trim() ? 'Informe o nome do serviço.' : !(Number(v.duracao) > 0) ? 'Informe a duração em minutos.'
    : v.categoria_id === '__nova' && !v._nova.trim() ? 'Informe o nome da nova categoria.' : null)}
  antes=${async (v, ctx) => {
    if (v.categoria_id !== '__nova') return {};
    const c = await q(db.from('categorias').insert({ empresa_id: ctx.empresa.id, nome: v._nova.trim() }).select('id').single());
    return { categoria_id: c.id };
  }}
  depois=${async (id, v, ctx) => {
    await sincronizar('servico_profissional', 'servico_id', id, 'profissional_id', v._profs, ctx.empresa.id);
    await sincronizar('adicional_servico', 'servico_id', id, 'adicional_id', v._adics, ctx.empresa.id);
  }}
  colunas=${() => [
    { label: 'Nome', k: 'nome' },
    { label: 'Categoria', txt: l => l.categoria?.nome || '—' },
    { label: 'Duração', txt: l => duracaoTxt(l.duracao) },
    { label: 'Preço', txt: l => (l.sob_consulta ? 'Sob consulta' : (l.a_partir_de ? 'a partir de ' : '') + brl(l.preco)) },
    { label: 'Status', txt: l => (l.ativo ? 'Ativo' : 'Inativo'), render: l => html`${ativoSelo(l)} ${!l.visivel ? html`<${Selo} tipo="off">Invisível<//>` : ''}` },
  ]}
  Form=${({ f, extra, ctx }) => html`
    <div class="grade2">
      <${Campo} label="Status">
        <select value=${f.v.ativo ? '1' : '0'} onChange=${e => f.set('ativo', e.target.value === '1')}>
          <option value="1">Ativo</option><option value="0">Inativo (não é possível agendar)</option>
        </select>
      <//>
      <${Campo} label="Visível para clientes">
        <select value=${f.v.visivel ? '1' : '0'} onChange=${e => f.set('visivel', e.target.value === '1')}>
          <option value="1">Visível</option><option value="0">Invisível (só pelo painel)</option>
        </select>
      <//>
      <${Campo} label="Categoria">
        <select ...${f.txt('categoria_id')} onChange=${e => f.set('categoria_id', e.target.value)}>
          <option value="">Sem categoria</option>
          ${extra.categorias.map(c => html`<option value=${c.id}>${c.nome}</option>`)}
          <option value="__nova">+ Criar nova categoria</option>
        </select>
      <//>
      ${f.v.categoria_id === '__nova' ? html`<${Campo} label="Nome da nova categoria" req><input ...${f.txt('_nova')} /><//>` : ''}
      <${Campo} label="Nome do serviço" req><input ...${f.txt('nome')} /><//>
      <${Campo} label="Duração (em minutos)" req><input type="number" min="5" step="5" ...${f.num('duracao')} /><//>
      <${Campo} label="Preço (R$)" req><input type="number" min="0" step="0.01" ...${f.num('preco')} disabled=${f.v.sob_consulta} placeholder="0,00" /><//>
      <${Campo} label="Comissão (%)" dica="Percentual pago ao profissional que realizar o serviço.">
        <input type="number" min="0" max="100" step="0.5" ...${f.num('comissao')} placeholder="0" />
      <//>
    </div>
    <${Chk} label="Preço sob consulta" dica="O cliente vê “Sob consulta” no lugar do preço." ...${f.chk('sob_consulta')} />
    <${Chk} label="Mostrar “a partir de” antes do preço" ...${f.chk('a_partir_de')} />
    <${Chk} label="Exigir pagamento antecipado via PIX" dica="Só tem efeito quando o PIX estiver ativo nas configurações." ...${f.chk('exigir_pix')} />
    <${Campo} label="Descrição" dica="Opcional. Aparece para os clientes."><textarea rows="2" ...${f.txt('descricao')}></textarea><//>
    <${Campo} label="Fotos e vídeos do serviço" dica="Formam o catálogo que o cliente vê na página de agendamento. A primeira é a capa. Fotos até 8 MB, vídeos até 40 MB.">
      <${Midias} valor=${f.v.midias} pasta=${ctx.empresa.id}
        onChange=${m => f.setV(o => ({ ...o, midias: m, foto_url: (m.find(x => x.tipo === 'foto') || {}).url || null }))} />
    <//>
    <${Obs} f=${f} />
    <${Campo} label="Adicionais disponíveis neste serviço">
      <${Marcar} itens=${extra.adicionais} valor=${f.v._adics} onChange=${x => f.set('_adics', x)} todos="Selecionar todos os adicionais" />
    <//>
    <${Campo} label="Profissionais que prestam este serviço">
      <${Marcar} itens=${extra.profissionais} valor=${f.v._profs} onChange=${x => f.set('_profs', x)} todos="Selecionar todos os profissionais" />
    <//>`} />`;

/* ---------- adicionais ---------- */
export const Adicionais = ({ ctx }) => html`<${Crud} ctx=${ctx} titulo="Adicionais" singular="adicional" btnNovo="Novo adicional"
  tabela="adicionais" select="*, adicional_servico(servico_id)" largura=${600}
  campos=${['nome', 'descricao', 'duracao', 'preco', 'a_partir_de', 'foto_url', 'observacoes', 'ativo']}
  numeros=${['duracao', 'preco']}
  extra=${async () => ({ servicos: await q(db.from('servicos').select('id,nome').order('nome')) })}
  novo=${() => ({ nome: '', descricao: '', duracao: 0, preco: '', a_partir_de: false, foto_url: null, observacoes: '', ativo: true, _servs: [] })}
  abrir=${l => ({ ...l, _servs: l.adicional_servico.map(x => x.servico_id) })}
  validar=${v => (!v.nome?.trim() ? 'Informe o nome do adicional.' : null)}
  depois=${(id, v, ctx) => sincronizar('adicional_servico', 'adicional_id', id, 'servico_id', v._servs, ctx.empresa.id)}
  colunas=${() => [
    { label: 'Nome', k: 'nome' },
    { label: 'Status', txt: l => (l.ativo ? 'Ativo' : 'Inativo'), render: ativoSelo },
    { label: 'Preço', txt: l => (l.a_partir_de ? 'a partir de ' : '') + brl(l.preco) },
    { label: 'Duração', txt: l => (l.duracao ? duracaoTxt(l.duracao) : '—') },
  ]}
  Form=${({ f, extra, ctx }) => html`
    <div class="grade2">
      <${Campo} label="Status">
        <select value=${f.v.ativo ? '1' : '0'} onChange=${e => f.set('ativo', e.target.value === '1')}>
          <option value="1">Ativo</option><option value="0">Inativo</option>
        </select>
      <//>
      <${Campo} label="Nome do adicional" req><input ...${f.txt('nome')} /><//>
      <${Campo} label="Duração extra (minutos)"><input type="number" min="0" step="5" ...${f.num('duracao')} /><//>
      <${Campo} label="Preço (R$)" req><input type="number" min="0" step="0.01" ...${f.num('preco')} placeholder="0,00" /><//>
    </div>
    <${Chk} label="Mostrar “a partir de” antes do preço" ...${f.chk('a_partir_de')} />
    <${Campo} label="Descrição" dica="Opcional. Aparece para os clientes."><textarea rows="2" ...${f.txt('descricao')}></textarea><//>
    <${Campo} label="Foto do adicional"><${Imagem} valor=${f.v.foto_url} onChange=${u => f.set('foto_url', u)} pasta=${ctx.empresa.id} /><//>
    <${Obs} f=${f} />
    <${Campo} label="Serviços que aceitam este adicional">
      <${Marcar} itens=${extra.servicos} valor=${f.v._servs} onChange=${x => f.set('_servs', x)} todos="Selecionar todos os serviços" />
    <//>`} />`;

/* ---------- profissionais ---------- */
const NIVEL_DESC = {
  1: 'vê só a própria agenda e bloqueia os próprios horários',
  2: 'gerencia os próprios agendamentos',
  3: 'agenda de todos, clientes, financeiro e relatórios',
  4: 'administrador, acesso completo',
};
export const Profissionais = ({ ctx }) => html`<${Crud} ctx=${ctx} titulo="Profissionais" singular="profissional" btnNovo="Adicionar profissional"
  tabela="profissionais" select="*, servico_profissional(servico_id)" largura=${760}
  campos=${['nome', 'telefone', 'email', 'nascimento', 'cpf', 'rg', 'comissao', 'foto_url', 'observacoes', 'nivel_acesso', 'ativo', 'horarios']}
  numeros=${['comissao', 'nivel_acesso']}
  extra=${async () => ({ servicos: await q(db.from('servicos').select('id,nome').order('nome')) })}
  novo=${x => ({ nome: '', telefone: '', email: '', nascimento: '', cpf: '', rg: '', comissao: '', foto_url: null, observacoes: '', nivel_acesso: 2,
    ativo: true, horarios: structuredClone(ctx.empresa.horarios), _servs: (x.servicos || []).map(s => s.id) })}
  abrir=${l => ({ ...l, _servs: l.servico_profissional.map(x => x.servico_id) })}
  validar=${v => (!v.nome?.trim() ? 'Informe o nome.' : !horariosValidos(v.horarios) ? 'Confira os horários de expediente: o início deve ser antes do fim.' : null)}
  antes=${v => ({ email: v.email ? v.email.trim().toLowerCase() : null })}
  depois=${(id, v, ctx) => sincronizar('servico_profissional', 'profissional_id', id, 'servico_id', v._servs, ctx.empresa.id)}
  naoExcluir=${(v, ctx) => v.id === ctx.prof.id}
  colunas=${() => [
    { label: 'Nome', k: 'nome' },
    { label: 'Dias de trabalho', txt: l => [1, 2, 3, 4, 5, 6, 0].filter(d => (l.horarios?.[d] || []).length).map(d => DIAS_C[d]).join(', '),
      render: l => html`<span class="dias">${[0, 1, 2, 3, 4, 5, 6].map(d => html`<i class=${(l.horarios?.[d] || []).length ? 'on' : ''}>${DIAS_C[d][0]}</i>`)}</span>` },
    { label: 'Nível de acesso', txt: l => NIVEIS[l.nivel_acesso] },
    { label: 'Acesso', txt: l => (l.user_id ? 'Conta ativa' : l.email ? 'Aguardando cadastro' : 'Sem acesso') },
    { label: 'Aceitando agendamentos?', txt: l => (l.ativo ? 'Sim' : 'Não'), render: l => html`<${Selo} tipo=${l.ativo ? 'ok' : 'off'}>${l.ativo ? 'Sim' : 'Não'}<//>` },
  ]}
  Form=${({ f, extra, ctx }) => html`
    <h3>Dados básicos</h3>
    <div class="grade2">
      <${Campo} label="Status">
        <select value=${f.v.ativo ? '1' : '0'} onChange=${e => f.set('ativo', e.target.value === '1')}>
          <option value="1">Disponível para agendamentos</option><option value="0">Não habilitado para agendamentos</option>
        </select>
      <//>
      <${Campo} label="Nome" req><input ...${f.txt('nome')} /><//>
      <${Campo} label="Telefone"><input ...${f.tel('telefone')} /><//>
      <${Campo} label="Data de nascimento"><input type="date" ...${f.txt('nascimento')} /><//>
      <${Campo} label="CPF"><input ...${f.txt('cpf')} /><//>
      <${Campo} label="RG"><input ...${f.txt('rg')} /><//>
      <${Campo} label="Comissão (%)" dica="Percentual sobre os agendamentos concluídos.">
        <input type="number" min="0" max="100" step="0.5" ...${f.num('comissao')} placeholder="0" />
      <//>
    </div>
    <${Campo} label="Foto de perfil"><${Imagem} valor=${f.v.foto_url} onChange=${u => f.set('foto_url', u)} pasta=${ctx.empresa.id} redonda /><//>
    <${Obs} f=${f} />
    <h3>Dados de acesso</h3>
    <div class="grade2">
      <${Campo} label="E-mail de acesso"
        dica=${f.v.user_id ? 'Conta já vinculada. Só a própria pessoa altera e-mail e senha, em Minha Conta.'
          : 'A pessoa cria a própria conta na tela de entrada usando este e-mail e é vinculada à empresa automaticamente.'}>
        <input type="email" ...${f.txt('email')} disabled=${!!f.v.user_id} placeholder="email@exemplo.com" />
      <//>
      <${Campo} label="Nível de acesso">
        <select value=${f.v.nivel_acesso} onChange=${e => f.set('nivel_acesso', Number(e.target.value))} disabled=${f.v.id === ctx.prof.id}>
          ${[1, 2, 3, 4].map(n => html`<option value=${n}>${NIVEIS[n]} — ${NIVEL_DESC[n]}</option>`)}
        </select>
      <//>
    </div>
    <h3>Horário de expediente</h3>
    <${Horarios} valor=${f.v.horarios} onChange=${h => f.set('horarios', h)} fechado="Folga" />
    <h3>Serviços prestados</h3>
    <${Marcar} itens=${extra.servicos} valor=${f.v._servs} onChange=${x => f.set('_servs', x)} todos="Selecionar todos os serviços" />
    ${f.v.id ? html`<p class="mudo peq">Criado em ${fData(f.v.criado_em)} · Último acesso: ${f.v.ultimo_acesso ? new Date(f.v.ultimo_acesso).toLocaleString('pt-BR') : 'nunca'}</p>` : ''}
  `} />`;

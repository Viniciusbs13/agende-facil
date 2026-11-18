// Gestão: configurações da empresa, financeiro e registro de atividades.
import { html, useState, useEffect, db, q, tentar, toast, copiar, useForm, Campo, Chk, Modal, Imagem, Horarios, horariosValidos, Lista, Selo,
  brl, fData, hoje, addDias, addMeses, linkPublico, FORMAS, MSG_TIPOS, MSG_PADRAO, VARIAVEIS, TIPOS_CAMPO } from './lib.js';

/* ================= configurações ================= */
const op = pares => pares.map(([v, t]) => html`<option value=${v}>${t}</option>`);
const MIN = [[0, 'Desligado'], [5, '5 minutos'], [10, '10 minutos'], [20, '20 minutos'], [30, '30 minutos'], [60, '1 hora'], [120, '2 horas'], [180, '3 horas'], [360, '6 horas'], [720, '12 horas'], [1440, '1 dia'], [2880, '2 dias']];
const LIMITE = [[7, '7 dias'], [15, '15 dias'], [30, '1 mês'], [60, '2 meses'], [90, '3 meses'], [180, '6 meses'], [365, '12 meses']];
const SIMULT = [[1, '1 agendamento'], [2, '2 agendamentos'], [3, '3 agendamentos'], [5, '5 agendamentos'], [10, '10 agendamentos'], [0, 'Ilimitado']];
const CANCEL = [[60, '1 hora antes'], [120, '2 horas antes'], [180, '3 horas antes'], [360, '6 horas antes'], [720, '12 horas antes'], [1440, '1 dia antes'], [2880, '2 dias antes']];
const INTERVALO = [[5, '5 minutos'], [10, '10 minutos'], [15, '15 minutos'], [20, '20 minutos'], [30, '30 minutos'], [45, '45 minutos'], [60, '1 hora'], [90, '1 hora e 30 minutos'], [120, '2 horas']];
const RAMOS = ['Barbearia', 'Nail Designer / Esmalteria', 'Designer de Sobrancelhas', 'Lash Designer / Cílios', 'Cabeleireira / Trancista', 'Massoterapeuta / Massagem',
  'Estética / Depilação', 'Saúde / Médico', 'Tatuagem', 'Pet Shop', 'Fotografia', 'Lava-jato / Estética Automotiva', 'Outro ramo'];
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const ABAS = [['regras', 'Regras de agendamento'], ['empresa', 'Dados da empresa'], ['horarios', 'Horários de funcionamento'], ['datas', 'Datas bloqueadas'], ['pagina', 'Página de agendamento'],
  ['mensagens', 'Mensagens'], ['pagamentos', 'Pagamentos PIX'], ['campos', 'Campos personalizados']];

export function Configuracoes({ ctx }) {
  const [aba, setAba] = useState('regras');
  const f = useForm(structuredClone(ctx.empresa));
  const [sujo, setSujo] = useState(false);
  const v = f.v, c = v.config;
  // atualizações sempre a partir do estado mais recente, para duas mudanças seguidas não se sobrescreverem
  const set = (k, x) => { f.setV(o => ({ ...o, [k]: x })); setSujo(true); };
  const cfg = (k, x) => { f.setV(o => ({ ...o, config: { ...o.config, [k]: typeof x === 'function' ? x(o.config[k]) : x } })); setSujo(true); };
  const txt = k => ({ value: v[k] ?? '', onInput: e => set(k, e.target.value) });
  const selCfg = k => ({ value: c[k] ?? '', onChange: e => cfg(k, Number(e.target.value)) });
  const chkCfg = k => ({ checked: !!c[k], onChange: e => cfg(k, e.target.checked) });

  const salvar = async () => {
    if (!v.nome?.trim()) return toast('Informe o nome da empresa.', 'erro');
    if (!/^[a-z0-9-]{2,40}$/.test(v.slug || '')) return toast('O endereço da página deve ter de 2 a 40 letras minúsculas, números ou hífen.', 'erro');
    if (!horariosValidos(v.horarios)) return toast('Confira os horários de funcionamento: o início deve ser antes do fim.', 'erro');
    if (pix.ativo && !String(pix.chave || '').trim()) return toast('Informe a chave PIX ou desative o pagamento via PIX.', 'erro');
    const { id, criado_em, ...dados } = v;
    Object.keys(dados).forEach(k => { if (dados[k] === '') dados[k] = null; });
    if (await tentar(() => q(db.from('empresas').update(dados).eq('id', id)), 'Configurações salvas.')) { setSujo(false); ctx.recarregar(); }
  };
  const link = linkPublico(v.slug);
  const secoes = c.secoes || {};
  const msg = c.mensagem_pagina || {};
  const pix = c.pix || {};
  const setPix = x => cfg('pix', p => ({ ...(p || {}), ...x }));

  return html`
    <div class="pagina">
      <div class="titulo"><h1>Configurações</h1>
        ${aba !== 'datas' && aba !== 'campos' ? html`${sujo ? html`<span class="selo parcial">Alterações não salvas</span>` : ''}<button class="btn" onClick=${salvar}>Salvar configurações</button>` : ''}
      </div>
      <div class="abas">${ABAS.map(([k, t]) => html`<button class=${aba === k ? 'on' : ''} onClick=${() => setAba(k)}>${t}</button>`)}</div>

      ${aba === 'regras' ? html`
        <section class="bloco">
          <h2>Regras de agendamento</h2>
          <div class="grade2">
            <${Campo} label="Antecedência mínima para agendar" dica="Impede o cliente de marcar em cima da hora."><select ...${selCfg('antecedencia_min')}>${op(MIN)}</select><//>
            <${Campo} label="Limite de tempo da agenda" dica="Até quanto tempo no futuro o cliente pode agendar."><select ...${selCfg('limite_dias')}>${op(LIMITE)}</select><//>
            <${Campo} label="Agendamentos simultâneos por cliente" dica="Quantos agendamentos futuros um cliente pode manter."><select ...${selCfg('limite_agendamentos')}>${op(SIMULT)}</select><//>
            <${Campo} label="Prazo para cancelar ou remarcar" dica="Antecedência exigida para o cliente cancelar ou remarcar."><select ...${selCfg('cancelamento_min')}>${op(CANCEL)}</select><//>
            <${Campo} label="Intervalo de horários" dica="Horários de início mostrados ao cliente. Não altera a duração dos serviços."><select ...${selCfg('intervalo_min')}>${op(INTERVALO)}</select><//>
            <${Campo} label="Cálculo de comissão" dica="Por profissional: percentual do profissional. Por serviço: percentual de cada serviço.">
              <select value=${c.modo_comissao} onChange=${e => cfg('modo_comissao', e.target.value)}><option value="profissional">Por profissional</option><option value="servico">Por serviço</option></select>
            <//>
          </div>
          <${Chk} label="Concluir agendamentos automaticamente" dica="Quando passa do horário final, o agendamento vira “Concluído”." ...${chkCfg('auto_concluir')} />
        </section>
        <section class="bloco">
          <h2>Opções para o cliente</h2>
          <${Chk} label="Opção “Sem preferência” de profissional" dica="O sistema escolhe o profissional com menos agendamentos no dia. Só aparece com 2 ou mais profissionais." ...${chkCfg('sem_preferencia')} />
          <${Chk} label="Seleção de múltiplos serviços" dica="O cliente pode agendar vários serviços de uma vez." ...${chkCfg('multiplos_servicos')} />
          <${Chk} label="Pedir data de nascimento" dica="Mostra o campo ao cliente na hora de agendar." ...${chkCfg('pedir_nascimento')} />
          <${Chk} label="Botão “Enviar agendamento pelo WhatsApp”" dica="Ao finalizar, o cliente pode mandar os detalhes para o WhatsApp da empresa." ...${chkCfg('botao_whatsapp')} />
        </section>
        <section class="bloco">
          <h2>Mensagens para o cliente</h2>
          <${Campo} label="Mensagem exibida após o agendamento" dica="Deixe em branco para não mostrar nada.">
            <textarea rows="3" value=${c.msg_final || ''} onInput=${e => cfg('msg_final', e.target.value)}></textarea>
          <//>
          <${Campo} label="Política de cancelamento" dica="Aparece na tela final do agendamento e nos detalhes, na Área do Cliente.">
            <textarea rows="3" value=${c.msg_politica || ''} onInput=${e => cfg('msg_politica', e.target.value)}></textarea>
          <//>
        </section>` : ''}

      ${aba === 'empresa' ? html`
        <section class="bloco">
          <h2>Dados básicos</h2>
          <div class="grade2">
            <${Campo} label="Nome da empresa" req><input ...${txt('nome')} /><//>
            <${Campo} label="Telefone / WhatsApp" req><input ...${f.tel('telefone')} onInput=${e => set('telefone', e.target.value.replace(/\D/g, '').slice(0, 11))} /><//>
            <${Campo} label="Ramo"><select ...${txt('ramo')} onChange=${e => set('ramo', e.target.value)}><option value="">Selecione</option>${RAMOS.map(r => html`<option value=${r}>${r}</option>`)}</select><//>
            <${Campo} label="CEP"><input ...${txt('cep')} /><//>
            <${Campo} label="Logradouro"><input ...${txt('logradouro')} /><//>
            <${Campo} label="Número"><input ...${txt('numero')} /><//>
            <${Campo} label="Complemento"><input ...${txt('complemento')} /><//>
            <${Campo} label="Bairro"><input ...${txt('bairro')} /><//>
            <${Campo} label="Cidade"><input ...${txt('cidade')} /><//>
            <${Campo} label="Estado"><select ...${txt('estado')} onChange=${e => set('estado', e.target.value)}><option value="">Selecione</option>${UFS.map(u => html`<option value=${u}>${u}</option>`)}</select><//>
          </div>
        </section>
        <section class="bloco">
          <h2>Redes sociais</h2>
          <div class="grade2">
            ${[['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['twitter', 'X (Twitter)']].map(([k, t]) => html`
              <${Campo} label=${'Endereço do ' + t}><input ...${txt(k)} placeholder="https://" /><//>`)}
          </div>
        </section>` : ''}

      ${aba === 'horarios' ? html`
        <section class="bloco">
          <h2>Horários de funcionamento</h2>
          <p class="mudo peq">Os clientes só veem horários dentro do funcionamento da empresa e do expediente de cada profissional. Se mudar aqui, confira também o expediente dos profissionais.</p>
          <${Horarios} valor=${v.horarios} onChange=${h => set('horarios', h)} />
        </section>` : ''}

      ${aba === 'datas' ? html`<${DatasBloqueadas} ctx=${ctx} />` : ''}
      ${aba === 'campos' ? html`<${CamposPersonalizados} ctx=${ctx} />` : ''}

      ${aba === 'mensagens' ? html`
        <section class="bloco">
          <h2>Mensagens de WhatsApp</h2>
          <p class="mudo peq">Modelos usados no botão “Enviar no WhatsApp” de cada agendamento. O botão abre o WhatsApp com a mensagem pronta para o cliente. O disparo automático, sem clique, depende de conectar um provedor de WhatsApp.</p>
          ${MSG_TIPOS.map(([k, t, dica]) => {
            const m = { ...MSG_PADRAO[k], ...((c.mensagens || {})[k] || {}) };
            const setM = x => cfg('mensagens', ms => ({ ...(ms || {}), [k]: { ...MSG_PADRAO[k], ...((ms || {})[k] || {}), ...x } }));
            return html`
              <div class="modelo">
                <${Chk} label=${t} dica=${dica} checked=${m.ativo !== false} onChange=${e => setM({ ativo: e.target.checked })} />
                ${m.ativo !== false ? html`<textarea rows="4" value=${m.texto} onInput=${e => setM({ texto: e.target.value })}></textarea>` : ''}
              </div>`;
          })}
        </section>
        <section class="bloco">
          <h2>Variáveis</h2>
          <p class="mudo peq">Use nas mensagens: cada uma é trocada pelo valor real na hora do envio. Clique para copiar.</p>
          <div class="chips">${VARIAVEIS.map(([x, t]) => html`<button type="button" class="chip" title=${t} onClick=${() => copiar(x, 'Variável copiada!')}>${x}</button>`)}</div>
        </section>` : ''}

      ${aba === 'pagamentos' ? html`
        <section class="bloco">
          <h2>Pagamento via PIX</h2>
          <${Chk} label="Aceitar pagamento via PIX no link de agendamento" checked=${!!pix.ativo} onChange=${e => setPix({ ativo: e.target.checked })}
            dica="Ao confirmar o agendamento, o cliente vê o valor, o QR code e o código copia e cola. A conferência é manual: você confere o recebimento e registra o pagamento no agendamento." />
          ${pix.ativo ? html`
            <div class="grade2">
              <${Campo} label="Tipo de pagamento">
                <select value=${pix.tipo || 'total'} onChange=${e => setPix({ tipo: e.target.value })}>${op([['total', 'Valor total do agendamento'], ['fixo', 'Sinal fixo'], ['percentual', 'Sinal percentual']])}</select>
              <//>
              ${pix.tipo === 'fixo' ? html`<${Campo} label="Valor do sinal (R$)" req><input type="number" min="0" step="0.01" value=${pix.valor_fixo ?? ''} onInput=${e => setPix({ valor_fixo: e.target.value })} /><//>` : ''}
              ${pix.tipo === 'percentual' ? html`<${Campo} label="Percentual do agendamento (%)" req><input type="number" min="1" max="100" value=${pix.percentual ?? ''} onInput=${e => setPix({ percentual: e.target.value })} /><//>` : ''}
              <${Campo} label="Tipo da chave">
                <select value=${pix.tipo_chave || 'cpf'} onChange=${e => setPix({ tipo_chave: e.target.value })}>${op([['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['email', 'E-mail'], ['telefone', 'Telefone'], ['aleatoria', 'Aleatória']])}</select>
              <//>
              <${Campo} label="Chave PIX" req><input value=${pix.chave || ''} onInput=${e => setPix({ chave: e.target.value })} /><//>
              <${Campo} label="Nome do recebedor" dica="Como aparece no banco. Até 25 letras, sem acentos."><input value=${pix.nome || ''} onInput=${e => setPix({ nome: e.target.value })} placeholder=${v.nome} /><//>
              <${Campo} label="Cidade do recebedor"><input value=${pix.cidade || ''} onInput=${e => setPix({ cidade: e.target.value })} placeholder=${v.cidade || ''} /><//>
            </div>
            <${Campo} label="Instruções" dica="Texto mostrado ao cliente junto do PIX.">
              <textarea rows="2" value=${pix.instrucoes || ''} onInput=${e => setPix({ instrucoes: e.target.value })}></textarea>
            <//>
            <${Chk} label="Mostrar botão “Enviar comprovante pelo WhatsApp”" checked=${pix.botao_comprovante !== false} onChange=${e => setPix({ botao_comprovante: e.target.checked })} />
            <p class="mudo peq">A confirmação automática do pagamento depende de contratar um provedor de pagamentos; por enquanto ela é manual.</p>` : ''}
        </section>` : ''}

      ${aba === 'pagina' ? html`
        <section class="bloco">
          <h2>Página</h2>
          <div class="grade2">
            <${Campo} label="Status da página de agendamento" dica="Desativada, os clientes não conseguem marcar horários.">
              <select value=${v.pagina_ativa ? '1' : '0'} onChange=${e => set('pagina_ativa', e.target.value === '1')}><option value="1">Ativada</option><option value="0">Desativada</option></select>
            <//>
            <${Campo} label="Endereço da página" dica="Só letras minúsculas, números e hífen.">
              <input value=${v.slug} onInput=${e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
            <//>
          </div>
          <div class="linha"><input readonly value=${link} />
            <button class="btn sec" onClick=${() => copiar(link, 'Link copiado!')}>Copiar</button><a class="btn sec" href=${link} target="_blank">Abrir</a></div>
          ${sujo ? html`<p class="mudo peq">Salve para o link passar a valer com as alterações.</p>` : ''}
        </section>
        <section class="bloco">
          <h2>Aparência</h2>
          <div class="grade2">
            <${Campo} label="Logo"><${Imagem} valor=${v.logo_url} onChange=${u => set('logo_url', u)} pasta=${v.id} redonda /><//>
            <${Campo} label="Imagem de capa"><${Imagem} valor=${v.capa_url} onChange=${u => set('capa_url', u)} pasta=${v.id} /><//>
            <${Campo} label="Cor do tema"><div class="linha"><input type="color" value=${v.cor_tema} onInput=${e => set('cor_tema', e.target.value)} /><input ...${txt('cor_tema')} /></div><//>
            <${Campo} label="Texto abaixo do nome da empresa"><input ...${txt('slogan')} /><//>
          </div>
        </section>
        <section class="bloco">
          <h2>Conteúdo</h2>
          <${Chk} label="Mensagem personalizada" dica="Mostrada no topo da página de agendamento para todos os visitantes."
            checked=${!!msg.ativo} onChange=${e => cfg('mensagem_pagina', { ...msg, ativo: e.target.checked })} />
          ${msg.ativo ? html`
            <div class="grade2 recuo">
              <${Campo} label="Tipo"><select value=${msg.tipo} onChange=${e => cfg('mensagem_pagina', { ...msg, tipo: e.target.value })}>
                ${op([['info', 'Informação'], ['aviso', 'Aviso'], ['urgente', 'Urgente'], ['promo', 'Promoção']])}</select><//>
              <${Campo} label="Título"><input value=${msg.titulo || ''} onInput=${e => cfg('mensagem_pagina', { ...msg, titulo: e.target.value })} /><//>
            </div>
            <${Campo} label="Texto" cls="recuo"><textarea rows="2" value=${msg.texto || ''} onInput=${e => cfg('mensagem_pagina', { ...msg, texto: e.target.value })}></textarea><//>` : ''}
          <h3>Seções exibidas na página</h3>
          <${Chk} label="Botão “Agendar agora” (sempre ativo)" checked disabled />
          ${[['servicos', 'Serviços'], ['equipe', 'Equipe'], ['localizacao', 'Localização'], ['horarios', 'Horários de funcionamento'], ['redes', 'Redes sociais']].map(([k, t]) => html`
            <${Chk} label=${t} checked=${secoes[k] !== false} onChange=${e => cfg('secoes', { ...secoes, [k]: e.target.checked })} />`)}
        </section>` : ''}
    </div>`;
}

function DatasBloqueadas({ ctx }) {
  const [ls, setLs] = useState(null);
  const [novo, setNovo] = useState(false);
  const f = useForm({ data_inicio: hoje(), data_fim: hoje(), motivo: '' });
  const carregar = () => tentar(async () => setLs(await q(db.from('bloqueios').select('*').is('profissional_id', null).is('hora_inicio', null).order('data_inicio'))));
  useEffect(() => { carregar(); }, []);
  const salvar = async () => {
    if (f.v.data_fim < f.v.data_inicio) return toast('A data de fim deve ser igual ou depois da de início.', 'erro');
    if (await tentar(() => q(db.from('bloqueios').insert({ empresa_id: ctx.empresa.id, ...f.v, motivo: f.v.motivo.trim() || null })), 'Datas bloqueadas.')) { setNovo(false); carregar(); }
  };
  const remover = async b => {
    if (!confirm('Remover este bloqueio de datas?')) return;
    if (await tentar(() => q(db.from('bloqueios').delete().eq('id', b.id)), 'Bloqueio removido.')) carregar();
  };
  return html`
    <section class="bloco">
      <div class="titulo"><h2>Datas bloqueadas</h2><button class="btn" onClick=${() => setNovo(true)}>Adicionar nova data</button></div>
      <p class="mudo peq">Datas em que a empresa não atende, como feriados e férias. Para bloquear só um intervalo de horas, use “Bloquear horário” na Agenda.</p>
      <div class="tabela-rolagem"><table>
        <thead><tr><th>Data de início</th><th>Data de término</th><th>Motivo</th><th></th></tr></thead>
        <tbody>
          ${ls && ls.length === 0 ? html`<tr><td colspan="4" class="mudo centro">Nenhuma data bloqueada.</td></tr>` : ''}
          ${(ls || []).map(b => html`<tr><td>${fData(b.data_inicio)}</td><td>${fData(b.data_fim)}</td><td>${b.motivo || '—'}</td>
            <td><button class="btn link peq" onClick=${() => remover(b)}>Remover</button></td></tr>`)}
        </tbody>
      </table></div>
      ${novo ? html`
        <${Modal} titulo="Bloquear datas" onClose=${() => setNovo(false)} largura=${460}
          rodape=${html`<span class="espaco"></span><button class="btn sec" onClick=${() => setNovo(false)}>Fechar</button><button class="btn" onClick=${salvar}>Bloquear datas</button>`}>
          <div class="grade2">
            <${Campo} label="Data de início" req><input type="date" ...${f.txt('data_inicio')} /><//>
            <${Campo} label="Data de fim" req><input type="date" ...${f.txt('data_fim')} /><//>
          </div>
          <${Campo} label="Motivo"><input ...${f.txt('motivo')} placeholder="Opcional" /><//>
        <//>` : ''}
    </section>`;
}

function CamposPersonalizados({ ctx }) {
  const [ls, setLs] = useState(null);
  const [ed, setEd] = useState(null);
  const carregar = () => tentar(async () => setLs(await q(db.from('campos_personalizados').select('*').order('ordem').order('nome'))));
  useEffect(() => { carregar(); }, []);
  const salvar = async () => {
    if (!ed.nome.trim()) return toast('Informe o nome do campo.', 'erro');
    const dados = { nome: ed.nome.trim(), tipo: ed.tipo, obrigatorio: !!ed.obrigatorio, ordem: Number(ed.ordem) || 0 };
    const ok = await tentar(() => q(ed.id ? db.from('campos_personalizados').update(dados).eq('id', ed.id)
      : db.from('campos_personalizados').insert({ ...dados, empresa_id: ctx.empresa.id })), 'Campo salvo.');
    if (ok) { setEd(null); carregar(); }
  };
  const remover = async c => {
    if (!confirm(`Remover o campo “${c.nome}”? As respostas já registradas continuam nos agendamentos.`)) return;
    if (await tentar(() => q(db.from('campos_personalizados').delete().eq('id', c.id)), 'Campo removido.')) carregar();
  };
  return html`
    <section class="bloco">
      <div class="titulo"><h2>Campos personalizados</h2><button class="btn" onClick=${() => setEd({ nome: '', tipo: 'texto', obrigatorio: false, ordem: (ls || []).length + 1 })}>Adicionar campo</button></div>
      <p class="mudo peq">Informações extras pedidas ao cliente no momento do agendamento. Ficam visíveis no agendamento e no cadastro do cliente.</p>
      <div class="tabela-rolagem"><table>
        <thead><tr><th>Ordem</th><th>Nome</th><th>Tipo</th><th>Obrigatório</th><th></th></tr></thead>
        <tbody>
          ${ls && ls.length === 0 ? html`<tr><td colspan="5" class="mudo centro">Nenhum campo personalizado ainda.</td></tr>` : ''}
          ${(ls || []).map(c => html`<tr class="clicavel" onClick=${() => setEd(c)}><td>${c.ordem}</td><td>${c.nome}</td><td>${(TIPOS_CAMPO.find(t => t[0] === c.tipo) || [])[1] || c.tipo}</td><td>${c.obrigatorio ? 'Sim' : 'Não'}</td>
            <td><button class="btn link peq perigo" onClick=${e => { e.stopPropagation(); remover(c); }}>Remover</button></td></tr>`)}
        </tbody>
      </table></div>
      ${ed ? html`
        <${Modal} titulo=${ed.id ? 'Editar campo' : 'Adicionar campo'} onClose=${() => setEd(null)} largura=${460}
          rodape=${html`<span class="espaco"></span><button class="btn sec" onClick=${() => setEd(null)}>Cancelar</button><button class="btn" onClick=${salvar}>Salvar campo</button>`}>
          <${Campo} label="Nome do campo" req dica="Exemplo: Alergias, Como nos conheceu, Placa do veículo."><input value=${ed.nome} onInput=${e => setEd({ ...ed, nome: e.target.value })} /><//>
          <div class="grade2">
            <${Campo} label="Tipo"><select value=${ed.tipo} onChange=${e => setEd({ ...ed, tipo: e.target.value })}>${op(TIPOS_CAMPO)}</select><//>
            <${Campo} label="Ordem"><input type="number" value=${ed.ordem} onInput=${e => setEd({ ...ed, ordem: e.target.value })} /><//>
          </div>
          <${Chk} label="Preenchimento obrigatório" checked=${!!ed.obrigatorio} onChange=${e => setEd({ ...ed, obrigatorio: e.target.checked })} />
        <//>` : ''}
    </section>`;
}

/* ================= financeiro ================= */
const CAT_DESPESA = ['Salário', 'Comissão', 'Aluguel', 'Contas Fixas (Água, Luz, Internet)', 'Produtos', 'Sistema', 'Prestadores de Serviço', 'Marketing', 'Tarifas Bancárias', 'Impostos', 'Outros'];
const REC = { dias: n => b => addDias(b, n), semanas: n => b => addDias(b, 7 * n), quinzenas: n => b => addDias(b, 14 * n), meses: n => b => addMeses(b, n), anos: n => b => addMeses(b, 12 * n) };

export function Financeiro({ ctx }) {
  const [ls, setLs] = useState(null);
  const [de, setDe] = useState(hoje().slice(0, 8) + '01');
  const [ate, setAte] = useState(addDias(addMeses(hoje().slice(0, 8) + '01', 1), -1));
  const [tipo, setTipo] = useState('');
  const [ed, setEd] = useState(null);
  const carregar = () => tentar(async () => setLs(await q(db.from('lancamentos').select('*, cliente:clientes(nome)').gte('data', de).lte('data', ate).order('data', { ascending: false }).order('id', { ascending: false }))));
  useEffect(() => { carregar(); }, [de, ate]);
  const soma = (t, s) => (ls || []).filter(l => l.tipo === t && (!s || l.status === s)).reduce((x, l) => x + Number(l.valor), 0);
  const receitas = soma('receita', 'pago'), despesas = soma('despesa', 'pago'), pendente = soma('despesa', 'pendente');
  return html`
    <div class="pagina larga">
      <div class="titulo"><h1>Financeiro</h1>
        <button class="btn sec" onClick=${() => setEd({ tipo: 'despesa', data: hoje(), categoria: '', descricao: '', valor: '', forma_pagamento: 'Pix', status: 'pago', rec: false, vezes: 2, periodo: 'meses' })}>Nova despesa</button>
        <button class="btn" onClick=${() => setEd({ tipo: 'receita', data: hoje(), categoria: 'Manual', descricao: '', valor: '', forma_pagamento: 'Pix', status: 'pago' })}>Nova receita</button>
      </div>
      <div class="cartoes">
        <div class="cartao"><span>Receitas</span><b class="sobe">${brl(receitas)}</b></div>
        <div class="cartao"><span>Despesas</span><b class="desce">${brl(despesas)}</b><small class="mudo">${brl(pendente)} pendente</small></div>
        <div class="cartao"><span>Lucro</span><b>${brl(receitas - despesas)}</b></div>
      </div>
      <${Lista} linhas=${ls && ls.filter(l => !tipo || l.tipo === tipo)} nomeArquivo="financeiro" onLinha=${l => setEd({ ...l, descricao: l.descricao || '' })}
        filtros=${html`
          <label class="filtro">De <input type="date" value=${de} onInput=${e => e.target.value && setDe(e.target.value)} /></label>
          <label class="filtro">Até <input type="date" value=${ate} onInput=${e => e.target.value && setAte(e.target.value)} /></label>
          <select value=${tipo} onChange=${e => setTipo(e.target.value)}><option value="">Receitas e despesas</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select>`}
        colunas=${[
          { label: 'Tipo', txt: l => (l.tipo === 'receita' ? 'Receita' : 'Despesa'), render: l => html`<${Selo} tipo=${l.tipo === 'receita' ? 'ok' : 'cancelado'}>${l.tipo === 'receita' ? 'Receita' : 'Despesa'}<//>` },
          { label: 'Data', txt: l => fData(l.data) },
          { label: 'Categoria', k: 'categoria' },
          { label: 'Descrição', txt: l => l.descricao || '—' },
          { label: 'Cliente', txt: l => l.cliente?.nome || '—' },
          { label: 'Forma de pagamento', k: 'forma_pagamento' },
          { label: 'Valor', txt: l => brl(l.valor) },
          { label: 'Status', txt: l => (l.status === 'pago' ? 'Pago' : 'Pendente'), render: l => html`<${Selo} tipo=${l.status === 'pago' ? 'pago' : 'parcial'}>${l.status === 'pago' ? 'Pago' : 'Pendente'}<//>` },
        ]} />
      ${ed ? html`<${LancModal} ctx=${ctx} inicial=${ed} onClose=${() => setEd(null)} onSalvo=${() => { setEd(null); carregar(); }} />` : ''}
    </div>`;
}

function LancModal({ ctx, inicial, onClose, onSalvo }) {
  const f = useForm(inicial);
  const v = f.v, despesa = v.tipo === 'despesa';
  const salvar = async () => {
    if (!v.data || !(Number(v.valor) > 0)) return toast('Informe a data e o valor.', 'erro');
    if (despesa && !v.categoria) return toast('Escolha a categoria da despesa.', 'erro');
    const base = { tipo: v.tipo, data: v.data, categoria: v.categoria || 'Manual', descricao: v.descricao.trim() || null, valor: Number(v.valor),
      forma_pagamento: v.forma_pagamento, status: despesa ? v.status : 'pago' };
    const ok = await tentar(async () => {
      if (v.id) return q(db.from('lancamentos').update(base).eq('id', v.id));
      const linhas = [{ ...base, empresa_id: ctx.empresa.id }];
      if (despesa && v.rec) for (let n = 1; n < Math.min(Number(v.vezes) || 1, 60); n++) linhas.push({ ...linhas[0], data: REC[v.periodo](n)(v.data) });
      await q(db.from('lancamentos').insert(linhas));
    }, 'Lançamento salvo.');
    if (ok) onSalvo();
  };
  const excluir = async () => {
    if (!confirm('Excluir este lançamento? Essa ação não pode ser desfeita.')) return;
    if (await tentar(() => q(db.from('lancamentos').delete().eq('id', v.id)), 'Lançamento excluído.')) onSalvo();
  };
  return html`
    <${Modal} titulo=${v.id ? 'Editar lançamento' : despesa ? 'Nova despesa' : 'Nova receita'} onClose=${onClose} largura=${520}
      rodape=${html`${v.id && ctx.nivel === 4 ? html`<button class="btn perigo-link" onClick=${excluir}>Excluir</button>` : ''}<span class="espaco"></span>
        <button class="btn sec" onClick=${onClose}>Fechar</button><button class="btn" onClick=${salvar}>${v.id ? 'Atualizar' : 'Cadastrar'}</button>`}>
      <div class="grade2">
        <${Campo} label="Data" req><input type="date" ...${f.txt('data')} /><//>
        <${Campo} label="Valor (R$)" req><input type="number" min="0" step="0.01" ...${f.txt('valor')} placeholder="0,00" /><//>
        ${despesa ? html`
          <${Campo} label="Categoria" req><select ...${f.txt('categoria')} onChange=${e => f.set('categoria', e.target.value)}><option value="">Selecione uma categoria</option>${CAT_DESPESA.map(x => html`<option value=${x}>${x}</option>`)}</select><//>
          <${Campo} label="Status" req><select ...${f.txt('status')} onChange=${e => f.set('status', e.target.value)}><option value="pago">Pago</option><option value="pendente">Pendente</option></select><//>` : ''}
        <${Campo} label="Forma de pagamento" req><select ...${f.txt('forma_pagamento')} onChange=${e => f.set('forma_pagamento', e.target.value)}>${FORMAS.map(x => html`<option value=${x}>${x}</option>`)}</select><//>
      </div>
      <${Campo} label="Descrição"><input ...${f.txt('descricao')} placeholder="Opcional" /><//>
      ${despesa && !v.id ? html`
        <${Chk} label="Definir recorrência" dica="Lança a mesma despesa várias vezes, no intervalo escolhido." ...${f.chk('rec')} />
        ${v.rec ? html`<div class="grade2 recuo">
          <${Campo} label="Quantas vezes"><input type="number" min="2" max="60" ...${f.txt('vezes')} /><//>
          <${Campo} label="A cada"><select ...${f.txt('periodo')} onChange=${e => f.set('periodo', e.target.value)}>
            ${op([['dias', 'Dias'], ['semanas', 'Semanas'], ['quinzenas', 'Quinzenas'], ['meses', 'Meses'], ['anos', 'Anos']])}</select><//>
        </div>` : ''}` : ''}
    <//>`;
}

/* ================= logs ================= */
export function Logs() {
  const [ls, setLs] = useState(null);
  useEffect(() => { tentar(async () => setLs(await q(db.from('logs').select('*').order('id', { ascending: false }).limit(1000)))); }, []);
  return html`
    <div class="pagina">
      <div class="titulo"><h1>Logs de atividades</h1></div>
      <${Lista} linhas=${ls} nomeArquivo="logs" colunas=${[
        { label: 'ID', k: 'id' }, { label: 'Usuário', k: 'usuario' }, { label: 'Ação', k: 'acao' }, { label: 'IP', txt: l => l.ip || '—' },
        { label: 'Data da ação', txt: l => new Date(l.criado_em).toLocaleString('pt-BR') },
      ]} />
    </div>`;
}

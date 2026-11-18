// Página pública de agendamento (link enviado aos clientes) e Área do Cliente.
import { html, render, useState, useEffect, db, q, tentar, toast, copiar, Modal, Campo, APP_NOME, CamposExtras, camposFaltando, valorPix, pixCopiaCola, aplicarTema,
  brl, fone, digitos, fData, hoje, iso, dt, addDias, addMeses, duracaoTxt, DIAS, DIAS_C, MESES, STATUS } from './lib.js';

const slug = new URLSearchParams(location.search).get('e') || '';
const chaveTel = `cliente:${slug}`;
const lerTel = () => { try { return localStorage.getItem(chaveTel) || ''; } catch { return ''; } };
const gravarTel = t => { try { t ? localStorage.setItem(chaveTel, t) : localStorage.removeItem(chaveTel); } catch { /* sem armazenamento */ } };
const preco = s => (s.sob_consulta ? 'Sob consulta' : (s.a_partir_de ? 'a partir de ' : '') + brl(s.preco));
const dataLonga = d => `${DIAS[dt(d).getDay()]}, ${fData(d)}`;

/* ---------- calendário com dias e horários livres ---------- */
function Calendario({ servicos, adicionais, prof, ignorar, limiteDias, valor, onEscolher }) {
  const [mes, setMes] = useState(hoje().slice(0, 8) + '01');
  const [disp, setDisp] = useState(null);
  const [dia, setDia] = useState(valor?.data || null);
  const ultimo = addDias(hoje(), limiteDias || 60);
  useEffect(() => {
    setDisp(null);
    const ini = mes < hoje() ? hoje() : mes;
    const fim = addDias(addMeses(mes, 1), -1);
    tentar(async () => setDisp(await q(db.rpc('pub_disponibilidade', { p_slug: slug, p_inicio: ini, p_fim: fim, p_servicos: servicos,
      p_adicionais: adicionais || [], p_prof: prof || null, p_ignorar: ignorar || null }))));
  }, [mes]);
  const inicio = addDias(mes, -((dt(mes).getDay() + 6) % 7));
  const horas = (disp && dia && disp[dia]) || [];
  return html`
    <div class="cal">
      <div class="cal-topo">
        <button class="btn link" disabled=${mes <= hoje().slice(0, 8) + '01'} onClick=${() => setMes(addMeses(mes, -1))}>← Anterior</button>
        <b>${MESES[dt(mes).getMonth()]} ${mes.slice(0, 4)}</b>
        <button class="btn link" disabled=${addMeses(mes, 1) > ultimo} onClick=${() => setMes(addMeses(mes, 1))}>Próximo →</button>
      </div>
      <div class="cal-grade">
        ${[1, 2, 3, 4, 5, 6, 0].map(d => html`<span class="cab">${DIAS_C[d]}</span>`)}
        ${Array.from({ length: 42 }, (_, i) => {
          const d = addDias(inicio, i);
          const livre = disp && disp[d] && d.slice(0, 7) === mes.slice(0, 7);
          return html`<button class="dia ${d === dia ? 'on' : ''} ${d === hoje() ? 'hoje' : ''}" disabled=${!livre} onClick=${() => setDia(d)}>${Number(d.slice(8))}</button>`;
        })}
      </div>
      ${disp == null ? html`<p class="mudo centro">Carregando horários…</p>` : ''}
      ${disp && Object.keys(disp).length === 0 ? html`<p class="mudo centro">Nenhum horário disponível neste mês.</p>` : ''}
      ${dia && horas.length ? html`
        <p class="sep"><span>${dataLonga(dia)}</span></p>
        <div class="horas">${horas.map(h => html`<button class="hora ${valor?.data === dia && valor?.hora === h ? 'on' : ''}" onClick=${() => onEscolher(dia, h)}>${h}</button>`)}</div>` : ''}
    </div>`;
}

/* ---------- pagamento online (Mercado Pago) ---------- */
async function pagarOnline(agendamento, telefone) {
  const { data, error } = await db.functions.invoke('pagamentos', { body: { acao: 'criar', slug, telefone, agendamento,
    retorno: `${location.origin}${location.pathname}?e=${encodeURIComponent(slug)}` } });
  if (error || !data || data.erro) throw new Error((data && data.erro) || 'Não foi possível iniciar o pagamento. Tente de novo.');
  location.href = data.url;
}
function PagarBloco({ pix, ag, tel }) {
  const [oc, setOc] = useState(false);
  const valor = Math.max(0, valorPix(pix, ag.valor_total) - Number(ag.pago || 0));
  if (!(valor > 0)) return '';
  return html`
    <div class="pix">
      <h3>Pagamento</h3>
      <p>${pix.tipo === 'fixo' || pix.tipo === 'percentual' ? 'Sinal para garantir o horário' : 'Valor do agendamento'}: <b>${brl(valor)}</b></p>
      <button class="btn" disabled=${oc} onClick=${async () => { setOc(true); await tentar(() => pagarOnline(ag.id, tel)); setOc(false); }}>${oc ? 'Abrindo…' : 'Pagar com PIX ou cartão'}</button>
      <p class="mudo peq">Você será levado ao Mercado Pago e volta para cá quando terminar.</p>
      ${pix.instrucoes ? html`<p class="mudo">${pix.instrucoes}</p>` : ''}
    </div>`;
}

/* ---------- pagamento via PIX na confirmação ---------- */
function PixBloco({ pix, total, empresa, ag, nome }) {
  const valor = valorPix(pix, total);
  const codigo = valor > 0 ? pixCopiaCola(pix, valor, empresa.nome) : '';
  const [qr, setQr] = useState('');
  useEffect(() => {
    if (!codigo) return;
    import('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm').then(m => (m.default || m).toDataURL(codigo, { margin: 1, width: 360 })).then(setQr).catch(() => {});
  }, [codigo]);
  if (!codigo) return '';
  const comprovante = () => window.open(`https://wa.me/55${digitos(empresa.telefone)}?text=${encodeURIComponent(
    `Olá! Segue o comprovante do PIX de ${brl(valor)} do meu agendamento de ${fData(ag.data)} às ${ag.hora_inicio}. Nome: ${nome}`)}`, '_blank');
  return html`
    <div class="pix">
      <h3>Pagamento via PIX</h3>
      <p>${pix.tipo === 'fixo' || pix.tipo === 'percentual' ? 'Sinal para garantir o horário' : 'Valor do agendamento'}: <b>${brl(valor)}</b></p>
      ${qr ? html`<img src=${qr} alt="QR code para pagamento via PIX" width="180" height="180" />` : ''}
      <div class="linha"><input readonly value=${codigo} onFocus=${e => e.target.select()} aria-label="Código PIX copia e cola" />
        <button class="btn sec" onClick=${() => copiar(codigo, 'Código PIX copiado!')}>Copiar código</button></div>
      ${pix.instrucoes ? html`<p class="mudo">${pix.instrucoes}</p>` : ''}
      ${pix.botao_comprovante !== false && empresa.telefone ? html`<button class="btn sec" onClick=${comprovante}>Enviar comprovante pelo WhatsApp</button>` : ''}
    </div>`;
}

/* ---------- fluxo de agendamento ---------- */
function Fluxo({ d, x, inicial, onClose }) {
  const cfg = d.empresa.config;
  const [etapa, setEtapa] = useState('servicos');
  const [servs, setServs] = useState(inicial ? [inicial] : []);
  const [adics, setAdics] = useState([]);
  const [prof, setProf] = useState(undefined); // undefined = não escolhido; null = sem preferência
  const [quando, setQuando] = useState(null);
  const [tel, setTel] = useState(lerTel());
  const [cliente, setCliente] = useState(null);
  const [nome, setNome] = useState('');
  const [nasc, setNasc] = useState('');
  const [obs, setObs] = useState('');
  const [extras, setExtras] = useState({});
  const [feito, setFeito] = useState(null);
  const [oc, setOc] = useState(false);

  const escolhidos = d.servicos.filter(s => servs.includes(s.id));
  const adPossiveis = d.adicionais.filter(a => escolhidos.some(s => s.adicionais.includes(a.id)));
  const adEscolhidos = adPossiveis.filter(a => adics.includes(a.id));
  const equipe = d.equipe.filter(p => escolhidos.every(s => s.profissionais.includes(p.id)));
  const total = [...escolhidos.filter(s => !s.sob_consulta), ...adEscolhidos].reduce((t, x) => t + Number(x.preco), 0);
  const duracao = [...escolhidos, ...adEscolhidos].reduce((t, x) => t + Number(x.duracao), 0);
  const profEscolhido = prof ? d.equipe.find(p => p.id === prof) : null;

  const alternar = id => {
    setQuando(null);
    if (cfg.multiplos_servicos === false) return setServs([id]);
    setServs(servs.includes(id) ? servs.filter(x => x !== id) : [...servs, id]);
  };
  const aposServicos = () => {
    if (!servs.length) return toast('Escolha ao menos um serviço.', 'erro');
    if (equipe.length === 0) return toast('Nenhum profissional realiza todos esses serviços juntos. Agende-os separadamente.', 'erro');
    if (adPossiveis.length) return setEtapa('adicionais');
    aposAdicionais();
  };
  const aposAdicionais = () => {
    if (equipe.length === 1) { setProf(equipe[0].id); return setEtapa('horario'); }
    setEtapa('profissional');
  };
  const aposTelefone = async () => {
    if (digitos(tel).length < 10) return toast('Informe seu WhatsApp com DDD.', 'erro');
    setOc(true);
    await tentar(async () => {
      const r = await q(db.rpc('pub_cliente', { p_slug: slug, p_telefone: tel }));
      setCliente(r?.cliente || null);
      setEtapa(r?.cliente ? 'revisao' : 'dados');
    });
    setOc(false);
  };
  const confirmar = async () => {
    const falta = camposFaltando(x.campos, extras);
    if (falta.length) return toast(`Preencha: ${falta.join(', ')}.`, 'erro');
    setOc(true);
    const r = await tentar(() => q(db.rpc('pub_agendar', { p_slug: slug, p_servicos: servs, p_adicionais: adEscolhidos.map(a => a.id), p_prof: prof || null,
      p_data: quando.data, p_hora: quando.hora, p_nome: cliente?.nome || nome, p_telefone: tel, p_nascimento: nasc || null, p_obs: obs || null })));
    setOc(false);
    if (r) {
      if (Object.keys(extras).length) await tentar(() => q(db.rpc('pub_campos', { p_slug: slug, p_telefone: tel, p_id: r.id, p_campos: extras })));
      gravarTel(digitos(tel)); setFeito(r); setEtapa('ok');
    }
  };
  const voltar = { adicionais: 'servicos', profissional: adPossiveis.length ? 'adicionais' : 'servicos',
    horario: equipe.length > 1 ? 'profissional' : adPossiveis.length ? 'adicionais' : 'servicos',
    telefone: 'horario', dados: 'telefone', revisao: 'horario' }[etapa];

  const titulos = { servicos: 'Escolha os serviços', adicionais: 'Deseja adicionar algo?', profissional: 'Escolha o profissional', horario: 'Selecione um dia e horário',
    telefone: 'Preencha seus dados', dados: 'Preencha seus dados', revisao: 'Confirme seu agendamento', ok: 'Agendamento confirmado' };
  const resumo = (a = null) => html`
    <dl class="resumo">
      <div><dt>Data</dt><dd>${a ? fData(a.data) : dataLonga(quando.data)}</dd></div>
      <div><dt>Hora</dt><dd>${a ? a.hora_inicio : quando.hora}</dd></div>
      <div class="larga"><dt>Serviços</dt><dd>${(a ? a.servicos : escolhidos).map(s => s.nome).join(', ')}</dd></div>
      ${(a ? a.adicionais : adEscolhidos).length ? html`<div class="larga"><dt>Adicionais</dt><dd>${(a ? a.adicionais : adEscolhidos).map(s => s.nome).join(', ')}</dd></div>` : ''}
      <div class="larga"><dt>Profissional</dt><dd>${a ? a.profissional : profEscolhido ? profEscolhido.nome : 'Sem preferência'}</dd></div>
      <div><dt>Duração</dt><dd>${duracaoTxt(duracao)}</dd></div>
      <div><dt>Valor total</dt><dd>${brl(a ? a.valor_total : total)}</dd></div>
    </dl>`;
  const zap = () => {
    const t = `Olá! Acabei de agendar pelo link:\n${feito.servicos.map(s => s.nome).join(', ')}\n${fData(feito.data)} às ${feito.hora_inicio}\nProfissional: ${feito.profissional}\nNome: ${cliente?.nome || nome}`;
    window.open(`https://wa.me/55${digitos(d.empresa.telefone)}?text=${encodeURIComponent(t)}`, '_blank');
  };

  const rodape = etapa === 'ok' ? html`
      <a class="btn sec" href="#conta" onClick=${onClose}>Área do Cliente</a><span class="espaco"></span>
      ${cfg.botao_whatsapp !== false && d.empresa.telefone ? html`<button class="btn zap" onClick=${() => { zap(); onClose(); }}>Fechar e avisar no WhatsApp</button>` : html`<button class="btn" onClick=${onClose}>Fechar</button>`}`
    : html`
      ${voltar ? html`<button class="btn link" onClick=${() => setEtapa(voltar)}>‹ Voltar</button>` : ''}<span class="espaco"></span>
      ${etapa === 'servicos' ? html`<button class="btn" disabled=${!servs.length} onClick=${aposServicos}>Próximo ›</button>` : ''}
      ${etapa === 'adicionais' ? html`<button class="btn" onClick=${aposAdicionais}>Próximo ›</button>` : ''}
      ${etapa === 'horario' ? html`<button class="btn" disabled=${!quando} onClick=${() => setEtapa(lerTel() && tel ? 'revisao' : 'telefone')}>Próximo ›</button>` : ''}
      ${etapa === 'telefone' ? html`<button class="btn" disabled=${oc} onClick=${aposTelefone}>Próximo ›</button>` : ''}
      ${etapa === 'dados' ? html`<button class="btn" onClick=${() => (nome.trim().length < 2 ? toast('Informe seu nome e sobrenome.', 'erro')
        : cfg.pedir_nascimento && !nasc ? toast('Informe sua data de nascimento.', 'erro') : setEtapa('revisao'))}>Próximo ›</button>` : ''}
      ${etapa === 'revisao' ? html`<button class="btn" disabled=${oc} onClick=${confirmar}>${oc ? 'Confirmando…' : 'Confirmar ✓'}</button>` : ''}`;

  // cliente que já entrou antes: busca o nome para a revisão
  useEffect(() => { if (lerTel()) tentar(async () => { const r = await q(db.rpc('pub_cliente', { p_slug: slug, p_telefone: lerTel() })); if (r?.cliente) setCliente(r.cliente); else { gravarTel(''); } }); }, []);

  return html`
    <${Modal} titulo=${titulos[etapa]} onClose=${onClose} largura=${520} rodape=${rodape}>
      ${etapa === 'servicos' ? html`
        <div class="opcoes">${d.servicos.map(s => html`
          <button class="opcao ${servs.includes(s.id) ? 'on' : ''}" onClick=${() => alternar(s.id)}>
            <i class="caixinha"></i><span><b>${s.nome}</b>${s.descricao ? html`<small>${s.descricao}</small>` : ''}</span>
            <span class="lado"><b>${preco(s)}</b><small>${duracaoTxt(s.duracao)}</small></span>
          </button>`)}</div>
        <p class="mudo centro">${servs.length ? `${servs.length} serviço(s) · ${duracaoTxt(duracao)} · ${brl(total)}` : 'Nenhum serviço selecionado'}</p>` : ''}

      ${etapa === 'adicionais' ? html`
        <div class="opcoes">${adPossiveis.map(a => html`
          <button class="opcao ${adics.includes(a.id) ? 'on' : ''}" onClick=${() => { setQuando(null); setAdics(adics.includes(a.id) ? adics.filter(x => x !== a.id) : [...adics, a.id]); }}>
            <i class="caixinha"></i><span><b>${a.nome}</b>${a.descricao ? html`<small>${a.descricao}</small>` : ''}</span>
            <span class="lado"><b>+${brl(a.preco)}</b>${a.duracao ? html`<small>+${a.duracao} min</small>` : ''}</span>
          </button>`)}</div>` : ''}

      ${etapa === 'profissional' ? html`
        <div class="opcoes">
          ${cfg.sem_preferencia !== false ? html`<button class="opcao ${prof === null ? 'on' : ''}" onClick=${() => { setProf(null); setQuando(null); setEtapa('horario'); }}>
            <i class="avatar">★</i><span><b>Sem preferência</b><small>Qualquer profissional disponível</small></span></button>` : ''}
          ${equipe.map(p => html`<button class="opcao ${prof === p.id ? 'on' : ''}" onClick=${() => { setProf(p.id); setQuando(null); setEtapa('horario'); }}>
            <i class="avatar" style=${p.foto_url ? `background-image:url('${p.foto_url}')` : ''}>${p.foto_url ? '' : p.nome[0]}</i><span><b>${p.nome}</b></span></button>`)}
        </div>` : ''}

      ${etapa === 'horario' ? html`<${Calendario} key=${servs.join() + adics.join() + prof} servicos=${servs} adicionais=${adEscolhidos.map(a => a.id)} prof=${prof}
        limiteDias=${cfg.limite_dias} valor=${quando} onEscolher=${(data, hora) => setQuando({ data, hora })} />` : ''}

      ${etapa === 'telefone' ? html`
        <${Campo} label="Digite seu WhatsApp"><input inputmode="tel" placeholder="(00) 00000-0000" value=${fone(tel)}
          onInput=${e => setTel(digitos(e.target.value).slice(0, 11))} onKeyDown=${e => e.key === 'Enter' && aposTelefone()} /><//>
        <p class="mudo peq">Usamos seu número para identificar seus agendamentos.</p>` : ''}

      ${etapa === 'dados' ? html`
        <${Campo} label="Nome e sobrenome"><input value=${nome} onInput=${e => setNome(e.target.value)} placeholder="Nome e sobrenome" /><//>
        ${cfg.pedir_nascimento ? html`<${Campo} label="Data de nascimento"><input type="date" value=${nasc} onInput=${e => setNasc(e.target.value)} /><//>` : ''}
        <${Campo} label="WhatsApp"><input disabled value=${fone(tel)} /><//>` : ''}

      ${etapa === 'revisao' ? html`
        <p class="destaque aviso-cor">Revise seu agendamento</p>
        ${resumo()}
        <dl class="resumo"><div><dt>Nome</dt><dd>${cliente?.nome || nome}</dd></div><div><dt>Telefone</dt><dd>${fone(tel)}</dd></div></dl>
        <p class="mudo peq">Não é você? <button class="btn link peq" onClick=${() => { gravarTel(''); setCliente(null); setTel(''); setEtapa('telefone'); }}>Trocar telefone</button></p>
        <${CamposExtras} campos=${x.campos} valor=${extras} onChange=${setExtras} />
        <${Campo} label="Observações"><textarea rows="2" value=${obs} onInput=${e => setObs(e.target.value)} placeholder="Se precisar, deixe uma observação para o seu agendamento."></textarea><//>` : ''}

      ${etapa === 'ok' ? html`
        <p class="destaque ok-cor">✓ Agendamento confirmado!</p>
        ${resumo(feito)}
        ${x.pix && x.pix.modo === 'mercadopago' ? (x.mp_ativo ? html`<${PagarBloco} pix=${x.pix} ag=${feito} tel=${tel} />` : '')
          : x.pix ? html`<${PixBloco} pix=${x.pix} total=${feito.valor_total} empresa=${d.empresa} ag=${feito} nome=${cliente?.nome || nome} />` : ''}
        ${cfg.msg_final ? html`<p class="recado">${cfg.msg_final}</p>` : ''}
        ${cfg.msg_politica ? html`<h3>Política de cancelamento</h3><p class="mudo">${cfg.msg_politica}</p>` : ''}` : ''}
    <//>`;
}

/* ---------- área do cliente ---------- */
function Conta({ d, x }) {
  const [tel, setTel] = useState(lerTel());
  const [dig, setDig] = useState('');
  const [c, setC] = useState(undefined);
  const [aba, setAba] = useState('proximos');
  const [ver, setVer] = useState(null);
  const [rem, setRem] = useState(null);
  const [quando, setQuando] = useState(null);
  const [meus, setMeus] = useState({ nome: '', nascimento: '' });
  const carregar = async t => {
    const r = await tentar(() => q(db.rpc('pub_cliente', { p_slug: slug, p_telefone: t })));
    if (r && r.cliente) { setC(r); setMeus({ nome: r.cliente.nome, nascimento: r.cliente.nascimento || '' }); gravarTel(digitos(t)); setTel(digitos(t)); }
    else { setC(null); if (r === true || r === null) toast('Não encontramos agendamentos com esse telefone.', 'erro'); gravarTel(''); setTel(''); }
  };
  useEffect(() => { if (tel) carregar(tel); else setC(null); }, []);
  const sair = () => { gravarTel(''); setTel(''); setC(null); };
  const cancelar = async a => {
    if (!confirm('Você tem certeza? Após o cancelamento, não será possível reverter essa ação.')) return;
    if (await tentar(() => q(db.rpc('pub_cancelar', { p_slug: slug, p_telefone: tel, p_id: a.id })), 'Agendamento cancelado.')) { setVer(null); carregar(tel); }
  };
  const remarcar = async () => {
    if (await tentar(() => q(db.rpc('pub_remarcar', { p_slug: slug, p_telefone: tel, p_id: rem.id, p_data: quando.data, p_hora: quando.hora })), 'Agendamento remarcado.')) {
      setRem(null); setQuando(null); carregar(tel);
    }
  };
  const salvarDados = async () => {
    if (meus.nome.trim().length < 2) return toast('Informe seu nome.', 'erro');
    if (await tentar(() => q(db.rpc('pub_salvar_cliente', { p_slug: slug, p_telefone: tel, p_nome: meus.nome, p_nascimento: meus.nascimento || null })), 'Dados salvos.')) carregar(tel);
  };

  if (c === undefined) return html`<p class="mudo centro">Carregando…</p>`;
  if (!c) return html`
    <div class="cartao-pub estreito">
      <h2>Área do Cliente</h2>
      <${Campo} label="Seu telefone"><input inputmode="tel" placeholder="(00) 00000-0000" value=${fone(dig)}
        onInput=${e => setDig(digitos(e.target.value).slice(0, 11))} onKeyDown=${e => e.key === 'Enter' && carregar(dig)} /><//>
      <button class="btn largo" onClick=${() => (digitos(dig).length < 10 ? toast('Informe seu telefone com DDD.', 'erro') : carregar(dig))}>Entrar</button>
    </div>`;

  const futuro = a => a.status === 'agendado' && `${a.data}T${a.hora_inicio}` >= c.agora;
  const lista = c.agendamentos.filter(a => (aba === 'proximos' ? futuro(a) : !futuro(a)));
  if (aba === 'proximos') lista.reverse();
  return html`
    <div class="abas centro">
      ${[['proximos', 'Próximos agendamentos'], ['historico', 'Histórico'], ['dados', 'Meus dados']].map(([k, t]) => html`<button class=${aba === k ? 'on' : ''} onClick=${() => setAba(k)}>${t}</button>`)}
      <button onClick=${sair}>Sair</button>
    </div>
    ${aba === 'dados' ? html`
      <div class="cartao-pub estreito">
        <${Campo} label="Nome e sobrenome" req><input value=${meus.nome} onInput=${e => setMeus({ ...meus, nome: e.target.value })} /><//>
        <${Campo} label="Telefone"><input disabled value=${fone(tel)} /><//>
        <${Campo} label="Data de nascimento"><input type="date" value=${meus.nascimento} onInput=${e => setMeus({ ...meus, nascimento: e.target.value })} /><//>
        <button class="btn" onClick=${salvarDados}>Salvar</button>
      </div>` : html`
      ${lista.length === 0 ? html`<p class="mudo centro">${aba === 'proximos' ? 'Você não tem agendamentos futuros.' : 'Você não possui agendamentos em seu histórico.'}</p>` : ''}
      ${lista.map(a => html`
        <div class="cartao-ag">
          <div class="quando"><b>${a.data.slice(8)}</b><span>${MESES[Number(a.data.slice(5, 7)) - 1].slice(0, 3).toUpperCase()}</span><small>${DIAS[dt(a.data).getDay()]}</small></div>
          <div class="meio"><span><span class="selo ${a.status}">${STATUS[a.status]}</span>${Number(a.pago) > 0 ? html` <span class="selo pago">Pago ${brl(a.pago)}</span>` : ''}</span><b>${a.servicos.map(s => s.nome).join(', ')}</b>
            <small class="mudo">${a.hora_inicio} · ${a.profissional}</small></div>
          <div class="acoes">
            <button class="btn link peq" onClick=${() => setVer(a)}>Ver detalhes ›</button>
            ${futuro(a) && x.mp_ativo && valorPix(x.pix, a.valor_total) - Number(a.pago || 0) > 0 ? html`<button class="btn peq" onClick=${() => tentar(() => pagarOnline(a.id, tel))}>Pagar</button>` : ''}
            ${futuro(a) ? html`<button class="btn link peq" onClick=${() => { setQuando(null); setRem(a); }}>Remarcar</button>
              <button class="btn link peq perigo" onClick=${() => cancelar(a)}>Cancelar</button>` : ''}
          </div>
        </div>`)}`}
    ${ver ? html`
      <${Modal} titulo="Dados do agendamento" onClose=${() => setVer(null)} largura=${480}
        rodape=${futuro(ver) ? html`<button class="btn perigo-link" onClick=${() => cancelar(ver)}>Cancelar</button><span class="espaco"></span>
          <button class="btn" onClick=${() => { setRem(ver); setVer(null); setQuando(null); }}>Remarcar</button>` : null}>
        <dl class="resumo">
          <div><dt>Status</dt><dd>${STATUS[ver.status]}</dd></div><div><dt>Data</dt><dd>${fData(ver.data)}</dd></div>
          <div><dt>Hora</dt><dd>${ver.hora_inicio}</dd></div><div><dt>Profissional</dt><dd>${ver.profissional}</dd></div>
          <div class="larga"><dt>Serviços</dt><dd>${ver.servicos.map(s => s.nome).join(', ')}</dd></div>
          <div class="larga"><dt>Adicionais</dt><dd>${ver.adicionais.map(s => s.nome).join(', ') || '—'}</dd></div>
          <div><dt>Valor total</dt><dd>${brl(ver.valor_total)}</dd></div><div><dt>Observações</dt><dd>${ver.observacoes || '—'}</dd></div>
        </dl>
        ${d.empresa.config.msg_politica ? html`<h3>Política de cancelamento</h3><p class="mudo">${d.empresa.config.msg_politica}</p>` : ''}
      <//>` : ''}
    ${rem ? html`
      <${Modal} titulo="Selecione um dia e horário para remarcar" onClose=${() => setRem(null)} largura=${520}
        rodape=${html`<span class="espaco"></span><button class="btn" disabled=${!quando} onClick=${remarcar}>Remarcar ✓</button>`}>
        <${Calendario} servicos=${rem.servicos.map(s => s.id)} adicionais=${rem.adicionais.map(s => s.id)} ignorar=${rem.id}
          limiteDias=${d.empresa.config.limite_dias} valor=${quando} onEscolher=${(data, hora) => setQuando({ data, hora })} />
      <//>` : ''}`;
}

/* ---------- catálogo: fotos e vídeos de um serviço ---------- */
function VerServico({ s, ms, onClose, onAgendar }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const f = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', f);
    document.body.classList.add('sem-rolagem');
    return () => { document.removeEventListener('keydown', f); document.body.classList.remove('sem-rolagem'); };
  }, []);
  const rolar = e => setI(Math.round(e.target.scrollLeft / e.target.clientWidth));
  return html`
    <div class="visor" role="dialog" aria-label=${s.nome} onClick=${e => e.target === e.currentTarget && onClose()}>
      <div class="visor-caixa">
        <button class="x" onClick=${onClose} aria-label="Fechar">×</button>
        ${ms.length ? html`
          <div class="carrossel" onScroll=${rolar}>
            ${ms.map(m => html`<div class="quadro">${m.tipo === 'video'
              ? html`<video src=${m.url} controls playsinline preload="metadata"></video>`
              : html`<img src=${m.url} alt=${s.nome} />`}</div>`)}
          </div>
          ${ms.length > 1 ? html`<div class="pontos">${ms.map((_, j) => html`<i class=${j === i ? 'on' : ''}></i>`)}</div>` : ''}` : ''}
        <div class="visor-txt">
          <h2>${s.nome}</h2>
          <p><b>${preco(s)}</b> <span class="mudo">· ${duracaoTxt(s.duracao)}</span></p>
          ${s.descricao ? html`<p class="mudo">${s.descricao}</p>` : ''}
          <button class="btn largo" onClick=${onAgendar}>Agendar este serviço</button>
        </div>
      </div>
    </div>`;
}

/* ---------- página ---------- */
const REDES = [['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['twitter', 'X']];
function Pagina() {
  const [d, setD] = useState(undefined);
  const [fluxo, setFluxo] = useState(null);
  const [x, setX] = useState({ pix: null, campos: [], ramo: null, galeria: [], midias: {} });
  const [ver, setVer] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [volta, setVolta] = useState(0);
  // retorno do Mercado Pago: confere o pagamento e mostra a Área do Cliente
  useEffect(() => {
    const pg = new URLSearchParams(location.search).get('pg');
    if (!pg) return;
    history.replaceState(null, '', `${location.pathname}?e=${encodeURIComponent(slug)}#conta`);
    setConta(true);
    db.functions.invoke('pagamentos', { body: { acao: 'verificar', pagamento: pg } }).then(({ data }) => {
      const s = data && data.status;
      toast(s === 'aprovado' ? 'Pagamento confirmado. Obrigado!' : s === 'recusado' ? 'O pagamento não foi aprovado. Você pode tentar de novo.'
        : 'Pagamento em processamento. Assim que for confirmado, aparece aqui.', s === 'recusado' ? 'erro' : s === 'aprovado' ? 'ok' : 'aviso');
      setVolta(v => v + 1);
    });
  }, []);
  const [conta, setConta] = useState(location.hash === '#conta');
  useEffect(() => {
    tentar(async () => setD(await q(db.rpc('pub_empresa', { p_slug: slug }))));
    tentar(async () => { const r = await q(db.rpc('pub_extras', { p_slug: slug })); if (r) setX(r); });
    const f = () => setConta(location.hash === '#conta');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  useEffect(() => {
    if (!d?.empresa) return;
    document.title = `${d.empresa.nome} — agendamento online`;
    aplicarTema(d.empresa.cor_tema);
  }, [d]);

  if (d === undefined) return html`<p class="mudo centro topo-vazio">Carregando…</p>`;
  if (!d) return html`<div class="cartao-pub estreito topo-vazio"><h2>Página não encontrada</h2><p class="mudo">Confira o endereço do link de agendamento.</p></div>`;
  if (d.inativa) return html`<div class="cartao-pub estreito topo-vazio"><h2>${d.nome}</h2><p class="mudo">A página de agendamento está temporariamente indisponível.</p></div>`;
  const e = d.empresa, sec = e.config.secoes || {}, msg = e.config.mensagem_pagina || {};
  const endereco = [e.logradouro && `${e.logradouro}${e.numero ? ', ' + e.numero : ''}`, e.complemento, e.bairro, e.cidade && `${e.cidade}${e.estado ? ' - ' + e.estado : ''}`, e.cep].filter(Boolean).join(' · ');
  const redes = REDES.filter(([k]) => e[k]);
  const midiasDe = s => (x.midias || {})[s.id] || (s.foto_url ? [{ url: s.foto_url, tipo: 'foto' }] : []);
  const catalogo = d.servicos.some(s => midiasDe(s).length);
  const grupos = [...d.categorias.map(c => [c, d.servicos.filter(s => s.categoria_id === c.id)]), [{ nome: 'Outros serviços' }, d.servicos.filter(s => !d.categorias.some(c => c.id === s.categoria_id))]].filter(g => g[1].length);

  return html`
    <div class="pub">
      <div class="faixa"><a href=${conta ? '#' : '#conta'}>${conta ? '‹ Voltar' : 'Área do Cliente'}</a></div>
      <div class="capa" style=${e.capa_url ? `background-image:url('${e.capa_url}')` : ''}></div>
      <div class="conteudo">
        <div class="cartao-pub cabecalho">
          <div class="logo" style=${e.logo_url ? `background-image:url('${e.logo_url}')` : ''}>${e.logo_url ? '' : e.nome[0]}</div>
          <h1>${e.nome}</h1>
          ${x.ramo && !conta ? html`<span class="ramo">${x.ramo}${e.cidade ? ` em ${e.cidade}` : ''}</span>` : ''}
          <p class="mudo">${conta ? 'Área do Cliente' : e.slogan}</p>
          ${!conta ? html`<button class="btn grande" onClick=${() => setFluxo({})}>Agendar agora</button>` : ''}
        </div>
        ${conta ? html`<${Conta} d=${d} x=${x} key=${volta} />` : html`
          ${msg.ativo && (msg.titulo || msg.texto) ? html`<div class="recado ${msg.tipo}"><b>${msg.titulo}</b>${msg.texto ? html`<p>${msg.texto}</p>` : ''}</div>` : ''}
          ${sec.servicos !== false && d.servicos.length ? html`
            <h2 class="secao">Serviços</h2>
            ${grupos.map(([c, ss]) => html`
              ${grupos.length > 1 || c.id ? html`<h3 class="cat">${c.nome}</h3>` : ''}
              <div class=${catalogo ? 'catalogo' : 'servicos'}>${ss.map(s => {
                const ms = midiasDe(s), capa = ms[0];
                return catalogo ? html`
                  <article class="item">
                    <button class="item-capa" onClick=${() => setVer(s)} aria-label=${`Ver fotos de ${s.nome}`}>
                      ${!capa ? html`<span class="sem-foto">${s.nome[0]}</span>` : capa.tipo === 'video'
                        ? html`<video src=${capa.url} muted playsinline preload="metadata"></video><span class="play">▶</span>`
                        : html`<img src=${capa.url} alt=${s.nome} loading="lazy" />`}
                      ${ms.length > 1 ? html`<span class="conta">1/${ms.length}</span>` : ''}
                    </button>
                    <div class="item-txt"><b>${s.nome}</b>${s.descricao ? html`<small class="mudo">${s.descricao}</small>` : ''}
                      <small>${duracaoTxt(s.duracao)} · <b>${preco(s)}</b></small></div>
                    <button class="btn peq" onClick=${() => setFluxo({ servico: s.id })}>Agendar</button>
                  </article>` : html`
                  <div class="servico">
                    <div class="txt"><b>${s.nome}</b>${s.descricao ? html`<small class="mudo">${s.descricao}</small>` : ''}<small>${duracaoTxt(s.duracao)} · <b>${preco(s)}</b></small></div>
                    <button class="btn peq" onClick=${() => setFluxo({ servico: s.id })}>Agendar</button>
                  </div>`;
              })}</div>`)}` : ''}
          ${(x.galeria || []).length ? html`
            <h2 class="secao">Fotos</h2>
            <div class="galeria">${x.galeria.map((u, i) => html`<button class="foto-g" style=${`background-image:url('${u}')`} onClick=${() => setZoom(u)} aria-label=${`Ampliar foto ${i + 1}`}></button>`)}</div>` : ''}
          ${sec.equipe !== false && d.equipe.length ? html`
            <h2 class="secao">Nossa equipe</h2>
            <div class="equipe">${d.equipe.map(p => html`<div><i class="avatar grande" style=${p.foto_url ? `background-image:url('${p.foto_url}')` : ''}>${p.foto_url ? '' : p.nome[0]}</i><span>${p.nome}</span></div>`)}</div>` : ''}
          ${sec.localizacao !== false ? html`
            <h2 class="secao">Localização</h2>
            <div class="cartao-pub">${endereco ? html`<p>${endereco}</p><a class="btn sec peq" target="_blank" href=${'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(endereco)}>Ver no mapa</a>`
              : html`<p class="mudo">Endereço não informado pela empresa.</p>`}</div>` : ''}
          ${sec.horarios !== false ? html`
            <h2 class="secao">Horários</h2>
            <div class="cartao-pub">${[1, 2, 3, 4, 5, 6, 0].map(n => html`<div class="linha-h"><span>${DIAS[n]}</span>
              <b>${(e.horarios[n] || []).length ? e.horarios[n].map(f => `${f.i} - ${f.f}`).join(' · ') : 'Fechado'}</b></div>`)}</div>` : ''}
          ${sec.redes !== false && redes.length ? html`
            <h2 class="secao">Redes sociais</h2>
            <div class="redes">${redes.map(([k, t]) => html`<a class="btn sec" target="_blank" rel="noopener" href=${e[k]}>${t}</a>`)}</div>` : ''}`}
      </div>
      ${!conta && !fluxo ? html`<div class="barra-fixa"><button class="btn largo" onClick=${() => setFluxo({})}>Agendar agora</button></div>` : ''}
      ${ver ? html`<${VerServico} s=${ver} ms=${midiasDe(ver)} onClose=${() => setVer(null)} onAgendar=${() => { setFluxo({ servico: ver.id }); setVer(null); }} />` : ''}
      ${zoom ? html`<div class="zoom" onClick=${() => setZoom(null)} role="dialog" aria-label="Foto ampliada"><img src=${zoom} alt="Foto da empresa" /><button class="x" aria-label="Fechar">×</button></div>` : ''}
      <footer class="rodape-pub">Agendamento online por <b>${APP_NOME}</b></footer>
      ${fluxo ? html`<${Fluxo} d=${d} x=${x} inicial=${fluxo.servico} onClose=${() => setFluxo(null)} />` : ''}
    </div>`;
}

render(html`<${Pagina} />`, document.getElementById('raiz'));

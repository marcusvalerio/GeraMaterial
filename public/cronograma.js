// Cronograma da turma: distribui a carga horária das UCs em aulas, semanas e meses.
// Cálculo feito no navegador (sem IA): instantâneo e exato.

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const chaveData = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dataBr = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const somaDias = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

// Feriados nacionais (fixos e móveis) e pontos facultativos que costumam parar as aulas.
export function feriadosNacionais(ano) {
  const p = pascoa(ano);
  const lista = [
    [new Date(ano, 0, 1), "Confraternização Universal"],
    [somaDias(p, -48), "Carnaval"], [somaDias(p, -47), "Carnaval"],
    [somaDias(p, -2), "Sexta-feira Santa"],
    [new Date(ano, 3, 21), "Tiradentes"],
    [new Date(ano, 4, 1), "Dia do Trabalho"],
    [somaDias(p, 60), "Corpus Christi"],
    [new Date(ano, 8, 7), "Independência"],
    [new Date(ano, 9, 12), "Nossa Senhora Aparecida"],
    [new Date(ano, 10, 2), "Finados"],
    [new Date(ano, 10, 15), "Proclamação da República"],
    [new Date(ano, 10, 20), "Consciência Negra"],
    [new Date(ano, 11, 25), "Natal"],
  ];
  return new Map(lista.map(([d, n]) => [chaveData(d), n]));
}

// Converte "08/12/2026, 24/12/2026 a 06/01/2027" em um conjunto de datas.
export function lerDiasSemAula(texto) {
  const set = new Set();
  const datas = (s) => {
    const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!m) return null;
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear();
    return new Date(ano, Number(m[2]) - 1, Number(m[1]));
  };
  for (const parte of String(texto || "").split(/[,;\n]+/)) {
    const [a, b] = parte.split(/\s+a\s+|\s*-\s*|\s+até\s+/i);
    const ini = datas(a || "");
    if (!ini) continue;
    const fim = b ? datas(b) : ini;
    for (let d = ini; fim && d <= fim; d = somaDias(d, 1)) set.add(chaveData(d));
  }
  return set;
}

export function lerDataBr(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

const horas = (ch) => Number(String(ch || "").replace(",", ".").match(/[\d.]+/)?.[0] || 0);

/**
 * Monta o cronograma do curso.
 * @param ucs [{nome, cargaHoraria}] na ordem do curso
 * @param cfg {inicio: Date, horasAula: número, dias: [0-6], semAula: Set de "aaaa-mm-dd"}
 */
export function montarCronograma(ucs, cfg) {
  const { inicio, horasAula, dias, semAula = new Set() } = cfg;
  if (!inicio || !(horasAula > 0) || !dias?.length || !ucs?.length) return null;
  const feriados = new Map();
  const pulados = [];
  let d = new Date(inicio);
  const proximaAula = () => {
    for (let guarda = 0; guarda < 3000; guarda++) {
      const k = chaveData(d);
      if (!feriados.has(d.getFullYear())) feriados.set(d.getFullYear(), feriadosNacionais(d.getFullYear()));
      const feriado = feriados.get(d.getFullYear()).get(k);
      const atual = new Date(d);
      d = somaDias(d, 1);
      if (!dias.includes(atual.getDay())) continue;
      if (feriado || semAula.has(k)) { pulados.push({ data: atual, motivo: feriado || "Sem aula (informado)" }); continue; }
      return atual;
    }
    return null;
  };
  const resultado = ucs.map((uc) => {
    const total = horas(uc.cargaHoraria);
    const aulas = [];
    let restante = total;
    while (restante > 0.001) {
      const data = proximaAula();
      if (!data) break;
      const ch = Math.min(horasAula, restante);
      aulas.push({ data, ch });
      restante -= ch;
    }
    const ini = aulas[0]?.data, fim = aulas.at(-1)?.data;
    const semanas = ini ? Math.ceil(((fim - ini) / 86400000 + 1) / 7) : 0;
    return { ...uc, horas: total, aulas, inicio: ini, termino: fim, semanas };
  });
  const todas = resultado.flatMap((u) => u.aulas);
  const ini = todas[0]?.data, fim = todas.at(-1)?.data;
  // Resumo por mês: aulas e horas.
  const meses = new Map();
  for (const a of todas) {
    const k = `${a.data.getFullYear()}-${a.data.getMonth()}`;
    const m = meses.get(k) || { rotulo: `${MESES[a.data.getMonth()][0].toUpperCase()}${MESES[a.data.getMonth()].slice(1)} de ${a.data.getFullYear()}`, aulas: 0, horas: 0 };
    m.aulas++; m.horas += a.ch;
    meses.set(k, m);
  }
  const puladosNoPeriodo = pulados.filter((p) => !fim || p.data <= fim);
  return {
    cfg, ucs: resultado, inicio: ini, termino: fim,
    totalAulas: todas.length, totalHoras: todas.reduce((s, a) => s + a.ch, 0),
    semanas: ini ? Math.ceil(((fim - ini) / 86400000 + 1) / 7) : 0,
    meses: [...meses.values()], pulados: puladosNoPeriodo,
  };
}

// Dados de uma UC no formato que vai para o PER (datas reais, não inventadas pela IA).
// Aulas do instrutor dentro do período em que ele dá aula (de/até opcionais).
export function noPeriodo(data, periodo) {
  if (!periodo) return true;
  if (periodo.de && data < periodo.de) return false;
  if (periodo.ate && data > periodo.ate) return false;
  return true;
}

// Aulas de uma UC dentro de um período (quando o "mapão" da escola põe a UC em datas
// diferentes da sequência calculada): mesmos dias da semana, horas por aula e feriados.
function aulasNoPeriodo(cfg, uc, periodo) {
  if (!cfg || !periodo?.de) return [];
  const total = horas(uc.cargaHoraria);
  const aulas = [];
  let d = new Date(periodo.de), restante = total;
  for (let guarda = 0; guarda < 3000 && restante > 0.001; guarda++, d = somaDias(d, 1)) {
    if (periodo.ate && d > periodo.ate) break;
    if (!cfg.dias.includes(d.getDay())) continue;
    const k = chaveData(d);
    if (feriadosNacionais(d.getFullYear()).get(k) || cfg.semAula?.has(k)) continue;
    const ch = Math.min(cfg.horasAula, restante);
    aulas.push({ data: new Date(d), ch });
    restante -= ch;
  }
  return aulas;
}

export function cronogramaDaUc(crono, nomeUc, periodo = null) {
  const u = crono?.ucs.find((x) => x.nome === nomeUc);
  if (!u) return null;
  const total = u.aulas.length;
  let minhas = u.aulas.map((a, i) => ({ ...a, n: i + 1 })).filter((a) => noPeriodo(a.data, periodo));
  let noMapao = false;
  // A UC não cai no período pela sequência calculada: o período informado é quando ela acontece.
  if (!minhas.length && periodo) {
    minhas = aulasNoPeriodo(crono.cfg, u, { de: periodo.de || crono.inicio, ate: periodo.ate }).map((a, i) => ({ ...a, n: i + 1 }));
    noMapao = true;
  }
  if (!minhas.length) return { vazio: true, total };
  return {
    dataInicio: dataBr(minhas[0].data),
    dataTermino: dataBr(minhas.at(-1).data),
    aulas: minhas.map((a) => ({ data: dataBr(a.data), ch: `${String(a.ch).replace(".", ",")}h` })),
    total, primeira: minhas[0].n, ultima: minhas.at(-1).n, noMapao,
    // Parcial = outro instrutor deu as aulas anteriores (o instrutor não começa na aula 1).
    parcial: minhas[0].n > 1,
    incompleta: minhas.at(-1).n < total,
  };
}

export { DIAS_SEMANA, dataBr };

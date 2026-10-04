const SUPABASE_URL = 'https://daoydhqlfghbutgytgti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb3lkaHFsZmdoYnV0Z3l0Z3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwODE2MDMsImV4cCI6MjEwNjY1NzYwM30.57ogpb_BzrD9E4JISzKcHchqFPkh8zMfWnotmq5jayg';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Grade base de horários (9h30 às 19h)
const GRADE_HORARIOS = [
  "09:30", "11:00", "13:00", "14:30", "16:00", "17:30"
];

let servicoSelecionado = null;
let horarioSelecionado = null;

// Impede seleção de datas passadas
const inputData = document.getElementById('data-agenda');
inputData.min = new Date().toISOString().split('T')[0];

async function carregarServicos() {
  const container = document.getElementById('lista-servicos');
  const { data: servicos, error } = await _supabase
    .from('servicos')
    .select('*')
    .order('preco', { ascending: true });

  if (error) {
    container.innerHTML = '<p>Erro ao carregar serviços.</p>';
    return;
  }

  container.innerHTML = '';
  servicos.forEach(servico => {
    const card = document.createElement('div');
    card.className = 'servico-item';
    card.innerHTML = `
      <div>
        <strong>${servico.nome}</strong>
        <span class="duracao">⏱ ${servico.duracao_minutos} min</span>
      </div>
      <span class="preco">R$ ${Number(servico.preco).toFixed(2)}</span>
    `;
    card.onclick = () => {
      document.querySelectorAll('.servico-item').forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');
      servicoSelecionado = servico;
      if (inputData.value) renderizarHorarios(inputData.value);
    };
    container.appendChild(card);
  });
}

inputData.addEventListener('change', (e) => {
  renderizarHorarios(e.target.value);
});

async function renderizarHorarios(dataEscolhida) {
  const grid = document.getElementById('slots-horario');
  grid.innerHTML = '<p class="hint">Consultando disponibilidade...</p>';
  horarioSelecionado = null;
  validarBotaoEnvio();

  // 1. Buscar agendamentos que não foram recusados
  const { data: ocupadosAgendamento } = await _supabase
    .from('agendamentos')
    .select('horario')
    .eq('data', dataEscolhida)
    .neq('status', 'recusado');

  // 2. Buscar bloqueios manuais cadastrados no admin
  const { data: bloqueios } = await _supabase
    .from('bloqueios_manuais')
    .select('horario')
    .eq('data', dataEscolhida);

  const horariosIndisponiveis = new Set([
    ...(ocupadosAgendamento || []).map(item => item.horario.slice(0, 5)),
    ...(bloqueios || []).map(item => item.horario.slice(0, 5))
  ]);

  grid.innerHTML = '';

  GRADE_HORARIOS.forEach(hora => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerText = hora;
    
    const estaOcupado = horariosIndisponiveis.has(hora);

    if (estaOcupado) {
      btn.className = 'slot-btn slot-vermelho';
      btn.disabled = true;
      btn.title = 'Horário indisponível';
    } else {
      btn.className = 'slot-btn slot-verde';
      btn.onclick = () => {
        document.querySelectorAll('.slot-btn.slot-verde').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        horarioSelecionado = hora;
        validarBotaoEnvio();
      };
    }

    grid.appendChild(btn);
  });
}

function validarBotaoEnvio() {
  const btn = document.getElementById('btn-confirmar');
  btn.disabled = !(servicoSelecionado && horarioSelecionado && inputData.value);
}

// Upload de imagem no Supabase Storage
async function subirFoto(file) {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const { error } = await _supabase.storage
    .from('fotos-unhas')
    .upload(fileName, file);

  if (error) {
    console.error('Erro no upload:', error);
    return null;
  }

  const { data } = _supabase.storage.from('fotos-unhas').getPublicUrl(fileName);
  return data.publicUrl;
}

// Submissão do Formulário
document.getElementById('form-agendamento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-confirmar');
  btn.disabled = true;
  btn.innerText = 'Enviando...';

  const nome = document.getElementById('nome').value.trim();
  const telefone = document.getElementById('whatsapp').value.replace(/\D/g, '');
  const fileInput = document.getElementById('foto-unha');
  
  let fotoUrl = null;
  if (fileInput.files.length > 0) {
    fotoUrl = await subirFoto(fileInput.files[0]);
  }

  const { error } = await _supabase.from('agendamentos').insert([{
    cliente_nome: nome,
    cliente_telefone: telefone,
    servico_id: servicoSelecionado.id,
    data: inputData.value,
    horario: horarioSelecionado,
    foto_referencia_url: fotoUrl,
    status: 'pendente'
  }]);

  if (error) {
    alert('Erro ao enviar agendamento: ' + error.message);
    btn.disabled = false;
    btn.innerText = 'Enviar Pedido de Agendamento';
  } else {
    alert('Pedido de agendamento enviado com sucesso! Aguarde a confirmação de Neyla Solorzano.');
    window.location.reload();
  }
});

carregarServicos();
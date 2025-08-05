import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const params = new URLSearchParams(window.location.search);
const uuid = params.get("id");
const userInfo = document.getElementById("user-info");
const statusDiv = document.getElementById("status");

const supabaseUrl = "https://vjrqefvcbxghghhcnand.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqcnFlZnZjYnhnaGdoaGNuYW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzNzU4NzIsImV4cCI6MjA2OTk1MTg3Mn0.evi-BIQGv-4hh8xwSSgdv52hMiUjvMmk_6S1IcSHLeI";
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'x-client-uuid': uuid
    }
  }
});

if (!uuid) {
  userInfo.innerText = "Usuário não identificado. Verifique o QR Code.";
  document.getElementById("btn-entrada").disabled = true;
  document.getElementById("btn-saida").disabled = true;
} else {
  carregarUsuario(uuid);
}

async function carregarUsuario(id) {
  userInfo.innerText = "Carregando usuário...";
  document.getElementById("btn-entrada").disabled = true;
  document.getElementById("btn-saida").disabled = true;

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("uuid", id)
    .single();

  if (error || !data) {
    userInfo.innerText = "Usuário não encontrado.";
    document.getElementById("btn-entrada").disabled = true;
    document.getElementById("btn-saida").disabled = true;
    document.getElementById("tabela-registros").style.display = "none";
    console.error("Erro ao carregar usuário:", id);
    return;
  }
  userInfo.innerText = `Olá, ${data.nome}`;
  document.getElementById("btn-entrada").disabled = false;
  document.getElementById("btn-saida").disabled = false;
  await carregarRegistrosMes(id); // Chama função para exibir tabela
}

async function carregarRegistrosMes(id) {
  const tabela = document.getElementById("tabela-registros");
  const tbody = tabela.querySelector("tbody");
  tbody.innerHTML = "<tr><td colspan='3'>Carregando...</td></tr>";

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const primeiroDia = `${ano}-${mes}-01`;
  const ultimoDia = `${ano}-${mes}-${new Date(ano, hoje.getMonth() + 1, 0).getDate()}`;

  const { data: registros, error } = await supabase
    .from("registros")
    .select("data,entrada,saida")
    .eq("usuario", id)
    .gte("data", primeiroDia)
    .lte("data", ultimoDia)
    .order("data", { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan='3'>Erro ao carregar registros</td></tr>`;
    tabela.style.display = "table";
    return;
  }

  if (!registros || registros.length === 0) {
    tbody.innerHTML = `<tr><td colspan='3'>Nenhum registro neste mês</td></tr>`;
    tabela.style.display = "table";
    return;
  }

  tbody.innerHTML = registros.map(reg =>
    `<tr>
      <td>${reg.data}</td>
      <td>${reg.entrada || "-"}</td>
      <td>${reg.saida || "-"}</td>
    </tr>`
  ).join("");
  tabela.style.display = "table";
}

document.getElementById("btn-entrada").addEventListener("click", () => registrarEvento("entrada"));
document.getElementById("btn-saida").addEventListener("click", () => registrarEvento("saida"));

async function registrarEvento(tipo) {
  document.getElementById("btn-entrada").disabled = true;
  document.getElementById("btn-saida").disabled = true;
  statusDiv.innerText = "Processando...";

  const hoje = new Date().toISOString().split("T")[0];
  const horaAtual = new Date().toTimeString().split(" ")[0].slice(0, 5);

  const { data: registro, error: erroBusca } = await supabase
    .from("registros")
    .select("*")
    .eq("data", hoje)
    .eq("usuario", uuid)
    .single();

  if (erroBusca && erroBusca.code !== "PGRST116") {
    statusDiv.innerText = `Erro ao buscar registros: ${erroBusca.message || erroBusca}`;
    document.getElementById("btn-entrada").disabled = false;
    document.getElementById("btn-saida").disabled = false;
    limparStatus();
    return;
  }

  let update;
  if (registro) {
    // Verifica se já existe entrada/saída
    if ((tipo === "entrada" && registro.entrada) || (tipo === "saida" && registro.saida)) {
      const confirmar = confirm(
        `Já existe um registro de ${tipo} para hoje (${registro[tipo]}).\nDeseja atualizar para o novo horário (${horaAtual})?`
      );
      if (!confirmar) {
        statusDiv.innerText = "Operação cancelada pelo usuário.";
        document.getElementById("btn-entrada").disabled = false;
        document.getElementById("btn-saida").disabled = false;
        limparStatus();
        return;
      }
    }
    update = await supabase
      .from("registros")
      .update({ [tipo]: horaAtual })
      .eq("data", hoje)
      .eq("usuario", registro.usuario);
  } else {
    const novoRegistro = {
      data: hoje,
      usuario: uuid,
      entrada: tipo === "entrada" ? horaAtual : null,
      saida: tipo === "saida" ? horaAtual : null,
    };
    update = await supabase.from("registros").insert([novoRegistro]);
  }

  if (update.error) {
    statusDiv.innerText = `Erro ao registrar ponto: ${update.error.message || update.error}`;
  } else {
    statusDiv.innerText = `Ponto de ${tipo} registrado com sucesso!`;
  }

  document.getElementById("btn-entrada").disabled = false;
  document.getElementById("btn-saida").disabled = false;
  limparStatus();
}

function limparStatus() {
  setTimeout(() => {
    statusDiv.innerText = "";
    setTimeout(() => {
      location.reload();
    }, 500); // Aguarda meio segundo após limpar o status
  }, 4000);
}

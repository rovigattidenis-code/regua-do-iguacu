// Cria o formulario e a planilha de ocorrencias da Regua do Iguacu na sua conta Google.
// Como usar: cole em script.google.com, escolha a funcao criarOcorrencias e clique em Executar.
// Os links aparecem no Registro de execucao. Rode uma vez so.

function criarOcorrencias() {
  var locais = [
    "Passarela principal (Brasil)", "Trilha das Cataratas (Brasil)", "Macuco Safari (Brasil)",
    "Passeio de barco (Brasil)", "Outro local (Brasil)",
    "Garganta del Diablo (Argentina)", "Circuito Superior (Argentina)", "Circuito Inferior (Argentina)",
    "Sendero Macuco (Argentina)", "Sendero Verde (Argentina)", "Tren Ecológico (Argentina)", "Outro local (Argentina)"
  ];

  var form = FormApp.create("Registrar ocorrência: Régua do Iguaçu", true);
  form.setDescription("Relatos aparecem no dashboard depois de aprovados. O nome em \"Quem relatou\" fica público.");
  form.addListItem().setTitle("Local").setChoiceValues(locais).setRequired(true);
  form.addMultipleChoiceItem().setTitle("Situação").setChoiceValues(["Fechado", "Restrito", "Reaberto"]).setRequired(true);
  form.addListItem().setTitle("Motivo")
    .setChoiceValues(["Vazão do rio", "Chuva forte", "Raios ou tempestade", "Queda de árvore", "Manutenção", "Outro motivo"])
    .setRequired(true);
  form.addDateTimeItem().setTitle("Quando").setRequired(true);
  form.addTextItem().setTitle("Vazão no momento (m³/s), se souber")
    .setValidation(FormApp.createTextValidation().requireNumberGreaterThanOrEqualTo(0).build());
  form.addTextItem().setTitle("Quem relatou").setHelpText("Ex.: guia no local, equipe do parque");
  form.addMultipleChoiceItem().setTitle("Sem previsão de reabertura").setChoiceValues(["Sim", "Não"]);
  form.addParagraphTextItem().setTitle("Observação").setHelpText("O que aconteceu e o que os visitantes devem saber.");

  var planilha = SpreadsheetApp.create("Ocorrências: Régua do Iguaçu");
  planilha.setSpreadsheetLocale("pt_BR");
  planilha.setSpreadsheetTimeZone("America/Sao_Paulo");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, planilha.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(3000);

  var respostas = SpreadsheetApp.openById(planilha.getId()).getSheets().filter(function (s) {
    return s.getFormUrl();
  })[0];
  if (!respostas) throw new Error("A aba de respostas ainda não apareceu. Apague os arquivos criados e rode de novo.");
  respostas.setName("Respostas");

  // A coluna J e a moderacao: so as linhas com "Sim" chegam ao dashboard.
  respostas.getRange("J1").setValue("Aprovado");
  respostas.getRange("J2:J").setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["Sim", "Não"], true).setAllowInvalid(true).build()
  );

  var publico = SpreadsheetApp.openById(planilha.getId()).insertSheet("Publico");
  publico.getRange("A1:I1").setValues([[
    "Carimbo", "Local", "Situação", "Motivo", "Quando", "Vazão", "Quem relatou", "Sem previsão", "Observação"
  ]]);
  publico.getRange("A2").setFormula('=IFERROR(FILTER(Respostas!A2:I, Respostas!J2:J="Sim"), "")');
  publico.getRange("A2:A").setNumberFormat("dd/mm/yyyy hh:mm:ss");
  publico.getRange("E2:E").setNumberFormat("dd/mm/yyyy hh:mm:ss");

  // Excluir a "Pagina1" vazia, se ela ainda existir.
  planilha.getSheets().forEach(function (s) {
    if (s.getName() !== "Respostas" && s.getName() !== "Publico") planilha.deleteSheet(s);
  });

  Logger.log("Formulário para os guias: " + form.getPublishedUrl());
  Logger.log("Planilha para moderar: " + planilha.getUrl());
}

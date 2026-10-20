// Recortes fixos e conferidos. A ampliação de um recorte exige nova revisão editorial.
export const oldExams=[{
  id:'jatai-2019-adaptado',
  title:'Jataí/GO · Nutricionista · 2019',
  examId:'quadrix-jatai-2019-408',
  numbers:[51,53,55,64,66,69,71,73,74,79,84,85,87,90,92,96,97],
  originalCount:100,
  originalMinutes:300,
  sourceURL:'https://www.quadrix.org.br/Archives/General/21679/21847/21849/F07EC39F7247/2_Prefeitura_Municipal_Jatai-GO_concurso_2019_edital_001.pdf',
  sourceLocation:'Edital nº 001/2019, itens 9.4, 10.1, 11.1 e 12.2: 100 questões, 1 ponto por questão e 5 horas para objetiva e discursiva juntas.',
  note:'Adaptação com 17 de 100 questões. Anuladas, equivalentes, desatualizadas e itens ainda em conferência ficaram fora. Não inclui redação nem reproduz a distribuição completa de matérias. Neste recorte, acerto vale 1; erro ou branco vale 0. A nota não é convertida em aprovação no concurso.'
}];

export function prepareOldExam(bank,presetId,timePolicy='proportional'){
  const exam=oldExams.find(item=>item.id===presetId);
  if(!exam||!['proportional','original','free'].includes(timePolicy))throw new Error('Configuração de prova antiga inválida.');
  const questions=exam.numbers.map(number=>{
    const matches=bank.filter(q=>q.examId===exam.examId&&q.originalNumber===number&&q.status==='approved'&&q.origin==='real');
    if(matches.length!==1)throw new Error('Este recorte precisa de nova conferência. Use o simulado personalizado.');
    return matches[0];
  });
  if(new Set(questions.map(q=>q.id)).size!==questions.length)throw new Error('Há questões repetidas no recorte.');
  const minutes=timePolicy==='free'?0:timePolicy==='original'?exam.originalMinutes:Math.ceil(exam.originalMinutes*questions.length/exam.originalCount);
  const timeNote=timePolicy==='free'?'Tempo livre escolhido.':timePolicy==='original'?'Mantidas as 5 horas do edital, que incluíam a redação.':`Tempo de treino ajustado: ${minutes} minutos, por proporção de itens (300 × ${questions.length} / 100). Essa divisão não é regra oficial nem estima a dificuldade.`;
  return {questions,config:{mode:'exam',limitMs:minutes*60000,penalty:0,weights:{},preset:{id:exam.id,title:exam.title,note:exam.note,timeNote,sourceURL:exam.sourceURL,sourceLocation:exam.sourceLocation}}};
}

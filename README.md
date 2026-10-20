# Bruna Estuda

Plataforma pessoal para estudar para concursos de Nutricionista. A meta desta etapa, alterada pelo usuário em 18/10/2026, foi alcançada: 300 questões ativas, sendo 200 reais e 100 autorais, com explicações de todas as alternativas. Há uma questão pendente preservada fora do treino. A ampliação será retomada depois.

Publicado em 20/10/2026: https://p3robr.github.io/bruna-estuda/. A entrada, o PIN e o início com 300 questões foram conferidos no navegador integrado. Código e acervo são públicos. A bateria final de testes no computador da usuária continua pendente. O progresso fica somente no navegador, com exportação e restauração por arquivo. O PIN 1807 afasta curiosos e não protege arquivos públicos.

O pacote Baixar atalho contém ABRA AQUI.url e instruções para abrir o endereço fixo. Exige internet; não é cópia offline nem contém o histórico. As mudanças publicadas são verificadas a cada abertura ou recarregamento, sem exigir manutenção da Bruna. O responsável prepara e envia as mudanças de conteúdo; GitHub Actions verifica e publica. Não há contas, sincronização, rastreamento ou envio de respostas.

Fontes e condições de reutilização estão identificadas em cada questão e no inventário público. A revisão foi por IA, sem revisão profissional humana. Exemplos didáticos não constituem orientação clínica para pacientes.

## Manutenção

Os arquivos publicados ficam em docs/. GitHub Pages deve usar GitHub Actions. O fluxo .github/workflows/pages.yml executa as conferências, gera a versão e publica automaticamente a cada envio à main. Bruna não executa comandos nem precisa baixar novamente o atalho.

Antes de enviar mudanças, confira o acervo e a lógica; gere a versão por último:

```text
node scripts/check-acervo.mjs
node tests/core.test.mjs
node tests/pin.test.mjs
node tests/subject-colors.test.mjs
node tests/update.test.mjs
node scripts/release.mjs
```

O script scripts/package-launcher.ps1 recria o atalho. Se o endereço mudar, use SiteUrl, gere novamente o pacote e depois a versão. A mudança de endereço exige exportar e restaurar o progresso.

Materiais internos de pesquisa, PDFs, anexos pessoais, backups, credenciais e resultados de teste não integram este pacote. O conteúdo editorial é preparado no projeto de trabalho e somente os dados publicáveis são copiados para cá.

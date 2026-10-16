# Bruna Estuda

Plataforma pessoal para estudar para concursos de Nutricionista. Prévia em construção: 74 questões ativas de um mínimo de 800; esta não é a entrega final.

Abra https://p3robr.github.io/bruna-estuda/ no mesmo navegador e perfil. O progresso fica no seu navegador; use Seus dados para exportar e restaurar backups. O PIN da entrada afasta curiosos, mas não protege os arquivos públicos.

O pacote no link Baixar atalho contém ABRA AQUI.url para abrir sempre o mesmo endereço. As atualizações publicadas são verificadas a cada abertura. Não há contas, sincronização, rastreamento ou envio de respostas.

Fontes e condições de reutilização estão identificadas no acervo e no inventário público. Explicações próprias com conferência automática; sem revisão profissional humana declarada.

## Manutenção

Os arquivos publicados ficam em docs/. Antes de enviar uma mudança, execute as verificações e gere a versão por último:

```text
node tests/core.test.mjs
node tests/pin.test.mjs
node tests/subject-colors.test.mjs
node tests/update.test.mjs
node scripts/release.mjs
```

O script scripts/package-launcher.ps1 recria o pacote do atalho. Se o endereço mudar, informe o novo endereço pelo parâmetro SiteUrl, recrie o pacote e depois gere a versão. Uma mudança de endereço também exige exportar e restaurar o progresso.

GitHub Pages deve usar main e /docs. O conteúdo da pasta de pesquisa, anexos, backups e arquivos pessoais não integra este repositório.
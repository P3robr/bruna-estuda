param([string]$SiteUrl = 'https://p3robr.github.io/bruna-estuda/')
$ErrorActionPreference = 'Stop'
$uri = [Uri]$SiteUrl
if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'https' -or $uri.UserInfo -or $SiteUrl.Contains("`r") -or $SiteUrl.Contains("`n")) { throw 'Informe um endereço HTTPS público válido.' }
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$folder = Join-Path $project 'output\atalho-Bruna'
$downloads = Join-Path $project 'docs\downloads'
New-Item -ItemType Directory -Force -Path $folder,$downloads | Out-Null
[IO.File]::WriteAllText((Join-Path $folder 'ABRA AQUI.url'), "[InternetShortcut]`r`nURL=$SiteUrl`r`n", [Text.Encoding]::ASCII)
$instructions = @"
BRUNA ESTUDA

Para estudar, dê dois cliques em ABRA AQUI.
O arquivo abre $SiteUrl no seu navegador padrão.
Recomendamos usar sempre o mesmo perfil do Google Chrome.

Você precisa de internet para abrir o site e verificar atualizações.
Quando houver uma nova versão publicada, ela será carregada ao abrir o site.
Não é preciso baixar este pacote novamente enquanto o endereço for o mesmo.

O progresso fica no navegador deste computador. Não fica neste atalho.
Exporte um backup em Seus dados antes de limpar o navegador ou trocar de computador.
Abrir em outro navegador, perfil ou endereço mostra outro armazenamento.

O PIN da entrada é apenas uma barreira visual contra curiosos.
"@
[IO.File]::WriteAllText((Join-Path $folder 'LEIA-ME.txt'), $instructions, [Text.UTF8Encoding]::new($true))
$zip = Join-Path $downloads 'Bruna-Estuda.zip'
Compress-Archive -LiteralPath (Join-Path $folder 'ABRA AQUI.url'),(Join-Path $folder 'LEIA-ME.txt') -DestinationPath $zip -Force
Write-Output "Atalho preparado: $zip"

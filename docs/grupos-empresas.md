# Grupos e empresas

Rota da tela: `/grupos-empresas`.

## O que faz
A pessoa escolhe **Grupo** ou **Empresa**. Trocar de aba guarda o que já foi digitado em cada formulário. Grupo existe só no Supabase. Empresa nova entra no Supabase e no MySQL `dna_work` com o mesmo UUID. Não há vaga, endereço nem migração de empresa que já existe só no sistema antigo. O grupo da empresa é escolhido numa busca pelo nome do grupo ou pelo nome fantasia e razão social das empresas dele. As listas também filtram: grupo pelo próprio nome ou pelo nome de uma empresa associada; empresa pela razão social, nome fantasia ou grupo.

Grupo: nome obrigatório; e-mail ou telefone (os dois podem ser preenchidos). Empresa: CNPJ com 14 dígitos, razão social, nome fantasia, CEP, endereço e o mesmo contato. Número e complemento são opcionais. O CEP consulta o ViaCEP e preenche o endereço, que continua editável. O grupo é obrigatório. Telefone vai para E.164 (`55DDNNNNNNNN`). CNPJ e CEP são gravados só com dígitos. Espaços no e-mail são removidos.

Antes de gravar empresa, o CNPJ é recusado se já existir em `dna_work.empresa` ou em `empresa` no Supabase, mesmo que a empresa antiga não esteja no sistema novo. A comparação no MySQL ignora ponto, barra, traço e espaço.

Empresa nova: gera o UUID, grava `dna_work.empresa` (`tipo_empresa=1`, `matriz` = o mesmo UUID, `status=1`, `sede=10`, `mesmoendereco=1`, `nome_confidencial=1`, `usa_agente=1`; contato ausente como string vazia), duas linhas em `assinaturas_empresa` (`TCE` e `Convenio`, `responsavel=1`) e o mesmo `id` no Supabase. Se o Supabase falhar, apaga só as assinaturas e a empresa desse UUID no MySQL.

Edição de grupo atualiza só o Supabase. Edição de empresa atualiza o grupo, CNPJ, razão social, nome fantasia, CEP, endereço, número, complemento, e-mail e telefone. No Lightsail mudam CNPJ, razão social, nome fantasia, e-mail, telefone, CEP, logradouro, número e complemento. Bairro, cidade e UF do sistema antigo não são preenchidos por esta tela. Trocar de grupo não altera o Lightsail. `grupo_id` no Supabase é obrigatório. As colunas de endereço do Supabase nascem no SQL Editor. CNPJ novo é conferido de novo nos dois bancos, ignorando o próprio id. `sede`, `matriz`, `tipo_empresa`, `status` e `assinaturas_empresa` não mudam na edição.

Na edição, o botão Excluir pede confirmação. Grupo some só do Supabase e é recusado se ainda tiver empresa. Empresa sai primeiro do MySQL (assinaturas e a linha daquele UUID, ou a linha com o mesmo CNPJ) e só depois do Supabase. Se o Lightsail não apagar a linha, a exclusão para e a empresa continua nos dois lugares.

As tabelas do Supabase são criadas no SQL Editor do projeto `moemgftlmncdqfvzscmq`. O deploy não cria tabela. RLS ligado, sem policy para a anon key. A gravação usa a service role.

## Arquivos desta página
- `src/app/grupos-empresas/page.tsx` — tela.
- `src/grupos-empresas/GruposEmpresas.tsx` — escolha, formulário e listas.
- `src/grupos-empresas/validar.ts` — CNPJ, contato e tipos.
- `src/grupos-empresas/gravar.ts` — leitura e gravação nos dois bancos.
- `src/app/api/grupos/route.ts` — `GET` e `POST`.
- `src/app/api/grupos/[id]/route.ts` — `PATCH` e `DELETE`.
- `src/app/api/empresas/route.ts` — `GET` e `POST`. A lista é só do Supabase, com o nome do grupo.
- `src/app/api/empresas/[id]/route.ts` — `PATCH` e `DELETE`.

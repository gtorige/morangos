# Morangos - Sistema de Gerenciamento

Sistema para registro de pedidos, organizacao de entregas, controle de pagamentos e contas.

## COMO INSTALAR (apenas uma vez)

1. Abra o PowerShell como Administrador
   - Clique no menu Iniciar
   - Digite "PowerShell"
   - Clique com botao direito e depois em "Executar como administrador"

2. Cole o comando abaixo e pressione Enter:

```powershell
irm https://raw.githubusercontent.com/gtorige/morangos/main/install.ps1 | iex
```

3. Aguarde a instalacao automatica (pode demorar alguns minutos)
4. O app abrira automaticamente no navegador
5. Na primeira tela, crie seu usuario e senha de administrador

## PARA ABRIR O APP NOVAMENTE

- Clique duas vezes no atalho "Morangos" na sua area de trabalho
- O app abrira automaticamente no navegador em alguns segundos

## CONFIGURACAO DO GOOGLE MAPS

Durante a instalacao o app pedira sua chave do Google.
Uma unica chave funciona para todos os servicos do app:
- Otimizacao de rotas de entrega
- Preview do mapa na tela de rota
- Link para abrir no Google Maps

Para criar sua chave:
1. Acesse https://console.cloud.google.com
2. Faca login com sua conta Google
3. Crie um projeto (ex: Morangos)
4. Va em APIs e Servicos > Biblioteca
5. Busque e ative: Routes API
6. Busque e ative: Maps Embed API
7. Va em Credenciais > Criar Credencial > Chave de API
8. Copie a chave e cole quando o instalador pedir

IMPORTANTE: Voce precisara de um cartao de credito
cadastrado no Google Cloud. O uso pessoal normalmente
fica dentro do credito gratuito de $200/mes.

## REQUISITOS

- Windows 10 ou superior
- Conexao com internet na primeira execucao
- PowerShell (ja vem instalado no Windows)

## EM CASO DE ERRO

- Tire uma foto da tela de erro
- Entre em contato com o administrador do sistema

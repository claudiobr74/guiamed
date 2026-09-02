# Dados de referência

## CID-10 Brasil — DATASUS V2008

`cid10-br-v2008.json` é um índice determinístico gerado a partir do arquivo
`CID-10-SUBCATEGORIAS.CSV` distribuído pelo DATASUS. Segundo a documentação da
fonte, esse é o arquivo que contém as categorias e subcategorias utilizáveis para
codificação de causas e diagnósticos.

- Fonte: `http://www2.datasus.gov.br/cid10/V2008/downloads/CID10CSV.zip`
- Arquivo no pacote: `CID-10-SUBCATEGORIAS.CSV`
- Codificação de origem: ISO-8859-1 / Windows-1252
- SHA-256 do pacote: `84f23809275575f751255048064bbb244b0de33fd5987ab98df0f98e5f5d2c95`
- SHA-256 do CSV: `1a85bef8f2065ad3e95ab07b6441e6f03404c54ab35849ebd4edccc3ba234e60`
- Registros: 12.451

Para reproduzir o índice após extrair o pacote oficial:

```bash
pnpm cid10:build /caminho/CID-10-SUBCATEGORIAS.CSV
```

O script recusa arquivos com hash, cabeçalho, quantidade de registros, códigos
ou metadados estruturais diferentes da versão auditada. O conteúdo classificatório
mantém a atribuição e os direitos informados pela fonte; não é relicenciado pelo
GuiaMed.

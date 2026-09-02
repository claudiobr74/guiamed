---
name: pdf-template-engine
description: Motor de PDF do GuiaMed — preencher o arquivo original versionado, nunca redesenhar.
---

# PDF template engine

- Upload grava o PDF oficial e cria `templateVersions` (versionamento).
- Mapper visual (`PdfMapper`) gera `FieldMapping` overlay ou AcroForm e `PdfRepeater`.
- `fillPdf` desenha no bytes originais (`pdf-lib`). Overflow é erro explícito, não corte silencioso.
- Quantidade entra no repeater/campos. Códigos vêm de snapshot; se ausentes, `CODE_NOT_FOUND`.
- Não gerar HTML/CSS que imite a guia da instituição.

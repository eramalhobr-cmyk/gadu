# OpenSCAD WebAssembly (componente separado, GPL)

Esta pasta contém o **OpenSCAD compilado para WebAssembly**, usado só pelo 3D Studio do GaDu dentro de um Web Worker.

| Arquivo | O que é | Licença |
|---|---|---|
| `openscad.js` | OpenSCAD + WASM embutido, **sem modificações**, do pacote npm `openscad-wasm-prebuilt` 1.2.0 | **GPL-2.0-or-later** (veja `LICENSE.txt`) |
| `LICENSE.txt` | Texto da GNU GPL versão 2 (arquivo `COPYING` do pacote) | — |
| `render-core.js` e `render-worker.js` | Código do GaDu que chama o OpenSCAD por mensagens | licença do GaDu |

## Código-fonte
- OpenSCAD: https://github.com/openscad/openscad (site: https://openscad.org)
- Pacote WASM usado: https://www.npmjs.com/package/openscad-wasm-prebuilt · repositório https://github.com/lorenzowritescode/openscad-wasm (receita de compilação do WASM)
- Quem quiser o código-fonte correspondente a este binário: abra os links acima, ou peça ao dono do GaDu.

## Como o isolamento funciona
- O GaDu **não importa** o `openscad.js` no seu código: o worker carrega o arquivo em tempo de execução e o app só troca mensagens (`postMessage`) com ele. Nada do OpenSCAD entra no pacote (bundle) do app.
- O código `.scad` roda **só no worker**, sem DOM, cookies nem rede (a CSP deste diretório usa `connect-src 'none'`).
- Cada renderização usa uma instância nova do OpenSCAD, com limite de tempo de 30 s; passou do limite, o worker é encerrado e recriado.

## Fontes
`fonts.js` traz as fontes **Liberation Sans** Regular e Bold (SIL Open Font License 1.1, veja `FONTS-LICENSE.txt`) em base64. O OpenSCAD WASM não traz fontes: sem elas `text()` sai vazio. O worker só carrega esse módulo quando o código usa `text()` (a CSP não permite rede, por isso a fonte vem como módulo do mesmo endereço).

## Atualizar
Troque `openscad.js` e `LICENSE.txt` pelos do novo pacote, rode `npm run test:unit` (há um teste que compila um cubo com este arquivo) e atualize a versão acima.

# Lista de compras

A tela usa a tipografia e os tokens do GaDu. No celular, o cabeçalho com a frase de voz vem antes do formulário e dos itens:

```
Lista de compras
Diga “Coloca café na lista de compras”
[O que você precisa comprar?]
[Adicionar]
[ ] Café                 [Remover]
[X] Leite · Comprado      [Remover]
```

A pessoa que dita itens pode confirmar cada cartão sem trocar de tela. Quem usa a lista no mercado marca o item no próprio rótulo, com alvo de 44 px. O estado “Comprado” também aparece em texto. O formulário e a lista seguem juntos no computador.

A carga esperada é baixa para listas curtas. Adicionar é a ação principal. Cada linha tem uma caixa de seleção e um botão de remoção. Pendências vêm primeiro e a paginação aparece quando há mais de 50 itens. A remoção manual é imediata, com feedback. Pela conversa, a remoção exige confirmação.

| Heurística | Nota de 0 a 4 | Revisão |
|---|---:|---|
| Visibilidade | 3 | Indicadores de carregamento, erro e resultado |
| Linguagem | 4 | Termos de mercado e exemplo falado |
| Controle | 3 | É possível desmarcar o item e descartar propostas |
| Consistência | 4 | Kit de módulos e cartões do GaDu |
| Prevenção de erro | 3 | Validação, nomes duplicados e confirmação pela conversa |
| Reconhecimento | 4 | Item e estado visíveis na mesma linha |
| Eficiência | 3 | Voz para adicionar e toque para marcar |
| Design enxuto | 3 | Um formulário e uma lista |
| Recuperação | 3 | Nova tentativa com mensagem em português |
| Ajuda | 3 | Exemplos no cabeçalho e em “O que posso dizer aqui” |

Revisão de fluxo por código. O cenário móvel autenticado foi incluído no CI para verificar persistência e largura de 390 px.

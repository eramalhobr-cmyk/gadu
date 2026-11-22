// CSP do componente isolado do 3D Studio (OpenSCAD WASM, GPL), servido de /vendor/openscad/ e usado só dentro de um Web Worker.
// MAIS estrita que a das páginas: sem rede (connect-src 'none'), só scripts e WebAssembly do próprio endereço.
// 'wasm-unsafe-eval' é o mínimo para compilar o WebAssembly e fica só aqui, nunca na CSP das páginas (src/proxy.ts).
// O proxy não toca neste caminho (matcher), para a CSP das páginas não se somar a esta.
export const VENDOR_CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'none'; worker-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

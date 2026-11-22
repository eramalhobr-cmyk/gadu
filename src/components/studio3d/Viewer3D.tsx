"use client";
import { useEffect, useRef, useState } from "react";
import type { Box } from "@/lib/3d/mesh";

// Visualizador three.js: peça sobre a mesa da A1 (256 × 256 mm), com giro, zoom e a caixa de medidas.
// O three.js só é carregado aqui (import dinâmico), na tela 3D. Z para cima, como na impressora.
const BED = 256;

type Props = { positions: Float32Array | null; box: Box | null };

export function Viewer3D({ positions, box }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setMesh: (p: Float32Array | null) => void; dispose: () => void } | null>(null);
  const pending = useRef<Float32Array | null>(positions);
  const [noGl, setNoGl] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      const el = host.current;
      if (!el) return;
      const THREE = await import("three");
      const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
      if (dead) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setNoGl(true); return; }
      const css = getComputedStyle(el);
      const color = (v: string, d: string) => new THREE.Color(css.getPropertyValue(v).trim() || d);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      el.appendChild(renderer.domElement);
      renderer.domElement.setAttribute("aria-hidden", "true");
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
      camera.up.set(0, 0, 1);
      camera.position.set(BED / 2 + 260, -140, 230);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(BED / 2, BED / 2, 30);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI * 0.495;
      controls.minDistance = 40;
      controls.maxDistance = 1200;
      scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.5));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(180, -120, 320);
      scene.add(sun);

      // Mesa da A1: contorno e grade a cada 32 mm.
      const line = color("--line-2", "#556");
      const grid: number[] = [];
      for (let i = 0; i <= BED; i += 32) grid.push(i, 0, 0, i, BED, 0, 0, i, 0, BED, i, 0);
      const gridGeo = new THREE.BufferGeometry();
      gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
      scene.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: line, transparent: true, opacity: 0.55 })));
      const bedMat = new THREE.Mesh(new THREE.PlaneGeometry(BED, BED), new THREE.MeshBasicMaterial({ color: color("--surface-2", "#223"), transparent: true, opacity: 0.55 }));
      bedMat.position.set(BED / 2, BED / 2, -0.05);
      scene.add(bedMat);
      const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(BED, 0, 0), new THREE.Vector3(BED, BED, 0), new THREE.Vector3(0, BED, 0)]), new THREE.LineBasicMaterial({ color: color("--sig", "#4cf") }));
      scene.add(edge);

      const group = new THREE.Group();
      scene.add(group);
      const bodyColor = color("--sig", "#4cf");
      const material = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.55, metalness: 0.05 });
      const boxLine = new THREE.LineBasicMaterial({ color: color("--hot", "#f93") });

      function setMesh(p: Float32Array | null) {
        for (const c of [...group.children]) { group.remove(c); (c as import("three").Mesh).geometry?.dispose(); }
        if (!p || p.length < 9) return;
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(p, 3));
        g.computeVertexNormals();
        g.computeBoundingBox();
        group.add(new THREE.Mesh(g, material));
        const bb = g.boundingBox!;
        const h = new THREE.Box3Helper(bb, boxLine.color);
        group.add(h);
        // Enquadra a peça (e não a mesa inteira) quando ela é pequena.
        const size = bb.getSize(new THREE.Vector3());
        const center = bb.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        const dist = Math.max(160, Math.max(size.x, size.y, size.z) * 2.6);
        const dir = new THREE.Vector3(0.75, -0.9, 0.7).normalize();
        camera.position.copy(center).addScaledVector(dir, dist);
      }

      function resize() {
        const w = el!.clientWidth, h = el!.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
        camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();
      let raf = 0;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      controls.enableDamping = !reduce;
      const tick = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(tick); };
      tick();
      setMesh(pending.current);
      api.current = {
        setMesh,
        dispose() {
          cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
          scene.traverse((o) => { const m = o as import("three").Mesh; m.geometry?.dispose(); });
          material.dispose(); renderer.dispose(); renderer.domElement.remove();
        },
      };
    })();
    return () => { dead = true; api.current?.dispose(); api.current = null; };
  }, []);

  useEffect(() => { pending.current = positions; api.current?.setMesh(positions); }, [positions]);

  const f = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return (
    <div className="s3d-view">
      <div ref={host} className="s3d-canvas" role="img" aria-label={box ? `Peça de ${f(box.size[0])} por ${f(box.size[1])} por ${f(box.size[2])} milímetros sobre a mesa da A1` : "Mesa da A1 vazia"} />
      {noGl && <p className="s3d-nogl">Este aparelho não consegue desenhar em 3D. Você ainda pode baixar os arquivos.</p>}
      {box && <p className="s3d-dims" aria-live="polite"><b>{f(box.size[0])} × {f(box.size[1])} × {f(box.size[2])} mm</b><span>largura × fundo × altura</span></p>}
      <p className="s3d-hint">Mesa da A1: 256 × 256 mm. Arraste para girar, use dois dedos para aproximar.</p>
    </div>
  );
}

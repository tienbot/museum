// App.js
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

export default function App() {
  const mountRef = useRef(null);

  // overlayData: null или объект { kind: 'mini'|'sculpture', shape: 'Box'|'Sphere'|'Cylinder', textureSrc?: string, color?: number, info?: string }
  const [overlayData, setOverlayData] = useState(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // === СЦЕНА, КАМЕРА, РЕНДЕР ===
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xaaaaaa);
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    document.addEventListener('enableControls', enablePlayerControls);

    // === СВЕТ ===
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(30, 50, 30);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // === ПОЛ ===
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500),
      new THREE.MeshStandardMaterial({
        color: 0x808080,
        side: THREE.DoubleSide,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // === ПАРАМЕТРЫ ЛАБИРИНТА ===
    const rows = 35;
    const cols = 35;
    const cellSize = 6;
    const wallHeight = 5;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a });

    // === ГЕНЕРАЦИЯ ЛАБИРИНТА ===
    const maze = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));
    const stack = [];

    const start = { r: Math.floor(rows / 2), c: Math.floor(cols / 2) };
    maze[start.r][start.c] = true;
    stack.push(start);

    const dirs = [
      { dr: 1, dc: 0 },
      { dr: -1, dc: 0 },
      { dr: 0, dc: 1 },
      { dr: 0, dc: -1 },
    ];

    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    while (stack.length) {
      const cell = stack[stack.length - 1];
      const possible = shuffle(
        dirs
          .map((d) => ({
            r: cell.r + d.dr * 2,
            c: cell.c + d.dc * 2,
            between: { r: cell.r + d.dr, c: cell.c + d.dc },
          }))
          .filter(
            (n) =>
              n.r >= 0 &&
              n.r < rows &&
              n.c >= 0 &&
              n.c < cols &&
              !maze[n.r][n.c]
          )
      );

      if (possible.length) {
        const next = possible[0];
        maze[next.r][next.c] = true;
        maze[next.between.r][next.between.c] = true;
        stack.push(next);
      } else {
        stack.pop();
      }
    }

    // === СТЕНЫ ===
    const walls = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!maze[r][c]) {
          const wall = new THREE.Mesh(
            new THREE.BoxGeometry(cellSize, wallHeight, cellSize),
            wallMat
          );
          wall.position.set(
            (c - cols / 2) * cellSize + cellSize / 2,
            wallHeight / 2,
            (r - rows / 2) * cellSize + cellSize / 2
          );
          wall.castShadow = true;
          wall.receiveShadow = true;
          scene.add(wall);
          walls.push(wall);
        }
      }
    }

    // === ВЫХОД: выбирается по краю похожим на оригинал ===
    const exitOptions = [];

    for (let c = 0; c < cols; c++) {
      if (maze[1][c]) exitOptions.push({ r: 0, c });
      if (maze[rows - 2][c]) exitOptions.push({ r: rows - 1, c });
    }
    for (let r = 0; r < rows; r++) {
      if (maze[r][1]) exitOptions.push({ r, c: 0 });
      if (maze[r][cols - 2]) exitOptions.push({ r, c: cols - 1 });
    }

    const fallbackExit = [
      { r: 0, c: Math.floor(Math.random() * cols) },
      { r: rows - 1, c: Math.floor(Math.random() * cols) },
      { r: Math.floor(Math.random() * rows), c: 0 },
      { r: Math.floor(Math.random() * rows), c: cols - 1 },
    ];
    const exitCell = (exitOptions.length ? exitOptions : fallbackExit)[
      Math.floor(Math.random() * (exitOptions.length ? exitOptions.length : fallbackExit.length))
    ];
    maze[exitCell.r][exitCell.c] = true;

    const protrusion = 0.18;
    const exitHeight = 1.5;

    let sizeX = cellSize;
    let sizeZ = cellSize;
    let shiftX = 0;
    let shiftZ = 0;

    if (exitCell.r === 0) {
      sizeZ = cellSize * (1 + protrusion);
      shiftZ = - (protrusion * cellSize) / 2;
    } else if (exitCell.r === rows - 1) {
      sizeZ = cellSize * (1 + protrusion);
      shiftZ = (protrusion * cellSize) / 2;
    }
    if (exitCell.c === 0) {
      sizeX = cellSize * (1 + protrusion);
      shiftX = - (protrusion * cellSize) / 2;
    } else if (exitCell.c === cols - 1) {
      sizeX = cellSize * (1 + protrusion);
      shiftX = (protrusion * cellSize) / 2;
    }

    const exitGeom = new THREE.BoxGeometry(sizeX, exitHeight, sizeZ);
    const exitMat = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.8,
      metalness: 0.2,
      roughness: 0.4,
    });
    const exit = new THREE.Mesh(exitGeom, exitMat);
    const baseX = (exitCell.c - cols / 2) * cellSize + cellSize / 2;
    const baseZ = (exitCell.r - rows / 2) * cellSize + cellSize / 2;
    exit.position.set(baseX + shiftX, exitHeight / 2, baseZ + shiftZ);
    scene.add(exit);
    const exitBox = new THREE.Box3().setFromObject(exit);
    let pulseTime = 0;

    // === СКУЛЬПТУРЫ (как в твоём первом коде) ===
    const sculptureData = [
      { img: 'posters/terminator.webp', ost: 'ost/terminator.mp3', count: 40 },
      { img: 'posters/robocop.webp', ost: 'ost/robocop.mp3', count: 40 },
      { img: 'posters/matrix.webp', ost: 'ost/matrix.mp3', count: 40 },
      { img: 'posters/ghost-in-the-shell.webp', ost: 'ost/ghost-in-the-shell.mp3', count: 40 },
      { img: 'posters/serial-experiments-lain.webp', ost: 'ost/serial-experiments-lain.mp3', count: 40 },
    ];

    const sculptures = [];
    const textureLoader = new THREE.TextureLoader();

    sculptureData.forEach(({ img, ost, count }) => {
      // безопасная загрузка текстуры: если нет – будет просто цвет
      const texture = textureLoader.load(
        img,
        undefined,
        undefined,
        () => {
          // onError: ничего не делаем — материал будет без текстуры
        }
      );
      const mat = new THREE.MeshStandardMaterial({ map: texture });
      const sound = new Audio(ost);
      sound.preload = 'auto';
      sound.volume = 0.7;

      for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);

        if (
          maze[r][c] &&
          !(r === start.r && c === start.c) &&
          !(r === exitCell.r && c === exitCell.c)
        ) {
          const sculpture = new THREE.Mesh(
            new THREE.BoxGeometry(
              1.5 + Math.random() * 2,
              2 + Math.random() * 4,
              1.5 + Math.random() * 2
            ),
            mat.clone()
          );

          sculpture.userData.ost = sound;
          sculpture.userData.preview = {
            kind: 'sculpture',
            textureSrc: img,
            info: `Sculpture (${img})`,
            shape: 'Box',
          };

          sculpture.position.set(
            (c - cols / 2) * cellSize + (Math.random() - 0.5) * (cellSize * 0.8),
            sculpture.geometry.parameters.height / 2,
            (r - rows / 2) * cellSize + (Math.random() - 0.5) * (cellSize * 0.8)
          );
          sculpture.castShadow = true;
          sculpture.receiveShadow = true;
          scene.add(sculpture);
          sculptures.push(sculpture);
        }
      }
    });

    // === ЗЕЛЁНЫЕ МИНИ-ФИГУРКИ ===
    const miniFigures = [];
    const miniMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.5, metalness: 0.1 });

    for (let i = 0; i < 50; i++) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      if (maze[r][c]) {
        const shapeType = Math.floor(Math.random() * 3); // 0 — куб, 1 — сфера, 2 — цилиндр
        let geom;
        let shapeName;
        if (shapeType === 0) { geom = new THREE.BoxGeometry(0.8, 0.8, 0.8); shapeName = 'Box'; }
        else if (shapeType === 1) { geom = new THREE.SphereGeometry(0.5, 16, 16); shapeName = 'Sphere'; }
        else { geom = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16); shapeName = 'Cylinder'; }

        const fig = new THREE.Mesh(geom, miniMat.clone());
        fig.position.set(
          (c - cols / 2) * cellSize + (Math.random() - 0.5) * 2,
          0.4,
          (r - rows / 2) * cellSize + (Math.random() - 0.5) * 2
        );
        fig.castShadow = true;
        fig.receiveShadow = true;
        fig.userData.isMini = true;
        fig.userData.preview = {
          kind: 'mini',
          shape: shapeName,
          color: 0x00ff00,
          info: `Mini figure — ${shapeName}`,
        };
        scene.add(fig);
        miniFigures.push(fig);
      }
    }

    // === ОБСТРУКЦИИ ===
    const obstacles = [
      ...walls.map((w) => ({ mesh: w, box: new THREE.Box3().setFromObject(w) })),
      ...sculptures.map((s) => ({ mesh: s, box: new THREE.Box3().setFromObject(s) })),
      ...miniFigures.map((m) => ({ mesh: m, box: new THREE.Box3().setFromObject(m) })),
    ];

    // === ИГРОК ===
    const player = {
      position: new THREE.Vector3(
        (start.c - cols / 2) * cellSize + cellSize / 2,
        1,
        (start.r - rows / 2) * cellSize + cellSize / 2
      ),
      direction: new THREE.Vector3(0, 0, 1),
      speed: 6,
      runSpeed: 12,
      radius: 0.6,
    };

    const playerMesh = new THREE.Mesh(
      new THREE.SphereGeometry(player.radius, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xff5555 })
    );
    scene.add(playerMesh);
    camera.position.set(player.position.x, player.radius * 2, player.position.z);

    // === УПРАВЛЕНИЕ ===
    const pointer = { yaw: 0, pitch: 0 };
    const raycaster = new THREE.Raycaster();
    const keys = {};

    function onMouseMove(e) {
      if (document.pointerLockElement === mount) {
        pointer.yaw -= e.movementX * 0.0025;
        pointer.pitch -= e.movementY * 0.0025;
        pointer.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pointer.pitch));
      }
    }

    let escapeAnim = false;
    let escapeProgress = 0;

    function onMouseDown(e) {
      if (document.pointerLockElement !== mount) return;
      if (e.button !== 0) return;

      raycaster.setFromCamera({ x: 0, y: 0 }, camera);
      const intersects = raycaster.intersectObjects([...sculptures, ...miniFigures, exit]);

      if (!intersects.length) return;
      const hit = intersects[0];
      const obj = hit.object;

      // === Если это мини-фигурка ===
      if (miniFigures.includes(obj)) {
        // открываем overlay с данными минифигуры
        const pd = obj.userData.preview || { kind: 'mini', shape: 'Box', color: 0x00ff00, info: 'Mini' };
        openOverlay(pd, { disableControls: true });
        return;
      }

      // === Если это скульптура ===
      if (sculptures.includes(obj)) {
        obj.userData.clicks = (obj.userData.clicks || 0) + 1;

        const point = hit.point;
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        dot.position.copy(obj.worldToLocal(point.clone()));
        obj.add(dot);

        if (obj.userData.clicks >= 3) {
          if (obj.userData.ost) {
            // Остановить предыдущее аудио, если оно есть
            if (window.currentOst && !window.currentOst.paused) {
              window.currentOst.pause();
              window.currentOst.currentTime = 0;
            }

            // Запустить новое
            window.currentOst = obj.userData.ost;
            window.currentOst.currentTime = 0;
            window.currentOst.play();
          }

          setTimeout(() => {
            scene.remove(obj);
            const i = sculptures.indexOf(obj);
            if (i !== -1) sculptures.splice(i, 1);
            const o = obstacles.findIndex((ob) => ob.mesh === obj);
            if (o !== -1) obstacles.splice(o, 1);
          }, 300);
        }
        return;
      }

      // === Если это ВЫХОД ===
      if (obj === exit && !escapeAnim) {
        escapeAnim = true;
        // очищаем препятствия, чтобы объект больше не коллидировал
        obstacles.length = 0;
      }
    }

    // === Функции управления overlay: отключение/включение управления ===
    function disablePlayerControls() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onWindowKeyDown);
      window.removeEventListener('keyup', onWindowKeyUp);
      // при показе overlay снимаем pointer lock
      try { document.exitPointerLock(); } catch (e) {}
    }
    function enablePlayerControls() {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mousedown', onMouseDown);
      window.addEventListener('keydown', onWindowKeyDown);
      window.addEventListener('keyup', onWindowKeyUp);
      // при закрытии overlay вновь запрашиваем pointer lock (пользователь может нажать ещё раз)
      try { mount.requestPointerLock(); } catch (e) {}
    }

    function openOverlay(previewData, opts = { disableControls: true }) {
      setOverlayData(previewData);
      if (opts.disableControls) disablePlayerControls();
    }
    function closeOverlay() {
      setOverlayData(null);
      // вернуть управление
      enablePlayerControls();
    }

    mount.addEventListener('click', () => mount.requestPointerLock());
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);

    // клавиатура — вынесем обработчики чтобы иметь возможность remove/add
    function onWindowKeyDown(e) {
      if (e.code === 'Escape') {
        if (overlayData) {
          // если открыт overlay — закроем
          closeOverlay();
        } else {
          setOverlayData(null);
        }
      }
      keys[e.code] = true;
    }
    function onWindowKeyUp(e) {
      keys[e.code] = false;
    }

    window.addEventListener('keydown', onWindowKeyDown);
    window.addEventListener('keyup', onWindowKeyUp);

    function isColliding(pos) {
      for (const o of obstacles) {
        const min = o.box.min;
        const max = o.box.max;
        if (
          pos.x > min.x - player.radius &&
          pos.x < max.x + player.radius &&
          pos.z > min.z - player.radius &&
          pos.z < max.z + player.radius
        ) {
          return true;
        }
      }
      return false;
    }

    // === АНИМАЦИЯ ===
    let last = performance.now();

    // если overlay открыт, мы всё ещё хотим анимировать сцену (можно поставить паузу, но оставим рендер)
    function animate() {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      pulseTime += dt;
      exit.material.emissiveIntensity = 0.5 + Math.sin(pulseTime * 3) * 0.5;

      // движение и управление работает только если overlay не открыт (мы дополнительно отключаем слушатели при открытии)
      const dirX = Math.sin(pointer.yaw);
      const dirZ = Math.cos(pointer.yaw);
      player.direction.set(dirX, 0, dirZ).normalize();

      const move = new THREE.Vector3();
      if (keys['KeyW'] || keys['ArrowUp']) move.z -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) move.z += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) move.x -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move.x += 1;

      const speed =
        keys['ShiftLeft'] || keys['ShiftRight'] ? player.runSpeed : player.speed;

      if (move.lengthSq() > 0) {
        move.normalize();
        const yaw = pointer.yaw;
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
        const world = new THREE.Vector3();
        world.addScaledVector(forward, -move.z);
        world.addScaledVector(right, move.x);
        const candidate = player.position
          .clone()
          .addScaledVector(world.normalize(), speed * dt);
        if (!isColliding(candidate)) player.position.copy(candidate);
      }

      playerMesh.position.set(player.position.x, player.radius, player.position.z);
      camera.position.set(player.position.x, player.radius * 2, player.position.z);

      const lookAt = player.position
        .clone()
        .add(
          new THREE.Vector3(
            Math.sin(pointer.yaw),
            Math.sin(pointer.pitch),
            Math.cos(pointer.yaw)
          ).multiplyScalar(10)
        );
      camera.lookAt(lookAt);

      // === Анимация "побега" ===
      if (escapeAnim && escapeProgress < 1) {
        escapeProgress += dt / 2;
        const offsetY = Math.min(1000, 1000 * easeOutCubic(escapeProgress));
        walls.forEach((w) => (w.position.y = wallHeight / 2 + offsetY));
        sculptures.forEach((s) => (s.position.y += 1000 * dt * 0.5));
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    animate();

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    // === Очистка при unmount ===
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onWindowKeyDown);
      window.removeEventListener('keyup', onWindowKeyUp);
      document.removeEventListener('enableControls', enablePlayerControls);


      try {
        mount.removeChild(renderer.domElement);
      } catch (e) {}
      renderer.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // === UI РЕНДЕР: прицел + overlay ===
  return (
    <div
      ref={mountRef}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Прицел */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '10px',
          height: '10px',
          backgroundColor: '#fff',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          boxShadow: '0 0 6px rgba(0,0,0,0.4)',
        }}
      />

      {/* Overlay */}
      {overlayData && (
        <Overlay
          data={overlayData}
          onClose={() => {
            setOverlayData(null);
            // вернём управление игроку
            try {
              const mount = mountRef.current;
              if (mount) mount.requestPointerLock(); // активируем управление мышью
            } catch (e) {}
            // добавляем клавиатурные и мышиные события обратно
            document.dispatchEvent(new Event('enableControls'));
          }}
        />
      )}

    </div>
  );
}

/* ====================
   Компонент Overlay
   - Показывает затемнённый фон
   - Слева — FigurePreview (новая мини-сцена)
   - Справа — текст (lorem ipsum / info)
   ==================== */
function Overlay({ data, onClose }) {
  // data: { kind, shape, textureSrc?, color?, info? }
  const humanName = (() => {
    if (!data) return '';
    if (data.kind === 'sculpture') return data.info || 'Sculpture';
    if (data.kind === 'mini') {
      if (data.shape === 'Box') return 'Куб';
      if (data.shape === 'Sphere') return 'Сфера';
      if (data.shape === 'Cylinder') return 'Цилиндр';
      return 'Фигура';
    }
    return 'Фигура';
  })();

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        color: '#fff',
        display: 'flex',
        gap: 24,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        zIndex: 50,
      }}
      onMouseDown={(e) => {
        // клик по фону — не закрываем (по условию выход — Esc)
        e.stopPropagation();
      }}
    >
      <div style={{ width: 320, flexShrink: 0 }}>
        <FigurePreviewMini data={data} size={320} />
      </div>

      <div style={{ maxWidth: 540 }}>
        <h2 style={{ marginTop: 0 }}>{humanName}</h2>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus euismod, sem in
          condimentum aliquet, sapien nisl tincidunt elit, nec blandit velit felis sit amet
          justo. Pellentesque in luctus erat. Integer id sapien ac lorem efficitur tincidunt.
        </p>
        <p style={{ opacity: 0.8 }}>
          Доп. инфо: {data.info || '—'}.
        </p>
        <p style={{ opacity: 0.7, fontSize: 13 }}>
          Нажмите <b>Esc</b>, чтобы закрыть окно.
        </p>
      </div>
    </div>
  );
}

/* FigurePreviewMini
   — рендерит отдельную мини-сцену с фигурой (на базе переданных данных)
   — автоматическое вращение, остановка при удержании мыши
*/
function FigurePreviewMini({ data, size = 300 }) {
  const ref = useRef(null);

  useEffect(() => {
    const mount = ref.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    // light
    const dl = new THREE.DirectionalLight(0xffffff, 1);
    dl.position.set(2, 3, 5);
    scene.add(dl);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    // geometry based on data
    let geom;
    if (data.kind === 'sculpture' && data.textureSrc) {
      // модель — куб с текстурой
      geom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    } else {
      if (data.shape === 'Box') geom = new THREE.BoxGeometry(1, 1, 1);
      else if (data.shape === 'Sphere') geom = new THREE.SphereGeometry(0.8, 32, 32);
      else geom = new THREE.CylinderGeometry(0.6, 0.6, 1.2, 32);
    }

    let mat;
    if (data.kind === 'sculpture' && data.textureSrc) {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(data.textureSrc, undefined, undefined, () => {});
      mat = new THREE.MeshStandardMaterial({ map: tex });
    } else {
      mat = new THREE.MeshStandardMaterial({ color: data.color || 0x00ff00, metalness: 0.2, roughness: 0.4 });
    }

    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    camera.position.z = 3;

    let rotate = true;
    function renderLoop() {
      if (rotate) {
        mesh.rotation.y += 0.01;
        mesh.rotation.x += 0.004;
      }
      renderer.render(scene, camera);
      requestAnimationFrame(renderLoop);
    }
    renderLoop();

    // остановка вращения при удержании мыши
    function onDown() { rotate = false; }
    function onUp() { rotate = true; }

    mount.addEventListener('mousedown', onDown);
    mount.addEventListener('mouseup', onUp);
    mount.addEventListener('mouseleave', onUp);

    // cleanup
    return () => {
      mount.removeEventListener('mousedown', onDown);
      mount.removeEventListener('mouseup', onUp);
      mount.removeEventListener('mouseleave', onUp);
      try { mount.removeChild(renderer.domElement); } catch (e) {}
      renderer.dispose();
    };
  }, [data, size]);

  return <div ref={ref} style={{ width: size, height: size }} />;
}
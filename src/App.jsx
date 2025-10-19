import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function App() {
  const mountRef = useRef(null);

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

    // === ВЫХОД ===
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

    // === СКУЛЬПТУРЫ ===
    const sculptureData = [
      { img: 'posters/terminator.webp', ost: 'ost/terminator.mp3', count: 100 },
      { img: 'posters/robocop.webp', ost: 'ost/robocop.mp3', count: 100 },
      { img: 'posters/matrix.webp', ost: 'ost/matrix.mp3', count: 100 },
      { img: 'posters/ghost-in-the-shell.webp', ost: 'ost/ghost-in-the-shell.mp3', count: 100 },
      { img: 'posters/serial-experiments-lain.webp', ost: 'ost/serial-experiments-lain.mp3', count: 100 },
    ];

    const sculptures = [];
    const textureLoader = new THREE.TextureLoader();

    sculptureData.forEach(({ img, ost, count }) => {
      const texture = textureLoader.load(img);
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
            mat
          );

          sculpture.userData.ost = sound;

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

    // === ОБСТРУКЦИИ ===
    const obstacles = [
      ...walls.map((w) => ({ mesh: w, box: new THREE.Box3().setFromObject(w) })),
      ...sculptures.map((s) => ({ mesh: s, box: new THREE.Box3().setFromObject(s) })),
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
      const intersects = raycaster.intersectObjects([...sculptures, exit]);

      if (!intersects.length) return;
      const hit = intersects[0];
      const obj = hit.object;

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
        obstacles.length = 0; // больше ничего не блокирует
      }
    }

    mount.addEventListener('click', () => mount.requestPointerLock());
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);

    // === КЛАВИАТУРА ===
    const keys = {};
    window.addEventListener('keydown', (e) => (keys[e.code] = true));
    window.addEventListener('keyup', (e) => (keys[e.code] = false));

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

    function animate() {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      pulseTime += dt;
      exit.material.emissiveIntensity = 0.5 + Math.sin(pulseTime * 3) * 0.5;

      // === Движение игрока ===
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

    // === Resize ===
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // === ПРИЦЕЛ ===
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
    </div>
  );
}
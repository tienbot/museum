import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function App() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // === СЦЕНА, КАМЕРА, РЕНДЕРЕР ===
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
      new THREE.MeshStandardMaterial({ color: 0x808080, side: THREE.DoubleSide })
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
    const exitSides = [
      { r: 0, c: Math.floor(Math.random() * cols) },
      { r: rows - 1, c: Math.floor(Math.random() * cols) },
      { r: Math.floor(Math.random() * rows), c: 0 },
      { r: Math.floor(Math.random() * rows), c: cols - 1 },
    ];
    const exitCell = exitSides[Math.floor(Math.random() * exitSides.length)];
    maze[exitCell.r][exitCell.c] = true;

    const exit = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize, 1, cellSize),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    exit.position.set(
      (exitCell.c - cols / 2) * cellSize + cellSize / 2,
      0.5,
      (exitCell.r - rows / 2) * cellSize + cellSize / 2
    );
    scene.add(exit);
    const exitBox = new THREE.Box3().setFromObject(exit);

    // === ТЕКСТУРЫ ===
    const textureLoader = new THREE.TextureLoader();
    const texture1 = textureLoader.load('posters/art1.jpg');
    const texture2 = textureLoader.load('posters/art2.jpg');

    // === СКУЛЬПТУРЫ ===
    const sculptures = [];
    const sculptureCount = 700;
    const half = Math.floor(sculptureCount / 2);

    for (let i = 0; i < sculptureCount; i++) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);

      if (
        maze[r][c] &&
        !(r === start.r && c === start.c) &&
        !(r === exitCell.r && c === exitCell.c)
      ) {
        const texture = i < half ? texture1 : texture2; // половина art1, половина art2
        const mat = new THREE.MeshStandardMaterial({ map: texture });

        const sculpture = new THREE.Mesh(
          new THREE.BoxGeometry(
            1.5 + Math.random() * 2,
            2 + Math.random() * 4,
            1.5 + Math.random() * 2
          ),
          mat
        );

        sculpture.position.set(
          (c - cols / 2) * cellSize + (Math.random() - 0.5) * (cellSize * 0.8),
          sculpture.geometry.parameters.height / 2,
          (r - rows / 2) * cellSize + (Math.random() - 0.5) * (cellSize * 0.8)
        );
        sculpture.castShadow = true;
        sculpture.receiveShadow = true;
        scene.add(sculpture);
        sculptures.push({
          mesh: sculpture,
          box: new THREE.Box3().setFromObject(sculpture),
        });
      }
    }

    const obstacles = [
      ...walls.map((w) => ({ box: new THREE.Box3().setFromObject(w) })),
      ...sculptures,
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

    // === Управление ===
    const pointer = { yaw: 0, pitch: 0 };
    function onMouseMove(e) {
      if (document.pointerLockElement === mount) {
        pointer.yaw -= e.movementX * 0.0025;
        pointer.pitch -= e.movementY * 0.0025;
        pointer.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pointer.pitch));
      }
    }

    mount.addEventListener('click', () => mount.requestPointerLock());
    document.addEventListener('mousemove', onMouseMove);

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
    let escaped = false;

    function animate() {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;

      const dirX = Math.sin(pointer.yaw);
      const dirZ = Math.cos(pointer.yaw);
      player.direction.set(dirX, 0, dirZ).normalize();

      const move = new THREE.Vector3();
      if (keys['KeyW'] || keys['ArrowUp']) move.z -= 1;
      if (keys['KeyS'] || keys['ArrowDown']) move.z += 1;
      if (keys['KeyA'] || keys['ArrowLeft']) move.x -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) move.x += 1;

      const speed = keys['ShiftLeft'] || keys['ShiftRight'] ? player.runSpeed : player.speed;

      if (move.lengthSq() > 0) {
        move.normalize();
        const yaw = pointer.yaw;
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const right = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
        const world = new THREE.Vector3();
        world.addScaledVector(forward, -move.z);
        world.addScaledVector(right, move.x);
        const candidate = player.position.clone().addScaledVector(world.normalize(), speed * dt);
        if (!isColliding(candidate)) player.position.copy(candidate);
      }

      playerMesh.position.set(player.position.x, player.radius, player.position.z);
      camera.position.set(player.position.x, player.radius * 2, player.position.z);
      const lookAt = player.position.clone().add(player.direction.clone().multiplyScalar(10));
      camera.lookAt(lookAt);

      const playerBox = new THREE.Box3().setFromCenterAndSize(player.position, new THREE.Vector3(1, 1, 1));
      if (!escaped && playerBox.intersectsBox(exitBox)) {
        escaped = true;
        alert('🎉 Вы выбрались из лабиринта!');
      }

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
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
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100vw', height: '100vh', overflow: 'hidden' }} />;
}

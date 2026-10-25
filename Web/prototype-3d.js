import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const stage = document.querySelector("#prototype-3d");
const figure = stage?.closest(".hero-visual");
const stageFrame = stage?.closest(".device-stage");
const fallback = figure?.querySelector(".device-art");
const hint = document.querySelector("#prototype-hint");
const controlsPanel = stageFrame?.querySelector(".viewer-controls");
const resetButton = document.querySelector("#reset-view");
const fullscreenButton = document.querySelector("#fullscreen-view");

if (stage && figure && fallback && stageFrame && controlsPanel && resetButton && fullscreenButton) {
  let renderer;
  let controls;
  let observer;
  let pendingFrame = 0;
  let initialCameraPosition;
  let fitCamera;
  let resetTransition;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.001, 100);
    const viewer = new THREE.Group();
    scene.add(viewer);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "prototype-renderer";
    renderer.domElement.setAttribute("role", "application");
    renderer.domElement.setAttribute("aria-label", "โมเดล Arduino LED Memory Game แบบสามมิติ ลากเพื่อหมุนและใช้ล้อเมาส์หรือ pinch เพื่อซูม");
    renderer.domElement.tabIndex = 0;
    stage.append(renderer.domElement);

    // Soft studio reflections distinguish metal, glass and molded plastic.
    const environmentGenerator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = environmentGenerator.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.42;
    room.dispose();
    environmentGenerator.dispose();
    scene.add(new THREE.HemisphereLight(0xf8fff9, 0x52645e, 0.65));
    const keyLight = new THREE.DirectionalLight(0xfff7e9, 1.85);
    keyLight.position.set(-3.5, 7, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.radius = 4;
    keyLight.shadow.camera.left = -1;
    keyLight.shadow.camera.right = 1;
    keyLight.shadow.camera.top = 1;
    keyLight.shadow.camera.bottom = -1;
    keyLight.shadow.bias = -0.000008;
    keyLight.shadow.normalBias = 0.00015;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xc9e2ef, 0.45);
    fillLight.position.set(4, 4, -5);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xf3d6b4, 0.3);
    rimLight.position.set(-5, 3, -2);
    scene.add(rimLight);

    function requestRender() {
      if (!pendingFrame) pendingFrame = window.requestAnimationFrame(render);
    }

    function render(now) {
      pendingFrame = 0;
      if (document.hidden || !renderer) return;
      if (resetTransition) {
        const t = reducedMotion.matches ? 1 : Math.min((now - resetTransition.start) / 420, 1);
        const eased = t * t * (3 - 2 * t);
        const orbit = new THREE.Spherical(
          THREE.MathUtils.lerp(resetTransition.from.radius, resetTransition.to.radius, eased),
          THREE.MathUtils.lerp(resetTransition.from.phi, resetTransition.to.phi, eased),
          THREE.MathUtils.lerp(resetTransition.from.theta, resetTransition.to.theta, eased),
        );
        camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(orbit));
        camera.lookAt(controls.target);
        if (t === 1) resetTransition = null;
        else requestRender();
      } else {
        controls?.update();
      }
      fitCamera?.();
      renderer.render(scene, camera);
    }

    renderer.domElement.addEventListener("pointerdown", requestRender);
    renderer.domElement.addEventListener("pointermove", (event) => {
      if (event.buttons) requestRender();
    });
    renderer.domElement.addEventListener("wheel", requestRender, { passive: true });

    const resize = () => {
      if (!renderer) return;
      const { width, height } = stage.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Leave a little room below the assembly for the existing controls.
      camera.setViewOffset(width, height, 0, height * 0.035, width, height);
      camera.updateProjectionMatrix();
      fitCamera?.(true);
      requestRender();
    };

    observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) requestRender();
    });

    new GLTFLoader().load(
      new URL("./assets/arduino-led-memory-game.glb", import.meta.url).href,
      (gltf) => {
        const model = gltf.scene;
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const largestDimension = Math.max(size.x, size.y, size.z);
        model.position.sub(center);
        model.traverse((node) => {
          if (node.isMesh) {
            // Tiny silkscreen and contact rims need no separate shadow draw.
            node.castShadow = !/silkscreen|marking|pixel|contact rim|column index/i.test(node.name);
            node.receiveShadow = true;
          }
        });
        viewer.add(model);
        model.updateMatrixWorld(true);
        const framingPoints = [];
        model.traverse((node) => {
          if (!node.isMesh) return;
          node.geometry.computeBoundingBox();
          const box = node.geometry.boundingBox;
          for (const x of [box.min.x, box.max.x]) {
            for (const y of [box.min.y, box.max.y]) {
              for (const z of [box.min.z, box.max.z]) {
                framingPoints.push(new THREE.Vector3(x, y, z).applyMatrix4(node.matrixWorld));
              }
            }
          }
        });

        // A transparent receiver grounds the separate physical boards without a plinth.
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(size.x * 1.1, size.z * 1.12),
          new THREE.ShadowMaterial({ color: 0x263530, opacity: 0.28 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = bounds.min.y - center.y - 0.0004;
        ground.receiveShadow = true;
        viewer.add(ground);

        keyLight.target.position.set(0, 0, 0);
        scene.add(keyLight.target);
        const shadowExtent = largestDimension * 0.7;
        keyLight.shadow.camera.left = -shadowExtent;
        keyLight.shadow.camera.right = shadowExtent;
        keyLight.shadow.camera.top = shadowExtent;
        keyLight.shadow.camera.bottom = -shadowExtent;
        keyLight.shadow.camera.near = 0.1;
        keyLight.shadow.camera.far = 20;
        keyLight.shadow.camera.updateProjectionMatrix();

        // The hardware and lights are static; orbiting only changes the camera.
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;

        camera.near = Math.max(largestDimension / 100, 0.001);
        camera.far = largestDimension * 20;
        const viewDirection = new THREE.Vector3(0.9, 1.4, 1.45).normalize();
        const viewTarget = new THREE.Vector3(0, 0, 0);
        const defaultDistance = largestDimension * 1.60 / 1.18;
        const viewRight = new THREE.Vector3().crossVectors(camera.up, viewDirection).normalize();
        const viewUp = new THREE.Vector3().crossVectors(viewDirection, viewRight).normalize();
        // Center the silhouette rather than the world-axis box of this asymmetric assembly.
        for (const axis of [viewRight, viewUp]) {
          let min = Infinity;
          let max = -Infinity;
          for (const point of framingPoints) {
            const value = point.dot(axis) * defaultDistance / (defaultDistance - point.dot(viewDirection));
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
          viewTarget.addScaledVector(axis, (min + max) / 2);
        }
        camera.position.copy(viewTarget).addScaledVector(viewDirection, defaultDistance);
        camera.lookAt(viewTarget);
        camera.updateProjectionMatrix();
        initialCameraPosition = camera.position.clone();

        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(viewTarget);
        controls.enableDamping = true;
        controls.dampingFactor = 0.075;
        controls.enablePan = false;
        controls.minDistance = largestDimension * 0.68;
        controls.maxDistance = largestDimension * 3.8;
        controls.minPolarAngle = 0.08;
        controls.maxPolarAngle = Math.PI - 0.08;
        controls.rotateSpeed = 0.65;
        controls.zoomSpeed = 0.8;
        controls.saveState();
        controls.addEventListener("change", requestRender);
        controls.update();

        // Fit actual mesh bounds, including the jumper harness, at every angle.
        // This prevents edge cropping even after zoom, resize or portrait fullscreen.
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        const relative = new THREE.Vector3();
        const direction = new THREE.Vector3();
        function safeDistance(view) {
          right.crossVectors(camera.up, view).normalize();
          up.crossVectors(view, right).normalize();
          const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          let distance = 0;
          for (const point of framingPoints) {
            relative.copy(point).sub(viewTarget);
            const depth = relative.dot(view);
            const vertical = relative.dot(up);
            distance = Math.max(distance,
              depth + Math.abs(relative.dot(right)) / (tan * camera.aspect * 0.96),
              depth + Math.abs(vertical) / (tan * (vertical >= 0 ? 0.85 : 1.0)),
            );
          }
          return distance;
        }
        fitCamera = (resized = false) => {
          direction.copy(camera.position).sub(viewTarget).normalize();
          const minimum = safeDistance(direction);
          controls.minDistance = minimum;
          controls.maxDistance = Math.max(largestDimension * 3.8, minimum * 2);
          const previousDefaultDistance = initialCameraPosition.distanceTo(viewTarget);
          initialCameraPosition.copy(viewTarget).addScaledVector(viewDirection, Math.max(defaultDistance, safeDistance(viewDirection)));
          let distance = camera.position.distanceTo(viewTarget);
          if (resized) {
            resetTransition = null;
            distance *= initialCameraPosition.distanceTo(viewTarget) / previousDefaultDistance;
          }
          camera.position.copy(viewTarget).addScaledVector(direction, Math.max(minimum, Math.min(distance, controls.maxDistance)));
          camera.updateMatrixWorld();
        };
        fitCamera();
        camera.position.copy(initialCameraPosition);
        controls.update();
        controls.addEventListener("start", () => { resetTransition = null; });

        resetButton.addEventListener("click", () => {
          // Flush residual orbit damping before starting an interruptible reset.
          controls.enableDamping = false;
          controls.update();
          controls.enableDamping = true;
          const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(viewTarget));
          const to = new THREE.Spherical().setFromVector3(initialCameraPosition.clone().sub(viewTarget));
          to.theta = from.theta + Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta));
          resetTransition = { from, to, start: performance.now() };
          requestRender();
        });

        fullscreenButton.addEventListener("click", async () => {
          try {
            if (document.fullscreenElement === stageFrame) {
              await document.exitFullscreen();
            } else if (!document.fullscreenElement) {
              await stageFrame.requestFullscreen();
            }
          } catch (error) {
            hint.textContent = "เบราว์เซอร์นี้ไม่รองรับโหมดเต็มหน้าจอ";
          }
        });

        document.addEventListener("fullscreenchange", () => {
          const isFullscreen = document.fullscreenElement === stageFrame;
          fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
          fullscreenButton.setAttribute("aria-label", isFullscreen ? "ออกจากโหมดเต็มหน้าจอ" : "ดูโมเดลเต็มหน้าจอ");
          fullscreenButton.title = isFullscreen ? "ออกจากโหมดเต็มหน้าจอ" : "ดูโมเดลเต็มหน้าจอ";
          fullscreenButton.querySelector("span").textContent = isFullscreen ? "ย่อมุมมอง" : "เต็มจอ";
          resize();
        });

        figure.classList.add("has-3d");
        fullscreenButton.setAttribute("aria-pressed", "false");
        fallback.setAttribute("aria-hidden", "true");
        controlsPanel.hidden = false;
        stage.setAttribute("aria-hidden", "false");
        hint.textContent = "ลากเพื่อหมุน · Scroll / Pinch เพื่อซูม";
        requestRender();
      },
      (progress) => {
        if (progress.total) {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          hint.textContent = `กำลังโหลดโมเดล 3D ${percent}%`;
        }
      },
      (error) => {
        console.warn("GLB model unavailable; using the static illustration.", error);
        hint.textContent = "แสดงภาพสำรอง · โมเดลสามมิติไม่พร้อม";
      },
    );

    window.addEventListener("beforeunload", () => {
      observer?.disconnect();
      controls?.dispose();
      if (pendingFrame) window.cancelAnimationFrame(pendingFrame);
      environment.dispose();
      renderer?.dispose();
    }, { once: true });
  } catch (error) {
    console.warn("3D viewer unavailable; using the static illustration.", error);
    hint.textContent = "แสดงภาพสำรอง · โมเดลสามมิติไม่พร้อม";
  }
}

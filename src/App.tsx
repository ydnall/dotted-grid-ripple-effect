import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './App.css';

function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mountElement = mountRef.current;
    if (!mountElement) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer();

    renderer.setSize(window.innerWidth, window.innerHeight);
    mountElement.appendChild(renderer.domElement);

    camera.position.set(0, 0, 8);

    // Water simulation parameters
    const width = 100;
    const height = 100;
    const size = width * height;
    let buffer1 = new Int16Array(size);
    let buffer2 = new Int16Array(size);

    // Create a dotted grid for the water surface
    function createDottedGrid(width: number, height: number) {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(width * height * 3);

      for (let i = 0, j = 0; i < width * height; i++) {
        const x = (i % width) / (width - 1) * 10 - 5;
        const y = Math.floor(i / width) / (height - 1) * 10 - 5;
        positions[j++] = x;
        positions[j++] = y;
        positions[j++] = 0;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 1,
        sizeAttenuation: false
      });

      return new THREE.Points(geometry, material);
    }

    const dottedGrid = createDottedGrid(width, height);
    scene.add(dottedGrid);

    // Add an invisible plane for raycasting
    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    scene.add(plane);

    function processWater(source: Int16Array, dest: Int16Array) {
      for (let i = width; i < size - width; i++) {
        if (i % width === 0 || i % width === width - 1) continue; // Skip edges
        dest[i] = ((source[i - 1] + source[i + 1] + source[i - width] + source[i + width]) >> 1) - dest[i];
        dest[i] -= dest[i] >> 5; // Damping
      }
    }

    function updateGeometry() {
      const positions = dottedGrid.geometry.attributes.position.array as Float32Array;
      for (let i = 0, j = 0; i < positions.length; i += 3, j++) {
        positions[i + 2] = buffer1[j] / 1000; // Scale down the height for visibility
      }
      dottedGrid.geometry.attributes.position.needsUpdate = true;
    }

    function addDrop(x: number, y: number) {
      const centerX = Math.floor(x * (width - 1));
      const centerY = Math.floor(y * (height - 1));
      const radius = 4;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= radius) {
            const px = centerX + dx;
            const py = centerY + dy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const index = py * width + px;
              const intensity = 5000 * (1 - distance / radius);
              buffer1[index] += intensity;
            }
          }
        }
      }
    }

    // Animation loop
    const FPS = 60;
    const frameTime = 1000 / FPS;
    let lastFrameTime = 0;

    const animate = (currentTime: number) => {
      requestAnimationFrame(animate);

      const deltaTime = currentTime - lastFrameTime;

      if (deltaTime >= frameTime) {
        processWater(buffer1, buffer2);
        [buffer1, buffer2] = [buffer2, buffer1];

        updateGeometry();

        renderer.render(scene, camera);

        lastFrameTime = currentTime - (deltaTime % frameTime);
      }
    };

    animate(0);

    // Handle window resize
    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    // Add drops on click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObject(plane);

      if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        const x = (intersectionPoint.x + 5) / 10;
        const y = (intersectionPoint.y + 5) / 10;
        addDrop(x, y);
      }
    };

    renderer.domElement.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      if (mountElement) {
        mountElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} />;
}

export default App;
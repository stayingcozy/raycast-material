import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'

const scene = new THREE.Scene()

// 🌟 Get reference to the <canvas> in HTML for displaying the color map
const colorMapCanvas = document.getElementById("color-map-canvas") as HTMLCanvasElement;
const ctx = colorMapCanvas?.getContext("2d");
if (!ctx) throw new Error("Canvas context not found");

new RGBELoader().load('img/venice_sunset_1k.hdr', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping
  scene.environment = texture
  scene.background = texture
  scene.backgroundBlurriness = 0.5
})

const SIZE = 600

// const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100)
camera.position.set(0, 0, 3)

const canvas = document.getElementById('canvas') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas: canvas })
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.8
renderer.shadowMap.enabled = true
renderer.setSize(SIZE, SIZE)
// document.body.appendChild(renderer.domElement)

window.addEventListener('resize', () => {
  camera.aspect = 1 // window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  // renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setSize(SIZE, SIZE)
})

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

const raycaster = new THREE.Raycaster()
const pickables: THREE.Mesh[] = []
const mouse = new THREE.Vector2()

const arrowHelper = new THREE.ArrowHelper()
arrowHelper.setLength(0.5)
scene.add(arrowHelper)

renderer.domElement.addEventListener('mousemove', (e) => {
  // mouse.set((e.clientX / renderer.domElement.clientWidth) * 2 - 1, -(e.clientY / renderer.domElement.clientHeight) * 2 + 1)
  const rect = canvas.getBoundingClientRect(); // Get correct canvas position in the DOM
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera)

  const intersects = raycaster.intersectObjects(pickables, false)

  if (intersects.length) {

    const n = new THREE.Vector3()
    n.copy((intersects[0].face as THREE.Face).normal)
    //n.transformDirection(intersects[0].object.matrixWorld)

    arrowHelper.setDirection(n)
    arrowHelper.position.copy(intersects[0].point)
  }
})

renderer.domElement.addEventListener('dblclick', (e) => {
  // mouse.set((e.clientX / renderer.domElement.clientWidth) * 2 - 1, -(e.clientY / renderer.domElement.clientHeight) * 2 + 1)
  const rect = canvas.getBoundingClientRect(); // Get correct canvas position in the DOM
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera)

  const intersects = raycaster.intersectObjects(pickables, false)

  if (intersects.length) {
    const intersect = intersects[0]

    const n = new THREE.Vector3()
    n.copy((intersect.face as THREE.Face).normal)
    //n.transformDirection(intersect.object.matrixWorld)

    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial())
    cube.lookAt(n)
    cube.position.copy(intersect.point)
    cube.position.addScaledVector(n, 0.1)
    cube.castShadow = true

    scene.add(cube)
    pickables.push(cube)

    // Draw white X //
    // Get UV coordinates
    const uv = intersect.uv;
    if (!uv) return;

    console.log(`Clicked UV: (${uv.x.toFixed(4)}, ${uv.y.toFixed(4)})`);

    // Get color map canvas and context
    const colorMapCanvas = document.getElementById("color-map-canvas") as HTMLCanvasElement;
    const ctx = colorMapCanvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = colorMapCanvas;

    // Convert UV to pixel coordinates
    const x = Math.floor(uv.x * width);
    const y = Math.floor((uv.y) * height); // Flip y-axis

    console.log(`Mapped pixel coordinates: (${x}, ${y})`);

    // Draw a white "X" centered on (x, y)
    const size = 10; // Size of "X"
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x - size, y - size); // Top-left to bottom-right
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size); // Top-right to bottom-left
    ctx.lineTo(x - size, y + size);
    ctx.stroke();
  }
})

new GLTFLoader().load('models/suzanne_scene.glb', (gltf) => {
  const suzanne = gltf.scene.getObjectByName('Suzanne') as THREE.Mesh
  suzanne.castShadow = true
  // @ts-ignore
  suzanne.material.map.colorSpace = THREE.LinearSRGBColorSpace
  pickables.push(suzanne)

  const plane = gltf.scene.getObjectByName('Plane') as THREE.Mesh
  plane.receiveShadow = true
  pickables.push(plane)

  const spotLight = gltf.scene.getObjectByName('Spot') as THREE.SpotLight
  spotLight.intensity /= 500
  spotLight.castShadow = true

  scene.add(gltf.scene)

  // 🔥 Traverse Scene and Extract Emissive Map
  suzanne.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mat = child.material as THREE.MeshStandardMaterial;
      // console.log("Material in Suzanne: ", JSON.stringify(mat.toJSON()));

      if (mat.map) {
        console.log("Processing emissive map for:", child);

        // Ensure texture is loaded
        const colorMap = mat.map.image;
        if (!colorMap) return;

        // Resize Canvas to Texture Size
        colorMapCanvas.width = colorMap.width;
        colorMapCanvas.height = colorMap.height;

        // Clear & Draw Texture on Canvas
        ctx.clearRect(0, 0, colorMapCanvas.width, colorMapCanvas.height);
        ctx.drawImage(colorMap, 0, 0, colorMapCanvas.width, colorMapCanvas.height);
      }
    }
  });
})


function animate() {
  requestAnimationFrame(animate)

  controls.update()

  renderer.render(scene, camera)
}

animate()
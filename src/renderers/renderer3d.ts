import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DieType } from '../app/types';

interface Die3D {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  type: DieType;
  settled: boolean;
  settleFrames: number;
  prerollValue?: number;
  spawnTime: number;
}

interface FaceNormal {
  normal: THREE.Vector3;
  value: number;
}

export class Renderer3D {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private world!: CANNON.World;
  private dice: Die3D[] = [];
  private table!: CANNON.Body;
  private tableMesh: THREE.Mesh | null = null;
  private tableMaterial: THREE.MeshLambertMaterial | null = null;
  private materials: Map<DieType, THREE.Material> = new Map();
  private faceNormals: Map<DieType, FaceNormal[]> = new Map();
  private animationId: number | null = null;
  private settleCallback?: (results: { type: DieType; value: number }[]) => void;
  private resultByPhysics = false;

  constructor(canvas: HTMLCanvasElement) {
    this.initThree(canvas);
    this.initPhysics();
    this.initMaterials();
    this.setupTable();
    this.startRenderLoop();
  }

  private initThree(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 20, 0);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });

    // Mobile optimization
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.shadowMap.enabled = false; // Disable shadows for performance

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 18;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.2;

    const isMobile = window.matchMedia('(max-width: 899px)').matches;
    this.controls.rotateSpeed = isMobile ? 0.6 : 0.9;
    this.controls.zoomSpeed = isMobile ? 0.6 : 0.9;

    // Lighting
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    this.scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);
  }

  private initPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -30, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    (this.world.solver as any).iterations = 10;
    this.world.defaultContactMaterial.friction = 0.4;
    this.world.defaultContactMaterial.restitution = 0.3;
  }

  private createNumberTexture(number: number, bgColor: string | number = '#ffffff'): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Background
    if (typeof bgColor === 'number') {
      ctx.fillStyle = `#${bgColor.toString(16).padStart(6, '0')}`;
      ctx.fillRect(0, 0, size, size);

      // Border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, size - 4, size - 4);

      // Number
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px Arial';
    } else {
      // Clear background for transparent
      ctx.clearRect(0, 0, size, size);

      // Draw text
      ctx.fillStyle = bgColor;
      ctx.font = 'bold 80px Arial';
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number.toString(), size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private addNumberDecals(mesh: THREE.Mesh, type: DieType): void {
    const sides = parseInt(type.substring(1));
    const faceNormals = this.faceNormals.get(type);
    if (!faceNormals) return;

    // Create number planes for each face
    for (let i = 0; i < Math.min(sides, faceNormals.length); i++) {
      const number = i + 1;
      const texture = this.createNumberTexture(number, '#ffffff'); // Standard white text

      const planeMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1, // Pull forward
        polygonOffsetUnits: -1
      });

      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), planeMaterial);

      // Position plane on face
      const normal = faceNormals[i].normal.clone();

      // Fine tune distance for different dice
      let distance = 0.51; // base

      switch (type) {
        case 'd2': distance = 0.2; break; // Coin face
        case 'd4': distance = 0.45; break;
        case 'd5': distance = 0.81; break; // Prism
        case 'd6': distance = 0.71; break;
        case 'd8': distance = 0.65; break;
        case 'd10': distance = 0.95; break; // Adjusted for new geometry
        case 'd12': distance = 0.95; break;
        case 'd20': distance = 0.95; break;
      }

      const pos = normal.clone().multiplyScalar(distance);
      plane.position.copy(pos);

      // Orient plane to face normal
      plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

      // Rotate 180 degrees if needed (some numbers might be upside down)
      // For now, let's keep it simple. We might need specific orientations for D4/D10 etc.

      mesh.add(plane);
    }
  }


  private initMaterials() {
    const colors = {
      d2: 0xfbbf24,    // Gold
      d4: 0x16537e,    // Blue
      d5: 0xbe185d,    // Pink
      d6: 0x7c3aed,    // Purple  
      d8: 0x059669,    // Green
      d10: 0xdc2626,   // Red
      d12: 0xea580c,   // Orange
      d20: 0x1f2937    // Dark gray
    };

    Object.entries(colors).forEach(([type, color]) => {
      // Create a simple colored material without textures for now
      // Numbers will be added as text sprites later
      this.materials.set(type as DieType, new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: 0.9
      }));
    });

    this.buildFaceNormals();
  }

  private setupTable() {
    // Visual table
    const tableGeometry = new THREE.PlaneGeometry(20, 20);
    this.tableMaterial = new THREE.MeshLambertMaterial({
      color: 0x2d3748,
      transparent: true,
      opacity: 0.8
    });
    this.tableMesh = new THREE.Mesh(tableGeometry, this.tableMaterial);
    this.tableMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.tableMesh);

    // Physics table
    const tableShape = new CANNON.Plane();
    this.table = new CANNON.Body({ mass: 0 });
    this.table.addShape(tableShape);
    this.table.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(this.table);

    // Table walls (invisible barriers)
    const wallHeight = 8; // Increased to prevent dice from flying out
    const wallThickness = 1;
    const tableSize = 10;

    const walls = [
      { pos: [0, wallHeight / 2, -tableSize] as [number, number, number], size: [tableSize, wallHeight / 2, wallThickness] as [number, number, number] },
      { pos: [0, wallHeight / 2, tableSize] as [number, number, number], size: [tableSize, wallHeight / 2, wallThickness] as [number, number, number] },
      { pos: [-tableSize, wallHeight / 2, 0] as [number, number, number], size: [wallThickness, wallHeight / 2, tableSize] as [number, number, number] },
      { pos: [tableSize, wallHeight / 2, 0] as [number, number, number], size: [wallThickness, wallHeight / 2, tableSize] as [number, number, number] }
    ];

    walls.forEach(wall => {
      const wallShape = new CANNON.Box(new CANNON.Vec3(...wall.size));
      const wallBody = new CANNON.Body({ mass: 0 });
      wallBody.addShape(wallShape);
      wallBody.position.set(...wall.pos);
      this.world.addBody(wallBody);
    });
  }

  private createDieGeometry(type: DieType): THREE.BufferGeometry {
    switch (type) {
      case 'd2':
        return new THREE.CylinderGeometry(1.2, 1.2, 0.2, 32);
      case 'd4':
        return new THREE.TetrahedronGeometry(1.2, 0);
      case 'd5':
        // Triangular prism
        // Create a cylinder with 3 sides
        return new THREE.CylinderGeometry(1, 1, 2, 3);
      case 'd6':
        return new THREE.BoxGeometry(1.4, 1.4, 1.4);
      case 'd8':
        return new THREE.OctahedronGeometry(1.3, 0);
      case 'd10':
        // Improved D10 - Pentagonal Trapezohedron approximation using Dipyramid
        // Vertices for a pentagonal dipyramid
        const radius = 1;
        const height = 1.2;

        // Faces
        const indices = [
          // Top faces
          0, 3, 2,
          0, 4, 3,
          0, 5, 4,
          0, 6, 5,
          0, 2, 6,
          // Bottom faces
          1, 2, 3,
          1, 3, 4,
          1, 4, 5,
          1, 5, 6,
          1, 6, 2
        ];

        const d10Geo = new THREE.BufferGeometry();
        d10Geo.setAttribute('position', new THREE.Float32BufferAttribute([
          0, height, 0, // 0: Top
          0, -height, 0, // 1: Bottom
          Math.sin(0) * radius, 0, Math.cos(0) * radius, // 2
          Math.sin(Math.PI * 0.4) * radius, 0, Math.cos(Math.PI * 0.4) * radius, // 3
          Math.sin(Math.PI * 0.8) * radius, 0, Math.cos(Math.PI * 0.8) * radius, // 4
          Math.sin(Math.PI * 1.2) * radius, 0, Math.cos(Math.PI * 1.2) * radius, // 5
          Math.sin(Math.PI * 1.6) * radius, 0, Math.cos(Math.PI * 1.6) * radius, // 6
        ], 3));
        d10Geo.setIndex(indices);
        d10Geo.computeVertexNormals();
        return d10Geo;

      case 'd12':
        return new THREE.DodecahedronGeometry(1.2, 0);
      case 'd20':
        return new THREE.IcosahedronGeometry(1.3, 0);
      default:
        return new THREE.BoxGeometry(1, 1, 1);
    }
  }

  private createDieMaterials(type: DieType): THREE.Material | THREE.Material[] {
    const baseColor = (this.materials.get(type) as THREE.MeshLambertMaterial)?.color.getHex() || 0x808080;

    // For all dice, use simple colored material
    return this.materials.get(type) || new THREE.MeshLambertMaterial({ color: baseColor });
  }

  private buildFaceNormals(): void {
    const diceTypes: DieType[] = ['d2', 'd4', 'd5', 'd6', 'd8', 'd10', 'd12', 'd20'];
    diceTypes.forEach((type) => {
      const geometry = this.createDieGeometry(type);
      const normals = this.extractFaceNormals(geometry, (normal) => {
        if (type === 'd2') {
          return Math.abs(normal.y) > 0.9; // Only top/bottom
        }
        // For D5 and D10, we want all faces
        return true; // All faces for others
      });
      const values = normals.map((normal, index) => ({
        normal,
        value: index + 1
      }));
      this.faceNormals.set(type, values);
      geometry.dispose();
    });
  }

  private extractFaceNormals(
    geometry: THREE.BufferGeometry,
    filter: (normal: THREE.Vector3) => boolean
  ): THREE.Vector3[] {
    // Only convert to non-indexed if it's indexed
    // const geom = geometry.index ? geometry.toNonIndexed() : geometry;
    // For manual D10, we might need to be careful.
    // Let's try to just get normals from faces using normal attribute or logic.
    const geom = geometry.toNonIndexed(); // Ensure we have raw triangles
    const position = geom.getAttribute('position');
    const normals: THREE.Vector3[] = [];
    const normalMap = new Map<string, THREE.Vector3>();

    for (let i = 0; i < position.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(position, i);
      const b = new THREE.Vector3().fromBufferAttribute(position, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(position, i + 2);
      const normal = new THREE.Vector3()
        .subVectors(b, a)
        .cross(new THREE.Vector3().subVectors(c, a))
        .normalize();
      if (!filter(normal)) continue;
      const key = `${normal.x.toFixed(3)}:${normal.y.toFixed(3)}:${normal.z.toFixed(3)}`;
      if (!normalMap.has(key)) {
        normalMap.set(key, normal);
      }
    }

    normalMap.forEach((value) => normals.push(value));
    return normals;
  }

  private createDieBody(type: DieType): CANNON.Body {
    let shape: CANNON.Shape;
    const mass = 1;

    switch (type) {
      case 'd2':
        // Cylinder for coin
        shape = new CANNON.Cylinder(1.2, 1.2, 0.2, 16);
        // Fix cylinder orientation (CANNON cylinder is along Z axis, we usually want Y)
        // We handle rotation in body added to shape usually, or just rotate the body
        break;
      case 'd6':
        shape = new CANNON.Box(new CANNON.Vec3(0.7, 0.7, 0.7));
        break;
      default:
        // Use ConvexPolyhedron for all other dice for accurate rolling
        const geometry = this.createDieGeometry(type);
        shape = this.createConvexPolyhedron(geometry);
    }

    const body = new CANNON.Body({ mass });

    // Rotate cylinder shape to match visual if needed
    if (type === 'd2') {
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
      body.addShape(shape, new CANNON.Vec3(0, 0, 0), q);
    } else if (type === 'd5') {
      // Rotate prism to stand up? Visual is Y-up cylinder
      // CANNON Cylinder is Z-up. Our visual is Y-up.
      // But we generate ConvexPoly for D5 from THREE geometry which is Y-up.
      // So ConvexPoly should match visual automatically.
      body.addShape(shape);
    } else {
      body.addShape(shape);
    }

    body.material = new CANNON.Material({ friction: 0.01, restitution: 0.5 }); // Lower friction for better rolling
    body.linearDamping = 0.1;
    body.angularDamping = 0.1;

    return body;
  }

  private createConvexPolyhedron(geometry: THREE.BufferGeometry): CANNON.ConvexPolyhedron {
    const geo = geometry.toNonIndexed();
    const position = geo.getAttribute('position');
    const faces: number[][] = [];

    // Extract unique vertices
    const uniqueVerts: CANNON.Vec3[] = [];
    const vertMap: Record<string, number> = {};

    const getVertIndex = (x: number, y: number, z: number) => {
      const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
      if (vertMap[key] !== undefined) return vertMap[key];
      const v = new CANNON.Vec3(x, y, z);
      uniqueVerts.push(v);
      vertMap[key] = uniqueVerts.length - 1;
      return uniqueVerts.length - 1;
    };

    for (let i = 0; i < position.count; i += 3) {
      const a = getVertIndex(position.getX(i), position.getY(i), position.getZ(i));
      const b = getVertIndex(position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1));
      const c = getVertIndex(position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2));
      faces.push([a, b, c]);
    }

    return new CANNON.ConvexPolyhedron({
      vertices: uniqueVerts,
      faces: faces
    });
  }

  public addDie(type: DieType, position: THREE.Vector3, throwForce: number, spinForce: number, prerollValue?: number): void {
    const geometry = this.createDieGeometry(type);
    const material = this.createDieMaterials(type);
    const mesh = new THREE.Mesh(geometry, material);

    // Add number decals
    this.addNumberDecals(mesh, type);

    const body = this.createDieBody(type);

    // Set position
    mesh.position.copy(position);
    body.position.set(position.x, position.y, position.z);

    // Apply random rotation
    const rotation = new THREE.Euler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );
    mesh.setRotationFromEuler(rotation);
    body.quaternion.set(
      rotation.x,
      rotation.y,
      rotation.z,
      1
    ).normalize();

    // Apply throw force
    const throwDirection = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      -0.3,
      (Math.random() - 0.5) * 0.5
    ).normalize().multiplyScalar(throwForce * 0.1);

    body.velocity.set(throwDirection.x, throwDirection.y, throwDirection.z);

    // Apply spin
    body.angularVelocity.set(
      (Math.random() - 0.5) * spinForce * 0.1,
      (Math.random() - 0.5) * spinForce * 0.1,
      (Math.random() - 0.5) * spinForce * 0.1
    );

    const die: Die3D = {
      mesh,
      body,
      type,
      settled: false,
      settleFrames: 0,
      prerollValue,
      spawnTime: Date.now()
    };

    this.dice.push(die);
    this.scene.add(mesh);
    this.world.addBody(body);

    this.isIdle = false;
    this.lastActiveTime = Date.now();
  }

  public clearDice(): void {
    this.dice.forEach(die => {
      this.scene.remove(die.mesh);
      this.world.removeBody(die.body);
      die.mesh.geometry.dispose();
    });
    this.dice = [];
  }

  private checkSettled(): void {
    const settleThreshold = 0.5; // Increased threshold for faster detection
    const settleFrames = 10; // Reduced frames needed
    const maxWaitTime = 4000; // 4 seconds timeout
    const now = Date.now();
    let allSettled = true;

    this.dice.forEach(die => {
      const velocity = die.body.velocity.length();
      const angularVelocity = die.body.angularVelocity.length();
      const timeElapsed = now - die.spawnTime;

      // Force settle after timeout
      if (timeElapsed > maxWaitTime) {
        die.settled = true;
      } else if (velocity < settleThreshold && angularVelocity < settleThreshold) {
        die.settleFrames++;
        if (die.settleFrames >= settleFrames) {
          die.settled = true;
        } else {
          allSettled = false;
        }
      } else {
        die.settled = false;
        die.settleFrames = 0;
        allSettled = false;
      }
    });

    if (allSettled && this.dice.length > 0 && this.settleCallback) {
      const results = this.dice.map(die => ({
        type: die.type,
        value: this.getDieValue(die)
      }));

      this.settleCallback(results);
      this.settleCallback = undefined;
    }
  }

  private getDieValue(die: Die3D): number {
    const sides = parseInt(die.type.substring(1));
    if (!this.resultByPhysics) {
      return die.prerollValue ?? Math.floor(Math.random() * sides) + 1;
    }
    const faceNormals = this.faceNormals.get(die.type);
    if (!faceNormals || faceNormals.length === 0) {
      return Math.floor(Math.random() * sides) + 1;
    }
    const up = new THREE.Vector3(0, 1, 0);
    let bestDot = -Infinity;
    let bestValue = 1;
    faceNormals.forEach(({ normal, value }) => {
      const worldNormal = normal.clone().applyQuaternion(die.mesh.quaternion).normalize();
      const dot = worldNormal.dot(up);
      if (dot > bestDot) {
        bestDot = dot;
        bestValue = value;
      }
    });
    return bestValue;
  }

  private startRenderLoop(): void {
    const render = () => {
      this.animationId = requestAnimationFrame(render);

      const deltaTime = 1 / 60; // Fixed timestep for physics

      // Update physics
      this.world.step(deltaTime);

      // Update mesh positions
      this.dice.forEach(die => {
        die.mesh.position.copy(die.body.position as any);
        die.mesh.quaternion.copy(die.body.quaternion as any);
      });

      this.checkSettled();
      this.controls.update();

      // Always render the scene (removed idle mode to keep table visible)
      this.renderer.render(this.scene, this.camera);
    };

    render();
  }

  public onSettled(callback: (results: { type: DieType; value: number }[]) => void): void {
    this.settleCallback = callback;
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public setResultByPhysics(enabled: boolean): void {
    this.resultByPhysics = enabled;
  }

  public setTableTexture(url?: string, repeat = 1): void {
    if (!this.tableMaterial) return;

    if (!url) {
      this.tableMaterial.map = null;
      this.tableMaterial.color.setHex(0x2d3748);
      this.tableMaterial.needsUpdate = true;
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture: THREE.Texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat, repeat);
        this.tableMaterial!.map = texture;
        this.tableMaterial!.color.setHex(0xffffff);
        this.tableMaterial!.needsUpdate = true;
      },
      undefined,
      () => {
        this.tableMaterial!.map = null;
        this.tableMaterial!.color.setHex(0x2d3748);
        this.tableMaterial!.needsUpdate = true;
      }
    );
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    this.clearDice();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

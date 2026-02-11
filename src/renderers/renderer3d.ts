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
  suspended: boolean;
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
  private diceColor: 'mixed' | 'red' | 'green' | 'blue' | 'yellow' | 'purple' = 'mixed';

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

    // For D5, we use 10 faces mapped to 1-5 (two sets)
    const count = type === 'd5' ? 10 : Math.min(sides, faceNormals.length);

    for (let i = 0; i < count; i++) {
      let number = i + 1;
      // Map D5 inputs (0-9) to 1-5
      if (type === 'd5') {
        number = (i % 5) + 1;
      }

      const texture = this.createNumberTexture(number, '#ffffff');

      // Use polygon offset to handle Z-fighting, so we can place mesh very close to surface
      const planeMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2, // Stronger pull forward
        polygonOffsetUnits: -2
      });

      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), planeMaterial);

      // Position plane on face
      const normal = faceNormals[i].normal.clone();

      // Distances slightly above mathematical face centers
      // D4 (r=1.2) -> 0.4
      // D6 (w=1.4) -> 0.7
      // D8 (r=1.3) -> ~0.75
      // D10 (r=1,h=1.2) -> ~0.9
      // D12 (r=1.2) -> ~0.95
      // D20 (r=1.3) -> ~0.98
      // offset = 0.005
      let distance = 0.51;

      switch (type) {
        case 'd2': distance = 0.255; break; // Updated for box geometry
        case 'd4': distance = 0.405; break;
        case 'd5': distance = 0.91; break; // Tuned for D10-like
        case 'd6': distance = 0.705; break;
        case 'd8': distance = 0.755; break;
        case 'd10': distance = 0.91; break;
        case 'd12': distance = 0.955; break;
        case 'd20': distance = 0.985; break;
      }

      const pos = normal.clone().multiplyScalar(distance);
      plane.position.copy(pos);

      // Orient plane to face normal
      plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

      mesh.add(plane);
    }
  }


  private initMaterials() {
    const colorSchemes = {
      mixed: {
        d2: 0xfbbf24,    // Gold
        d4: 0x16537e,    // Blue
        d5: 0xbe185d,    // Pink
        d6: 0x7c3aed,    // Purple  
        d8: 0x059669,    // Green
        d10: 0xdc2626,   // Red
        d12: 0xea580c,   // Orange
        d20: 0x1f2937    // Dark gray
      },
      red: {
        d2: 0xdc2626, d4: 0xdc2626, d5: 0xdc2626, d6: 0xdc2626,
        d8: 0xdc2626, d10: 0xdc2626, d12: 0xdc2626, d20: 0xdc2626
      },
      green: {
        d2: 0x059669, d4: 0x059669, d5: 0x059669, d6: 0x059669,
        d8: 0x059669, d10: 0x059669, d12: 0x059669, d20: 0x059669
      },
      blue: {
        d2: 0x2563eb, d4: 0x2563eb, d5: 0x2563eb, d6: 0x2563eb,
        d8: 0x2563eb, d10: 0x2563eb, d12: 0x2563eb, d20: 0x2563eb
      },
      yellow: {
        d2: 0xeab308, d4: 0xeab308, d5: 0xeab308, d6: 0xeab308,
        d8: 0xeab308, d10: 0xeab308, d12: 0xeab308, d20: 0xeab308
      },
      purple: {
        d2: 0x9333ea, d4: 0x9333ea, d5: 0x9333ea, d6: 0x9333ea,
        d8: 0x9333ea, d10: 0x9333ea, d12: 0x9333ea, d20: 0x9333ea
      }
    };

    const colors = colorSchemes[this.diceColor];

    Object.entries(colors).forEach(([type, color]) => {
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

    // Table walls
    const wallHeight = 8;
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
        // Hexagonal prism instead of thin cylinder to prevent edge-landing
        return new THREE.BoxGeometry(1.2, 0.4, 1.2);
      case 'd4':
        return new THREE.TetrahedronGeometry(1.2, 0);
      case 'd5':
        // Reuse D10 Geometry (Pentagonal Trapezohedron) for D5 (1-5 twice)
        // Vertices for a pentagonal dipyramid
        const r5 = 1;
        const h5 = 1.2;
        // Same logic as D10 below
        const indices5 = [
          0, 3, 2, 0, 4, 3, 0, 5, 4, 0, 6, 5, 0, 2, 6,
          1, 2, 3, 1, 3, 4, 1, 4, 5, 1, 5, 6, 1, 6, 2
        ];
        const d5Geo = new THREE.BufferGeometry();
        d5Geo.setAttribute('position', new THREE.Float32BufferAttribute([
          0, h5, 0, 0, -h5, 0,
          Math.sin(0) * r5, 0, Math.cos(0) * r5,
          Math.sin(Math.PI * 0.4) * r5, 0, Math.cos(Math.PI * 0.4) * r5,
          Math.sin(Math.PI * 0.8) * r5, 0, Math.cos(Math.PI * 0.8) * r5,
          Math.sin(Math.PI * 1.2) * r5, 0, Math.cos(Math.PI * 1.2) * r5,
          Math.sin(Math.PI * 1.6) * r5, 0, Math.cos(Math.PI * 1.6) * r5,
        ], 3));
        d5Geo.setIndex(indices5);
        d5Geo.computeVertexNormals();
        return d5Geo;

      case 'd6':
        return new THREE.BoxGeometry(1.4, 1.4, 1.4);
      case 'd8':
        return new THREE.OctahedronGeometry(1.3, 0);
      case 'd10':
        const radius = 1;
        const height = 1.2;
        const indices = [
          0, 3, 2, 0, 4, 3, 0, 5, 4, 0, 6, 5, 0, 2, 6,
          1, 2, 3, 1, 3, 4, 1, 4, 5, 1, 5, 6, 1, 6, 2
        ];
        const d10Geo = new THREE.BufferGeometry();
        d10Geo.setAttribute('position', new THREE.Float32BufferAttribute([
          0, height, 0, 0, -height, 0,
          Math.sin(0) * radius, 0, Math.cos(0) * radius,
          Math.sin(Math.PI * 0.4) * radius, 0, Math.cos(Math.PI * 0.4) * radius,
          Math.sin(Math.PI * 0.8) * radius, 0, Math.cos(Math.PI * 0.8) * radius,
          Math.sin(Math.PI * 1.2) * radius, 0, Math.cos(Math.PI * 1.2) * radius,
          Math.sin(Math.PI * 1.6) * radius, 0, Math.cos(Math.PI * 1.6) * radius,
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
    return this.materials.get(type) || new THREE.MeshLambertMaterial({ color: baseColor });
  }

  private buildFaceNormals(): void {
    const diceTypes: DieType[] = ['d2', 'd4', 'd5', 'd6', 'd8', 'd10', 'd12', 'd20'];
    diceTypes.forEach((type) => {
      const geometry = this.createDieGeometry(type);
      const normals = this.extractFaceNormals(geometry, (normal) => {
        if (type === 'd2') {
          return Math.abs(normal.y) > 0.9;
        }
        return true;
      });

      const values = normals.map((normal, index) => {
        let value = index + 1;
        if (type === 'd5') {
          value = (index % 5) + 1;
        }
        return { normal, value };
      });

      this.faceNormals.set(type, values);
      geometry.dispose();
    });
  }

  private extractFaceNormals(
    geometry: THREE.BufferGeometry,
    filter: (normal: THREE.Vector3) => boolean
  ): THREE.Vector3[] {
    const geom = geometry.toNonIndexed();
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
    // Safety padding to ensure decals (offset by ~0.01) don't clip table
    // Scale factor 1.03 gives ample room without looking too floaty
    const scale = 1.03;

    switch (type) {
      case 'd2':
        // Box shape for coin (hexagonal prism approximation)
        shape = new CANNON.Box(new CANNON.Vec3(0.6 * scale, 0.2 * scale, 0.6 * scale));
        break;
      case 'd6':
        // Scale box: 0.7 * 1.03 = 0.721
        // Decal is at 0.705. Gap = 0.016. Safe.
        shape = new CANNON.Box(new CANNON.Vec3(0.725, 0.725, 0.725));
        break;
      default:
        const geometry = this.createDieGeometry(type);
        geometry.scale(scale, scale, scale);
        shape = this.createConvexPolyhedron(geometry);
    }

    const body = new CANNON.Body({ mass });
    body.addShape(shape);

    // Increased friction for more realistic stopping
    body.material = new CANNON.Material({ friction: 0.1, restitution: 0.5 });
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
      spawnTime: Date.now(),
      suspended: false
    };

    this.dice.push(die);
    this.scene.add(mesh);
    this.world.addBody(body);
  }

  public spawnSuspendedDie(type: DieType): void {
    // Spawn high above center
    const position = new THREE.Vector3(0, 15, 0);

    const geometry = this.createDieGeometry(type);
    const material = this.createDieMaterials(type);
    const mesh = new THREE.Mesh(geometry, material);
    this.addNumberDecals(mesh, type);

    // Create static body initially (mass=0)
    const body = this.createDieBody(type);
    body.mass = 0;
    body.type = CANNON.Body.STATIC; // Or KINEMATIC if we want to move it
    body.position.set(position.x, position.y, position.z);

    mesh.position.copy(position);

    const die: Die3D = {
      mesh,
      body,
      type,
      settled: false,
      settleFrames: 0,
      spawnTime: Date.now(),
      suspended: true
    };

    this.dice.push(die);
    this.scene.add(mesh);
    this.world.addBody(body);
  }

  public releaseSuspendedDice(throwForce: number, spinForce: number): void {
    let releasedCount = 0;
    this.dice.forEach(die => {
      if (die.suspended) {
        die.suspended = false;
        die.body.mass = 1;
        die.body.type = CANNON.Body.DYNAMIC;
        die.body.updateMassProperties();
        die.spawnTime = Date.now(); // Reset timer for settling

        // Apply force
        const throwDirection = new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          -1, // Throw down
          (Math.random() - 0.5) * 0.5
        ).normalize().multiplyScalar(throwForce * 0.1);

        die.body.velocity.set(throwDirection.x, throwDirection.y, throwDirection.z);

        die.body.angularVelocity.set(
          (Math.random() - 0.5) * spinForce * 0.1,
          (Math.random() - 0.5) * spinForce * 0.1,
          (Math.random() - 0.5) * spinForce * 0.1
        );
        releasedCount++;
      }
    });

    // If we released dice, we need to ensure we wait for them to settle
    if (releasedCount > 0) {
      // Logic for waiting is handled by checkSettled loop
    }
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

      if (die.suspended) {
        allSettled = false;
      } else if (timeElapsed > maxWaitTime) {
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

  public getDiceCount(): number {
    return this.dice.length;
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

  public setDiceColor(color: 'mixed' | 'red' | 'green' | 'blue' | 'yellow' | 'purple'): void {
    this.diceColor = color;
    this.materials.clear();
    this.initMaterials();
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

  public showRandomNumber(number: number): void {
    // Create a paper card showing the random number
    const cardGeometry = new THREE.PlaneGeometry(3, 4);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 682;
    const ctx = canvas.getContext('2d')!;

    // White paper background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Number
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number.toString(), canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const cardMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide
    });

    const card = new THREE.Mesh(cardGeometry, cardMaterial);
    card.position.set(0, 2, 0);
    card.rotation.x = -Math.PI / 6; // Tilt slightly for better view
    card.name = 'randomizer-card';

    // Remove old card if exists
    const oldCard = this.scene.getObjectByName('randomizer-card');
    if (oldCard) {
      this.scene.remove(oldCard);
      oldCard.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
      });
    }

    this.scene.add(card);

    // Trigger settle callback immediately with the number
    if (this.settleCallback) {
      setTimeout(() => {
        this.settleCallback?.([{ type: 'd20', value: number }]);
        this.settleCallback = undefined;
      }, 100);
    }
  }

  public showDrawStraws(count: number): void {
    // Clear previous straws
    const oldStraws = this.scene.children.filter(obj => obj.name.startsWith('straw-'));
    oldStraws.forEach(obj => {
      this.scene.remove(obj);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    });

    // Generate random lengths and shuffle sequence
    const strawData: { length: number; sequence: number; x: number; z: number }[] = [];
    const sequences = Array.from({ length: count }, (_, i) => i + 1);

    // Fisher-Yates shuffle
    for (let i = sequences.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sequences[i], sequences[j]] = [sequences[j], sequences[i]];
    }

    // Calculate grid positions for centering
    const spacing = 1.2;
    const cols = Math.min(count, 4);
    const rows = Math.ceil(count / cols);
    const startX = -(cols - 1) * spacing / 2;
    const startZ = -(rows - 1) * spacing / 2;

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * spacing;
      const z = startZ + row * spacing;

      // Random length between 0.5 and 1.5
      const length = 0.5 + Math.random();

      strawData.push({
        length,
        sequence: sequences[i],
        x,
        z
      });
    }

    // Create straws
    strawData.forEach((data, index) => {
      const strawGroup = new THREE.Group();
      strawGroup.name = `straw-${index}`;

      // Stick body
      const stickGeometry = new THREE.CylinderGeometry(0.03, 0.03, data.length, 8);
      const stickMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 }); // Brown
      const stick = new THREE.Mesh(stickGeometry, stickMaterial);

      // Head (red tip)
      const headGeometry = new THREE.SphereGeometry(0.05, 8, 8);
      const headMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 }); // Red
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = data.length / 2;

      // Number on head
      const numberCanvas = document.createElement('canvas');
      numberCanvas.width = 64;
      numberCanvas.height = 64;
      const numCtx = numberCanvas.getContext('2d')!;
      numCtx.fillStyle = '#ffffff';
      numCtx.font = 'bold 48px Arial';
      numCtx.textAlign = 'center';
      numCtx.textBaseline = 'middle';
      numCtx.fillText(data.sequence.toString(), 32, 32);

      const numberTexture = new THREE.CanvasTexture(numberCanvas);
      const numberMaterial = new THREE.SpriteMaterial({ map: numberTexture });
      const numberSprite = new THREE.Sprite(numberMaterial);
      numberSprite.position.y = data.length / 2 + 0.15;
      numberSprite.scale.set(0.3, 0.3, 1);

      strawGroup.add(stick);
      strawGroup.add(head);
      strawGroup.add(numberSprite);

      // Position on table
      strawGroup.position.set(data.x, data.length / 2 + 0.1, data.z);
      strawGroup.userData = { ...data, index };

      this.scene.add(strawGroup);
    });

    // Find shortest straw
    const shortestIndex = strawData.reduce((shortest, current, idx) =>
      current.length < strawData[shortest].length ? idx : shortest, 0
    );

    // Animate shortest straw after a delay
    setTimeout(() => {
      const shortestStraw = this.scene.getObjectByName(`straw-${shortestIndex}`);
      if (shortestStraw) {
        // Lift up animation
        const startY = shortestStraw.position.y;
        const targetY = startY + 1.5;
        let animTime = 0;
        const liftDuration = 1000; // 1 second

        const liftAnim = () => {
          animTime += 16;
          const progress = Math.min(animTime / liftDuration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
          shortestStraw.position.y = startY + (targetY - startY) * eased;

          if (progress < 1) {
            requestAnimationFrame(liftAnim);
          } else {
            // Turn black (burned)
            shortestStraw.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
                child.material.color.setHex(0x111111);
              }
            });

            // Add fire effect (simple particle-like sprites)
            this.addFireEffect(shortestStraw);
          }
        };

        liftAnim();
      }
    }, 2000);

    // Trigger settle callback with straw results
    if (this.settleCallback) {
      setTimeout(() => {
        const results = strawData.map((data, idx) => ({
          type: 'd20' as DieType,
          value: data.sequence
        }));
        this.settleCallback?.(results);
        this.settleCallback = undefined;
      }, 100);
    }
  }

  private addFireEffect(object: THREE.Object3D): void {
    // Create simple 2D fire sprites
    const fireCanvas = document.createElement('canvas');
    fireCanvas.width = 64;
    fireCanvas.height = 64;
    const ctx = fireCanvas.getContext('2d')!;

    // Create radial gradient for flame
    const gradient = ctx.createRadialGradient(32, 32, 5, 32, 32, 30);
    gradient.addColorStop(0, 'rgba(255, 255, 100, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 150, 0, 0.9)');
    gradient.addColorStop(0.7, 'rgba(255, 50, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const fireTexture = new THREE.CanvasTexture(fireCanvas);
    const fireMaterial = new THREE.SpriteMaterial({
      map: fireTexture,
      transparent: true,
      blending: THREE.AdditiveBlending
    });

    // Add 3 flame sprites
    for (let i = 0; i < 3; i++) {
      const flame = new THREE.Sprite(fireMaterial);
      flame.position.y = object.userData.length / 2 + 0.2 + i * 0.1;
      flame.scale.set(0.3, 0.4, 1);
      flame.name = 'flame';
      object.add(flame);

      // Animate flames
      let time = Math.random() * Math.PI * 2;
      const animateFlame = () => {
        time += 0.1;
        flame.position.y = object.userData.length / 2 + 0.2 + i * 0.1 + Math.sin(time) * 0.05;
        flame.scale.set(0.3 + Math.sin(time * 2) * 0.05, 0.4 + Math.cos(time * 2) * 0.1, 1);
        requestAnimationFrame(animateFlame);
      };
      animateFlame();
    }
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

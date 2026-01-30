import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { DieType } from '../app/types';

interface Die3D {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  type: DieType;
  settled: boolean;
  settleFrames: number;
  prerollValue?: number;
}

interface FaceNormal {
  normal: THREE.Vector3;
  value: number;
}

export class Renderer3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private world: CANNON.World;
  private dice: Die3D[] = [];
  private table: CANNON.Body;
  private tableMesh: THREE.Mesh | null = null;
  private tableMaterial: THREE.MeshLambertMaterial | null = null;
  private materials: Map<DieType, THREE.Material> = new Map();
  private faceNormals: Map<DieType, FaceNormal[]> = new Map();
  private animationId: number | null = null;
  private isIdle = false;
  private lastActiveTime = 0;
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
      50,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 8, 12);
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
    this.world.solver.iterations = 10;
    this.world.defaultContactMaterial.friction = 0.4;
    this.world.defaultContactMaterial.restitution = 0.3;
  }

  private initMaterials() {
    const colors = {
      d4: 0x16537e,    // Blue
      d6: 0x7c3aed,    // Purple  
      d8: 0x059669,    // Green
      d10: 0xdc2626,   // Red
      d12: 0xea580c,   // Orange
      d20: 0x1f2937    // Dark gray
    };

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
    this.world.add(this.table);

    // Table walls
    const wallHeight = 2;
    const wallThickness = 0.5;
    const tableSize = 10;
    
    const walls = [
      { pos: [0, wallHeight/2, -tableSize], size: [tableSize, wallHeight/2, wallThickness] },
      { pos: [0, wallHeight/2, tableSize], size: [tableSize, wallHeight/2, wallThickness] },
      { pos: [-tableSize, wallHeight/2, 0], size: [wallThickness, wallHeight/2, tableSize] },
      { pos: [tableSize, wallHeight/2, 0], size: [wallThickness, wallHeight/2, tableSize] }
    ];

    walls.forEach(wall => {
      const wallShape = new CANNON.Box(new CANNON.Vec3(...wall.size));
      const wallBody = new CANNON.Body({ mass: 0 });
      wallBody.addShape(wallShape);
      wallBody.position.set(...wall.pos);
      this.world.add(wallBody);
    });
  }

  private createDieGeometry(type: DieType): THREE.BufferGeometry {
    switch (type) {
      case 'd4':
        return new THREE.TetrahedronGeometry(1.2, 0);
      case 'd6':
        return new THREE.BoxGeometry(1.4, 1.4, 1.4);
      case 'd8':
        return new THREE.OctahedronGeometry(1.3, 0);
      case 'd10':
        return new THREE.ConeGeometry(1.2, 2, 10);
      case 'd12':
        return new THREE.DodecahedronGeometry(1.2, 0);
      case 'd20':
        return new THREE.IcosahedronGeometry(1.3, 0);
      default:
        return new THREE.BoxGeometry(1, 1, 1);
    }
  }

  private buildFaceNormals(): void {
    const diceTypes: DieType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
    diceTypes.forEach((type) => {
      const geometry = this.createDieGeometry(type);
      const normals = this.extractFaceNormals(geometry, (normal) => {
        if (type === 'd10') {
          return normal.y > -0.6;
        }
        return true;
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

    switch (type) {
      case 'd4':
      case 'd8':
      case 'd12':
      case 'd20':
        // Use sphere approximation for complex polyhedra (performance)
        shape = new CANNON.Sphere(1.2);
        break;
      case 'd6':
        shape = new CANNON.Box(new CANNON.Vec3(0.7, 0.7, 0.7));
        break;
      case 'd10':
        shape = new CANNON.Cylinder(1.2, 1.2, 2, 8);
        break;
      default:
        shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    }

    const body = new CANNON.Body({ mass });
    body.addShape(shape);
    body.material = new CANNON.Material({ friction: 0.4, restitution: 0.3 });
    
    return body;
  }

  public addDie(type: DieType, position: THREE.Vector3, throwForce: number, spinForce: number, prerollValue?: number): void {
    const geometry = this.createDieGeometry(type);
    const material = this.materials.get(type)!;
    const mesh = new THREE.Mesh(geometry, material);
    
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
      prerollValue
    };

    this.dice.push(die);
    this.scene.add(mesh);
    this.world.add(body);
    
    this.isIdle = false;
    this.lastActiveTime = Date.now();
  }

  public clearDice(): void {
    this.dice.forEach(die => {
      this.scene.remove(die.mesh);
      this.world.remove(die.body);
      die.mesh.geometry.dispose();
    });
    this.dice = [];
  }

  private checkSettled(): void {
    const settleThreshold = 0.15;
    const settleFrames = 20;
    let allSettled = true;

    this.dice.forEach(die => {
      const velocity = die.body.velocity.length();
      const angularVelocity = die.body.angularVelocity.length();
      
      if (velocity < settleThreshold && angularVelocity < settleThreshold) {
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
      
      const now = Date.now();
      const deltaTime = 1/60; // Fixed timestep for physics
      
      // Update physics
      this.world.step(deltaTime);
      
      // Update mesh positions
      let hasMovement = false;
      this.dice.forEach(die => {
        die.mesh.position.copy(die.body.position as any);
        die.mesh.quaternion.copy(die.body.quaternion as any);
        
        if (die.body.velocity.length() > 0.01 || die.body.angularVelocity.length() > 0.01) {
          hasMovement = true;
        }
      });

      if (hasMovement) {
        this.lastActiveTime = now;
        this.isIdle = false;
      } else if (now - this.lastActiveTime > 1000) {
        this.isIdle = true;
      }

      this.checkSettled();
      this.controls.update();

      // Only render if not idle or if forced
      if (!this.isIdle || now - this.lastActiveTime < 2000) {
        this.renderer.render(this.scene, this.camera);
      }
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
      (texture) => {
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

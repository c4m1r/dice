import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DieType } from '../app/types';

interface Die3D {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  type: DieType;
  settled: boolean;
  settleFrames: number;
  prerollValue?: number;
}

export class Renderer3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private world: CANNON.World;
  private dice: Die3D[] = [];
  private table: CANNON.Body;
  private materials: Map<DieType, THREE.Material> = new Map();
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
  }

  private setupTable() {
    // Visual table
    const tableGeometry = new THREE.PlaneGeometry(20, 20);
    const tableMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x2d3748,
      transparent: true,
      opacity: 0.8
    });
    const tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
    tableMesh.rotation.x = -Math.PI / 2;
    this.scene.add(tableMesh);

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
        value: die.prerollValue || this.getDieValue(die)
      }));
      
      this.settleCallback(results);
      this.settleCallback = undefined;
    }
  }

  private getDieValue(die: Die3D): number {
    if (!this.resultByPhysics) {
      return die.prerollValue || Math.floor(Math.random() * parseInt(die.type.substring(1))) + 1;
    }

    // Simple physics-based result (can be improved with face normals)
    const sides = parseInt(die.type.substring(1));
    return Math.floor(Math.random() * sides) + 1;
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

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.clearDice();
    this.renderer.dispose();
  }
}
import { DieType } from '../app/types';

interface Die2D {
  type: DieType;
  value: number;
  x: number;
  y: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  scaleTarget: number;
  alpha: number;
  color: string;
}

export class Renderer2D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private dice: Die2D[] = [];
  private animationId: number | null = null;
  private isAnimating = false;
  private settleCallback?: (results: { type: DieType; value: number }[]) => void;
  private backgroundImage: HTMLImageElement | null = null;
  private backgroundReady = false;

  private colors: Record<DieType, string> = {
    d2: '#fbbf24', // Gold
    d4: '#16537e',
    d5: '#be185d', // Pink
    d6: '#7c3aed',
    d8: '#059669',
    d10: '#dc2626',
    d12: '#ea580c',
    d20: '#1f2937'
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) {
      console.error('Failed to get 2D rendering context');
      return;
    }
    this.setupCanvas();
    this.renderStatic();
  }

  private setupCanvas(): void {
    if (!this.ctx) return;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.imageSmoothingEnabled = false;
  }

  public setBackground(url?: string): void {
    if (!url) {
      this.backgroundImage = null;
      this.backgroundReady = false;
      this.renderStatic();
      return;
    }

    const image = new Image();
    image.onload = () => {
      this.backgroundImage = image;
      this.backgroundReady = true;
      this.renderStatic();
    };
    image.src = url;
  }

  public roll(dice: { type: DieType; value: number }[]): void {
    this.dice = [];
    this.backgroundReady = !!this.backgroundImage;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const spacing = 80;
    const rows = Math.ceil(Math.sqrt(dice.length));
    const cols = Math.ceil(dice.length / rows);

    dice.forEach((die, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const offsetX = (col - (cols - 1) / 2) * spacing;
      const offsetY = (row - (rows - 1) / 2) * spacing;

      this.dice.push({
        type: die.type,
        value: die.value,
        x: centerX + offsetX + (Math.random() - 0.5) * 20,
        y: centerY + offsetY + (Math.random() - 0.5) * 20,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        scale: 0,
        scaleTarget: 1,
        alpha: 1,
        color: this.colors[die.type]
      });
    });

    this.startAnimation();
  }

  private startAnimation(): void {
    this.isAnimating = true;
    let startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const duration = 1500;
      const progress = Math.min(elapsed / duration, 1);

      this.clear();

      // Animation phases
      if (progress < 0.7) {
        // Rolling phase
        this.dice.forEach(die => {
          die.rotation += die.rotationSpeed;
          die.scale = Math.min(die.scale + 0.05, 0.8);
          this.drawSpinningDie(die);
        });
      } else {
        // Settling phase
        const settleProgress = (progress - 0.7) / 0.3;
        this.dice.forEach(die => {
          die.scale = 0.8 + settleProgress * 0.2;
          die.rotationSpeed *= 0.9;
          die.rotation += die.rotationSpeed;
          this.drawDie(die, settleProgress);
        });
      }

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        if (this.settleCallback) {
          const results = this.dice.map(die => ({
            type: die.type,
            value: die.value
          }));
          this.settleCallback(results);
          this.settleCallback = undefined;
        }
      }
    };

    animate();
  }

  private clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.backgroundImage && this.backgroundReady) {
      this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private renderStatic(): void {
    if (this.isAnimating) return;
    this.clear();
  }

  private drawSpinningDie(die: Die2D): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.translate(die.x, die.y);
    this.ctx.rotate(die.rotation);
    this.ctx.scale(die.scale, die.scale);
    this.ctx.globalAlpha = die.alpha;

    // Draw spinning shape
    this.ctx.fillStyle = die.color;
    this.drawDieShape(die.type);

    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 2;
    this.drawDieShape(die.type, true);

    this.ctx.restore();
  }

  private drawDie(die: Die2D, settleProgress: number): void {
    if (!this.ctx) return;
    this.ctx.save();
    this.ctx.translate(die.x, die.y);
    this.ctx.scale(die.scale, die.scale);
    this.ctx.globalAlpha = die.alpha;

    // Draw die background
    this.ctx.fillStyle = die.color;
    this.drawDieShape(die.type);

    // Draw border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 3;
    this.drawDieShape(die.type, true);

    // Draw value
    if (settleProgress > 0.5) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 24px monospace';
      this.ctx.fillText(die.value.toString(), 0, 0);
    }

    this.ctx.restore();
  }

  private drawDieShape(type: DieType, stroke = false): void {
    if (!this.ctx) return;
    const size = 30;

    switch (type) {
      case 'd2':
        // Circle (Coin)
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size, 0, Math.PI * 2);
        this.ctx.closePath();
        break;

      case 'd4':
        // Triangle
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(-size * 0.866, size * 0.5);
        this.ctx.lineTo(size * 0.866, size * 0.5);
        this.ctx.closePath();
        break;

      case 'd5':
        // Pentagon (using similar logic to d10 but simpler)
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const x = Math.cos(angle) * size;
          const y = Math.sin(angle) * size;
          if (i === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        break;

      case 'd6':
        // Square
        if (stroke) {
          this.ctx.strokeRect(-size, -size, size * 2, size * 2);
        } else {
          this.ctx.fillRect(-size, -size, size * 2, size * 2);
        }
        return;

      case 'd8':
        // Diamond
        this.ctx.beginPath();
        this.ctx.moveTo(0, -size);
        this.ctx.lineTo(size, 0);
        this.ctx.lineTo(0, size);
        this.ctx.lineTo(-size, 0);
        this.ctx.closePath();
        break;

      case 'd10':
        // Pentagon
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const x = Math.cos(angle) * size;
          const y = Math.sin(angle) * size;
          if (i === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        break;

      case 'd12':
        // Dodecagon
        this.ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const angle = (i * Math.PI * 2) / 12;
          const x = Math.cos(angle) * size;
          const y = Math.sin(angle) * size;
          if (i === 0) this.ctx.moveTo(x, y);
          else this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        break;

      case 'd20':
        // Circle (approximating icosahedron)
        this.ctx.beginPath();
        this.ctx.arc(0, 0, size, 0, Math.PI * 2);
        this.ctx.closePath();
        break;
    }

    if (stroke) {
      this.ctx.stroke();
    } else {
      this.ctx.fill();
    }
  }

  public onSettled(callback: (results: { type: DieType; value: number }[]) => void): void {
    this.settleCallback = callback;
  }

  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.setupCanvas();
    // Force redraw even during animation
    if (this.isAnimating) {
      this.clear();
      // Redraw all dice
      this.dice.forEach(die => {
        this.drawDie(die, 1);
      });
    } else {
      this.renderStatic();
    }
  }

  public showRandomNumber(number: number): void {
    this.clear();
    if (!this.ctx) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Draw card background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(centerX - 150, centerY - 200, 300, 400);

    // Draw border
    this.ctx.strokeStyle = '#cccccc';
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(centerX - 150, centerY - 200, 300, 400);

    // Draw number
    this.ctx.fillStyle = '#000000';
    this.ctx.font = 'bold 80px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(number.toString(), centerX, centerY);

    // Trigger callback immediately
    if (this.settleCallback) {
      setTimeout(() => {
        this.settleCallback?.([{ type: 'd20', value: number }]);
        this.settleCallback = undefined;
      }, 100);
    }
  }

  public showDrawStraws(count: number): void {
    this.clear();
    if (!this.ctx) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    // Generate random lengths and shuffled sequences
    const strawData: { length: number; sequence: number; x: number; y: number }[] = [];
    const sequences = Array.from({ length: count }, (_, i) => i + 1);

    // Fisher-Yates shuffle
    for (let i = sequences.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sequences[i], sequences[j]] = [sequences[j], sequences[i]];
    }

    // Calculate grid positions
    const spacing = 80;
    const cols = Math.min(count, 4);
    const rows = Math.ceil(count / cols);
    const startX = centerX - ((cols - 1) * spacing) / 2;
    const startY = centerY - ((rows - 1) * spacing) / 2;

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * spacing;
      const y = startY + row * spacing;
      const length = 30 + Math.random() * 40; // Random length

      strawData.push({
        length,
        sequence: sequences[i],
        x,
        y
      });
    }

    // Find shortest straw
    const shortestIndex = strawData.reduce((shortest, current, idx) =>
      current.length < strawData[shortest].length ? idx : shortest, 0
    );

    // Draw all straws
    strawData.forEach((data, index) => {
      const isWinner = index === shortestIndex;

      // Straw body
      this.ctx!.fillStyle = isWinner ? '#111111' : '#8b4513';
      this.ctx!.fillRect(data.x - 3, data.y - data.length / 2, 6, data.length);

      // Red head
      this.ctx!.fillStyle = isWinner ? '#111111' : '#ff0000';
      this.ctx!.beginPath();
      this.ctx!.arc(data.x, data.y - data.length / 2, 5, 0, Math.PI * 2);
      this.ctx!.fill();

      // Sequence number
      this.ctx!.fillStyle = '#ffffff';
      this.ctx!.font = 'bold 16px Arial';
      this.ctx!.textAlign = 'center';
      this.ctx!.textBaseline = 'middle';
      this.ctx!.fillText(data.sequence.toString(), data.x, data.y - data.length / 2);

      // Fire effect for winner
      if (isWinner) {
        // Draw simple flame shapes
        for (let i = 0; i < 3; i++) {
          const flameY = data.y - data.length / 2 - 10 - i * 8;
          const flameSize = 8 - i * 2;

          this.ctx!.fillStyle = i === 0 ? '#ffff64' : i === 1 ? '#ff9600' : '#ff3200';
          this.ctx!.beginPath();
          this.ctx!.moveTo(data.x, flameY - flameSize);
          this.ctx!.lineTo(data.x - flameSize / 2, flameY);
          this.ctx!.lineTo(data.x + flameSize / 2, flameY);
          this.ctx!.closePath();
          this.ctx!.fill();
        }
      }
    });

    // Trigger callback with results
    if (this.settleCallback) {
      setTimeout(() => {
        const results = strawData.map(data => ({
          type: 'd20' as DieType,
          value: data.sequence
        }));
        this.settleCallback?.(results);
        this.settleCallback = undefined;
      }, 100);
    }
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

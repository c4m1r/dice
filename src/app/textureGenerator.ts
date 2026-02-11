
export const createTexture = (type: 'felt' | 'wood' | 'stone' | 'galaxy', width = 1024, height = 1024): string => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const addNoise = (amount: number) => {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * amount;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
        ctx.putImageData(imageData, 0, 0);
    };

    switch (type) {
        case 'felt':
            // Green felt
            ctx.fillStyle = '#0f5132'; // Dark green
            ctx.fillRect(0, 0, width, height);

            // Add texture
            addNoise(30);

            // Vignette
            const grad = ctx.createRadialGradient(width / 2, height / 2, width / 3, width / 2, height / 2, width);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.4)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
            break;

        case 'wood':
            // Dark wood (Mahogany)
            ctx.fillStyle = '#3f1d0b';
            ctx.fillRect(0, 0, width, height);

            // Wood grain
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 2;
            for (let i = 0; i < width; i += 4) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                // Wavy line
                for (let y = 0; y < height; y += 20) {
                    ctx.lineTo(i + Math.sin(y * 0.01 + i) * 10 + (Math.random() - 0.5) * 2, y);
                }
                ctx.stroke();
            }
            addNoise(20);
            break;

        case 'stone':
            // Marble/Stone
            ctx.fillStyle = '#334155'; // Slate
            ctx.fillRect(0, 0, width, height);

            // Marble veins
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 3;
            for (let i = 0; i < 10; i++) {
                ctx.beginPath();
                ctx.moveTo(Math.random() * width, Math.random() * height);
                let x = Math.random() * width;
                let y = Math.random() * height;
                for (let j = 0; j < 10; j++) {
                    x += (Math.random() - 0.5) * 200;
                    y += (Math.random() - 0.5) * 200;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            addNoise(40);
            break;

        case 'galaxy':
            // Deep space
            const spaceGrad = ctx.createLinearGradient(0, 0, 0, height);
            spaceGrad.addColorStop(0, '#020617'); // Dark blue/black
            spaceGrad.addColorStop(1, '#1e1b4b'); // Indigo
            ctx.fillStyle = spaceGrad;
            ctx.fillRect(0, 0, width, height);

            // Stars
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 400; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const r = Math.random() * 1.5;
                const a = Math.random();
                ctx.globalAlpha = a;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Nebula cloud
            const cloudGrad = ctx.createRadialGradient(width * 0.7, height * 0.3, 0, width * 0.7, height * 0.3, width * 0.5);
            cloudGrad.addColorStop(0, 'rgba(124, 58, 237, 0.2)'); // Purple
            cloudGrad.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = cloudGrad;
            ctx.fillRect(0, 0, width, height);
            break;
    }

    return canvas.toDataURL('image/jpeg', 0.8);
};

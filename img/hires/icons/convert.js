const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = __dirname;
const outputDir = path.join(__dirname, '../../../public/img');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Get all PNG files in the current directory
const files = fs.readdirSync(inputDir).filter(file => file.toLowerCase().endsWith('.png'));

async function processImage(filename) {
    const inputPath = path.join(inputDir, filename);
    const outputPath = path.join(outputDir, filename);

    // Custom glow color (base color to extract hue from)
    const glowColor = { r: 0x88, g: 0xaa, b: 0xff };
    // Gaussian blur sigma (controls spread)
    const blurSigma = 16;
    // Blur strength multiplier (controls opacity/intensity)
    const blurStrength = 150;

    // Manual RGB to HSL conversion and maximized saturation
    function rgbToBold(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0;
        if (max === min) {
            h = 0;
        } else if (max === r) {
            h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6;
        } else if (max === g) {
            h = ((b - r) / (max - min) + 2) / 6;
        } else {
            h = ((r - g) / (max - min) + 4) / 6;
        }
        const hue = h * 360;
        // S=100%, L=50%
        const c = 1;
        const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
        let r1, g1, b1;
        if (hue < 60) { r1 = c; g1 = x; b1 = 0; }
        else if (hue < 120) { r1 = x; g1 = c; b1 = 0; }
        else if (hue < 180) { r1 = 0; g1 = c; b1 = x; }
        else if (hue < 240) { r1 = 0; g1 = x; b1 = c; }
        else if (hue < 300) { r1 = x; g1 = 0; b1 = c; }
        else { r1 = c; g1 = 0; b1 = x; }
        return {
            r: Math.round(r1 * 255),
            g: Math.round(g1 * 255),
            b: Math.round(b1 * 255)
        };
    }
    const boldColor = rgbToBold(glowColor.r, glowColor.g, glowColor.b);
    
    try {
        // Step 1: Threshold and get raw data
        const { data, info } = await sharp(inputPath)
            .threshold(80)
            .toColourspace('b-w')
            .raw()
            .toBuffer({ resolveWithObject: true });

        // Step 2: Create original RGBA (black/transparent)
        const origRgba = Buffer.alloc(info.width * info.height * 4);
        for (let i = 0; i < data.length; i++) {
            const idx = i * 4;
            origRgba[idx] = data[i]; // R
            origRgba[idx + 1] = data[i]; // G
            origRgba[idx + 2] = data[i]; // B
            origRgba[idx + 3] = data[i] > 80 ? 0 : 255; // A
        }

        // Step 3: Create colorized RGBA (boldest version of custom color/transparent)
        const colorRgba = Buffer.alloc(info.width * info.height * 4);
        for (let i = 0; i < data.length; i++) {
            const idx = i * 4;
            if (data[i] > 80) {
                // Transparent
                colorRgba[idx] = 0;
                colorRgba[idx + 1] = 0;
                colorRgba[idx + 2] = 0;
                colorRgba[idx + 3] = 0;
            } else {
                // Use bold saturated color
                colorRgba[idx] = boldColor.r;
                colorRgba[idx + 1] = boldColor.g;
                colorRgba[idx + 2] = boldColor.b;
                colorRgba[idx + 3] = 255;
            }
        }

        // Step 4: Create sharp images from buffers
        const origSharp = sharp(origRgba, {
            raw: { width: info.width, height: info.height, channels: 4 }
        }).resize(280, 280, { kernel: 'lanczos3' });

        let colorSharp = sharp(colorRgba, {
            raw: { width: info.width, height: info.height, channels: 4 }
        }).resize(280, 280, { kernel: 'lanczos3' });

        // Step 5: Apply Gaussian blur with explicit sigma
        // Create Gaussian kernel
        const kernelSize = Math.ceil(blurSigma * 3) * 2 + 1;
        const kernel = [];
        const center = Math.floor(kernelSize / 2);
        let sum = 0;

        for (let y = 0; y < kernelSize; y++) {
            for (let x = 0; x < kernelSize; x++) {
                const dx = x - center;
                const dy = y - center;
                // Gaussian value
                const value = Math.exp(-(dx * dx + dy * dy) / (2 * blurSigma * blurSigma));
                kernel.push(value);
                sum += value;
            }
        }

        // Normalize kernel first
        const normalizedKernel = kernel.map(v => v / sum);
        // Then apply blurStrength as a power function
        //const poweredKernel = normalizedKernel.map(v => Math.pow(v, 1 / blurStrength));
        const poweredKernel = normalizedKernel.map(v => (v>0)?1:0);

        let blurredBuffer = await colorSharp.png().toBuffer();
        blurredBuffer = await sharp(blurredBuffer)
            .convolve({
                width: kernelSize,
                height: kernelSize,
                kernel: poweredKernel
            })
            .png()
            .toBuffer();

        // Step 6: Composite original over blurred colorized
        await sharp(blurredBuffer)
            .composite([{ input: await origSharp.png().toBuffer(), blend: 'over' }])
            .png()
            .toFile(outputPath);

        console.log(`Processed: ${filename}`);
    } catch (error) {
        console.error(`Error processing ${filename}:`, error.message);
    }
}

// Process all images
Promise.all(files.map(processImage))
    .then(() => console.log('All images processed'))
    .catch(err => console.error('Error:', err));
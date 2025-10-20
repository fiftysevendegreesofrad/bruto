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

async function processImage(filename) {
    const inputPath = path.join(inputDir, filename);
    const basename = path.parse(filename).name;
    const ext = path.parse(filename).ext;

    // Glow configs
    const glows = [
        { color: { r: 0x88, g: 0xaa, b: 0xff }, name: 'blue' },
        { color: { r: 0xcc, g: 0x60, b: 0xcc }, name: 'red' }
    ];
    const blurSigma = 10;
    const blurStrength = 150;

    // Calculate padding for blur (3*sigma covers >99% of Gaussian) but there was padding already
    const pad = Math.ceil(blurSigma * 1);

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
            origRgba[idx] = data[i];
            origRgba[idx + 1] = data[i];
            origRgba[idx + 2] = data[i];
            origRgba[idx + 3] = data[i] > 80 ? 0 : 255;
        }

        // Step 3: Save no-glow version (centered in expanded canvas)
        const targetSize = 280;
        const expandedSize = targetSize + pad * 2;
        await sharp(origRgba, {
            raw: { width: info.width, height: info.height, channels: 4 }
        })
        .resize(targetSize, targetSize, { kernel: 'lanczos3' })
        .extend({
            top: pad,
            bottom: pad,
            left: pad,
            right: pad,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(path.join(outputDir, `${basename}_noglow.png`));

        // Step 4: For each glow color, produce glow version
        for (const glow of glows) {
            const boldColor = rgbToBold(glow.color.r, glow.color.g, glow.color.b);
            // Create colorized RGBA
            const colorRgba = Buffer.alloc(info.width * info.height * 4);
            for (let i = 0; i < data.length; i++) {
                const idx = i * 4;
                if (data[i] > 80) {
                    colorRgba[idx] = 0;
                    colorRgba[idx + 1] = 0;
                    colorRgba[idx + 2] = 0;
                    colorRgba[idx + 3] = 0;
                } else {
                    colorRgba[idx] = boldColor.r;
                    colorRgba[idx + 1] = boldColor.g;
                    colorRgba[idx + 2] = boldColor.b;
                    colorRgba[idx + 3] = 255;
                }
            }

            // Create sharp images from buffers
            const origSharp = sharp(origRgba, {
                raw: { width: info.width, height: info.height, channels: 4 }
            })
            .resize(targetSize, targetSize, { kernel: 'lanczos3' })
            .extend({
                top: pad,
                bottom: pad,
                left: pad,
                right: pad,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            });

            let colorSharp = sharp(colorRgba, {
                raw: { width: info.width, height: info.height, channels: 4 }
            })
            .resize(targetSize, targetSize, { kernel: 'lanczos3' })
            .extend({
                top: pad,
                bottom: pad,
                left: pad,
                right: pad,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            });

            // Gaussian kernel
            const kernelSize = Math.ceil(blurSigma * 3) * 2 + 1;
            const kernel = [];
            const center = Math.floor(kernelSize / 2);
            let sum = 0;
            for (let y = 0; y < kernelSize; y++) {
                for (let x = 0; x < kernelSize; x++) {
                    const dx = x - center;
                    const dy = y - center;
                    const value = Math.exp(-(dx * dx + dy * dy) / (2 * blurSigma * blurSigma));
                    kernel.push(value);
                    sum += value;
                }
            }
            // Normalize kernel first
            const normalizedKernel = kernel.map(v => v / sum);
            // Then apply blurStrength as a power function
            const poweredKernel = normalizedKernel.map(v => Math.pow(v, 1 / blurStrength));

            let blurredBuffer = await colorSharp.png().toBuffer();
            blurredBuffer = await sharp(blurredBuffer)
                .convolve({
                    width: kernelSize,
                    height: kernelSize,
                    kernel: poweredKernel
                })
                .png()
                .toBuffer();

            // Composite original over blurred colorized
            await sharp(blurredBuffer)
                .composite([{ input: await origSharp.png().toBuffer(), blend: 'over' }])
                .png()
                .toFile(path.join(outputDir, `${basename}_${glow.name}.png`));
        }

        console.log(`Processed: ${filename}`);
    } catch (error) {
        console.error(`Error processing ${filename}:`, error.message);
    }
}

// Process all images
Promise.all(files.map(processImage))
    .then(() => console.log('All images processed'))
    .catch(err => console.error('Error:', err));
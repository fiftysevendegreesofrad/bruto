const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = __dirname;
const outputDir = path.join(__dirname, '../../icons'); // Change this path as needed

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Get all PNG files in the current directory
const files = fs.readdirSync(inputDir).filter(file => file.toLowerCase().endsWith('.png'));

async function processImage(filename) {
    const inputPath = path.join(inputDir, filename);
    const outputPath = path.join(outputDir, filename);

    try {
        await sharp(inputPath)
            .threshold(80) // Pixels lighter than 80/255 become white
            .toColourspace('b-w') // Convert to black and white
            .raw()
            .toBuffer({ resolveWithObject: true })
            .then(({ data, info }) => {
                // Create an RGBA buffer with transparency
                const rgba = Buffer.alloc(info.width * info.height * 4);
                for (let i = 0; i < data.length; i++) {
                    const idx = i * 4;
                    rgba[idx] = data[i]; // R
                    rgba[idx + 1] = data[i]; // G
                    rgba[idx + 2] = data[i]; // B
                    rgba[idx + 3] = data[i] > 80 ? 0 : 255; // A (transparent if > 80)
                }
                
                return sharp(rgba, {
                    raw: {
                        width: info.width,
                        height: info.height,
                        channels: 4
                    }
                })
                .resize(280, 280, { kernel: 'lanczos3' })
                .png()
                .toFile(outputPath);
            });

        console.log(`Processed: ${filename}`);
    } catch (error) {
        console.error(`Error processing ${filename}:`, error.message);
    }
}

// Process all images
Promise.all(files.map(processImage))
    .then(() => console.log('All images processed'))
    .catch(err => console.error('Error:', err));
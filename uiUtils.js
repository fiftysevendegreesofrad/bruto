import { DEVMODE } from './sharedState.js';
import { CHARACTERNAME } from './gamedata.js';
import { updateLogLik, computeBelievabilityFromLogLik } from './BeliefGraphUtils.js';
import { getAssetUrl } from './utils/assets.js';

// Preload completion image here
let completionImage = new Image();
completionImage.src = getAssetUrl("img/completion_image.webp");

const NUMCLOWNIMAGES = 7;
let clownImages = [];
for (let i = 1; i <= NUMCLOWNIMAGES; i++) {
    let img = new Image();
    img.src = getAssetUrl(`img/clown${i}.jpg`);
    clownImages.push(img);
}

export function getClownImage(clownImageIndex=NUMCLOWNIMAGES-1, madness=1) {
    let img = clownImages[clownImageIndex];
    let madpercent = Math.floor(madness * 100);
    img.alt = `Picture of ${CHARACTERNAME} looking ${madpercent}% mad`;
    img.className = "clown-image";
    return img;
}

export function updateClownImage(cy) {
    let totalWackValue = cy.nodes().map(x => (x.data().predicateValue==1 && x.data().wacky)?1:0).reduce((a, b) => a + b);
    let numWackyNodes = cy.nodes().filter(x => x.data().wacky).size();
    let madness = totalWackValue / numWackyNodes;

    let clownImageIndex = Math.floor(madness * (NUMCLOWNIMAGES - 1));
    if (madness>0 && clownImageIndex<1) clownImageIndex = 1;

    let img = getClownImage(clownImageIndex, madness);
    document.getElementById("clown-image-container").innerHTML = "";
    document.getElementById("clown-image-container").appendChild(img);
}

function updateProgressBar(percentage) {
    let progressBar = document.getElementById("progress-bar");
    progressBar.style.width = percentage + "%";
}

export function updateBelievabilityDisplay(cy, permittedMinLogProb) {
    let logLik = updateLogLik(cy);
    let believability = computeBelievabilityFromLogLik(logLik, permittedMinLogProb);
    let bullshit = 100 - believability;
    let bullshitText = bullshit.toFixed(0) + "%";
    if (bullshit > 100)
        bullshitText = "OVERLOAD (" + bullshitText + ")";
    document.getElementById("moving-text").textContent = bullshitText;
    updateProgressBar(Math.max(Math.min(bullshit, 100),10)); // min 10% to fit text in bar
    if (DEVMODE)
        document.getElementById("moving-text").textContent += " " + logLik.toFixed(2);
    cy.resize();
    return bullshit;
}

export function hideModal() {
    let modal = document.getElementById("myModal");
    modal.style.display = "none";
}

export function showModal(content, canDismiss=true) {
    let modal = document.getElementById("myModal");
    let span = document.getElementById("modal-close");
    modal.style.display = "block";
    if (canDismiss) {
        span.onclick = function () {
            hideModal();
        }
        window.onclick = function (event) {
            if (event.target == modal) {
                hideModal();
            }
        }
        span.style.display = "block";
    } else {
        span.style.display = "none";
        span.onclick = function(){};
        window.onclick = function(){};
    }
    let modalMessage = document.getElementById("modal-message");
    modalMessage.innerHTML = "";
    modalMessage.appendChild(content);
}

export function updateGraphDisplay(cy, cyBaseFontSize) {
    let visibleNodes = cy.nodes(":visible");
    function updateLayout() {
        let layoutOptions = {
            name: 'avsdf',
            nodeSeparation: 120,
            animate: "end",
            animationDuration: 2000,
            animationEasing: 'ease-in-out',
            eles: visibleNodes
        };
        let layout = cy.layout(layoutOptions);
        layout.run();
        return layout;
    }
    let layout = updateLayout();
    let endFontSize = visibleNodes.length > 7 ? cyBaseFontSize*28/15 : cyBaseFontSize;
    let endIconSize = visibleNodes.length > 7 ? 70 : 40;
    layout.promiseOn('layoutstop').then(() => {
        cy.style().selector('node').style('font-size', endFontSize + 'px').style('width', endIconSize + 'px').style('height', endIconSize + 'px').update();
        updateLayout(); // run again to accommodate size changes
    });    
    
}

// Provide a function to get the preloaded completion image (as a clone)
export function getCompletionImage() {
    let img = completionImage.cloneNode(true);
    img.className = "completion-image";
    img.style.maxWidth = "80vw";
    img.style.maxHeight = "50vh";
    return img;
}

export let nodeImageDataURLs = {};

// Preload node images as data URLs
const NODE_IMAGE_SUFFIXES = ['_noglow', '_red', '_blue'];
export async function preloadNodeImages(elements) {
    let promises = [];
    elements.nodes.forEach(node => {
        const nodeId = node.data.id.toLowerCase();
        nodeImageDataURLs[nodeId] = {}; // Initialize nested object for this node
        NODE_IMAGE_SUFFIXES.forEach(suffix => {
            let img = new Image();
            img.crossOrigin = "anonymous";
            img.src = getAssetUrl(`img/${nodeId}${suffix}.png`);
            let p = new Promise(resolve => {
                img.onload = function() {
                    let canvas = document.createElement('canvas');
                    canvas.width = img.width || 40;
                    canvas.height = img.height || 40;
                    let ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    nodeImageDataURLs[nodeId][suffix] = canvas.toDataURL();
                    resolve();
                };
                img.onerror = function() {
                    nodeImageDataURLs[nodeId][suffix] = 'FAILED_PRELOAD';
                    resolve();
                };
            });
            promises.push(p);
        });
    });
    await Promise.all(promises);
}

export function setNodeSizesFromLogProb(cy) {
    const minSize=20;
    const maxSize=60;
    const minNodeLogProb=-3;
    const maxNodeLogProb=0;
    cy.nodes().forEach(node => {
        //store current node width in node.oldSize
        node.data('oldSize', node.style('width'));
        let logProb = node.data().logprob;
        //compute new size based on logProb
        let normalizedSize = (logProb - minNodeLogProb) / (maxNodeLogProb - minNodeLogProb) * (minSize - maxSize) + maxSize;
        //clamp to range
        let newSize = Math.min(maxSize, Math.max(minSize, normalizedSize));
        node.style('width', newSize);
        node.style('height', newSize);
    });
}

export function restoreNodeSizes(cy) {
    cy.nodes().forEach(node => {
        node.style('width', node.data('oldSize'));
        node.style('height', node.data('oldSize'));
    });
}
import { DEVMODE } from './sharedState.js';
import { CHARACTERNAME } from './gamedata.js';
import { updateLogLik, computeBelievabilityFromLogLik } from './BeliefGraphUtils.js';
import { getAssetUrl } from './utils/assets.js';

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
    let bullshitText = bullshit.toFixed(1) + "%";
    if (bullshit > 100)
        bullshitText = "OVERLOAD (" + bullshitText + ")";
    document.getElementById("moving-text").textContent = bullshitText;
    updateProgressBar(Math.min(bullshit, 100));
    if (DEVMODE)
        document.getElementById("moving-text").textContent += " " + logLik.toFixed(2);
    cy.resize();
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
    let endFontSize = visibleNodes.length > 6 ? cyBaseFontSize*28/15 : cyBaseFontSize;
    let endIconSize = visibleNodes.length > 9 ? 70 : 40;
    layout.promiseOn('layoutstop').then(() => {
        cy.style().selector('node').style('font-size', endFontSize + 'px').style('width', endIconSize + 'px').style('height', endIconSize + 'px').update();
    });
}

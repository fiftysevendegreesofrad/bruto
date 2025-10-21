import 'bootstrap/dist/css/bootstrap.min.css';

import cytoscape from 'cytoscape';
import avsdf from 'cytoscape-avsdf';
cytoscape.use(avsdf);

import { load_elements, permittedMinLogProbs, CHARACTERNAME } from './gamedata.js';
import './BeliefGraphUtils.js';
import { displayNodeDetails, hideNodeDisplay } from './BeliefPanel.js';
import { setCy, DEVMODE, setCyBaseFontSize, cyBaseFontSize, setPERMITTEDMINLOGPROB, PERMITTEDMINLOGPROB, allowClickNodes } from './sharedState.js';
import { updateClownImage, updateBelievabilityDisplay, updateGraphDisplay, nodeImageDataURLs, preloadNodeImages, showModal, hideModal } from './uiUtils.js';
import { updateLogLik } from './BeliefGraphUtils.js';
import { getAssetUrl } from './utils/assets.js';

setPERMITTEDMINLOGPROB(permittedMinLogProbs["easy"]);
let nodeDisplay = DEVMODE ? "element" : "none";

//logging
const DB_URL = 'https://beliefnet-24eef-default-rtdb.europe-west1.firebasedatabase.app/logs.json';
const CLIENT_ID_KEY = 'clientRandomId';
function getClientId() {
    try {
        let id = localStorage.getItem(CLIENT_ID_KEY);
        if (!id) {
            id = Math.random().toString(36).slice(2);
            localStorage.setItem(CLIENT_ID_KEY, id);
        }
        return id;
    } catch(e) { return "unknown"; }
}
const clientId = getClientId();
function log(message) {
    const payload = {
        clientId,
        msg: message,
        ts: { ".sv": "timestamp" }
    };
    fetch(DB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

export { log, getDifficulty };

function showMainMenu() {
    let menu = document.getElementById("main-menu");
    menu.style.display = "block";
    document.body.style.visibility = "visible";
}

let audio = DEVMODE?null:new Audio(getAssetUrl("bruto.m4a"));
if (audio)
{
    audio.volume = 0.2;
    audio.loop = true;
}
function startOrResumeMusic() {
    if (!DEVMODE) audio.play();
}
function stopMusic() {
    if (!DEVMODE) audio.pause();
}

function getDifficulty() {
    return document.querySelector('input[name="difficulty"]:checked').value;
}
function setPermittedMinLogProb() {
    setPERMITTEDMINLOGPROB(permittedMinLogProbs[getDifficulty()]);
}
function hideMainMenu() {
    let menu = document.getElementById("main-menu");
    menu.style.display = "none";
    document.getElementById("start-button-text").textContent = "Resume";
    setPermittedMinLogProb();
    updateBelievabilityDisplay(window.cy, PERMITTEDMINLOGPROB);
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    let soundOn = document.querySelector('input[name="sound"]:checked').value == "on";
    if (soundOn) startOrResumeMusic();
}
function stringListToTableRow(list) {
    let row = document.createElement("tr");

    for (let i = 0; i < list.length; i++) {
        let cell = document.createElement("td");
        cell.innerHTML = list[i];
        row.appendChild(cell);
    }
    return row;
}

//make cy square
window.addEventListener('resize', function() {
    var cy = document.getElementById('cy');
    //console.log(cy.offsetWidth);
    let maxCyHeight = window.innerHeight - 100;
    let cySize = Math.min(cy.offsetWidth, maxCyHeight);
    cy.style.height = cySize + 'px';
    cy.style.width = cySize + 'px';
});

document.addEventListener('DOMContentLoaded', async function () {
    log("ARR "+window.location.href);
    window.dispatchEvent(new Event('resize')); //trigger first time resize to make cy square

    document.querySelectorAll('.CharacterName').forEach(function (element) {
        element.textContent = CHARACTERNAME;
    });

    let elements = await load_elements();
    let maxweight = elements.edges.map(x => x.data.absweight).reduce((a, b) => Math.max(a, b));

    await preloadNodeImages(elements);
    
    let mediaQuery = window.matchMedia("(max-width: 600px)");
    function setCyFontSizeFromMedia(m) {
        setCyBaseFontSize(m.matches ? 15*.6 : 12*.6);
    }
    setCyFontSizeFromMedia(mediaQuery);

    // Only initialize Cytoscape after all images are loaded
    var cy = window.cy = cytoscape({
        container: document.getElementById('cy'),

        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(displaylabel)',
                    'text-wrap': 'wrap',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': -2, 
                    'font-family': 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                    'color': '#000000',
                    'width': 40,
                    'height': 40,
                    'background-opacity': 0, // make the circle invisible but keep geometry for arrows
                    'background-image': ele => {
                        const val = ele.data('predicateValue');
                        let suffix = '_noglow';
                        if (val === 1) suffix = '_red';
                        else if (val === 0) suffix = '_blue';
                        const nodeId = ele.id().toLowerCase();
                        return (nodeImageDataURLs[nodeId] && nodeImageDataURLs[nodeId][suffix])
                            ? nodeImageDataURLs[nodeId][suffix]
                            : 'FAILED_RETRIEVE';
                    },
                    'background-fit': 'contain',
                    'background-clip': 'none',
                    'display': nodeDisplay,
                    'font-size': cyBaseFontSize+"px",
                    'border-width': '0px'
                }
            },
            {
                selector: 'node[target=1]',
                style: {
                    'border-width': '0px',
                    'outline-width': '5px',
                    'outline-color': '#aaaaaa',
                    'outline-style': 'dotted',
                    'outline-opacity': 0.8,
                    'outline-offset': '3px'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 'mapData(absweight, 0, ' + maxweight + ', 0, 7)',
                    'line-color': 'mapData(colorType, -1, 1, #d52b00, #009E73)',
                    'opacity': 0.5,
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': 'mapData(colorType, -1, 1, #d52b00, #009E73)',
                    'curve-style': 'unbundled-bezier',
                    'control-point-distances': '10px',
                    'control-point-weights': '0.5',
                    'label': DEVMODE?'data(weight)':''
                }
            },
            {
                selector: 'edge[colorType=0]',
                style: {
                    'line-color': 'grey',
                    'target-arrow-color': 'grey',
                    'line-style': 'dotted'
                }
            }
        ],

        elements: elements,
        autounselectify: true,
        autoungrabify: true,
        userZoomingEnabled: false,
        userPanningEnabled: false
    });
    setCy(cy);
    let firstNode = cy.nodes().first();
    firstNode.style("display", "element");
    updateGraphDisplay(cy, cyBaseFontSize);
    updateLogLik(cy);
    updateBelievabilityDisplay(cy, PERMITTEDMINLOGPROB);
    showMainMenu();
    

    cy.bind('tap', 'node', function (evt) {
        let node = evt.target;
        if (allowClickNodes)
            displayNodeDetails(node);
    });
    log("LOADED");
});

window.restartGameOnHardMode = function() {
    document.querySelector('input[name="difficulty"][value="hard"]').checked = true;
    setPERMITTEDMINLOGPROB(permittedMinLogProbs[getDifficulty()]);
    window.cy.nodes().forEach(function (node) {
        node.data().predicateValue = 0;
    });
    updateBelievabilityDisplay(window.cy, PERMITTEDMINLOGPROB);
    hideModal();
    hideNodeDisplay(()=>{});
}

function verifyRestart()
{
    //if game hasn't started just allow selection without further ado
    let allZero = window.cy.nodes().every(function (node) {
        return node.data().predicateValue == 0;
    });
    if (allZero) return;
    
    //otherwise ask for confirmation
    let modalContent = document.createElement("div");
    modalContent.innerHTML = "<p>Are you sure you want to restart? All beliefs will be reset.</p>";
    let yesButton = document.createElement("button");
    yesButton.className = "btn btn-primary";
    yesButton.textContent = "Yes";
    yesButton.onclick = window.restartGameOnHardMode;
    
    let noButton = document.createElement("button");
    noButton.className = "btn btn-primary";
    noButton.textContent = "No";
    noButton.onclick = function() {
        //undo selection
        document.querySelector('input[name="difficulty"][value="easy"]').checked = true;
        hideModal();
    }
    modalContent.appendChild(yesButton);
    modalContent.appendChild(noButton);
    showModal(modalContent);
}

function about()
{
    log("about");
    window.open('about.html', '_blank');
}

// Make functions available globally for HTML onclick handlers
window.showMainMenu = showMainMenu;
window.hideMainMenu = hideMainMenu;
window.startOrResumeMusic = startOrResumeMusic;
window.stopMusic = stopMusic;
window.verifyRestart = verifyRestart;
window.about = about;

window.showBullshitHelpModal = function() {
    let d = document.createElement("div");
    d.innerHTML = "<h2>What is the Bullshitometer?</h2><p>The Bullshitometer represents the degree to which ALL of Bruto's current beliefs conflict (including any you haven't discovered yet). You could see it as a measure of cognitive dissonance, distrust, or confusion; either way there's only so much of it he can tolerate. If you're stuck on getting him to believe something, even if all the related beliefs support it, that may be because he thought that belief was quite unlikely to start with. You'll have to have to reduce the bullshit elsewhere for him to lower his guard.</p>";
    showModal(d);
}
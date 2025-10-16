import { load_elements, permittedMinLogProbs, CHARACTERNAME } from './gamedata.js';
import './BeliefGraphUtils.js';
import { displayNodeDetails, hideNodeDisplay } from './BeliefPanel.js';
import { setCy, DEVMODE, setCyBaseFontSize, cyBaseFontSize, setPERMITTEDMINLOGPROB, PERMITTEDMINLOGPROB, allowClickNodes } from './sharedState.js';
import { updateBelievabilityDisplay, updateGraphDisplay, showModal, hideModal } from './uiUtils.js';
import { updateLogLik } from './BeliefGraphUtils.js';

setPERMITTEDMINLOGPROB(permittedMinLogProbs["easy"]);
let nodeDisplay = DEVMODE ? "element" : "none";

//preload completion image
let completionImage = new Image();
completionImage.src = "img/completion_image.webp";

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
}

let audio = DEVMODE?null:new Audio("bruto.m4a");
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

    let mediaQuery = window.matchMedia("(max-width: 600px)");
    
    function setCyFontSizeFromMedia(m) {
        setCyBaseFontSize(m.matches ? 15 : 12);
    }
    setCyFontSizeFromMedia(mediaQuery);
    
    var cy = window.cy = cytoscape({
        container: document.getElementById('cy'),

        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(displaylabel)',
                    'text-wrap': 'wrap',
                    'text-valign': 'center',
                    'color': '#000000',
                    'width': 'mapData(logprob,-3,0,60,20)',
                    'height': 'mapData(logprob,-3,0,60,20)',
                    'pie-1-background-color': 'mapData(predicateValue, 0, 1, #0011ff, #cc00cc)',
                    'pie-1-background-size': 'mapData(baseProb,0,1,0,100)',
                    'pie-2-background-color': 'mapData(predicateValue, 0, 1, #aaaaff, #ffaaff)',
                    'pie-2-background-size': 'mapData(baseProb,0,1,100,0)',
                    'display': nodeDisplay,
                    'font-size': cyBaseFontSize+"px"
                }
            },
            {
                selector: 'node[predicateValue=0.5]',
                style: {
                    'pie-1-background-color': '#444444',
                    'pie-2-background-color': '#aaaaaa',
                }
            },
            {
                selector: 'node[researched=0]',
                style: {
                    'border-width': '10px',
                    'border-color': '#aaaaaa',
                    'border-style': 'dotted'
                }
            },
            {
                selector: 'node[researched=1]',
                style: {
                    'border-width': '0px',
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 'mapData(absweight, 0, ' + maxweight + ', 0, 7)',
                    'line-color': 'data(color)',
                    'opacity': 0.5,
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': 'data(color)',
                    //'source-arrow-shape': 'triangle',
                    //'source-arrow-color': 'data(color)',
                    'curve-style': 'unbundled-bezier',
                    'control-point-distances': '10px',
                    'control-point-weights': '0.5',
                    'label': DEVMODE?'data(weight)':''
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


let DEVMODE;
let ALLOWIMPOSSIBLEMOVES;
let PERMITTEDMINLOGPROB = permittedMinLogProbs["Easy"];
if (window.location.protocol === 'file:') {
    // TEST SETTINGS, CAN CHANGE
    DEVMODE = true;
    ALLOWIMPOSSIBLEMOVES = false;
} else {
    DEVMODE = false; //DEPLOYMENT SETTING, DO NOT CHANGE
    ALLOWIMPOSSIBLEMOVES = false; //DO NOT CHANGE
}
let nodeDisplay = DEVMODE ? "element" : "none";

let allowClickNodes = true;
let cyBaseFontSize;

//get clown images clown1.jpg through to clown7.jpg in an array
const NUMCLOWNIMAGES = 7;
let clownImages = [];
for (let i = 1; i <= NUMCLOWNIMAGES; i++) {
    let img = new Image();
    img.src = "img/clown" + i + ".jpg";
    clownImages.push(img);
}
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

function getClownImage(clownImageIndex=NUMCLOWNIMAGES-1, madness=1) {
    let img = clownImages[clownImageIndex];
    let madpercent = Math.floor(madness * 100);
    img.alt = `Picture of ${CHARACTERNAME} looking ${madpercent}% mad`;
    img.className = "clown-image";
    return img;
}
function updateClownImage(cy) {
    let totalWackValue = cy.nodes().map(x => (x.data().predicateValue==1 && x.data().wacky)?1:0).reduce((a, b) => a + b);
    let numWackyNodes = cy.nodes().filter(x => x.data().wacky).size();
    let madness = totalWackValue / numWackyNodes;

    //clown image index is 0 if and only if madness is 0, but otherwise scales linearly with madness
    //clown image index is NUMCLOWNIMAGES-1 if and only if madness is 1
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
function updateBelievabilityDisplay(cy) {
    let logLik = updateLogLik(cy);
    let believability = computeBelievabilityFromLogLik(logLik);
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
function hideNodeDisplay(callback) {
    let nodeDisplay = document.getElementById("node-display");
    nodeDisplay.addEventListener('transitionend', function() {
        callback();
    }, { once: true });
    nodeDisplay.classList.remove("on-screen");
}
function hideModal() {
    let modal = document.getElementById("myModal");
    modal.style.display = "none";
}
function showModal(content,canDismiss=true) {
    let modal = document.getElementById("myModal");
    let span = document.getElementById("modal-close");
    modal.style.display = "block";
    if (canDismiss)
    {
        span.onclick = function () {
            hideModal();
        }
        window.onclick = function (event) {
            if (event.target == modal) {
                hideModal();
            }
        }
        span.style.display = "block";
    }
    else
    {
        span.style.display = "none";
        span.onclick = function(){};
        window.onclick = function(){};
    }
    let modalMessage = document.getElementById("modal-message");
    modalMessage.innerHTML = "";
    modalMessage.appendChild(content);
}
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
function getDifficulty()
{
    return document.querySelector('input[name="difficulty"]:checked').value;
}
function setPermittedMinLogProb()
{
    PERMITTEDMINLOGPROB = permittedMinLogProbs[getDifficulty()];
}
function hideMainMenu() {
    let menu = document.getElementById("main-menu");
    menu.style.display = "none";
    document.getElementById("start-button-text").textContent = "Resume";
    setPermittedMinLogProb();
    updateBelievabilityDisplay(window.cy);
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    //if music is not playing and sound is on, start playing music
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

function updateGraphDisplay(cy) {
    let visibleNodes = cy.nodes(":visible");
    let layoutOptions = {
        name: 'avsdf',
        nodeSeparation: 120,
        animate: "end",
        animationDuration: 2000,
        animationEasing: 'ease-in-out',
        nodeSeparation: 120,
        eles: visibleNodes
    };
    let layout = cy.layout(layoutOptions);
    layout.run();
    let endFontSize = visibleNodes.length > 3 ? cyBaseFontSize*19/15 : cyBaseFontSize;
    layout.promiseOn('layoutstop').then(() => {
        cy.style().selector('node').style('font-size', endFontSize + 'px').update();
    });
}
function preventCloseWindow()
{
    window.onbeforeunload = function(event) {
            event.preventDefault(); //prevent closing the window
            event.returnValue = ''; //some browsers require this to show a confirmation dialog
            return ''; //returning a string shows a confirmation dialog in some browsers
    };
}
function allowCloseWindow()
{
    window.onbeforeunload = null; //allow closing the window
}
document.addEventListener('DOMContentLoaded', async function () {
    log("ARR "+window.location.href);
    window.dispatchEvent(new Event('resize')); //trigger first time resize to make cy square

    document.querySelectorAll('.CharacterName').forEach(function (element) {
        element.textContent = CHARACTERNAME;
    });

    let elements = await load_elements();
    let maxweight = elements.edges.map(x => x.data.absweight).reduce((a, b) => Math.max(a, b));

    let mediaQuery = window.matchMedia("(max-width: 600px)");
    
    function setCyFontSizeFromMedia(m)
    {
        cyBaseFontSize = m.matches ? 15 : 12;
    }
    setCyFontSizeFromMedia(mediaQuery); //set once at start
    
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
    let firstNode = cy.nodes().first();
    firstNode.style("display", "element");
    updateGraphDisplay(cy);
    updateLogLik(cy); //call to initialize node logprobs
    updateBelievabilityDisplay(cy);
    showMainMenu();

    cy.bind('tap', 'node', function (evt) {
        let node = evt.target;
        if (allowClickNodes)
            displayNodeDetails(node);
    });
    log("LOADED");
});

window.restartGameOnHardMode = function()
{
    document.querySelector('input[name="difficulty"][value="hard"]').checked = true;
    PERMITTEDMINLOGPROB = permittedMinLogProbs[getDifficulty()];
    window.cy.nodes().forEach(function (node) {
            node.data().predicateValue = 0;
    });
    updateBelievabilityDisplay(window.cy);
    hideModal();
    hideNodeDisplay(()=>{}); //must do to ensure influence buttons are regenerated
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

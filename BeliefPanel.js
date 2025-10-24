import { cy, DEVMODE, allowClickNodes, setAllowClickNodes, cyBaseFontSize, PERMITTEDMINLOGPROB, ALLOWIMPOSSIBLEMOVES, triedInfluence, setTriedInfluence } from './sharedState.js';
import { predicateToIndex, getPredicateFromIndex, getSupportingEdgesCoeffs, getSupportedEdgesCoeffs, updateLogLik, computeBelievabilityFromLogLik, altNetworkLogLik, getNarrative, predicateToOption } from './BeliefGraphUtils.js';
import { updateClownImage, updateBelievabilityDisplay, updateGraphDisplay, showModal, hideModal, getClownImage, getCompletionImage, nodeImageDataURLs, setNodeSizesFromLogProb, restoreNodeSizes } from './uiUtils.js';
import { CHARACTERNAME } from './gamedata.js';
import { log, getDifficulty } from './main.js';
import { getAssetUrl } from './utils/assets.js';

export function preventCloseWindow() {
    window.onbeforeunload = function(event) {
        event.preventDefault();
        event.returnValue = '';
        return '';
    };
}

export function allowCloseWindow() {
    window.onbeforeunload = null;
}

export function hideNodeDisplay(callback) {
    let nodeDisplay = document.getElementById("node-display");
    nodeDisplay.addEventListener('transitionend', function() {
        callback();
    }, { once: true });
    nodeDisplay.classList.remove("on-screen");
}

function hideNodeDetailsUpdateGraphDisplay(cy, cyBaseFontSize) {
    hideNodeDisplay(()=>updateGraphDisplay(cy, cyBaseFontSize));
}
function predicateToTextColour(predicateValue) {
    return predicateValue == 0.5 ? "#111111" : (predicateValue > 0.5 ? "purple" : "blue");
}
function showHideAtStartClass() {
    let elements = document.getElementsByClassName("hide-at-start");
    for (let e of elements)
        e.style.display = "block";
}
function displayNodeDetails(node)
{
    updateNodeDetails(node);
    preventCloseWindow();
    let nodeDisplay = document.getElementById("node-display");
    nodeDisplay.style.display = "block";
    nodeDisplay.classList.add("on-screen");
    setTimeout(showHideAtStartClass, 1000);
}

export { displayNodeDetails };

function showBullshitometer() {
    document.getElementById("progress-bar-container").classList.remove("hidden");
}
function updateNodeDetails(node) {
    updateClownImage(cy);
    
    let closeButton = document.getElementById("node-close");
    closeButton.onclick = function () {
        hideNodeDetailsUpdateGraphDisplay(cy, cyBaseFontSize);
    }

    document.getElementById("topic").innerHTML = node.data("displayLabelSingleLine");
    let options = node.data().options;
    let whichSelected = predicateToIndex(node);
    let predicateValue = node.data("predicateValue");
    let color = predicateToTextColour(predicateValue);
    document.getElementById("currentBelief").innerHTML = "<font color=" + color + ' ><b>'+CHARACTERNAME+" currently believes: " + options[whichSelected] + "</b></font>";

    //create research button
    if (node.data("researched")==0) {
        document.getElementById("ResearchButton").innerHTML = "";
        let button = document.createElement("button");
        button.innerHTML = "Research Influencing Beliefs";
        button.addEventListener("click", function (evt1) {
            log("RES "+node.id());
            node.data("researched", 1);
            //iterate through neighbouring nodes
            for (let e of node.incomers())
                e.source().style("display", "element");
            //no longer showing beliefs infleunced by this one, as it's more fun to discover them
            //for (let e of node.outgoers())
            //    e.target().style("display", "element");
            hideNodeDetailsUpdateGraphDisplay(cy, cyBaseFontSize);
        });
        document.getElementById("ResearchButton").appendChild(button);
    }
    else {
        displayRelatedBeliefs(node);
    }
    //create buttons for other options
    document.getElementById("nodeDetails").innerHTML = "";
    //let prevNodeValues = cy.elements().map(x => x.json()); //for undo not yet implemented
    let table = document.createElement("table");
    for (let i = 0; i < options.length; i++) {
        let optionSpan = document.createElement("span");
        const isTargetOption = (node.data().target==1 && i==0);
        let htmlOption = "";
        let color = predicateToTextColour(getPredicateFromIndex(node.data(), i));
        
        // Add node image based on the predicate value for this option
        const nodeId = node.id().toLowerCase();
        const optionPredValue = getPredicateFromIndex(node.data(), i);
        let imageSuffix;
        if (optionPredValue === 1) {
            imageSuffix = '_red';
        } else if (optionPredValue === 0) {
            imageSuffix = '_blue';
        } else {
            imageSuffix = '_noglow';
        }
        
        let optImage = "";
        if (nodeImageDataURLs[nodeId] && nodeImageDataURLs[nodeId][imageSuffix]) {
            optImage = `<img src="${nodeImageDataURLs[nodeId][imageSuffix]}" style="width:36px; height:36px; vertical-align:middle; margin-right:6px;" alt="" />`;
        }
        let tdImage = document.createElement("td");
        tdImage.innerHTML = optImage;
        
        if (i==whichSelected) document.getElementById("topic-image").innerHTML = `<img src="${nodeImageDataURLs[nodeId][imageSuffix]}" style="width:80px; height:80px; " alt="" />`;

        if (isTargetOption)
            htmlOption+=`<div class=targetbox><span class=darkbg><font class=target color=ffff00><b>GAME TARGET<br>&darr; Your aim is to convince ${CHARACTERNAME} of this &darr;</b></font></span><div class=targettextcontainer><font class=target>`;
        htmlOption +=  "<font color="+color+">"+options[i]+"</font>";
        if (isTargetOption)
            htmlOption+=`</font></div></div>
        `;
        optionSpan.innerHTML = htmlOption;

        //create successful influence button (may or may not be used)
        let possibleButton = document.createElement("button");
        possibleButton.innerHTML = "Influence";
        possibleButton.addEventListener("click", function (evt1) {
                    log("INFYES "+node.id()+"="+buttonPredValue+" "+getDifficulty());
                    window.triggerLongGlitch();
                    showBullshitometer();
                    node.data("predicateValue", buttonPredValue);
                    updateBelievabilityDisplay(cy, PERMITTEDMINLOGPROB);
                    hideNodeDetailsUpdateGraphDisplay(cy, cyBaseFontSize);
                    if (isTargetOption)
                    {
                        allowCloseWindow();
                        let div = document.createElement("div");
                        if (getDifficulty() == "easy")
                        {
                            div.appendChild(getClownImage());
                            div.innerHTML += `<h1>Well done!</h1>
                            <h2>You convinced ${CHARACTERNAME} of the reptilian elite.</h2>
                            <p>${CHARACTERNAME} (set to easy mode) sits around doomscrolling all day, his isolation making him gullible. So although you've convinced him, this doesn't change much as he barely leaves his couch.</p>
                            <p><button onclick="window.restartGameOnHardMode()">Try again on hard mode</button></p>
                            `;
                        }
                        else
                        {
                            div.appendChild(getCompletionImage());
                            div.innerHTML += `<h1>Well done!</h1><h2>
                            <h2>You completed the game on hard mode.</h2>
                            <p>Convinced that we are governed by reptiles, ${CHARACTERNAME} goes out one day and attacks a zookeeper.</p>
                            <p>I hope you're proud of yourself.</p>`;
                        }
                        div.innerHTML += `<button type="button" class="btn-about" onclick="about()">FAQ & Credits</button>`;
                        ;
                        showModal(div, false);
                    }
                });

        let buttonPredValue = getPredicateFromIndex(node.data(), i);

        //create analyze button (may or may not be used)
        let analyzeButton = document.createElement("button");
        analyzeButton.innerHTML = "Analyze";
        analyzeButton.addEventListener("click", ()=>examineHypothetical(cy,node,buttonPredValue)); 

        //construct the table row
        let row = document.createElement("tr");
        row.classList.add("optiontable");
        let showAnalyze = triedInfluence && node.data("researched")==1;
        if (i != whichSelected) {
            
            let currentLogLik = updateLogLik(cy);
            let resultingLogLik = altNetworkLogLik(cy, { [node.id()]: buttonPredValue });
            let resultingBelievability = computeBelievabilityFromLogLik(resultingLogLik, PERMITTEDMINLOGPROB);

            let possible = resultingLogLik >= PERMITTEDMINLOGPROB;

            if (possible) {
                //add working influence button
                let td = document.createElement("td");
                td.style.textAlign = "center";
                //if (!showAnalyze)
                //    td.colSpan = 2;
                td.appendChild(possibleButton);
                row.appendChild(td);
            }
            else
            {
                if (!triedInfluence)
                {
                    //add influence button that won't work 
                    let button = document.createElement("button");
                    button.innerHTML = "Influence";
                    button.addEventListener("click", function (evt1) {
                        log("INFNO "+node.id()+"="+buttonPredValue+" "+getDifficulty());
                        showBullshitometer();

                        let div = document.createElement("div");
                        div.innerHTML = `<h2>You can't convince ${CHARACTERNAME} of this. 
                                        His bullshitometer would climb above 100%.</h2>
                                        <ul><li>Try researching ${CHARACTERNAME}'s related beliefs first</li>`;
                        setTriedInfluence();
                        showModal(div);
                    });
                    let td = document.createElement("td");
                    td.style.textAlign = "center";
                    //td.colSpan = 2;
                    td.appendChild(button);
                    row.appendChild(td);
                }
                else //player has seen how influence can fail already
                {
                    //add disabled influence button
                    let button = document.createElement("button");
                    button.innerHTML = "<i>Influence</i>";
                    button.disabled = true;
                    let td = document.createElement("td");
                    td.style.textAlign = "center";
                    //if (!showAnalyze)
                    //    td.colSpan = 2;
                    td.appendChild(button);
                    row.appendChild(td);
                }
            }
        }
        else //current option
        {
            //add current label cell
            let td1 = document.createElement("td");
            td1.style.textAlign = "center";
            td1.innerHTML="[CURRENT]";
            //if (!showAnalyze)
            //    td1.colSpan = 2;
            row.appendChild(td1);
        }
        if (showAnalyze)
        {
            let td2 = document.createElement("td");
            td2.style.textAlign = "center";
            td2.appendChild(analyzeButton);
            row.appendChild(td2);
        }

        //row.appendChild(tdImage);
        
        //add cell with the option text
        let td3 = document.createElement("td");
        td3.appendChild(optionSpan);
        row.appendChild(td3);
        table.appendChild(row);
    }
    document.getElementById("nodeDetails").appendChild(table);
}

function examineHypothetical(cy,node,hypotheticalPredValue) {
    let hypotheticalIsCurrent = (node.data().predicateValue == hypotheticalPredValue);

    let normalGraphInfo = document.getElementById("normal-graph-info");
    normalGraphInfo.style.display = "none";
    let hypotheticalInfo = document.getElementById("hypothetical-info");
    hypotheticalInfo.innerHTML = "";

    let nodeName = node.data("displaylabel");
    let option = predicateToOption(node, hypotheticalPredValue);
    let nodeText = nodeName + ": " + option;

    hideModal();
    hideNodeDetailsUpdateGraphDisplay(cy);
    
    setAllowClickNodes(false);
    let prevPredValue = node.data("predicateValue");
    node.data("predicateValue", hypotheticalPredValue);
    let bullshit=updateBelievabilityDisplay(cy, PERMITTEDMINLOGPROB);
    setNodeSizesFromLogProb(cy);
    
    const gradient = "repeating-linear-gradient(45deg, #ffffff, #ffffff 10px, #fff0f0 10px, #fff0f0 20px)";
    let bodydiv = document.getElementById("body-div");
    bodydiv.style.background = gradient;
    let restoreBackground = ()=>{bodydiv.style.background = "";};
    
    let p = document.createElement("p");
    if (bullshit>100)
        p.innerHTML = `<b>Unachievable belief combination (bullshit > 100%) for <i>${nodeText}.</i></b>`;
    else
        p.innerHTML = `<b>Analysis with <br><i>${nodeText}.</i></b>`;
    p.innerHTML += " Nodes shown larger are triggering the bullshitometer more."
    let notVisible = cy.nodes().filter(node => node.style('display') === 'none');
    if (notVisible.length > 0) 
        p.innerHTML += ` <i>Unresearched beliefs may also be triggering the bullshitometer.</i>`;

    let button = document.createElement("button");
    button.innerHTML = "Close Analysis";
    button.classList.add("align-right");
    p.appendChild(button);

    hypotheticalInfo.appendChild(p);

    function closeHypotheticalDisplay() {
        restoreBackground();
        node.data("predicateValue", prevPredValue);
        restoreNodeSizes(cy);
        updateBelievabilityDisplay(cy, PERMITTEDMINLOGPROB);
        updateGraphDisplay(cy, cyBaseFontSize);
        hypotheticalInfo.innerHTML = "";
        setAllowClickNodes(true);
        normalGraphInfo.style.display = "block";
    }

    setTimeout(()=>
        document.addEventListener("click",closeHypotheticalDisplay,{once:true}, true) 
        //useCapture=true to catch click before it reaches cy, but that still doesn't work on mobile so we make a button too
    ,100);
    button.addEventListener("click",closeHypotheticalDisplay);
}

function displayRelatedBeliefs(node) {
    let researchButton = document.getElementById("ResearchButton");

    researchButton.innerHTML = "";
    
    let closeButton = document.createElement("button");
    closeButton.innerHTML = "View Mind Map";
    closeButton.addEventListener("click", ()=>hideNodeDetailsUpdateGraphDisplay(cy, cyBaseFontSize));
    closeButton.className = "align-right";
    researchButton.appendChild(closeButton);

    let researchHeader = document.createElement("h3");
    researchHeader.innerHTML = CHARACTERNAME + "'s other beliefs...";
    researchButton.appendChild(researchHeader);

    let predicateValue = node.data("predicateValue");

    let supportingBeliefs = [];
    let opposingBeliefs = [];
    let neutralBeliefs = [];
    for (let [e, nodeSupport] of getSupportingEdgesCoeffs(node)) {
        let n = e.source();
        let otherBelief = n.data().displaylabel + ": " + n.data().options[predicateToIndex(n)];
        const otherPredicate = n.data().predicateValue;

        let narrative = getNarrative(e, otherPredicate, predicateValue);
        if (narrative != "")
            narrative = " <i>" + narrative + "</i>";

        if (nodeSupport > 0)
            supportingBeliefs.push([nodeSupport, otherBelief, narrative]);
        else if (nodeSupport < 0)
            opposingBeliefs.push([nodeSupport, otherBelief, narrative]);
        else
            neutralBeliefs.push([nodeSupport, otherBelief, narrative]);
    }
    
    let researchHTML = "";
    if (supportingBeliefs.length > 0) {
        researchHTML += "<h3>...currently supporting this one:</h3><ul>";
        for (let [mutualSupport, otherBelief, narrative] of supportingBeliefs) {
            researchHTML += '<li><font color="#009E73">+' + mutualSupport + ": " + otherBelief + ".</font>" + narrative + "</li>";
        }
        researchHTML += "</ul>";
    }
    if (opposingBeliefs.length > 0) {
        researchHTML += "<h3>...currently opposing this one:</h3><ul>";
        for (let [mutualSupport, otherBelief, narrative] of opposingBeliefs) {
            researchHTML += '<li><font color="#d52b00">' + mutualSupport + ": " + otherBelief + ".</font>" + narrative + "</li>";
        }
        researchHTML += "</ul>";
    }
    if (neutralBeliefs.length > 0) {
        researchHTML += "<h3>...that could affect this one, but currently don't:</h3><ul>";
        for (let [mutualSupport, otherBelief, narrative] of neutralBeliefs) {
            researchHTML += `<li>${otherBelief}. ${narrative}</li>`;
        }
        researchHTML += "</ul>";
    }

    supportingBeliefs = [];
    opposingBeliefs = [];
    neutralBeliefs = [];

    for (let [e, nodeSupport] of getSupportedEdgesCoeffs(node)) {
        if (e.target().data("researched")==0) continue;
        let n = e.target();
        let otherBelief = n.data().displaylabel + ": " + n.data().options[predicateToIndex(n)];
        const otherPredicate = n.data().predicateValue;

        let narrative = ""; //narratives are only written on target node

        if (nodeSupport > 0)
            supportingBeliefs.push([nodeSupport, otherBelief, narrative]);
        else if (nodeSupport < 0)
            opposingBeliefs.push([nodeSupport, otherBelief, narrative]);
        else
            neutralBeliefs.push([nodeSupport, otherBelief, narrative]);
    }
    
    if (supportingBeliefs.length > 0) {
        researchHTML += "<h3>...currently supported by this one:</h3><ul>";
        for (let [mutualSupport, otherBelief, narrative] of supportingBeliefs) {
            researchHTML += '<li><font color="#009E73">+' + mutualSupport + ": " + otherBelief + ".</font>" + narrative + "</li>";
        }
        researchHTML += "</ul>";
    }
    if (opposingBeliefs.length > 0) {
        researchHTML += "<h3>...currently opposed by this one:</h3><ul>";
        for (let [mutualSupport, otherBelief, narrative] of opposingBeliefs) {
            researchHTML += '<li><font color="#d52b00">' + mutualSupport + ": " + otherBelief + ".</font>" + narrative + "</li>";
        }
        researchHTML += "</ul>";
    }
    if (neutralBeliefs.length > 0) {
        researchHTML += "<h3>...that could be affected by this one, but currently aren't:</h3><ul>";
        for (let [mutualSupport, otherBelief, narrative] of neutralBeliefs) {
            researchHTML += `<li>${otherBelief}. ${narrative}</li>`;
        }
        researchHTML += "</ul>";
    }

    let div = document.createElement("div");
    div.innerHTML = researchHTML;
    researchButton.appendChild(div);
}
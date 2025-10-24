export let cy = null;
export function setCy(cyInstance) {
    cy = cyInstance;
}

export let DEVMODE = false;
export let ALLOWIMPOSSIBLEMOVES = DEVMODE;

export let cyBaseFontSize;

export function setCyBaseFontSize(size) {
    cyBaseFontSize = size;
}

export let allowClickNodes = true;
export function setAllowClickNodes(value) {
    allowClickNodes = value;
}

export let PERMITTEDMINLOGPROB = 0;
export function setPERMITTEDMINLOGPROB(value) {
    PERMITTEDMINLOGPROB = value;
}

export let triedInfluence = false;
export function setTriedInfluence() {
    triedInfluence = true;
}
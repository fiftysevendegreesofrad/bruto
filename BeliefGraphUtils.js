import cytoscape from 'cytoscape';
export function assert(bool) {
    if (!bool)
        throw "Assertion failed.";
}
export function predicateToIndex(node, predicateValue=node.data("predicateValue")) {
    return (1 - predicateValue) * (node.data("options").length - 1);
}
export function predicateToOption(node, predicateValue) {
    return node.data("options")[predicateToIndex(node, predicateValue)];
}
export function getPredicateFromIndex(node, index) {
    return 1 - index / (node.options.length - 1);
}
export function nodeCoeffValue(node) {
    return (node.data("predicateValue") * 2 - 1);
}
export function getSupportedEdgesCoeffs(node)
{
    let supportedEdgesCoeffs = [];
    for (let e of node.outgoers("edge")) {
        let support = nodeCoeffValue(node) * nodeCoeffValue(e.target()) * e.data("weight");
        if (e.data().positiveOnly && nodeCoeffValue(e.source()) < 0)
            support = 0;
        supportedEdgesCoeffs.push([e, support]);
    }
    return supportedEdgesCoeffs;
}
export function getSupportingEdgesCoeffs(node)
{
    let supportingEdgesCoeffs = [];
    for (let e of node.incomers("edge")) {
        let support = nodeCoeffValue(node) * nodeCoeffValue(e.source()) * e.data("weight");
        if (e.data().positiveOnly && nodeCoeffValue(e.source()) < 0)
            support = 0;
        supportingEdgesCoeffs.push([e, support]);
    }
    return supportingEdgesCoeffs;
}
function updateEdgeColoursGetNodeLogProb(n) {
    //console.log(" "+n.data("label")+" "+predicateToOption(n, n.data("predicateValue")));
    let baseProb = n.data("baseProb");
    let altLogOdds = Math.log(baseProb / (1 - baseProb));
    let nodeLogOdds = altLogOdds*nodeCoeffValue(n);
    //console.log("  alt-baseprob "+baseProb+" alt-logodds "+altLogOdds+" option-logodds "+nodeLogOdds);
    
    for (let [e, nodeSupport] of getSupportingEdgesCoeffs(n))
    {
        //console.log("  mutual support from "+otherNode.data("label")+" "+nodeMutualSupport);
        nodeLogOdds += nodeSupport;
        if (nodeSupport > 0)
            e.data("color", "#009E73");
        else if (nodeSupport < 0)
            e.data("color", "#d52b00");
        else
            e.data("color", "grey");
    }
    
    let logProb = nodeLogOdds - Math.log(1 + Math.exp(nodeLogOdds));
    //console.log( "  final log odds "+nodeLogOdds+" logProb "+logProb);
    return logProb;
}
export function computeBelievabilityFromLogLik(logLik, permittedMinLogProb) {
    const MAXLOGPROB = 0;
    let believability = (logLik - permittedMinLogProb) / (MAXLOGPROB - permittedMinLogProb) * 100;
    
    //round to 1 decimal place
    return believability.toFixed(1);
}
export function updateLogLik(cy) {
    let logLik = 0;
    for (let n of cy.nodes()) {
        let logProb = updateEdgeColoursGetNodeLogProb(n);
        n.data("logprob", logProb);
        let baseLogProb = Math.log(n.data("baseProb"));
        //n.data("displaylabel", n.data("label")+baseLogProb.toFixed(1)+" "+logProb.toFixed(1));
        logLik += logProb;
    }
    return logLik;
}
export function altNetworkLogLik(cy, nodesToChange) {
    let eles = cy.elements().map(x => x.json());
    let cyClone = cytoscape({ elements: eles, headless: true });
    for (let [nodeID, nodePredValue] of Object.entries(nodesToChange))
        cyClone.getElementById(nodeID).data("predicateValue", nodePredValue);
    return updateLogLik(cyClone);
}
export function getNarrative(e,otherPredicate, predicateValue)
{
    const narrativeKey = otherPredicate+""+predicateValue;
    let narrative = e.data("narrative")[narrativeKey];
	if (narrative == undefined) narrative = "";
    return narrative;
}
const {load_elements, } = require('./gamedata');
const PriorityQueue = require('./priority-queue.min');

let ENABLE_OUTPUT = true;
async function output(text) {
    if (ENABLE_OUTPUT)
        process.stdout.write(""+text+"\n");
}
async function progressReport(text) {
    process.stdout.write(text+"\r");
}
function probToLogOdds(prob) {
    return Math.log(prob / (1 - prob));
}
function logOddsToProb(logOdds) {
    return Math.exp(logOdds) / (1 + Math.exp(logOdds));
}
function getBaseProbAdjustment(currentBase, supportChange) {
    let currentLO = probToLogOdds(currentBase);
    let desiredLO = currentLO - supportChange;
    let desiredBaseProb = logOddsToProb(desiredLO);
    return desiredBaseProb;
}
function stateToInteger(state) {
    const stateBase3 = state.map(x => x+1);
    return stateBase3.reduce((a,b) => a*3+b);
}
function getPredicateArrayLogProb(beliefNetGraph,predicateArray) {
    const altLogOdds = beliefNetGraph.nodes.map(x => probToLogOdds(x.data.baseProb));
    let nodeLogOdds = altLogOdds.map((x,i) => x * predicateArray[i]);
    for (e of beliefNetGraph.edges) {
        const sourceIndex = e.data.sourceIndex;
        const targetIndex = e.data.targetIndex;
        const weight = e.data.weight;
        const sourcePredicate = predicateArray[sourceIndex];
        const targetPredicate = predicateArray[targetIndex];
        const support = sourcePredicate * targetPredicate * weight;
        if (!e.data.positiveOnly || sourcePredicate > 0)
            nodeLogOdds[targetIndex] += support; //if we merge this with runtime logic we need to return 0 to show neutral belief
    }
    const logProbs = nodeLogOdds.map(x => x - Math.log(1 + Math.exp(x)));
    const logProb = logProbs.reduce((a,b) => a+b);
    return logProb;
}
//FIXME the following two funcs use a different definition of 'predicate' to BeliefGraphUtils.js
//also there is duplicated functionality
function predicateToIndex(node, predicateValue) {
    const numOptions = node.data.options.length;
    const p = (predicateValue + 1) / 2;
    return (1 - p) * (node.data.options.length - 1);
}
function predicateToOption(node, predicateValue) {
    return node.data.options[predicateToIndex(node, predicateValue)];
}  
function describeStateChange(beliefNetGraph,before,after)
{
    let result = "";
    for (let i = 0; i < before.length; i++)
        if (before[i] != after[i])
        {
            result += predicateToOption(beliefNetGraph.nodes[i],after[i])+" ";
        }
    return result;
}
class SearchState {
    constructor(node,steps,backtrace,minLogProb) {
        this.minLogProb = minLogProb;
        this.steps = steps;
        this.backtrace = backtrace;
        this.node = node;
    }

    static getFirst(node, gameStateLogProbs) {
        return new SearchState(node,0,null,gameStateLogProbs.get(node));
    }
    //issue: do we discard ways to reach the same node at worse prob? yes
    //issue: do we discard ways to reach the same node with more steps? only if the minimum cost is the same or better
    getOutgoing(nodeBestSearchStates, gameStateLogProbs, predicateArrayOutgoingFunction)
    {
        let outgoingStates = [];
        for (let n of predicateArrayOutgoingFunction(this.node))
        {
            let candidateLogProb = gameStateLogProbs.get(n);
            let newMinLogProb = Math.min(this.minLogProb, candidateLogProb);
            let newSteps = this.steps+1;
            
            let potentialNewSearchState = new SearchState(n,newSteps,this,newMinLogProb);
            let nodeUnexplored = !(nodeBestSearchStates.has(n));
            if (nodeUnexplored || potentialNewSearchState.compare(nodeBestSearchStates.get(n)) > 0)
                outgoingStates.push(potentialNewSearchState);
        }
        return outgoingStates;
    }

    compare(other) { //returns 1 if this is better, -1 for worse, 0 for equal
        if (this.minLogProb > other.minLogProb)
            return 1;
        if (this.minLogProb < other.minLogProb)
            return -1;
        if (this.steps < other.steps)
            return 1;
        if (this.steps > other.steps)
            return -1;
        return 0;
    }
}
class StateMap {
    //map class that indexes of state arrays
    constructor() {
        this.map = new Map();
    }
    get(state) {
        const index = stateToInteger(state);
        if (this.map.has(index))
            return this.map.get(index);
        return null;
    }
    set(state, value) {
        const index = stateToInteger(state);
        this.map.set(index,value);
    }
    has(state) {
        const index = stateToInteger(state);
        return this.map.has(index);
    }
}
class GameStateLogProbCache {
    constructor(bng) {
        this.cache = new StateMap();
        this.beliefNetGraph = bng;
    }
    get(node) {
        if (this.cache.has(node))
            return this.cache.get(node);
        let logProb = getPredicateArrayLogProb(this.beliefNetGraph,node);
        this.cache.set(node,logProb);
        return logProb;
    }
    prohibit(node) {
        this.cache.set(node,Number.NEGATIVE_INFINITY);
    }
}
function findMaxLikelihoodPath(beliefNet, gameStateLogProbs, predicateArrayOutgoingFunction, startNode, isEndNode) {
    //NOTE this works on the game state graph, not the beliefNet graph which is used to calculate weights on the game state graph
    let queue = new PriorityQueue({ comparator: function(b, a) { return a.compare(b); }});
    let gameStateBestPaths = new StateMap();
    let startSearchState = SearchState.getFirst(startNode,gameStateLogProbs);
    output("Starting search from "+startNode+" with logprob "+startSearchState.minLogProb+".");
    queue.queue(startSearchState);
    gameStateBestPaths[startNode] = startSearchState;
    let iterations=0;
    while (queue.length > 0) {
        iterations++;
        if (iterations % 5000 == 0)
            progressReport("Iterations: "+iterations);
        let searchState = queue.dequeue();
        if (isEndNode(searchState.node)) {
            output("Found path with "+searchState.steps+" steps.");
            output("let PERMITTEDMINLOGPROB="+searchState.minLogProb+";");
            let path = [];
            let current = searchState;
            let unlikliestState = current;
            let unlikliestLogProb = gameStateLogProbs.get(current.node);
            path.push(gameStateLogProbs.get(current.node));
            while (current.backtrace != null) {
                let after = current;
                current = current.backtrace;
                path.push(describeStateChange(beliefNet,current.node,after.node));
                path.push(gameStateLogProbs.get(current.node));
                if (gameStateLogProbs.get(current.node) < unlikliestLogProb)
                {
                    unlikliestState = current;
                    unlikliestLogProb = gameStateLogProbs.get(current.node);
                }
            }
            path.reverse();
            for (p of path)
                output(p);
            let finalState = searchState.node;
            if (!finalState.every(x => x === 1))
                process.stdout.write ("WARNING: final state is not all 1s.\n");
            for (let i = 0; i < finalState.length; i++)
                if (finalState[i] != 1)
                {
                    //get option from predicate                  
                    process.stdout.write(predicateToOption(beliefNet.nodes[i],finalState[i])+"\n");
                }
            return unlikliestState;
        }
        let outgoingStates = searchState.getOutgoing(gameStateBestPaths, gameStateLogProbs, predicateArrayOutgoingFunction);
        for (s of outgoingStates) {
            queue.queue(s);
            gameStateBestPaths.set(s.node,s);
        }
    }
    output("No path found.");
}

function addNodeIndicesToEdges(beliefNet) { 
    //this is a bit of a hack, but it's a lot easier than trying to figure out how to do it in cytoscape
    for (e of beliefNet.edges) {
        let source = beliefNet.nodes.find(x => x.data.id == e.data.source);
        let target = beliefNet.nodes.find(x => x.data.id == e.data.target);
        e.data.sourceIndex = beliefNet.nodes.indexOf(source);
        e.data.targetIndex = beliefNet.nodes.indexOf(target);
    }
}
function countRandomWalks(startNode, isEndNode, predicateArrayOutgoingFunction, gameStateLogProbs, minLogProb, maxPathLength, index) {
    let fastestPossibleRandomWalk = startNode.length;
    //compute how many random walks hit the end node in fastestPossibleRandomWalk steps, fastestPossibleRandomWalk+1 steps, etc
    let endNodeCountBySteps = [];
    let endNodeCount = 0;
    let iterations = 10000;
    let maxWalkLength = maxPathLength;
    for (let i = 0; i < maxWalkLength; i++)
        endNodeCountBySteps.push(0);
    for (let i = 0; i < iterations; i++) {
        let currentNode = startNode;
        let steps = 0;
        while (steps < maxWalkLength) {
            if (isEndNode(currentNode)) {
                endNodeCountBySteps[steps]++;
                endNodeCount++;
                break;
            }
            let outgoing = predicateArrayOutgoingFunction(currentNode);
            //filter out nodes with logprob < minLogProb
            outgoing = outgoing.filter(x => gameStateLogProbs.get(x) >= minLogProb);
            //filter out backtracing nodes
            let currentWeird = currentNode.reduce((a,b) => a+b);
            outgoing = outgoing.filter(x => x.reduce((a,b) => a+b) >= currentWeird);
            if (outgoing.length == 0)
                break;
            let nextNode = outgoing[Math.floor(Math.random()*outgoing.length)];
            currentNode = nextNode;
            steps++;
        }
    }

    //divide by iterations
    endNodeCountBySteps = endNodeCountBySteps.map(x => (x / iterations * 100));
    let totalSuccesses = endNodeCountBySteps.reduce((a,b) => a+b);
    endNodeCountBySteps = endNodeCountBySteps.map(x => x.toFixed(1));
    output(`Route ${index} minLogProb=${minLogProb} Random walks ${endNodeCountBySteps} total ${totalSuccesses.toPrecision(3)}%`);
}

async function main() {

    //write csv of logits
    const fs = require('fs');
    let csv = "";
    let supportChanges = [1,2,3,5];
    csv += "baseprob,";
    for (let supportChange of supportChanges) {
        csv += supportChange+",";
    }
    csv += "\n";
    for (let baseprob of [0.5,0.1,0.01,0.001]) {
        csv += baseprob+",";
        for (let supportChange of supportChanges) {
            csv += getBaseProbAdjustment(baseprob,supportChange)+",";
        }
        csv += "\n";
    }
    fs.writeFileSync("logits.csv",csv);

    output(getBaseProbAdjustment(0.5,3));
    //return;

    let beliefNet = await load_elements(debug=false);

    addNodeIndicesToEdges(beliefNet);
    let beliefNetOptionCounts = beliefNet.nodes.map(x => x.data.options.length);
    let totalOptions = beliefNetOptionCounts.reduce((a,b) => a+b);
    let maxPathLength = totalOptions-beliefNetOptionCounts.length;
    output("Total options "+totalOptions+" max path length "+maxPathLength);
    let optionCountToPredicateValues = {2: [-1,1], 3:[-1,0,1]};
    let beliefNetPredicateValues = beliefNetOptionCounts.map(x => optionCountToPredicateValues[x]);
    
    function predicateArrayOutgoingFunction(predicateArray) {
        let outgoing = [];
        for (let i = 0; i < predicateArray.length; i++) {
            for (let pv of beliefNetPredicateValues[i]) {
                if (pv == predicateArray[i]) continue;
                let newState = predicateArray.slice();
                newState[i] = pv;
                outgoing.push(newState);
            }
        }
        return outgoing;
    }

    //startnode is array of all the lowest predicate values
    let startNode = beliefNetPredicateValues.map(x => x[0]);

    //set endnode to be any node where the first predicate is true
    let isEndNode = (node) => node[0]==1;

    let gameStateLogProbs = new GameStateLogProbCache(beliefNet);
    let unlikliestState = findMaxLikelihoodPath(beliefNet, gameStateLogProbs, predicateArrayOutgoingFunction, startNode, isEndNode);
    let alternativeRoutes = 30;
    let logProbList = [gameStateLogProbs.get(unlikliestState.node)];
    for (let i = 0; i < alternativeRoutes; i++) {
        gameStateLogProbs.prohibit(unlikliestState.node);
        output("\nAlternative route "+(i+1));
        ENABLE_OUTPUT = false;
        unlikliestState = findMaxLikelihoodPath(beliefNet, gameStateLogProbs, predicateArrayOutgoingFunction, startNode, isEndNode);
        ENABLE_OUTPUT = true;
        output("logprob "+gameStateLogProbs.get(unlikliestState.node));
        logProbList.push(gameStateLogProbs.get(unlikliestState.node));
    }
    //reset gameStateLogProbs
    gameStateLogProbs = new GameStateLogProbCache(beliefNet);
    logProbList.forEach((lp,index)=>{
        countRandomWalks(startNode, isEndNode, predicateArrayOutgoingFunction, gameStateLogProbs, lp, maxPathLength, index);
    });
}
main();
const permittedMinLogProbs = {"easy":-8.58,"hard":-6.37}   ; //for restricting moves; derived from game analysis
const CHARACTERNAME = "Bruto";
async function load_elements(debug=false)
{
    //let response = await fetch(new Request(filename));
    //let text = await response.text();

    //informal syntax
    //LABEL BASEPROB: User label
    //Belief if true
    //[Belief if neutral]
    //[Belief if false]
    //then one or more of:
        //[+/- weight] LABEL [01 if positive effect only]
        //00 Narrative if both beliefs false
        //01 Narrative if other belief true and this one false
        //10 Narrative if other belief false and this one true
        //11 Narrative if both beliefs true
    //blank line to end node

    let text=`
REPTILES* 0.000001: Reptilian Elite
The world is governed by a secret elite of literal reptiles - actual lizard people
The world is governed by humans
+18.5 GOVERNMENTS
11 ...which could even be run by lizards too.
01 ...and they haven't said anything about lizard people.
10 ...which could even be run by lizards too.
00 ...and they haven't said anything about lizard people.

LEADER* 0.001: Leader
Our national leader’s primary aim is to expose and defeat a secret cult controlling the government
Our national leader’s primary aim is to deliver on some of their election promises (minus the usual u-turns) and win the next one
+5 CHEMTRAILS 01
11 If chemtrails are a thing, these guys are the number one suspects for being behind them.
10 Hang on, if chemtrails are a thing, these guys are the number one suspects for being behind them.
+10 GOVERNMENTS
11 ...probably this secret cult.
01 ...and they are pretty clear that these ideas are nonsense.
10 ...probably this secret cult.
00 ...and they are pretty clear that these ideas are nonsense.
+3 OUTSIDER
11 Bruto is more likely to believe wacky shit if he identifies as an outsider.
10 Bruto is more likely to believe wacky shit if he identifies as an outsider.
01 Conventional members of society don't believe such nonsense.
00 Conventional members of society don't believe such nonsense.

GOVERNMENTS* 0.01: Governments
Governments are merely puppets of a secret evil world order
What we know about our government barely scratches the surface
Governments do both good and bad things but don't have that many secrets
+1 COMPETENT 01
11 And you have to follow the dots - who is in charge of the supressing? 
10 Hang on, maybe the government is secretly suppressing me?
00 No evidence for government conspiracy there.
01 No evidence for government conspiracy there.
+2 PHARMA 01
11 And it's likely the government is involved too.
10 Hang on, surely the government would be involved in this?
00 No evidence for government conspiracy there.
01 No evidence for government conspiracy there.
+1 EXPERTSEVIL
11 And many of then are openly in the pay of the government.
01 Never explain with conspiracy what can be explained by incompetence.
10 Hang on, lots of those experts are paid by the government. Follow the dots...
00 Never explain with conspiracy what can be explained by incompetence.
+5 BIRDS 01
11 A secret world order needs its spy drones.
10 Hang on, who are all those birds spying for?
01 Hmm, wouldn't a secret world order needs an enormous number of secret spy drones?

BIRDS* 0.000001: Birds
All birds have been replaced with robot surveillance drones
Birds are just birds, man, they're cool but what's the big deal?
+5 FIVEG 01
11 The masts are also used to control the bird drones
10 Hang on, couldn't those masts also be remote controls for something?
+3 OUTSIDER
11 Bruto is more likely to believe wacky shit if he identifies as an outsider.
10 Bruto is more likely to believe wacky shit if he identifies as an outsider.
01 Conventional members of society don't believe such nonsense.
00 Conventional members of society don't believe such nonsense.
+5 EXPERTSEVIL
11 And they deny that birds are drones.
10 And they DENY that birds are drones; go figure.
01 And lots of bird experts are very clear about them being animals, not robots.
00 And lots of bird experts are very clear about them being animals, not robots.

FIVEG* 0.05: 5G
Disease is caused by 5G phone masts
Disease is caused by germs, viruses, etc
+5 CHEMTRAILS 01
11 The chemtrails are what make us susceptible to this, of course.
10 Hang on, wouldn't chemtrails need some sort of signal to activate their effects?
+5 GOVERNMENTS
11 And they use 5G to control us.
01 ...and they seem pretty clear that 5G is just for phone signal. You know, conventional control via tracking and advertising.
10 Hang on, I wonder why they're in such a hurry to roll out 5G?
00 ...and they seem pretty clear that 5G is just for phone signal. You know, conventional control via tracking and advertising.
-5 HOPE
11 It should be the other way round - Bruto's feelings informed by the evidence, rather than vice versa. But it's not, so in his happy-go-lucky way he's pretty sure the phone mast isn't making him ill.
10 It should be the other way round - Bruto's feelings informed by the evidence, rather than vice versa. But it's not, so in his happy-go-lucky way he's pretty sure the phone mast isn't making him ill.
01 Come to think of it I reckon that mast is making me ill on purpose.
00 I swear that mast is making me ill, electromagnetic radiation might be affecting me.
+3 OUTSIDER
11 Bruto is more likely to believe wacky shit if he identifies as an outsider.
10 Bruto is more likely to believe wacky shit if he identifies as an outsider.
01 Conventional members of society don't believe such nonsense.
00 Conventional members of society don't believe such nonsense.
+5 EXPERTSEVIL
11 And they deny that phone masts make anyone ill.
10 And they DENY that phone masts make anyone ill.
01 And lots of telecoms experts are very clear about 5G masts just being for phone signals.
00 And lots of telecoms experts are very clear about 5G masts just being for phone signals.

CHEMTRAILS* 0.0001: Chemtrails
Trails left behind jets are chemtrails used for mind control
Trails left behind jets are condensed water called contrails
+10 PHARMA 01
11 And they're obviously in on the manufacturing.
10 Hang on, wouldn't they want to distribute mind control drugs by air?
+5 GOVERNMENTS
11 And they control the airports.
01 ...and they are pretty clear about chemtrails being nonsense.
10 Hang on, don't they control all the airports?
00 ...and they are pretty clear about chemtrails being nonsense.
-5 HOPE
11 Nah, there aren't dangerous chemicals emitted by planes - apart from the carbon dioxide, d'oh!
10 Nah, there aren't dangerous chemicals emitted by planes - apart from the carbon dioxide, d'oh!
01 Of course we're all being poisoned by chemtrails.
00 And wouldn't it be terrible if we were all being poisoned by chemtrails?
+3 OUTSIDER
11 Bruto is more likely to believe wacky shit if he identifies as an outsider.
10 Bruto is more likely to believe wacky shit if he identifies as an outsider.
01 Conventional members of society don't believe such nonsense.
00 Conventional members of society don't believe such nonsense.
+5 EXPERTSEVIL
11 And they tell us contrails are natural, so that's clearly not true.
10 And they tell us contrails are NATURAL. Yeah, right.
01 And lots of them are very clear about contrails being caused by vortices. Or something.
00 And lots of them are very clear about contrails being caused by vortices. Or something.

PHARMA* 0.01: Big Pharma
Big pharma is the tool of a secret world order
Big pharma does not always act in the interests of the patient 
Large medical research corporations are trustworthy
+10 HOMEOPATHY 01
11 Of course they would try to suppress it.
10 Hang on, big pharma deny that don't they.
+5 EXPERTSEVIL 01
11 And the medical experts TELL us homeopathy DOESN'T work, because they don't want us to have that POWER.
10 Could medical experts be TELLING us homeopathy doesn't work, because they don't want us to have that POWER?

HOMEOPATHY* 0.1: Homeopathy
Homeopathy definitely works
Science has proven nothing about homeopathy, but one day it might
Homeopathy is indistinguishable from placebo, we're done here
+10 IBSCURE 01
11 It shouldn't be this way round, but Bruto is desperate to believe his condition is curable. He's pinned all his hopes on this.
10 It shouldn't be this way round, but Bruto is desperate to believe his condition is curable. He really wants to believe homeopathy works.
+5 EXPERTSWRONG
11 Homeopathy definitely works, do your own research!
10 There's some really interesting videos on YouTube about homeopathy.
01 And they're pretty clear that homeopathic remedies are just sugar pills.
00 And they're pretty clear that homeopathic remedies are just sugar pills.

COMPETENT* 0.5: I_Got Fired 
I got fired because the elite are trying to suppress me 
I got fired because my manager was incompetent
I got fired because I am incompetent 
+5 HOPE
11 It should be the other way round, shouldn't it? Like, Bruto should be more hopeful about life if he thinks he's competent. Still, he's got an interview next week. He'll do better if he's confident, which he is, now he believes getting fired wasn't his fault.
10 It should be the other way round, shouldn't it? Like, Bruto should be more hopeful about life if he thinks he's competent. Still, he's got an interview next week. He'll do better if he's confident, and he'll be far more confident if he can find someone else to blame for his lack of career success.
01 Then again, I'm rubbish at this job anyway. There doesn't need to be any conspiracy to explain why I got fired.
00 I'm rubbish at this job, and all of them for that matter.

IBSCURE* 0.5: IBS 
My Irritable Bowel Syndrome can be cured
...well, maybe. I dunno
My Irritable Bowel Syndrome is incurable
+5 HOPE
11 It should be the other way round, shouldn't it? Like, Bruto should only be hopeful about this if a potential cure looks promising. But maybe it's better for his sanity to be optimistic. The placebo effect is real, after all.
00 It should be the other way round, shouldn't it? Not counting the placebo effect, any future cure for IBS won't be held back by Bruto's pessimism. But it's hard to see that when you're feeling so low.
10 You know what, maybe this illness can be fixed. I'm going to try some new things.
01 I'm not sure there's any cure for this. I've tried everything.

HOPE 0.9: Hope
My life is good. There is hope &#128512;
I am useless. There is no hope for me &#128577;

OUTSIDER 0.1: Outsider
My friends don't accept me; I need to find new friends who think like me
I'm secure in my friendships as a conventional member of society
+10 NORESPECT
11 Actually they're not my friends any more.
10 Come to think of it, why am I friends with these people?
01 The world has room for me to be a little bit different.
00 Not that we have any differences, really.
+1 LEADER
11 My friends don't think that.
10 My friends don't think that.
01 My friends would agree.
00 My friends would agree.
+1 BIRDS
11 My friends don't think that. WAKE UP SHEEPLE!
10 My friends don't think that. 
01 My friends would agree.
00 My friends would agree.
+1 FIVEG
11 My friends don't think that. WAKE UP SHEEPLE!
10 My friends don't think that. 
01 My friends would agree, the science is pretty clear.
00 My friends would agree, the science is pretty clear.
+1 CHEMTRAILS
11 My friends don't think that. WAKE UP SHEEPLE!
10 My friends don't think that. 
01 My friends would agree. 
00 My friends would agree. We all paid attention in school.

NORESPECT 0.7: Respect
When we disagree on politics, my friends treat me with disdain and disgust because of my opinions
My friends respect our differences and always assume the best of me, even when they can't understand why I think the way I do

EXPERTSWRONG* 0.04: Expertise
Anyone who can make YouTube videos is an expert, and I can become one myself by watching them
Experts are sometimes wrong, but if they have spent many years studying a topic, they have a better chance of being right than I do
Experts should always be trusted
+3 PHARMA
01 And they say you have to ask a doctor before taking any medicine.
00 And they say you have to ask a doctor before taking any medicine. There's a reason for that.
11 They say only to trust experts because they don't want us to think for ourselves.
10 They say only to trust experts, but what if that's because they don't want us to think for ourselves?
+3 GOVERNMENTS
01 And they always seem to follow mainstream expert opinion.
00 And they always seem to follow mainstream expert opinion.
11 Anyway they always just drag in some "expert" to suit their politics. What gives them the right to decide who is an expert?
10 Anyway they always just drag in some "expert" to suit their politics. What gives them the right to decide who is an expert?
+5 COMPETENT
11 I'm good at my job, and I'm good at this too.
10 I'm good at my job, and I could be good at this too.
01 I'm bad at my job, maybe I wouldn't be so good at this either.
00 I'm bad at my job, no way I could be an expert in anything.

EXPERTSEVIL* 0.05: Expert Conspiracy
Experts are part of a conspiracy to suppress the truth
Most experts are trying to get things right
+3 PHARMA
01 And they say you have to ask a doctor before taking any medicine.
00 And they say you have to ask a doctor before taking any medicine. There's a reason for that.
11 They say only to trust experts because they don't want us to think for ourselves.
10 They say only to trust experts, but what if that's because they don't want us to think for ourselves?
+3 GOVERNMENTS
01 And they trust the experts. They seem like they know what they are doing.
00 And they trust the experts. I wonder why.
11 Experts are part of the conspiracy.
10 Hang on, aren't most experts in the pay of the government?
+3 EXPERTSWRONG
00 And they seem like decent people.
01 And they seem like decent people. Maybe I should reconsider.
10 And man, there are some YouTube videos on these so-called experts.
11 And let me tell you about these so-called experts.
+3 LEADER 01
11 Only our fearless leader can save us from the so-called experts.
10 Hang on, I bet the experts are in on it too.

`
    let lines = text.split("\n");
    let elements = {nodes: [], edges: []};
    
    while (lines.length > 0)
    {
        let line = lines.shift();
        if (line.trim()=="") continue;

        //expecting node line
        let parts = line.split(":");
        let leftparts = parts[0].split(" ");
        let nodeLabel = leftparts[0].trim();
        let baseProb = parseFloat(leftparts[1]);
        let userLabel = parts[1].trim();
        let userLabelSingleLine = userLabel.replace(/_/g, " ");
        let userLabelMultiLine = userLabel.replace(/ /g, "\n").replace(/_/g, " ");

        let wacky = nodeLabel[nodeLabel.length-1]=="*";
        if (wacky)
            nodeLabel = nodeLabel.substring(0,nodeLabel.length-1);

        let options=[]
        line = lines.shift();
        while (true)
        {
            line = line.trim();
            if (line=="")
                break; //end of node
            if (line[0]=="+" || line[0]=="-")
                break; //that will be an edge
            options.push(line);
            line = lines.shift();
        }
        elements.nodes.push({data: {id: nodeLabel, label: userLabel, displaylabel: userLabelMultiLine, displayLabelSingleLine: userLabelSingleLine, baseProb: baseProb, options: options,
            predicateValue: 0, logprob: 0, researched: 0, wacky: wacky, target: false}});

        //now we are expecting edges
        while(line.trim()!="")
        {
            if (line[0]=="+"||line[0]=="-")
            {
                let parts = line.split(" ");
                let weight = parseFloat(parts[0]);
                let source = parts[1].trim();
                let positiveOnly = parts[2]=="01";
                elements.edges.push({data: {source: source, target: nodeLabel, weight: weight, absweight: Math.abs(weight), 
                    directed: true, color:'grey', narrative: {}, positiveOnly: positiveOnly}});
            }
            else
            {
                let narrativeKey = line.substring(0,2);
                let narrative = line.substring(3).trim();
                elements.edges[elements.edges.length-1].data.narrative[narrativeKey]=narrative;
            }
            line = lines.shift();
        }
    }
    elements.nodes[0].data.target=true; //first node is the target
    return elements;
}

module.exports = {load_elements, permittedMinLogProbs};
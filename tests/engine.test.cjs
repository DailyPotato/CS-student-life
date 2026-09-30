const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const D=require('../data.js');
const fresh=(seed=42)=>E.create({name:'测试同学',background:'ordinary',talents:['academic','healthy'],seed});
const plan=(s,ids)=>ids.forEach(id=>E.addPlan(s,id));
const resolve=s=>{const event=D.events.find(e=>e.id===s.pendingEvent);const choices=event.choices.map((choice,index)=>({choice,index})).filter(({choice})=>!E.choiceError(s,choice));const safe=choices.find(({choice})=>!choice.check);assert.ok(safe||choices[0],`${event.id} must have an available choice`);return E.choose(s,(safe||choices[0]).index);};
const withEvent=(event,run)=>{D.events.push(event);try{return run(event);}finally{D.events.pop();}};
const pending=(event,seed=42)=>{const s=E.create({background:'ordinary',talents:[],seed});s.phase='event';s.pendingEvent=event.id;return s;};
const unchangedOnError=(s,fn)=>{const before=JSON.stringify(s);assert.throws(fn);assert.equal(JSON.stringify(s),before);};
const calendar=s=>(s.semester-1)*4+s.week;
const routeFixture=(route,semester,week,overrides={})=>{
  const s=E.create({talents:[],seed:42});
  Object.assign(s,{semester,week,weeksPlayed:(semester-1)*4+week-1,credits:(semester-1)*20,study:100,code:100,theory:100,algorithm:100,research:100,social:100,health:100,mood:100,projects:3,papers:1,internSteps:4,recommendPrep:100,examPrep:100,jobPrep:100,interviewPrep:100});
  s.grades=Array.from({length:semester-1},(_,i)=>({semester:i+1,gpa:4,repaired:false}));
  Object.assign(s,overrides);E.selectRoute(s,route);return s;
};
const settleRouteWeek=s=>withEvent({id:'test-route-neutral',title:'平静的一周',choices:[{result:'按计划继续生活。',effects:{}}]},event=>{s.phase='event';s.pendingEvent=event.id;return E.choose(s,0);});
const routeRecord=(stage,status='success',score=90)=>{const [semester,week]={recommend:[7,2],written:[7,4],retest:[8,2],job:[8,3]}[stage];return {status,score,reason:'已结算的阶段结果',semester,week};};

test('shop purchases spend real money and invalid purchases or uses leave state unchanged',()=>{
  const s=fresh(),money=s.money,result=E.buyItem(s,'algorithm-book');
  assert.equal(s.money,money-360);assert.equal(s.inventory['algorithm-book'],1);assert.equal(result.effects.money,-360);
  assert.ok(result.changes.some(text=>text.includes('算法书')));assert.equal(E.itemStatus(s,'algorithm-book').canBuy,false);
  unchangedOnError(s,()=>E.buyItem(s,'algorithm-book'));unchangedOnError(s,()=>E.useItem(s,'algorithm-book'));
  unchangedOnError(s,()=>E.buyItem(s,'missing'));unchangedOnError(s,()=>E.useItem(s,'coffee'));
  s.money=0;unchangedOnError(s,()=>E.buyItem(s,'coffee'));s.money=10000;
  for(let i=0;i<3;i++)E.buyItem(s,'coffee');unchangedOnError(s,()=>E.buyItem(s,'coffee'));
  E.buyItem(s,'repair-kit');unchangedOnError(s,()=>E.useItem(s,'repair-kit'));
  for(const phase of ['event','report','ending']){s.phase=phase;unchangedOnError(s,()=>E.buyItem(s,'meal-pack'));unchangedOnError(s,()=>E.useItem(s,'coffee'));}
  s.phase='planning';s.health=95;s.mood=99;E.buyItem(s,'meal-pack');const used=E.useItem(s,'meal-pack');
  assert.deepEqual(used.effects,{health:5,mood:1});assert.equal(s.inventory['meal-pack'],undefined);
  assert.equal(E.itemStatus(s,'meal-pack').owned,0);assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
});

test('shop spending preserves the budget of each scheduled action in order',()=>{
  const s=fresh();s.money=400;plan(s,['social','work','social']);
  unchangedOnError(s,()=>E.buyItem(s,'algorithm-book'));
  assert.match(E.itemStatus(s,'algorithm-book').buyReason,/已安排/);
  s.plan=[];plan(s,['work','social','social']);E.buyItem(s,'algorithm-book');
  assert.equal(s.money,40);E.advance(s);
  assert.ok(!s.log.some(entry=>entry.text.includes('未能进行')),'scheduled income should pay for the later activities');
});

test('permanent books and equipment change actual actions and keep working after reload',()=>{
  for(const [item,action,stat,bonus]of [['algorithm-book','algorithm','algorithm',3],['systems-book','course','theory',2],['laptop-upgrade','project','projectProgress',10],['headphones','code','mood',2],['running-shoes','exercise','health',4]]){
    const plain=E.create({talents:[],seed:42}),equipped=E.create({talents:[],seed:42});
    for(const s of [plain,equipped])Object.assign(s,{money:5000,code:40,theory:40,health:30,mood:30});
    E.buyItem(equipped,item);const loaded=E.validate(JSON.parse(JSON.stringify(equipped)));
    for(const s of [plain,equipped,loaded]){plan(s,[action,'rest','rest']);E.advance(s);}
    assert.equal(equipped[stat]-plain[stat],bonus,item);assert.deepEqual(loaded,equipped);assert.equal(equipped.inventory[item],1);
  }
  const s=fresh(),bookAction=D.actions.find(a=>a.id==='book-study');assert.ok(E.locked(s,bookAction));
  E.buyItem(s,'algorithm-book');assert.equal(E.locked(s,bookAction),'');plan(s,['book-study','rest','rest']);E.advance(s);assert.ok(s.algorithm>5);
});

test('activity tickets cannot be overbooked and are consumed once by the activity',()=>{
  const s=fresh();E.buyItem(s,'conference-ticket');unchangedOnError(s,()=>E.useItem(s,'conference-ticket'));
  E.addPlan(s,'conference-visit');unchangedOnError(s,()=>E.addPlan(s,'conference-visit'));plan(s,['rest','rest']);
  E.advance(s);assert.equal(s.inventory['conference-ticket'],undefined);assert.ok(s.perks.includes('conference-network'));
  assert.equal(s.lastWeek.notes.filter(note=>note.includes('消耗')).length,1);assert.ok(E.locked(s,D.actions.find(a=>a.id==='conference-visit')));
  settleRouteWeek(s);E.buyItem(s,'conference-ticket');plan(s,['conference-visit','rest','rest']);E.advance(s);
  assert.equal(s.perks.filter(id=>id==='conference-network').length,1);
});

test('temporary effects benefit all actions for two weeks and tick only on weekly settlement',()=>{
  const plain=E.create({talents:[],seed:42}),boosted=E.create({talents:[],seed:42});
  E.buyItem(boosted,'coffee');E.buyItem(boosted,'coffee');E.useItem(boosted,'coffee');
  assert.equal(boosted.buffs.focus,2);assert.equal(boosted.inventory.coffee,1);
  unchangedOnError(boosted,()=>E.useItem(boosted,'coffee'));
  for(let week=1;week<=3;week++){
    const before=boosted.algorithm-plain.algorithm;
    for(const s of [plain,boosted]){plan(s,['algorithm','algorithm','rest']);E.advance(s);}
    assert.equal(boosted.algorithm-plain.algorithm-before,week<=2?4:0);
    assert.equal(boosted.buffs.focus,week===1?1:undefined);
    assert.deepEqual(E.validate(JSON.parse(JSON.stringify(boosted))),boosted);
    unchangedOnError(boosted,()=>E.advance(boosted));
    for(const s of [plain,boosted])settleRouteWeek(s);
    assert.equal(boosted.buffs.focus,week===1?1:undefined);
  }
  E.useItem(boosted,'coffee');assert.equal(boosted.buffs.focus,2);assert.equal(boosted.inventory.coffee,undefined);
  const normal=routeFixture('undecided',3,1,{code:40,research:30,projectProgress:0,paperProgress:0}),cloud=E.clone(normal);
  E.buyItem(cloud,'cloud-credit');E.useItem(cloud,'cloud-credit');
  for(const s of [normal,cloud]){plan(s,['project','lab','rest']);E.advance(s);}
  assert.equal(cloud.projectProgress-normal.projectProgress,12);assert.equal(cloud.paperProgress-normal.paperProgress,8);
});

test('all four stories unlock real work, prioritize followups and give rewards only once',()=>{
  for(const def of D.stories){
    const s=routeFixture('undecided',3,1),invite=D.events.find(e=>e.choices.some(c=>c.startStory===def.id));
    const join=invite.choices.findIndex(c=>c.startStory===def.id),started=calendar(s);
    const description=E.choiceConsequencesText(s,invite.choices[join]);assert.ok(description.some(text=>text.includes(def.name)));
    s.phase='event';s.pendingEvent=invite.id;s.seen.push(invite.id);const joined=E.choose(s,join);
    assert.equal(s.stories[def.id].startedWeek,started);assert.equal(s.stories[def.id].dueWeek,started+def.duration);
    assert.equal(E.storyStatus(s,def.id).remainingWeeks,def.duration);assert.ok(joined.changes.some(text=>text.includes(def.name)));
    assert.equal(E.locked(s,D.actions.find(a=>a.id===def.actionId)),'');
    const followup=D.events.find(e=>e.id===def.followupEvent),complete=followup.choices.findIndex(c=>c.resolveStory?.outcome==='completed');
    assert.ok(E.choiceError(s,followup.choices[complete]),'unfinished work must not be deliverable');
    const actions=Array(def.target).fill(def.actionId);while(actions.length<3)actions.push('rest');plan(s,actions);E.advance(s);
    assert.equal(s.stories[def.id].progress,def.target);assert.equal(s.pendingEvent,def.followupEvent);
    assert.ok(s.lastWeek.notes.some(text=>text.includes(def.name)));assert.equal(E.storyStatus(s,def.id).ready,true);
    const loaded=E.validate(JSON.parse(JSON.stringify(s))),before=s.money,completed=E.choose(s,complete);E.choose(loaded,complete);
    assert.deepEqual(loaded,s);assert.equal(s.stories[def.id].status,'completed');assert.equal(s.stories[def.id].ending,followup.choices[complete].result);
    assert.equal(s.money-before,followup.choices[complete].effects.money||0);assert.ok(s.perks.includes(followup.choices[complete].grantPerk));
    assert.ok(completed.changes.some(text=>text.includes(def.name)));assert.ok(completed.changes.some(text=>text.includes('长期收获')));
    assert.ok(E.choiceError(s,invite.choices[join]));assert.equal(E.eventWeight(s,invite),0);
    s.phase='event';s.pendingEvent=followup.id;unchangedOnError(s,()=>E.choose(s,complete));s.phase='planning';s.pendingEvent=null;
    if(def.id==='study-group')assert.equal(E.locked(s,D.actions.find(a=>a.id===def.actionId)),'','completed study partners remain available');
    else if(def.id!=='campus-product')assert.ok(E.locked(s,D.actions.find(a=>a.id===def.actionId)));
    assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
  }
});

test('the last allowed story week can finish work, while uncompleted delivery permits cancellation without reward',()=>{
  const def=D.stories.find(story=>story.id==='freelance'),invite=D.events.find(e=>e.id==='freelance-invite');
  for(const finish of [true,false]){
    const s=routeFixture('undecided',3,1);s.phase='event';s.pendingEvent=invite.id;E.choose(s,0);
    while(calendar(s)<s.stories.freelance.dueWeek){plan(s,['rest','rest','rest']);E.advance(s);assert.notEqual(s.pendingEvent,def.followupEvent);settleRouteWeek(s);}
    assert.equal(E.storyStatus(s,'freelance').remainingWeeks,1);assert.equal(E.locked(s,D.actions.find(a=>a.id===def.actionId)),'');
    plan(s,finish?[def.actionId,def.actionId,'rest']:['rest','rest','rest']);E.advance(s);assert.equal(s.pendingEvent,def.followupEvent);
    if(finish){E.choose(s,0);assert.equal(s.stories.freelance.status,'completed');}
    else{const before=s.money;unchangedOnError(s,()=>E.choose(s,0));const canceled=E.choose(s,1);assert.equal(canceled.effects.money||0,0);assert.equal(s.money-before,s.report?.scholarship||0);assert.equal(s.stories.freelance.status,'abandoned');assert.ok(!s.perks.includes('client-trust'));}
    assert.equal(s.stories.freelance.resolvedWeek,s.stories.freelance.dueWeek);assert.ok(s.stories.freelance.ending.length>0);
  }
});

test('simultaneous story followups use the oldest deadline and preserve completed work awaiting resolution',()=>{
  const s=routeFixture('undecided',4,1);
  s.stories.freelance={status:'active',progress:2,startedWeek:9,dueWeek:12,resolvedWeek:null,ending:''};
  s.stories['open-source']={status:'active',progress:2,startedWeek:9,dueWeek:13,resolvedWeek:null,ending:''};
  assert.equal(E.eventPool(s)[0].event.id,'freelance-delivery');assert.ok(E.locked(s,D.actions.find(a=>a.id==='freelance-work')));
  plan(s,['rest','rest','rest']);E.advance(s);E.choose(s,0);
  assert.equal(E.eventPool(s)[0].event.id,'open-source-review');assert.ok(E.locked(s,D.actions.find(a=>a.id==='open-source-work')));
  plan(s,['rest','rest','rest']);E.advance(s);E.choose(s,0);
  assert.equal(s.stories.freelance.status,'completed');assert.equal(s.stories['open-source'].status,'completed');
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
});

test('graduation records unresolved stories as abandoned instead of leaving active work',()=>{
  const s=routeFixture('undecided',8,4);
  s.stories.freelance={status:'active',progress:0,startedWeek:29,dueWeek:32,resolvedWeek:null,ending:''};
  s.stories['open-source']={status:'active',progress:0,startedWeek:28,dueWeek:32,resolvedWeek:null,ending:''};
  plan(s,['rest','rest','rest']);E.advance(s);E.choose(s,1);assert.equal(s.phase,'report');
  assert.equal(Object.values(s.stories).filter(story=>story.status==='active').length,1);E.continueTerm(s);
  for(const story of Object.values(s.stories)){assert.equal(story.status,'abandoned');assert.equal(story.resolvedWeek,32);assert.ok(story.ending);}
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
});

test('computer failure blocks development until a repair kit or borrowed computer resolves it',()=>{
  const event=D.events.find(e=>e.id==='laptop-breakdown'),project=D.actions.find(a=>a.id==='project');
  for(const method of ['repair-kit','borrow-laptop']){
    const s=routeFixture('undecided',3,1);s.phase='event';s.pendingEvent=event.id;const result=E.choose(s,2);
    assert.ok(result.changes.some(text=>text.includes('电脑故障')));assert.ok(s.conditions.includes('broken-laptop'));
    unchangedOnError(s,()=>E.addPlan(s,'project'));
    if(method==='repair-kit'){E.buyItem(s,method);const fixed=E.useItem(s,method);assert.ok(fixed.changes.some(text=>text.includes('解除')));assert.equal(s.inventory[method],undefined);}
    else{plan(s,[method,'rest','rest']);E.advance(s);assert.ok(s.lastWeek.notes.some(text=>text.includes('解除')));settleRouteWeek(s);}
    assert.equal(E.locked(s,project),'');assert.deepEqual(s.conditions,[]);
  }
  const s=routeFixture('undecided',3,1);E.buyItem(s,'repair-kit');s.phase='event';s.pendingEvent=event.id;
  assert.ok(E.choiceConsequencesText(s,event.choices[1]).some(text=>text.includes('消耗')));const result=E.choose(s,1);
  assert.equal(s.inventory['repair-kit'],undefined);assert.deepEqual(s.conditions,[]);assert.ok(result.changes.some(text=>text.includes('维修工具包')));
});

test('lasting experiences affect actual work, attribute checks and route forecasts',()=>{
  const plain=routeFixture('job',5,1,{code:50,research:50,social:50,algorithm:50,jobPrep:60,interviewPrep:40,projects:1,papers:0,internSteps:0}),experienced=E.clone(plain);
  experienced.perks=['client-trust','maintainer-contact','study-partner','campus-users','conference-network'];
  assert.ok(Math.abs(E.checkChance(experienced,{stat:'code',difficulty:50})-E.checkChance(plain,{stat:'code',difficulty:50})-.05)<1e-10);
  assert.equal(E.routeStatus(experienced).forecast.min-E.routeStatus(plain).forecast.min,6);
  assert.equal(E.routeStatus(experienced,'recommend').forecast.min-E.routeStatus(plain,'recommend').forecast.min,3);
  const retest=routeFixture('exam',8,1,{code:50,research:50,social:50,interviewPrep:40,routeResults:{recommend:null,written:routeRecord('written'),retest:null,job:null}}),partner=E.clone(retest);
  partner.perks=['conference-network'];assert.equal(E.routeStatus(partner).forecast.min-E.routeStatus(retest).forecast.min,3);
  for(const s of [plain,experienced]){plan(s,['work','course','project']);E.advance(s);}
  assert.equal(experienced.money-plain.money,80);assert.equal(experienced.study-plain.study,3);assert.equal(experienced.projectProgress-plain.projectProgress,5);
});

test('an event-acquired item has the displayed cost, enters the bag and unlocks its real action',()=>{
  const event=D.events.find(e=>e.id==='secondhand-bookstall'),s=pending(event);s.money=179;
  unchangedOnError(s,()=>E.choose(s,0));s.money=180;
  assert.ok(E.choiceConsequencesText(s,event.choices[0]).some(text=>text.includes('算法书')));
  const result=E.choose(s,0);assert.equal(result.effects.money,-180);assert.equal(s.money,0);assert.equal(s.inventory['algorithm-book'],1);
  assert.ok(result.changes.some(text=>text.includes('算法书')));assert.equal(E.locked(s,D.actions.find(a=>a.id==='book-study')),'');
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
  s.phase='event';s.pendingEvent=event.id;s.money=180;unchangedOnError(s,()=>E.choose(s,0));
});

test('once-only encounters never return when all ordinary encounters have been seen',()=>{
  const s=routeFixture('undecided',3,1);s.seen=D.events.map(event=>event.id);
  const pool=E.eventPool(s);assert.ok(pool.length>0);assert.ok(pool.every(({event})=>!event.once&&!event.storyOnly));
  for(let week=0;week<3;week++){plan(s,['rest','rest','rest']);E.advance(s);assert.ok(!D.events.find(event=>event.id===s.pendingEvent).once);resolve(s);}
  const late=routeFixture('undecided',8,2),start=D.events.find(event=>event.id==='open-source-invite').choices[0];
  assert.ok(E.choiceError(late,start));
});

test('old saves without shop and story fields retain their state with empty new collections',()=>{
  const old=fresh();plan(old,['course','code','rest']);E.advance(old);resolve(old);
  for(const key of ['inventory','buffs','perks','conditions','stories'])delete old[key];
  delete old.lastEvent.changes;delete old.lastWeek.notes;
  const loaded=E.validate(JSON.parse(JSON.stringify(old)));
  for(const [key,value]of Object.entries(old))assert.deepEqual(loaded[key],value,key);
  assert.deepEqual(loaded.inventory,{});assert.deepEqual(loaded.buffs,{});assert.deepEqual(loaded.stories,{});assert.deepEqual(loaded.perks,[]);assert.deepEqual(loaded.conditions,[]);
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(loaded))),loaded);
});

test('invalid inventory, effect, experience and story records are rejected',()=>{
  const record={status:'active',progress:1,startedWeek:6,dueWeek:9,resolvedWeek:null,ending:''};
  const cases=[s=>s.inventory=null,s=>s.inventory=[],s=>s.inventory={coffee:0},s=>s.inventory={coffee:4},s=>s.inventory={coffee:1.5},s=>s.inventory={missing:1},s=>s.buffs={focus:3},s=>s.buffs={focus:0},s=>s.buffs={missing:1},s=>s.perks=['missing'],s=>s.perks=['client-trust','client-trust'],s=>s.conditions=['missing'],s=>s.conditions=['broken-laptop','broken-laptop'],s=>s.stories=[],s=>s.stories={missing:record},s=>s.stories.freelance={...record,progress:3},s=>s.stories.freelance={...record,dueWeek:10},s=>s.stories.freelance={...record,startedWeek:10,dueWeek:13},s=>s.stories.freelance={...record,status:'completed',resolvedWeek:8},s=>s.stories.freelance={...record,resolvedWeek:8},s=>s.stories.freelance={...record,status:'abandoned',resolvedWeek:10},s=>s.lastWeek={semester:3,week:1,effects:{},notes:[42]}];
  for(const mutate of cases){const s=routeFixture('undecided',3,1);mutate(s);assert.throws(()=>E.validate(s));}
  const missingStory=routeFixture('undecided',3,1);missingStory.phase='event';missingStory.pendingEvent='freelance-delivery';assert.throws(()=>E.validate(missingStory));
});

test('route selection permits early planning, guards transitions and retains preparation',()=>{
  const s=fresh();E.selectRoute(s,'recommend');assert.equal(s.route,'recommend');
  assert.ok(E.locked(s,D.actions.find(a=>a.id==='recommend-prepare')),'specialized preparation begins in year three');
  Object.assign(s,{recommendPrep:34,examPrep:27,jobPrep:12,interviewPrep:45});
  E.selectRoute(s,'exam');E.selectRoute(s,'job');E.selectRoute(s,'undecided');
  assert.deepEqual([s.recommendPrep,s.examPrep,s.jobPrep,s.interviewPrep],[34,27,12,45]);
  for(const phase of ['event','report','ending']){
    s.phase=phase;const before=JSON.stringify(s);assert.throws(()=>E.selectRoute(s,'recommend'));assert.equal(JSON.stringify(s),before);
  }
  s.phase='planning';E.addPlan(s,'course');
  const before=JSON.stringify(s);assert.throws(()=>E.selectRoute(s,'recommend'));assert.equal(JSON.stringify(s),before);
  E.removePlan(s,0);assert.throws(()=>E.selectRoute(s,'unknown'));assert.throws(()=>E.selectRoute(s,['exam']));assert.equal(s.route,'undecided');
});

test('route actions and events require the selected route and an open stage',()=>{
  const actions={recommend:'recommend-prepare',exam:'exam-study',job:'job-prepare'};
  const events=D.events.filter(e=>e.routes);
  assert.ok(events.length>=3);
  for(const route of Object.keys(actions)){
    const s=routeFixture(route,5,1);
    for(const [candidate,id]of Object.entries(actions))assert.equal(Boolean(E.locked(s,D.actions.find(a=>a.id===id))),candidate!==route,id);
    assert.equal(E.locked(s,D.actions.find(a=>a.id==='route-interview')),'');
    const currentEvents=events.filter(e=>(e.min||1)<=5&&(e.max||8)>=5);
    for(const event of currentEvents)assert.equal(E.eventWeight(s,event)>0,event.routes.includes(route),event.id);
    const id=actions[route],key={recommend:'recommendPrep',exam:'examPrep',job:'jobPrep'}[route];
    s[key]=0;const preview=E.actionPreview(s,id);plan(s,[id,'rest','rest']);E.advance(s);
    assert.equal(s[key],preview[key]);assert.equal(s.lastWeek.effects[key],preview[key]);
  }
  const closed=routeFixture('recommend',7,2);settleRouteWeek(closed);
  assert.ok(E.locked(closed,D.actions.find(a=>a.id==='recommend-prepare')));
  for(const event of events.filter(e=>e.routes.includes('recommend')))assert.equal(E.eventWeight(closed,event),0,event.id);
});

test('missed and failed routes cannot reopen, while a successful destination can be selected again',()=>{
  const missed=routeFixture('undecided',7,3);
  assert.throws(()=>E.selectRoute(missed,'recommend'));
  E.selectRoute(missed,'exam');assert.equal(missed.route,'exam');
  const failed=routeFixture('recommend',7,2,{recommendPrep:59});settleRouteWeek(failed);
  assert.equal(failed.routeResults.recommend.status,'failure');E.selectRoute(failed,'job');
  const before=JSON.stringify(failed);assert.throws(()=>E.selectRoute(failed,'recommend'));assert.equal(JSON.stringify(failed),before);
  const successful=routeFixture('recommend',7,2);settleRouteWeek(successful);
  const result=JSON.parse(JSON.stringify(successful.routeResults.recommend));
  E.selectRoute(successful,'job');E.selectRoute(successful,'recommend');
  assert.equal(successful.route,'recommend');assert.deepEqual(successful.routeResults.recommend,result);
});

test('recommendation, written examination and hiring settle at their deadline only once',()=>{
  for(const [route,key,semester,week]of [['recommend','recommend',7,2],['exam','written',7,4],['job','job',8,3]]){
    const s=routeFixture(route,semester,week-1);settleRouteWeek(s);
    assert.equal(s.week,week);assert.equal(s.routeResults[key],null);
    const loaded=E.validate(JSON.parse(JSON.stringify(s))),forecast=E.routeStatus(s).forecast;
    settleRouteWeek(s);settleRouteWeek(loaded);
    assert.deepEqual(loaded,s);assert.equal(s.routeResults[key].status,'success');
    const result=JSON.parse(JSON.stringify(s.routeResults[key]));
    assert.equal(result.semester,semester);assert.equal(result.week,week);
    assert.ok(result.score>=forecast.min&&result.score<=forecast.max);
    const before=JSON.stringify(s);assert.throws(()=>E.choose(s,0));assert.equal(JSON.stringify(s),before);
    if(s.phase==='report')E.continueTerm(s);
    settleRouteWeek(s);assert.deepEqual(s.routeResults[key],result,'later weeks must not reroll a settled result');
  }
});

test('recommendation enforces the first six GPAs, pending retakes, preparation and research or contest evidence',()=>{
  const grades=gpa=>Array.from({length:6},(_,i)=>({semester:i+1,gpa,repaired:false}));
  const cases=[
    [{grades:grades(3.5)},'success'],[{grades:grades(3.49)},'failure'],[{failed:1},'failure'],
    [{papers:0,awards:0},'failure'],[{papers:0,awards:1},'success'],[{recommendPrep:59},'failure']
  ];
  for(const [overrides,status]of cases){const s=routeFixture('recommend',7,2,overrides);settleRouteWeek(s);assert.equal(s.routeResults.recommend.status,status,JSON.stringify(overrides));}
  const s=routeFixture('recommend',7,2,{grades:grades(3.5)});settleRouteWeek(s);
  const original=JSON.parse(JSON.stringify(s.routeResults.recommend));
  s.grades.push({semester:7,gpa:0,repaired:false});s.semester=8;s.week=1;
  assert.equal(E.routeStatus(s).requirements[0].met,true,'a seventh-semester grade cannot change the first-six GPA');
  assert.deepEqual(s.routeResults.recommend,original);assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
});

test('passing the written examination opens the retest while failure keeps it closed',()=>{
  const event=D.events.find(e=>e.id==='exam-retest-practice'),interview=D.actions.find(a=>a.id==='route-interview');
  const passed=routeFixture('exam',7,4);settleRouteWeek(passed);
  assert.equal(passed.routeResults.written.status,'success');assert.equal(passed.routeResults.retest,null);
  E.continueTerm(passed);assert.match(E.routeStatus(passed).title,/复试/);
  assert.ok(E.locked(passed,D.actions.find(a=>a.id==='exam-study')));assert.equal(E.locked(passed,interview),'');
  assert.ok(E.eventWeight(passed,event)>0);
  settleRouteWeek(passed);assert.equal(passed.routeResults.retest,null);
  const loaded=E.validate(JSON.parse(JSON.stringify(passed)));settleRouteWeek(passed);settleRouteWeek(loaded);
  assert.deepEqual(loaded,passed);assert.equal(passed.routeResults.retest.status,'success');
  const result=JSON.parse(JSON.stringify(passed.routeResults.retest));settleRouteWeek(passed);assert.deepEqual(passed.routeResults.retest,result);
  assert.equal(E.eventWeight(passed,event),0);assert.ok(E.locked(passed,interview));
  const failed=routeFixture('exam',7,4,{examPrep:59});settleRouteWeek(failed);E.continueTerm(failed);
  assert.equal(failed.routeResults.written.status,'failure');assert.equal(E.eventWeight(failed,event),0);assert.ok(E.locked(failed,interview));
  settleRouteWeek(failed);settleRouteWeek(failed);assert.equal(failed.routeResults.retest,null);
});

test('retest and job preparation cannot replace their required evidence',()=>{
  const retest=routeFixture('exam',7,4);settleRouteWeek(retest);E.continueTerm(retest);
  retest.interviewPrep=39;settleRouteWeek(retest);settleRouteWeek(retest);
  assert.equal(retest.routeResults.retest.status,'failure');assert.match(retest.routeResults.retest.reason,/面试准备/);
  for(const overrides of [{projects:0},{code:39},{jobPrep:59}]){
    const s=routeFixture('job',8,3,overrides);settleRouteWeek(s);assert.equal(s.routeResults.job.status,'failure',JSON.stringify(overrides));
  }
  const novice=routeFixture('job',8,3,{projects:1,internSteps:0});settleRouteWeek(novice);
  assert.equal(novice.routeResults.job.status,'success','internships improve the score but are not a hard prerequisite');
});

test('selected-route endings take priority without bypassing graduation requirements',()=>{
  for(const [route,key,successEnding,failureEnding]of [['recommend','recommend','recommend-admit','recommend-pending'],['exam','retest','exam-admit','exam-retry'],['job','job','job-offer','job-searching']]){
    const s=routeFixture('undecided',8,4,{credits:160,thesis:100,papers:3,research:100});
    s.phase='ending';s.route=route;s.routeResults[key]=routeRecord(key);
    if(route==='exam')s.routeResults.written=routeRecord('written');
    assert.equal(E.getEnding(s).id,successEnding);
    assert.equal(E.getEnding({...s,credits:151}).id,'delayed');assert.equal(E.getEnding({...s,thesis:99}).id,'delayed');
    s.routeResults[key]=routeRecord(key,'failure',40);assert.equal(E.getEnding(s).id,failureEnding);
    s.routeResults[key]=null;assert.equal(E.getEnding(s).id,failureEnding);
  }
});

test('old saves migrate missing route fields without losing progress or creating a destination',()=>{
  const old=routeFixture('undecided',8,1,{code:61,projectProgress:47,thesis:25});
  for(const key of ['route','recommendPrep','examPrep','jobPrep','interviewPrep','routeResults'])delete old[key];
  const loaded=E.validate(JSON.parse(JSON.stringify(old)));
  for(const [key,value]of Object.entries(old))assert.deepEqual(loaded[key],value,key);
  assert.equal(loaded.route,'undecided');assert.deepEqual(loaded.routeResults,{recommend:null,written:null,retest:null,job:null});
  for(const key of ['recommendPrep','examPrep','jobPrep','interviewPrep'])assert.equal(loaded[key],0);
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(loaded))),loaded);
  assert.throws(()=>E.selectRoute(loaded,'recommend'));assert.throws(()=>E.selectRoute(loaded,'exam'));
  E.selectRoute(loaded,'job');assert.equal(loaded.route,'job');
});

test('invalid route saves reject malformed progress, premature results and impossible retests',()=>{
  const cases=[
    s=>s.route='unknown',s=>s.route=['exam'],s=>s.route={id:'exam'},s=>s.route=null,s=>s.recommendPrep=-1,s=>s.examPrep=101,s=>s.jobPrep=2.5,s=>s.interviewPrep=NaN,
    s=>s.routeResults=null,s=>s.routeResults={},s=>s.routeResults.extra=null,
    s=>s.routeResults.recommend={...routeRecord('recommend'),score:69},
    s=>s.routeResults.recommend={...routeRecord('recommend'),status:'pending'},
    s=>s.routeResults.recommend={...routeRecord('recommend'),week:1},
    s=>s.routeResults.recommend={...routeRecord('recommend'),score:101},
    s=>s.routeResults.recommend={...routeRecord('recommend'),reason:42},
    s=>s.routeResults.retest=routeRecord('retest')
  ];
  for(const mutate of cases){const s=routeFixture('undecided',8,4);mutate(s);assert.throws(()=>E.validate(s));}
  const premature=routeFixture('recommend',7,2);premature.routeResults.recommend=routeRecord('recommend');assert.throws(()=>E.validate(premature));
});

test('each route can be completed successfully through a real four-year game',()=>{
  const destinations={recommend:'recommend-admit',exam:'exam-admit',job:'job-offer'};
  const preparation={recommend:['recommend-prepare','recommendPrep'],exam:['exam-study','examPrep'],job:['job-prepare','jobPrep']};
  function nextAction(s,route){
    if(s.health<45||s.mood<40)return 'rest';
    const [action,stat]=preparation[route];
    if(s.semester>=5){
      if(s[stat]<100&&!E.locked(s,D.actions.find(a=>a.id===action)))return action;
      if(s.interviewPrep<100&&!E.locked(s,D.actions.find(a=>a.id==='route-interview')))return 'route-interview';
    }
    if(route==='recommend'){
      if(s.semester>=3&&(s.research<95||s.papers<2))return 'lab';
      if(s.social<60)return 'social';
      if(s.code<40)return 'code';
    }else if(route==='exam'){
      if(s.algorithm<75)return 'algorithm';
      if(s.code<60)return 'code';
      if(s.semester>=3&&s.research<40)return 'lab';
      if(s.social<50)return 'social';
    }else{
      if(s.code<40)return 'code';
      if(s.projects<3)return 'project';
      if(s.semester>=5&&s.internSteps<4)return 'intern';
      if(s.algorithm<60)return 'algorithm';
      if(s.social<50)return 'social';
    }
    return 'rest';
  }
  for(const route of Object.keys(destinations))for(const seed of [1,42,1000]){
    const s=E.create({name:'路线测试',background:'ordinary',talents:['academic','healthy'],seed});E.selectRoute(s,route);
    for(let week=0;week<32;week++){
      E.addPlan(s,'course');
      if(s.week===1||(s.semester<=2&&s.week===2))E.addPlan(s,'course');
      if(s.semester>=7&&s.thesis<100)E.addPlan(s,'thesis');
      while(s.plan.length<3)E.addPlan(s,nextAction(s,route));
      E.advance(s);E.validate(s);resolve(s);E.validate(s);
      if(s.phase==='report'){E.continueTerm(s);E.validate(s);}
    }
    assert.equal(s.phase,'ending');assert.equal(s.weeksPlayed,32);assert.equal(s.grades.length,8);
    assert.ok(s.credits>=152);assert.equal(s.thesis,100);assert.equal(s.failed,0);
    assert.equal(s.ending.id,destinations[route],`${route}, seed ${seed}: ${JSON.stringify({results:s.routeResults,research:s.research,code:s.code,algorithm:s.algorithm,social:s.social,interview:s.interviewPrep,grades:s.grades})}`);
  }
});

test('talent draws are reproducible, unique and varied across new-game seeds',()=>{
  const known=new Set(D.talents.map(t=>t.id));
  const draws=Array.from({length:100},(_,i)=>E.drawTalents(i+1,8));
  for(let i=0;i<draws.length;i++){
    assert.deepEqual(draws[i],E.drawTalents(i+1,8));
    assert.equal(draws[i].length,8);assert.equal(new Set(draws[i]).size,8);
    assert.ok(draws[i].every(id=>known.has(id)));
  }
  assert.ok(new Set(draws.map(draw=>draw.join(','))).size>90,'separate seeds should produce distinct starting choices');
  assert.ok(new Set(draws.flat()).size>24,'random draws should expose the expanded talent pool');
  const all=E.drawTalents(123,D.talents.length);
  assert.equal(all.length,D.talents.length);assert.equal(new Set(all).size,D.talents.length);
  assert.throws(()=>E.drawTalents(123,D.talents.length+1));
  assert.throws(()=>E.drawTalents(123,0));
});

test('rarity changes draw frequency while rare talents remain obtainable',()=>{
  const common=D.talents.filter(t=>t.rarity==='common'),rare=D.talents.filter(t=>t.rarity==='rare');
  assert.ok(common.length&&rare.length);
  const counts=Object.fromEntries(D.talents.map(t=>[t.id,0]));
  for(let seed=1;seed<=2500;seed++)counts[E.drawTalents(Math.imul(seed,2654435761)>>>0,1)[0]]++;
  const average=group=>group.reduce((sum,t)=>sum+counts[t.id],0)/group.length;
  assert.ok(average(common)>average(rare)*2,'common cards should be more frequent per card');
  assert.ok(rare.every(t=>counts[t.id]>0),'all rare cards should remain obtainable');
});

test('selected starting talents change the character and unselected talents do not',()=>{
  const base=E.create({background:'ordinary',talents:[],seed:42});
  const starters=D.talents.filter(t=>t.start&&Object.keys(t.start).length);
  assert.ok(starters.length>0,'the talent pool should include starting attributes');
  for(const talent of starters){
    const s=E.create({background:'ordinary',talents:[talent.id],seed:42});
    for(const [stat,bonus]of Object.entries(talent.start)){
      const max=['code','theory','algorithm','research','social','health','mood','thesis'].includes(stat)?100:Infinity;
      assert.equal(s[stat],Math.min(max,Math.max(0,base[stat]+bonus)),`${talent.id}: ${stat}`);
    }
    assert.deepEqual(s.talents,[talent.id]);
  }
});

test('action, weekly recovery and expense talents have their advertised effect',()=>{
  const plain=E.create({talents:[],seed:42}),logical=E.create({talents:['logic'],seed:42});
  for(const s of [plain,logical]){plan(s,['algorithm','course','rest']);E.advance(s);}
  assert.equal(logical.algorithm-plain.algorithm,3);
  const normal=E.create({talents:[],seed:42}),comfortable=E.create({talents:['healthy','thrifty'],seed:42});
  normal.health=comfortable.health=40;
  for(const s of [normal,comfortable]){plan(s,['course','code','algorithm']);E.advance(s);}
  assert.equal(comfortable.health-normal.health,4);
  assert.equal(comfortable.money-normal.money,70);
});

test('theory improves course study and social connections improve research progress',()=>{
  const beginner=E.create({talents:[],seed:42}),expert=E.create({talents:[],seed:42});
  beginner.theory=0;expert.theory=80;
  for(const s of [beginner,expert]){plan(s,['course','rest','rest']);E.advance(s);}
  assert.equal(expert.study-beginner.study,4);
  const solo=E.create({talents:[],seed:42}),connected=E.create({talents:[],seed:42});
  for(const s of [solo,connected]){s.semester=3;s.theory=50;}
  solo.social=0;connected.social=75;
  for(const s of [solo,connected]){plan(s,['lab','rest','rest']);E.advance(s);}
  assert.equal(connected.paperProgress-solo.paperProgress,6);
});

test('action previews match actual study and progress gains across skill thresholds',()=>{
  const cases=[['course',{theory:80},'study'],['project',{code:38},'projectProgress'],['lab',{semester:3,theory:50,research:55,social:75},'paperProgress']];
  for(const [id,overrides,stat]of cases){
    const s=Object.assign(E.create({talents:[],seed:42}),overrides);
    const before=JSON.stringify(s),start=s[stat],preview=E.actionPreview(s,id);
    assert.equal(JSON.stringify(s),before,'viewing an action must not change the character');
    plan(s,[id,'rest','rest']);E.advance(s);
    assert.equal(s[stat]-start,preview[stat],`${id}: ${stat}`);
  }
});

test('weekly summaries report actual growth and keep completed project progress positive',()=>{
  const s=E.create({talents:['healthy','thrifty'],seed:42});
  Object.assign(s,{semester:3,weeksPlayed:8,credits:40,code:50,theory:50,research:55,social:75,projectProgress:90,paperProgress:90});
  s.grades=[{semester:1,gpa:3,repaired:false},{semester:2,gpa:3,repaired:false}];
  const before=JSON.parse(JSON.stringify(s));
  plan(s,['project','lab','rest']);E.advance(s);
  assert.equal(s.projects,1);assert.equal(s.papers,1);
  assert.equal(s.lastWeek.semester,3);assert.equal(s.lastWeek.week,1);
  assert.equal(s.lastWeek.effects.projectProgress,s.projects*100+s.projectProgress-before.projects*100-before.projectProgress);
  assert.equal(s.lastWeek.effects.paperProgress,s.papers*100+s.paperProgress-before.papers*100-before.paperProgress);
  for(const stat of ['code','theory','research','health','mood','money'])assert.equal(s.lastWeek.effects[stat]||0,s[stat]-before[stat],stat);
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
  const summary=JSON.parse(JSON.stringify(s.lastWeek));resolve(s);
  assert.deepEqual(s.lastWeek,summary,'event results must not overwrite the weekly action summary');
});

test('event project completion reports its rewards and cumulative progress without the term scholarship',()=>{
  const s=pending(D.events.find(e=>e.id==='keyboard'));
  Object.assign(s,{week:4,weeksPlayed:4,study:150,projectProgress:95,code:10,mood:50,money:700});
  const before=JSON.parse(JSON.stringify(s)),result=E.choose(s,1);
  assert.equal(s.projects,1);assert.equal(s.projectProgress,5);
  assert.equal(s.code,14);assert.equal(s.mood,62);
  assert.deepEqual(result.effects,{code:4,mood:12,projectProgress:10,projects:1});
  assert.equal(result.effects.projectProgress,s.projects*100+s.projectProgress-before.projects*100-before.projectProgress);
  assert.deepEqual(s.lastEvent,result);
  assert.equal(s.phase,'report');assert.equal(s.report.scholarship,600);
  assert.equal(s.money-before.money,600);assert.equal(result.effects.money||0,0,'the scholarship belongs to the semester report');
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
});

test('event paper completion reports clamped rewards and cumulative progress without the term scholarship',()=>{
  const s=pending(D.events.find(e=>e.id==='mentor'));
  Object.assign(s,{semester:3,week:4,weeksPlayed:12,credits:40,study:150,paperProgress:95,theory:30,research:97,mood:97,money:300});
  s.grades=[{semester:1,gpa:3,repaired:false},{semester:2,gpa:3,repaired:false}];
  const before=JSON.parse(JSON.stringify(s)),result=E.choose(s,1);
  assert.equal(s.papers,1);assert.equal(s.paperProgress,5);
  assert.equal(s.theory,36);assert.equal(s.research,100);assert.equal(s.mood,100);
  assert.deepEqual(result.effects,{theory:6,research:3,mood:3,paperProgress:10,papers:1});
  assert.equal(result.effects.paperProgress,s.papers*100+s.paperProgress-before.papers*100-before.paperProgress);
  assert.deepEqual(s.lastEvent,result);
  assert.equal(s.phase,'report');assert.equal(s.report.scholarship,600);
  assert.equal(s.money-before.money,600);assert.equal(result.effects.money||0,0,'the scholarship belongs to the semester report');
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
});

test('event eligibility respects every attribute requirement and both semester limits',()=>{
  const s=fresh();s.semester=4;s.code=50;s.health=30;
  const event={min:3,max:5,weight:2,requires:[{stat:'code',min:40},{stat:'health',max:35}]};
  assert.equal(E.eventWeight(s,event),2);
  assert.equal(E.eventWeight({...s,code:39},event),0);
  assert.equal(E.eventWeight({...s,health:36},event),0);
  assert.equal(E.eventWeight({...s,semester:2},event),0);
  assert.equal(E.eventWeight({...s,semester:6},event),0);
});

test('event weights favor matching attributes with normalized money and skill scales',()=>{
  const s=fresh(),high={weight:2,bias:[{stat:'code',direction:'high',factor:2}]},low={weight:2,bias:[{stat:'code',direction:'low',factor:2}]};
  assert.ok(E.eventWeight({...s,code:90},high)>E.eventWeight({...s,code:10},high));
  assert.ok(E.eventWeight({...s,code:10},low)>E.eventWeight({...s,code:90},low));
  const money={weight:2,bias:[{stat:'money',direction:'high',factor:2}]};
  assert.equal(E.eventWeight({...s,money:1000},money),E.eventWeight({...s,code:50},high));
  assert.equal(E.eventWeight({...s,money:5000},money),E.eventWeight({...s,money:2000},money));
});

test('event selection prioritizes unseen eligible events and reuses only eligible ones',()=>{
  const s=fresh();s.semester=1;
  const eligible=D.events.filter(e=>E.eventWeight(s,e)>0);
  assert.ok(eligible.length>1);
  const remaining=eligible[eligible.length-1];
  s.seen=eligible.filter(e=>e!==remaining).map(e=>e.id);
  assert.deepEqual(E.eventPool(s).map(({event})=>event.id),[remaining.id]);
  s.seen=D.events.map(e=>e.id);
  const reused=E.eventPool(s);
  assert.deepEqual(new Set(reused.map(({event})=>event.id)),new Set(D.events.filter(e=>E.eventWeight(s,e)>0).map(e=>e.id)));
  assert.ok(reused.every(({event})=>!event.once&&!event.storyOnly));
  assert.ok(reused.every(({event,weight})=>weight>0&&weight===E.eventWeight(s,event)));
});

test('weekly random selection actually favors an event matching the character attributes',()=>withEvent({
  id:'test-high-code-event',title:'编程机会',bias:[{stat:'code',direction:'high',factor:10}],choices:[{result:'记录',effects:{}}]
},biased=>withEvent({
  id:'test-neutral-event',title:'普通日常',choices:[{result:'记录',effects:{}}]
},neutral=>{
  const counts={low:0,high:0};
  for(let i=1;i<=400;i++)for(const [profile,code]of [['low',0],['high',100]]){
    const s=E.create({talents:[],seed:Math.imul(i,2654435761)>>>0});s.code=code;
    s.seen=D.events.filter(e=>e.id!==biased.id&&e.id!==neutral.id).map(e=>e.id);
    plan(s,['rest','rest','rest']);E.advance(s);
    assert.ok([biased.id,neutral.id].includes(s.pendingEvent));
    if(s.pendingEvent===biased.id)counts[profile]++;
  }
  assert.ok(counts.high>counts.low+100,JSON.stringify(counts));
})));

test('attribute checks improve with skill, apply talent bonuses and keep chance limits',()=>{
  const s=E.create({talents:[],seed:42}),check={stat:'code',difficulty:50};
  assert.ok(E.checkChance({...s,code:80},check)>E.checkChance({...s,code:20},check));
  assert.equal(E.checkChance({...s,code:50},check),.55);
  assert.equal(E.checkChance({...s,code:0},{stat:'code',difficulty:100}),.10);
  assert.equal(E.checkChance({...s,code:100},{stat:'code',difficulty:0}),.95);
  const talent=D.talents.find(t=>t.checkBonuses&&Object.values(t.checkBonuses).some(b=>b>0));
  assert.ok(talent,'at least one talent should affect event checks');
  const [stat,bonus]=Object.entries(talent.checkBonuses).find(([,value])=>value>0);
  const withTalent={...s,talents:[talent.id]};
  const targetStat=stat==='all'?'code':stat;
  withTalent[targetStat]=50;s[targetStat]=50;
  assert.ok(Math.abs(E.checkChance(withTalent,{stat:targetStat,difficulty:50})-E.checkChance(s,{stat:targetStat,difficulty:50})-bonus)<1e-10);
});

test('unmet event choice requirements and unaffordable costs leave state untouched',()=>withEvent({
  id:'test-choice-requirements',title:'门槛测试',choices:[
    {require:{code:40,social:30},effects:{code:5},result:'通过'},
    {effects:{money:-200},result:'付费'},
    {effects:{mood:2},result:'安全选择'}
  ]
},event=>{
  const s=pending(event);s.code=40;s.social=29;s.money=100;
  for(const index of [0,1]){
    const before=JSON.stringify(s);assert.ok(E.choiceError(s,event.choices[index]));
    assert.throws(()=>E.choose(s,index));assert.equal(JSON.stringify(s),before);
  }
  s.social=30;assert.equal(E.choiceError(s,event.choices[0]),'');
  assert.equal(E.choiceError(s,event.choices[2]),'');
  const result=E.choose(s,2);assert.equal(result.outcome,'normal');assert.equal(result.chance,null);assert.equal(s.week,2);
}));

test('seeded checks retain success and failure outcomes across saving and reloading',()=>withEvent({
  id:'test-seeded-check',title:'技能检定',choices:[{
    effects:{money:-30,mood:4},check:{stat:'code',difficulty:50,
      success:{result:'成功',effects:{code:8,mood:9}},
      failure:{result:'失败',effects:{code:2,mood:-5,money:-70}}
    }
  }]
},event=>{
  for(const [seed,outcome,code,mood,money]of [[1,'success',58,100,30],[1000,'failure',52,95,0]]){
    const s=pending(event,seed);s.code=50;s.mood=99;s.money=60;
    const loaded=E.validate(JSON.parse(JSON.stringify(s)));
    const result=E.choose(s,0),reloadedResult=E.choose(loaded,0);
    assert.equal(result.outcome,outcome);assert.equal(result.chance,.55);
    assert.equal(s.code,code);assert.equal(s.mood,mood);assert.equal(s.money,money);
    assert.equal(result.effects.code,code-50);assert.equal(result.effects.mood,mood-99);assert.equal(result.effects.money,money-60);
    assert.deepEqual(s.lastEvent,result);assert.deepEqual(reloadedResult,result);assert.deepEqual(loaded,s);
    assert.deepEqual(E.validate(JSON.parse(JSON.stringify(s))),s);
  }
}));

test('a check uses attributes before the choice awards its base effects',()=>withEvent({
  id:'test-check-before-effects',title:'先检定再获得奖励',choices:[{
    effects:{code:100},check:{stat:'code',difficulty:50,
      success:{result:'成功',effects:{research:10}},failure:{result:'失败',effects:{research:2}}
    }
  }]
},event=>{
  const s=pending(event,1000);s.code=0;
  const expected=E.checkChance(s,event.choices[0].check),result=E.choose(s,0);
  assert.equal(result.chance,expected);assert.equal(result.outcome,'failure');
  assert.equal(s.code,100);assert.equal(s.research,2);
}));

test('every real event has a free unconditional option for a character with no resources',()=>{
  const s=E.create({talents:[],seed:42});
  for(const stat of ['code','theory','algorithm','research','social','health','mood','money'])s[stat]=0;
  for(const event of D.events){
    if(event.storyOnly){const def=D.stories.find(story=>story.id===event.storyId);s.stories[def.id]={status:'active',progress:0,startedWeek:1,dueWeek:1+def.duration,resolvedWeek:null,ending:''};}
    const safe=event.choices.find(c=>!c.check&&!c.require&&!c.requireStoryComplete&&(c.effects?.money||0)>=0&&!E.choiceError(s,c));
    assert.ok(safe,`${event.id} needs a safe option`);assert.equal(E.choiceError(s,safe),'',event.id);
  }
});

test('version-one saves without summaries preserve original stats on every load',()=>{
  const old=fresh();old.code=17;old.theory=31;old.health=54;old.money=777;delete old.lastEvent;delete old.lastWeek;
  const loaded=E.validate(JSON.parse(JSON.stringify(old)));
  assert.equal(loaded.lastEvent,null);assert.equal(loaded.lastWeek,null);
  for(const [key,value]of Object.entries(old))assert.deepEqual(loaded[key],value,key);
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(loaded))),loaded);
  const starter=D.talents.find(t=>t.start&&Object.keys(t.start).length);
  const selected=E.create({talents:[starter.id],seed:42});
  assert.deepEqual(E.validate(JSON.parse(JSON.stringify(selected))),selected,'reloading must not award start bonuses twice');
});
test('initial profile and talent validation',()=>{const s=fresh();assert.equal(s.mood,85);assert.equal(s.semester,1);assert.equal(s.phase,'planning');assert.deepEqual(E.validate(s),s);const bad=E.create({talents:['fake','logic','logic','healthy','social']});assert.deepEqual(bad.talents,['logic','healthy']);});
test('three actions are required and a fourth cannot be added',()=>{const s=fresh();assert.throws(()=>E.advance(s));plan(s,['course','code','rest']);assert.throws(()=>E.addPlan(s,'course'));E.removePlan(s,1);assert.deepEqual(s.plan,['course','rest']);assert.throws(()=>E.removePlan(s,5));});
test('locked routes and budget are enforced by the engine',()=>{const s=fresh();assert.throws(()=>E.addPlan(s,'intern'));assert.throws(()=>E.addPlan(s,'lab'));s.money=0;assert.throws(()=>E.addPlan(s,'social'));E.addPlan(s,'work');E.addPlan(s,'social');assert.equal(s.plan.length,2);});
test('weekly settlement only happens once and event choices advance time',()=>{const s=fresh();plan(s,['course','code','rest']);E.advance(s);assert.equal(s.phase,'event');assert.equal(s.week,1);const before=JSON.stringify(s);assert.throws(()=>E.advance(s));assert.equal(JSON.stringify(s),before);assert.throws(()=>E.choose(s,99));resolve(s);assert.equal(s.week,2);assert.equal(s.phase,'planning');assert.throws(()=>E.choose(s,0));});
test('a saved pending event continues deterministically after reload',()=>{const s=fresh();plan(s,['course','code','rest']);E.advance(s);const loaded=E.validate(JSON.parse(JSON.stringify(s)));resolve(s);resolve(loaded);assert.deepEqual(loaded,s);});
test('unaffordable event options do not alter the state',()=>{const s=fresh();s.phase='event';s.pendingEvent='laptop';s.money=0;const before=JSON.stringify(s);assert.throws(()=>E.choose(s,0));assert.equal(JSON.stringify(s),before);E.choose(s,1);assert.equal(s.week,2);});
test('four weeks create one report, and a new term resets course study',()=>{const s=fresh();for(let i=0;i<4;i++){plan(s,['course','course','rest']);E.advance(s);resolve(s);}assert.equal(s.phase,'report');assert.equal(s.grades.length,1);assert.equal(s.credits,20);assert.ok(s.report.gpa>=3.8);assert.ok(s.achievements.includes('scholar'));E.continueTerm(s);assert.equal(s.semester,2);assert.equal(s.study,0);assert.equal(s.week,1);assert.equal(s.phase,'planning');assert.throws(()=>E.continueTerm(s));});
test('failed courses can be repaired once with credits restored',()=>{const s=fresh();for(let i=0;i<4;i++){plan(s,['rest','rest','rest']);E.advance(s);resolve(s);}assert.equal(s.failed,1);assert.equal(s.credits,12);E.continueTerm(s);E.addPlan(s,'retake');assert.throws(()=>E.addPlan(s,'retake'));plan(s,['rest','rest']);E.advance(s);assert.equal(s.failed,0);assert.equal(s.credits,20);assert.equal(s.grades[0].gpa,2);});
test('project, paper and internship milestones are earned at thresholds',()=>{const s=fresh();s.semester=5;s.code=50;s.theory=50;s.projects=1;s.projectProgress=90;s.paperProgress=90;plan(s,['project','lab','intern']);E.advance(s);assert.equal(s.projects,2);assert.equal(s.papers,1);assert.equal(s.internSteps,1);assert.ok(s.projectProgress<100);assert.ok(s.achievements.includes('project'));resolve(s);plan(s,['intern','rest','rest']);E.advance(s);assert.ok(s.achievements.includes('intern'));});
test('invalid and inconsistent saves are rejected',()=>{for(const mutate of [s=>s.health=NaN,s=>s.semester=9,s=>s.name='a'.repeat(17),s=>s.plan=['bad'],s=>s.phase='missing',s=>s.grades=[{semester:1,gpa:4,repaired:false}],s=>s.talents=['logic','logic'],s=>s.phase='report',s=>s.credits=-1]){const s=fresh();mutate(s);assert.throws(()=>E.validate(s));}assert.throws(()=>E.validate(null));});
test('complete four-year simulations keep valid state at every transition',()=>{
  const outcomes={};
  for(let seed=1;seed<=100;seed++){
    const s=E.create({name:'测试同学',background:'ordinary',talents:E.drawTalents(Math.imul(seed,2654435761)>>>0).slice(0,2),seed});
    for(let n=0;n<32;n++){
      let ids=['course'];
      if(s.week===1)ids.push('course');
      if(s.semester>=7&&s.thesis<100)ids.push('thesis');
      while(ids.length<3){if(s.health<55||s.mood<55)ids.push('rest');else if(s.code<35)ids.push('code');else ids.push(n%3===0?'social':'project');}
      plan(s,ids);E.advance(s);E.validate(s);resolve(s);E.validate(s);
      if(s.phase==='report'){
        const forecast=E.semesterForecast(s);
        assert.ok(s.report.gpa>=forecast.min-.01&&s.report.gpa<=forecast.max+.01,`GPA ${s.report.gpa} outside ${forecast.min}..${forecast.max}`);
        assert.ok(forecast.min>=0&&forecast.max<=4&&forecast.min<=forecast.max);
        E.continueTerm(s);E.validate(s);
      }
    }
    assert.equal(s.phase,'ending');assert.equal(s.weeksPlayed,32);assert.equal(s.grades.length,8);assert.equal(s.thesis,100);assert.equal(s.failed,0);assert.ok(s.credits>=152);assert.notEqual(s.ending.id,'delayed');outcomes[s.ending.id]=(outcomes[s.ending.id]||0)+1;
  }
  console.log('100 completed games:',JSON.stringify(outcomes));
});
test('all eleven ending branches have reachable conditions',()=>{
  const base={...fresh(),semester:8,week:4,phase:'ending',credits:160,thesis:100,grades:Array.from({length:8},(_,i)=>({semester:i+1,gpa:2.8,repaired:false})),health:50,mood:50};
  const cases=[['delayed',{thesis:99}],['researcher',{research:75,papers:2,grades:base.grades.map(g=>({...g,gpa:3.8}))}],['algorithm',{algorithm:85,awards:2,internSteps:2}],['engineer',{code:80,projects:3,internSteps:4}],['indie',{projects:4,social:60}],['graduate',{theory:80,grades:base.grades.map(g=>({...g,gpa:3.3}))}],['assistant',{research:60,papers:1}],['product',{social:75,projects:1}],['developer',{code:50,projects:1}],['balanced',{health:80,mood:80,social:55}],['explorer',{}]];
  for(const [id,overrides]of cases)assert.equal(E.getEnding({...base,...overrides}).id,id);
});

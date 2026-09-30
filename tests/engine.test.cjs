const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const D=require('../data.js');
const fresh=(seed=42)=>E.create({name:'测试同学',background:'ordinary',talents:['academic','healthy'],seed});
const plan=(s,ids)=>ids.forEach(id=>E.addPlan(s,id));
const resolve=s=>{const event=D.events.find(e=>e.id===s.pendingEvent);const choices=event.choices.map((choice,index)=>({choice,index})).filter(({choice})=>!E.choiceError(s,choice));const safe=choices.find(({choice})=>!choice.check);assert.ok(safe||choices[0],`${event.id} must have an available choice`);return E.choose(s,(safe||choices[0]).index);};
const withEvent=(event,run)=>{D.events.push(event);try{return run(event);}finally{D.events.pop();}};
const pending=(event,seed=42)=>{const s=E.create({background:'ordinary',talents:[],seed});s.phase='event';s.pendingEvent=event.id;return s;};

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
  assert.deepEqual(new Set(reused.map(({event})=>event.id)),new Set(eligible.map(e=>e.id)));
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
    const safe=event.choices.find(c=>!c.check&&!c.require&&(c.effects?.money||0)>=0);
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

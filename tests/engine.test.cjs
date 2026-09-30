const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../engine.js');
const D=require('../data.js');
const fresh=(seed=42)=>E.create({name:'测试同学',background:'ordinary',talents:['academic','healthy'],seed});
const plan=(s,ids)=>ids.forEach(id=>E.addPlan(s,id));
const resolve=s=>{const event=D.events.find(e=>e.id===s.pendingEvent);E.choose(s,event.choices.findIndex(c=>s.money+(c.effects.money||0)>=0));};
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
    const s=fresh(seed);
    for(let n=0;n<32;n++){
      let ids=['course'];
      if(s.week===1)ids.push('course');
      if(s.semester>=7&&s.thesis<100)ids.push('thesis');
      while(ids.length<3){if(s.health<55||s.mood<55)ids.push('rest');else if(s.code<35)ids.push('code');else ids.push(n%3===0?'social':'project');}
      plan(s,ids);E.advance(s);E.validate(s);resolve(s);E.validate(s);
      if(s.phase==='report'){E.continueTerm(s);E.validate(s);}
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

(function (root) {
  'use strict';
  const D = root.CS_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  const stats = ['code','theory','algorithm','research','social','health','mood'];
  const labels = {code:'编程',theory:'理论',algorithm:'算法',research:'科研',social:'人脉',health:'健康',mood:'心态',money:'生活费',study:'课程掌握',thesis:'毕业设计',projectProgress:'项目进度',paperProgress:'论文进度',projects:'完成项目',papers:'科研成果',awards:'竞赛获奖',internSteps:'实习进度'};
  const clamp = (n,a=0,b=100) => Math.min(b,Math.max(a,n));
  const clone = s => JSON.parse(JSON.stringify(s));
  const growthSnapshot = s => ({...Object.fromEntries(Object.keys(labels).map(k=>[k,s[k]])),projectProgress:s.projects*100+s.projectProgress,paperProgress:s.papers*100+s.paperProgress});
  const growthChanges = (before,after) => Object.fromEntries(Object.keys(labels).map(k=>[k,after[k]-before[k]]).filter(([,v])=>v!==0));
  function random(s) { s.seed = (Math.imul(s.seed,1664525)+1013904223)>>>0; return s.seed/4294967296; }
  function drawTalents(seed,count=8) {
    if(!Number.isInteger(seed)||!Number.isInteger(count)||count<1||count>D.talents.length)throw Error('无效的天赋抽取参数');
    const rng={seed:seed>>>0},pool=[...D.talents],draw=[];
    const weights={common:6,uncommon:3,rare:1};
    while(draw.length<count){
      const total=pool.reduce((n,t)=>n+(weights[t.rarity]||6),0);
      let roll=random(rng)*total,index=pool.length-1;
      for(let i=0;i<pool.length;i++){roll-=weights[pool[i].rarity]||6;if(roll<0){index=i;break;}}
      draw.push(pool.splice(index,1)[0].id);
    }
    return draw;
  }
  function chosenTalents(s){return s.talents.map(id=>D.talents.find(t=>t.id===id)).filter(Boolean);}
  function actionEffects(s,a){
    const effects={...a.effects};
    for(const t of chosenTalents(s))for(const[k,v]of Object.entries(t.actions?.[a.id]||{}))effects[k]=(effects[k]||0)+v;
    if(a.id==='course')effects.study=(effects.study||0)+Math.floor(s.theory/20);
    if(a.id==='project')effects.projectProgress=(effects.projectProgress||0)+25+Math.floor(clamp(s.code+(effects.code||0))/20)*5;
    if(a.id==='lab')effects.paperProgress=(effects.paperProgress||0)+20+(clamp(s.research+(effects.research||0))>=60?5:0)+Math.floor(s.social/25)*2;
    return effects;
  }
  function actionPreview(s,id){const a=D.actions.find(a=>a.id===id);if(!a)throw Error('未知行动');return actionEffects(s,a);}
  function log(s,text,type='normal') { s.log.unshift({semester:s.semester,week:s.week,text,type}); s.log=s.log.slice(0,200); }
  function create(config={}) {
    const bg = D.backgrounds.find(b=>b.id===config.background) || D.backgrounds[0];
    const talents = [...new Set(config.talents||[])].filter(t=>D.talents.some(x=>x.id===t)).slice(0,2);
    const s = {version:D.version,name:String(config.name||'新同学').trim().slice(0,16)||'新同学',background:bg.id,talents,
      seed:(Number.isInteger(config.seed)?config.seed:Date.now())>>>0,semester:1,week:1,phase:'planning',plan:[],
      code:8,theory:8,algorithm:5,research:0,social:10,health:85,mood:80,money:bg.money,
      study:0,thesis:0,projectProgress:0,paperProgress:0,projects:0,papers:0,awards:0,internSteps:0,
      credits:0,failed:0,grades:[],achievements:[],seen:[],log:[],pendingEvent:null,lastEvent:null,lastWeek:null,report:null,ending:null,weeksPlayed:0};
    apply(s,bg.bonus);
    for(const t of chosenTalents(s))apply(s,t.start);
    log(s,'拿到录取通知书，搬进四人寝。你好，计算机科学与技术。','milestone');
    log(s,'本周安排 3 项行动，再点击「开始这一周」。每学期用 4 个关键周推进。');
    return s;
  }
  function gpa(s) {return s.grades.length ? s.grades.reduce((a,b)=>a+b.gpa,0)/s.grades.length : 0;}
  function semesterForecast(s){
    const parts={course:s.study*.024,theory:s.theory*.008,code:s.code*.003,base:1.2-s.semester*.06};
    const total=parts.course+parts.theory+parts.code+parts.base;
    return {...parts,min:Number(clamp(total-.11,0,4).toFixed(2)),max:Number(clamp(total+.11,0,4).toFixed(2))};
  }
  function apply(s,effects) {
    for(const [key,value] of Object.entries(effects||{})) {
      if(stats.includes(key)||key==='thesis') s[key]=clamp(s[key]+value);
      else if(['money','study','projectProgress','paperProgress'].includes(key)) s[key]=Math.max(0,s[key]+value);
    }
  }
  function locked(s,a) {
    if(!a) return '未知行动';
    const r=a.require||{};
    if(r.semester && s.semester<r.semester) return `第 ${r.semester} 学期开启`;
    if(r.failed && s.failed<r.failed) return '没有需要补考的课程';
    if(r.projects && s.projects<r.projects) return '需要完成 1 个项目';
    for(const k of stats) if(r[k] && s[k]<r[k]) return `需要${labels[k]} ${r[k]}`;
    if(a.id==='thesis' && s.thesis>=100) return '毕业设计已完成';
    return '';
  }
  function planError(s,id) {
    if(s.phase!=='planning') return '请先处理当前事件';
    if(s.plan.length>=3) return '本周计划已排满，可点选计划取消';
    const a=D.actions.find(x=>x.id===id), reason=locked(s,a);
    if(reason) return reason;
    if(id==='retake' && s.plan.filter(x=>x===id).length>=s.failed) return '补考已安排';
    const budget=s.money+s.plan.reduce((v,p)=>v+(actionEffects(s,D.actions.find(x=>x.id===p)).money||0),0);
    if(budget+(actionEffects(s,a).money||0)<0) return '生活费不足，先安排兼职';
    return '';
  }
  function addPlan(s,id) {const reason=planError(s,id); if(reason) throw Error(reason); s.plan.push(id);}
  function removePlan(s,index) {if(s.phase!=='planning') throw Error('当前不能调整计划'); if(!Number.isInteger(index)||index<0||index>=s.plan.length) throw Error('无效计划');s.plan.splice(index,1);}
  function unlock(s,id) {if(!s.achievements.includes(id)){s.achievements.push(id);const a=D.achievements.find(a=>a.id===id);log(s,`解锁成就「${a.name}」`,'achievement');}}
  function milestones(s) {
    while(s.projectProgress>=100) {s.projectProgress-=100;s.projects++;apply(s,{mood:8,code:4});log(s,`第 ${s.projects} 个个人项目发布了！终于有人能用上你的代码。`,'milestone');}
    while(s.paperProgress>=100) {s.paperProgress-=100;s.papers++;apply(s,{mood:8,research:5});log(s,'一项科研成果完成了：实验、复现和写作，终于连成了一条线。','milestone');}
    if(s.projects>=1) unlock(s,'project'); if(s.projects>=4) unlock(s,'maker');
    if(s.papers>=1) unlock(s,'paper'); if(s.awards>=1) unlock(s,'award');
    if(s.internSteps>=2) unlock(s,'intern'); if(s.social>=70) unlock(s,'friends');
  }
  function action(s,id) {
    const a=D.actions.find(x=>x.id===id),reason=locked(s,a);
    const e=actionEffects(s,a);
    if(reason || s.money+(e.money||0)<0) {log(s,`${a.name}未能进行：${reason||'生活费不足'}，改为好好休息。`);apply(s,{health:12,mood:18});return;}
    apply(s,e);
    if(id==='intern') {s.internSteps++;if(s.internSteps%2===0)log(s,`完成第 ${s.internSteps/2} 段实习，简历里多了一段真实的经历。`,'milestone');}
    if(id==='contest') {
      const chance=clamp(.10+s.algorithm*.007+s.social*.001+chosenTalents(s).reduce((n,t)=>n+(t.contestBonus||0),0),0,.9);
      if(random(s)<chance){s.awards++;apply(s,{money:300,mood:10});log(s,'比赛获奖了！队友的欢呼声，比 Accepted 还好听。奖金 ¥300。','milestone');}
      else {apply(s,{algorithm:3});log(s,'比赛没能获奖，但赛后补题让算法再提升了 3 点。');}
    }
    if(id==='retake') {s.failed--;s.credits+=8;const grade=s.grades.find(g=>g.gpa<2&&!g.repaired);if(grade){grade.repaired=true;grade.gpa=2;}log(s,'补考通过，补回了 8 学分。');}
    log(s,`${a.name} · ${Object.entries(e).map(([k,v])=>`${labels[k]} ${v>0?'+':''}${v}`).join('，')}`);
    milestones(s);
  }
  function eventWeight(s,event){
    if(s.semester<(event.min||1)||s.semester>(event.max||8))return 0;
    for(const r of event.requires||[]){if(!Number.isFinite(s[r.stat])||(r.min!==undefined&&s[r.stat]<r.min)||(r.max!==undefined&&s[r.stat]>r.max))return 0;}
    let weight=event.weight??1;
    const caps={money:2000,semester:8,projects:5,papers:3,awards:5,internSteps:6};
    for(const b of event.bias||[]){const value=clamp((s[b.stat]||0)/(caps[b.stat]||100),0,1);weight*=1+(b.direction==='low'?1-value:value)*b.factor;}
    return Math.max(0,weight);
  }
  function eventPool(s){
    const eligible=D.events.map(event=>({event,weight:eventWeight(s,event)})).filter(x=>x.weight>0);
    const fresh=eligible.filter(x=>!s.seen.includes(x.event.id));
    return fresh.length?fresh:eligible;
  }
  function choiceError(s,choice){
    if(!choice)return '无效的事件选项';
    for(const[k,min]of Object.entries(choice.require||{}))if(!Number.isFinite(s[k])||s[k]<min)return `需要${labels[k]||k} ${min}`;
    if(s.money+(choice.effects?.money||0)<0)return '生活费不足';
    return '';
  }
  function checkChance(s,check){
    if(!check||!stats.includes(check.stat)||!Number.isFinite(check.difficulty))throw Error('无效的属性检定');
    const bonus=chosenTalents(s).reduce((n,t)=>n+(t.checkBonuses?.[check.stat]||0),0);
    return clamp(.55+(s[check.stat]-check.difficulty)*.008+bonus,.10,.95);
  }
  function advance(s) {
    if(s.phase!=='planning'||s.plan.length!==3) throw Error('请先安排 3 项行动');
    const before=growthSnapshot(s);
    const plan=[...s.plan];s.plan=[];
    for(const id of plan) action(s,id);
    const bg=D.backgrounds.find(b=>b.id===s.background);
    const expense=Math.max(0,180-chosenTalents(s).reduce((n,t)=>n+(t.expenseDiscount||0),0));
    apply(s,{money:bg.income-expense});
    for(const t of chosenTalents(s))apply(s,t.weekly);
    log(s,`本周生活费 +¥${bg.income}，日常开销 −¥${expense}。`);
    if(s.health<15 || s.mood<15) {
      apply(s,{health:25,mood:25,money:-Math.min(s.money,150)});
      log(s,'身体和情绪亮起红灯。你暂停额外安排，接受帮助并休整了一段时间（支出最多 ¥150）。下周记得留出休息。','warning');
    }
    s.lastWeek={semester:s.semester,week:s.week,effects:growthChanges(before,growthSnapshot(s))};
    s.weeksPlayed++;
    const pool=eventPool(s);
    let roll=random(s)*pool.reduce((n,e)=>n+e.weight,0),ev=pool[pool.length-1].event;
    for(const item of pool){roll-=item.weight;if(roll<0){ev=item.event;break;}}
    s.pendingEvent=ev.id;if(!s.seen.includes(ev.id))s.seen.push(ev.id);s.phase='event';
  }
  function choose(s,index) {
    if(s.phase!=='event') throw Error('当前没有待处理的事件');
    const event=D.events.find(e=>e.id===s.pendingEvent),c=event?.choices[index];
    if(!Number.isInteger(index)||!c) throw Error('无效的事件选项');
    const reason=choiceError(s,c);if(reason)throw Error(reason);
    const chance=c.check?checkChance(s,c.check):null;
    const outcome=c.check?(random(s)<chance?'success':'failure'):'normal';
    const branch=c.check?c.check[outcome]:c;
    const before=growthSnapshot(s);
    apply(s,c.effects);
    if(c.check)apply(s,branch.effects);
    milestones(s);
    const effects=growthChanges(before,growthSnapshot(s));
    const result={title:event.title,result:branch.result,outcome,effects,chance};
    s.lastEvent=result;
    log(s,`${event.title}${outcome==='normal'?'':outcome==='success'?'【检定成功】':'【检定未达成】'}：${branch.result}${Object.keys(effects).length?'（'+effectsText(effects)+'）':''}`,'event');s.pendingEvent=null;
    if(s.week===4) semesterEnd(s);else{s.week++;s.phase='planning';}
    return result;
  }
  function semesterEnd(s) {
    const forecast=semesterForecast(s);
    const score=Number(clamp(forecast.base+forecast.course+forecast.theory+forecast.code+(random(s)-.5)*.22,0,4).toFixed(2));
    const passed=score>=2;
    s.credits+=passed?20:12;if(!passed)s.failed++;
    s.grades.push({semester:s.semester,gpa:score,repaired:false});
    const scholarship=score>=3.6?600:score>=3.2?300:0;
    if(scholarship)apply(s,{money:scholarship});
    s.report={semester:s.semester,gpa:score,credits:passed?20:12,scholarship,passed};
    s.phase='report';
    log(s,`第 ${s.semester} 学期结束：绩点 ${score.toFixed(2)}，获得 ${passed?20:12} 学分。${passed?'': '一门课程需要补考。'}`,'milestone');
    if(s.semester===1)unlock(s,'hello');if(score>=3.8)unlock(s,'scholar');
  }
  function continueTerm(s) {
    if(s.phase!=='report') throw Error('当前没有学期报告');
    s.report=null;
    if(s.semester===8){s.phase='ending';s.ending=getEnding(s);if(s.ending.id!=='delayed'){unlock(s,'graduate');if(s.health>=80&&s.mood>=80)unlock(s,'balance');}log(s,`大学篇结束 · ${s.ending.title}`,'milestone');return;}
    s.semester++;s.week=1;s.study=0;s.phase='planning';apply(s,{health:12,mood:10});
    log(s,`假期结束，进入第 ${s.semester} 学期。假期休整：健康 +12，心态 +10。`,'milestone');
  }
  function getEnding(s) {
    const grade=gpa(s),interns=Math.floor(s.internSteps/2);
    if(s.credits<152||s.thesis<100)return {id:'delayed',title:'下一站，继续出发',label:'延期毕业',desc:`${s.credits<152?'学分尚未达到 152。':''}${s.thesis<100?'毕业设计还没有完成。':''}你决定补齐这些未完成的事。晚一点抵达，也依然是在往前走。`,advice:'下次在每学期安排 4–5 次认真上课，挂科后及时补考，并在大四安排 4 次毕业设计。'};
    if(grade>=3.5&&s.research>=70&&s.papers>=2)return {id:'researcher',title:'把好奇心带去更远的地方',label:'直博深造',desc:'扎实的成绩和两项科研成果，为你打开了继续研究的大门。你知道研究未必顺利，但仍愿意追问那个没有答案的问题。',advice:'这不是终点，是一份更长的阅读清单。'};
    if(s.algorithm>=80&&s.awards>=2&&interns>=1)return {id:'algorithm',title:'下一题，真实世界',label:'算法工程师',desc:'从比赛现场到真实业务，你带着算法功底和实习经历开始了第一份工作。新的题目没有标准输入，但值得认真求解。',advice:'希望你一直保有，第一次看到 Accepted 时的开心。'};
    if(s.code>=75&&s.projects>=3&&interns>=2)return {id:'engineer',title:'让代码在真实世界运行',label:'软件工程师',desc:'完整项目和扎实的实习经历，让你拿到了心仪的研发岗位。你已经学会：好的代码除了能运行，还要有人看得懂。',advice:'新的工位，新的仓库。记得按时下班，也按时吃饭。'};
    if(s.projects>=4&&s.social>=55)return {id:'indie',title:'自己的想法，自己实现',label:'独立开发者',desc:'你已经做出几个有人使用的小产品，也学会了倾听反馈。毕业后，你给自己一段时间，认真试试把想法变成事业。',advice:'没有一夜成名的保证，但你有了从零到一的能力。'};
    if(grade>=3.1&&s.theory>=75)return {id:'graduate',title:'再给热爱一点时间',label:'研究生录取',desc:'你带着系统的专业基础，收到了继续深造的录取通知。校园里的路还会延伸，而你比刚入学时更清楚自己想学什么。',advice:'把基础打牢的人，总有再出发的底气。'};
    if(s.research>=55&&s.papers>=1)return {id:'assistant',title:'实验室的灯，仍为你亮着',label:'科研助理',desc:'你选择先在研究团队里积累经验。提出问题、验证想法、诚实记录，这些大学里学到的习惯会陪你继续走下去。',advice:'不急着给未来定型，先把眼前的问题做好。'};
    if(s.social>=70&&s.projects>=1)return {id:'product',title:'在代码与人之间搭一座桥',label:'技术产品经理',desc:'懂技术，也愿意听人说话。你把项目经历和沟通能力带进了产品岗位，开始学习如何让一个团队把真正需要的东西做出来。',advice:'技术的另一端，总是具体的人。'};
    if(s.code>=45&&s.projects>=1)return {id:'developer',title:'第一个正式的开发岗位',label:'开发工程师',desc:'你加入了一个认真做产品的团队。还有许多要学，但那个初入校园的自己，大概会对现在的你感到放心。',advice:'慢慢成长，持续交付，也好好生活。'};
    if(s.health>=70&&s.mood>=70&&s.social>=50)return {id:'balanced',title:'人生不止一个最优解',label:'自在毕业生',desc:'你完成了学业，拥有健康、朋友和属于自己的节奏。接下来想去哪里，你愿意慢慢寻找答案。',advice:'能把普通的日子过好，也是一种很珍贵的能力。'};
    return {id:'explorer',title:'毕业快乐，未来待定',label:'继续探索',desc:'你还没决定下一站，但四年并没有白过。那些学会的东西、犯过的错、认识的人，都已经成为你的一部分。',advice:'人生没有统一的验收测试。带上自己的节奏，继续走。'};
  }
  function effectsText(e) {return Object.entries(e).map(([k,v])=>`${labels[k]} ${v>0?'+':''}${v}`).join(' · ');}
  function validate(input) {
    const s=input;
    if(!s||typeof s!=='object'||Array.isArray(s)||s.version!==1)throw Error('无法识别此存档版本');
    if(typeof s.name!=='string'||s.name.length>16||!D.backgrounds.some(b=>b.id===s.background))throw Error('角色数据不完整');
    if(!Array.isArray(s.talents)||s.talents.length>2||new Set(s.talents).size!==s.talents.length||s.talents.some(id=>!D.talents.some(t=>t.id===id)))throw Error('天赋数据无效');
    const ranges={semester:[1,8],week:[1,4],seed:[0,4294967295],money:[0,1000000],study:[0,10000],thesis:[0,100],projectProgress:[0,99],paperProgress:[0,99],projects:[0,200],papers:[0,200],awards:[0,100],internSteps:[0,100],credits:[0,160],failed:[0,8],weeksPlayed:[0,32]};
    for(const k of stats) ranges[k]=[0,100];
    for(const[k,[min,max]]of Object.entries(ranges))if(!Number.isFinite(s[k])||s[k]<min||s[k]>max||!Number.isInteger(s[k]))throw Error('存档数值无效：'+k);
    if(!['planning','event','report','ending'].includes(s.phase))throw Error('存档阶段无效');
    if(!Array.isArray(s.plan)||s.plan.length>3||s.plan.some(id=>!D.actions.some(a=>a.id===id)))throw Error('行动计划无效');
    if(!Array.isArray(s.grades)||s.grades.length>8||s.grades.some(g=>!g||!Number.isFinite(g.gpa)||g.gpa<0||g.gpa>4||!Number.isInteger(g.semester)||g.semester<1||g.semester>8||typeof g.repaired!=='boolean'))throw Error('成绩记录无效');
    const completed=s.phase==='report'||s.phase==='ending'?s.semester:s.semester-1;
    if(s.grades.length!==completed||s.grades.some((g,i)=>g.semester!==i+1))throw Error('学期记录不一致');
    if(!Array.isArray(s.log)||s.log.length>200||s.log.some(l=>!l||typeof l.text!=='string'||l.text.length>2000||!Number.isInteger(l.semester)||l.semester<1||l.semester>8||!Number.isInteger(l.week)||l.week<1||l.week>4))throw Error('日志数据无效');
    if(!Array.isArray(s.achievements)||s.achievements.some(id=>!D.achievements.some(a=>a.id===id)))throw Error('成就数据无效');
    if(!Array.isArray(s.seen)||s.seen.length>D.events.length||s.seen.some(id=>!D.events.some(e=>e.id===id)))throw Error('事件数据无效');
    if(s.phase==='event'&&!D.events.some(e=>e.id===s.pendingEvent))throw Error('待处理事件无效');
    if(s.lastEvent!==undefined&&s.lastEvent!==null){const e=s.lastEvent;if(typeof e.title!=='string'||e.title.length>200||typeof e.result!=='string'||e.result.length>2000||!['success','failure','normal'].includes(e.outcome)||!e.effects||typeof e.effects!=='object'||Array.isArray(e.effects)||Object.entries(e.effects).some(([k,v])=>!Object.hasOwn(labels,k)||!Number.isFinite(v)||Math.abs(v)>1000000)||(e.chance!==null&&(!Number.isFinite(e.chance)||e.chance<.1||e.chance>.95)))throw Error('事件结果无效');}
    if(s.lastWeek!==undefined&&s.lastWeek!==null){const w=s.lastWeek;if(!Number.isInteger(w.semester)||w.semester<1||w.semester>8||!Number.isInteger(w.week)||w.week<1||w.week>4||!w.effects||typeof w.effects!=='object'||Array.isArray(w.effects)||Object.entries(w.effects).some(([k,v])=>!Object.hasOwn(labels,k)||!Number.isFinite(v)||Math.abs(v)>1000000))throw Error('每周成长记录无效');}
    if(s.phase==='report'&&(!s.report||s.week!==4||s.report.semester!==s.semester||!Number.isFinite(s.report.gpa)||s.report.gpa<0||s.report.gpa>4||![12,20].includes(s.report.credits)||![0,300,600].includes(s.report.scholarship)||typeof s.report.passed!=='boolean'))throw Error('学期报告无效');
    if(s.phase==='ending'&&(s.semester!==8||s.week!==4))throw Error('毕业数据无效');
    const clean=create({name:s.name,background:s.background,talents:s.talents,seed:s.seed});
    for(const k of Object.keys(clean))if(Object.prototype.hasOwnProperty.call(s,k))clean[k]=clone(s[k]);
    if(s.phase==='ending')clean.ending=getEnding(clean);
    return clean;
  }
  const E={create,drawTalents,gpa,semesterForecast,actionPreview,locked,planError,addPlan,removePlan,advance,choose,continueTerm,getEnding,effectsText,eventWeight,eventPool,choiceError,checkChance,validate,clone,labels};
  root.CS_ENGINE=E;if(typeof module!=='undefined')module.exports=E;
})(typeof globalThis!=='undefined'?globalThis:window);

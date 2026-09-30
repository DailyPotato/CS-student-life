(function (root) {
  'use strict';
  const D = {
    version: 1,
    backgrounds: [
      { id:'ordinary', name:'普通家庭', desc:'每周生活费 ¥260；心态 +5', income:260, money:1200, bonus:{mood:5} },
      { id:'scholar', name:'书香门第', desc:'每周生活费 ¥220；理论 +8', income:220, money:1000, bonus:{theory:8} },
      { id:'independent', name:'自立自强', desc:'每周生活费 ¥180；编程 +8', income:180, money:800, bonus:{code:8} }
    ],
    talents: [
      {id:'logic',name:'逻辑直觉',desc:'算法训练额外 +3 算法',icon:'code'},
      {id:'builder',name:'动手达人',desc:'项目开发进度额外 +10',icon:'box'},
      {id:'academic',name:'学术好奇心',desc:'课程额外 +3 理论，科研额外 +3 科研',icon:'book'},
      {id:'social',name:'社交充电',desc:'社团活动额外 +5 心态、+3 人脉',icon:'users'},
      {id:'healthy',name:'运动习惯',desc:'每周结算额外恢复 4 健康',icon:'heart'},
      {id:'thrifty',name:'生活小能手',desc:'每周生活开销从 ¥180 降至 ¥110',icon:'coffee'}
    ],
    terms: [
      {name:'Hello, World!',subtitle:'新的校园，新的光标。你的人生程序，开始运行。',courses:['程序设计基础','高等数学','计算机导论'],tip:'先打好基础。编程达到 15 后，可以动手开发自己的项目。'},
      {name:'指针指向未来',subtitle:'终于看懂了指针，却开始看不懂自己的作息。',courses:['数据结构','线性代数','离散数学'],tip:'算法与项目各有用处。记得给期末考试留一些时间。'},
      {name:'走出新手村',subtitle:'社团招新、竞赛组队，大学开始有了自己的形状。',courses:['计算机组成原理','面向对象程序设计','概率论'],tip:'大二可以参加竞赛、进入实验室。能力积累会提高成功率。'},
      {name:'世界不止一个进程',subtitle:'在操作系统与深夜食堂之间，寻找调度的最优解。',courses:['操作系统','数据库原理','计算机网络'],tip:'做出完整项目，比一直新建文件夹更有用。'},
      {name:'第一次走进职场',subtitle:'简历上终于有了东西。“熟悉”两个字，也写得谨慎了。',courses:['软件工程','算法设计与分析','编译原理'],tip:'实习需要编程 40 和一个完整项目。每两次实习行动记为一段经历。'},
      {name:'向左，还是向右',subtitle:'读研、工作、做自己的产品。你开始认真考虑下一站。',courses:['人工智能导论','分布式系统','信息安全'],tip:'科研成果、竞赛奖项和实习经历，会打开不同的毕业道路。'},
      {name:'把未来写进简历',subtitle:'秋招邮件和毕业设计一起到来，这次真的不能拖到明天。',courses:['专业实践','毕业设计开题','就业指导'],tip:'毕业设计进度须达到 100%。完成课程也很重要。'},
      {name:'最后一次 git commit',subtitle:'校园里的每一条路都走熟了，而人生还没有标准答案。',courses:['毕业论文','毕业答辩','综合实践'],tip:'毕业要求：学分至少 152、毕业设计完成。所有经历都算数。'}
    ],
    actions: [
      {id:'course',name:'认真上课',desc:'把课听懂，也把笔记补齐。',category:'学习',icon:'book',effects:{theory:5,study:15,health:-3,mood:-3},hint:'理论 +5 · 课程 +15'},
      {id:'code',name:'编程练习',desc:'从跑得动，到写得明白。',category:'学习',icon:'code',effects:{code:8,theory:1,health:-4,mood:-3},hint:'编程 +8 · 理论 +1'},
      {id:'algorithm',name:'算法刷题',desc:'今天的红色 Wrong Answer，会变绿。',category:'学习',icon:'terminal',effects:{algorithm:8,code:2,health:-5,mood:-5},hint:'算法 +8 · 编程 +2'},
      {id:'project',name:'开发个人项目',desc:'给脑海里的想法一个可用的版本。',category:'成长',icon:'box',effects:{code:4,health:-5,mood:-3},hint:'项目进度 +25 起 · 编程 +4',require:{code:15}},
      {id:'lab',name:'实验室科研',desc:'读论文、做实验，再读一遍论文。',category:'成长',icon:'flask',effects:{research:8,theory:3,health:-5,mood:-5},hint:'科研 +8 · 论文进度 +20',require:{semester:3,theory:25}},
      {id:'contest',name:'参加程序竞赛',desc:'和队友一起，等一个 Accepted。',category:'成长',icon:'trophy',effects:{algorithm:5,social:3,health:-6,mood:-4,money:-100},hint:'算法 +5 · 概率获奖 · ¥100',require:{semester:3,algorithm:25}},
      {id:'intern',name:'企业实习',desc:'第一次在真正的项目里提交代码。',category:'成长',icon:'briefcase',effects:{code:6,social:4,health:-7,mood:-4,money:500},hint:'编程 +6 · 收入 ¥500',require:{semester:5,code:40,projects:1}},
      {id:'thesis',name:'推进毕业设计',desc:'让最后一次答辩更有底气。',category:'学习',icon:'file',effects:{theory:2,code:3,health:-4,mood:-3,thesis:25},hint:'毕设进度 +25 · 大四开放',require:{semester:7}},
      {id:'social',name:'参加社团活动',desc:'合上电脑，去认识一些有趣的人。',category:'生活',icon:'users',effects:{social:9,mood:12,health:2,money:-70},hint:'人脉 +9 · 心态 +12 · ¥70'},
      {id:'exercise',name:'操场夜跑',desc:'让大脑休息，让心跳加速。',category:'生活',icon:'heart',effects:{health:17,mood:7},hint:'健康 +17 · 心态 +7'},
      {id:'rest',name:'好好休息',desc:'睡到自然醒。休息也是正经事。',category:'生活',icon:'coffee',effects:{health:12,mood:18},hint:'健康 +12 · 心态 +18'},
      {id:'work',name:'做校内兼职',desc:'靠自己的双手，补充生活费。',category:'生活',icon:'wallet',effects:{money:350,social:2,health:-6,mood:-4},hint:'收入 ¥350 · 人脉 +2'},
      {id:'retake',name:'准备补考',desc:'把落下的课程，踏踏实实补回来。',category:'学习',icon:'book',effects:{theory:4,health:-4,mood:-2,money:-100},hint:'补过 1 门 · 学分 +8 · ¥100',require:{failed:1}}
    ],
    events: [
      {id:'club',title:'百团大战，人山人海',body:'开源社的学长递来一张传单：“不需要会很多，只要你愿意开始。”旁边的吉他社正在唱你喜欢的歌。',min:1,max:2,icon:'users',choices:[{text:'去开源社坐坐',result:'你在开源社认识了几个同样爱折腾的朋友。',effects:{code:4,social:4}},{text:'加入吉他社',result:'你第一次在代码之外，找到一群合拍的人。',effects:{mood:9,social:5}},{text:'先回宿舍适应一下',result:'你给新生活留了一点缓冲时间。',effects:{health:6,mood:6}}]},
      {id:'environment',title:'环境配了一整晚',body:'教程说“五分钟快速开始”。三个小时后，终端依然红得很有层次。室友问你要不要一起吃夜宵。',icon:'terminal',choices:[{text:'看官方文档，从头排查',result:'终于发现是版本不匹配。你学会了读报错，而不是害怕它。',effects:{code:5,theory:2,health:-5}},{text:'向学长请教',result:'学长用十分钟讲清了依赖关系，还推荐了一本好书。',effects:{code:3,social:4}},{text:'先吃饭，明天再战',result:'第二天醒来，你一眼就发现了那个拼错的路径。',effects:{mood:7,health:5}}]},
      {id:'group',title:'小组作业，只剩你在线',body:'提交截止前一天，群里只有你的消息亮着。有人说电脑坏了，有人发了一个“加油”的表情包。',icon:'users',choices:[{text:'拆分任务，重新明确分工',result:'沟通很费劲，但大家终于交出了各自的一小块。',effects:{social:7,code:3,mood:-3}},{text:'独自把核心功能做完',result:'项目按时交上去了。你决定下次早点确认分工。',effects:{code:7,study:5,health:-8,mood:-5}},{text:'向老师说明实际贡献',result:'老师允许按贡献评分。你的边界也值得被尊重。',effects:{study:5,mood:4}}]},
      {id:'ai',title:'AI 写的代码，真的能交吗',body:'生成的代码看起来很漂亮，但有一个你完全没见过的库。老师说，下周要当场解释实现。',icon:'code',choices:[{text:'逐行理解并补上测试',result:'你修掉了两个虚构接口，真正理解了这个实现。',effects:{code:6,theory:4,health:-3}},{text:'自己重写一个简单版本',result:'功能少了一点，每一行却都能解释清楚。',effects:{code:5,study:6}},{text:'找同学一起做代码审查',result:'你们发现了边界条件漏洞，也学会了互相提问。',effects:{code:4,social:4}}]},
      {id:'rain',title:'突如其来的一场雨',body:'教学楼门口，你和一位不熟的同学一起等雨停。今天没有急着要赶的事。',icon:'coffee',choices:[{text:'一起聊聊最近的生活',result:'从选修课聊到家乡。校园忽然没有那么陌生了。',effects:{social:5,mood:7}},{text:'安静地听一会儿雨',result:'雨声把脑子里没关掉的标签页，一张张合上了。',effects:{mood:10,health:3}}]},
      {id:'bug',title:'这个 bug，居然是个分号',body:'你怀疑过算法、编译器和人生，最后发现只是多写了一个分号。',icon:'terminal',choices:[{text:'写成一篇排错笔记',result:'笔记帮到了几位同学。踩过的坑，也能变成路标。',effects:{code:4,social:3}},{text:'大笑三声，出去走走',result:'天还没黑，食堂还有你喜欢的那道菜。',effects:{mood:9,health:4}}]},
      {id:'talk',title:'一场意外有趣的讲座',body:'本来是来凑素质拓展学分的，教授却把一个复杂问题讲得像侦探故事。',icon:'flask',choices:[{text:'留下来问一个问题',result:'教授认真回答了你的问题，还推荐了入门材料。',effects:{research:5,theory:4}},{text:'和身边的同学交换想法',result:'你们约好了下次一起去听讲座。',effects:{social:5,theory:3}},{text:'整理笔记发给室友',result:'把问题讲给别人听，你也理解得更清楚了。',effects:{theory:5,study:4}}]},
      {id:'hackathon',title:'周末黑客松邀请',body:'朋友想做一个帮助同学找自习室的小工具，问你要不要用一个周末把它做出来。',min:2,icon:'box',choices:[{text:'加入，一起写出原型',result:'功能朴素，但真的有人开始使用了。',effects:{projectProgress:20,code:4,health:-6,mood:5}},{text:'负责调研和界面',result:'你发现“有人需要”比“能写出来”更值得先确认。',effects:{social:7,projectProgress:10}},{text:'这周先休息，下次再来',result:'朋友表示理解，休息计划也顺利完成。',effects:{health:7,mood:6}}]},
      {id:'exam',title:'“老师说，这章不考”',body:'群里流传着一份来历不明的重点清单。你翻开教材，发现被划掉的恰好是最难的一章。',icon:'book',choices:[{text:'按教学大纲认真复习',result:'你把不确定的知识点都过了一遍，心里踏实多了。',effects:{study:12,theory:3,mood:-3}},{text:'组织一次互相讲题',result:'有人补全证明，有人解释直觉。大家都带走了一些东西。',effects:{study:8,social:4}},{text:'先把基础题做熟',result:'基础题比想象中更重要，你稳住了自己的节奏。',effects:{study:7,mood:4}}]},
      {id:'offerhelp',title:'室友的第一道递归题',body:'室友盯着函数调用栈，问你：“它怎么知道什么时候回来？”',icon:'code',choices:[{text:'画一张图，从头讲起',result:'你讲懂了递归，也补上了自己的知识盲区。',effects:{algorithm:4,social:5}},{text:'一起单步调试',result:'看着栈帧一层层弹出，他终于说了一声“原来如此”。',effects:{code:4,algorithm:3}},{text:'推荐材料，约好明天讨论',result:'你保住了今天的休息时间，也没有忘记约定。',effects:{mood:4,social:3}}]},
      {id:'laptop',title:'风扇像要带电脑起飞',body:'项目还没跑完，笔记本就开始降频。维修店说清灰换硅脂要两百块。',icon:'box',choices:[{text:'付钱维护一下',result:'电脑终于安静了下来，你的耳朵也松了口气。',effects:{money:-200,mood:7,code:2}},{text:'看教程，自己清理',result:'小心拆装后，电脑恢复了状态。你还多学了一项技能。',effects:{code:4,health:-3}},{text:'去机房借用设备',result:'机房很凉快，你顺便认识了隔壁座位的同学。',effects:{social:3,mood:3}}]},
      {id:'open-source',title:'你的第一个 Pull Request',body:'常用工具的文档有个小错误。你打开仓库，发现修复它可能并不需要先成为“大佬”。',min:2,icon:'branch',choices:[{text:'提交修复，认真写说明',result:'维护者合并了你的修改，并说了声谢谢。贡献从来没有大小。',effects:{code:5,social:4,mood:6}},{text:'先复现问题，提交 issue',result:'清晰的复现步骤帮助维护者快速定位了问题。',effects:{code:3,theory:3}},{text:'读读其他人的讨论',result:'你看到了一个真实项目如何做取舍。',effects:{theory:4,mood:3}}]},
      {id:'summer',title:'夏天，要不要回家',body:'家里发来一张晚饭照片，说你的房间已经收拾好了。校园也有一份短期助研的机会。',icon:'heart',choices:[{text:'回家住几天',result:'熟悉的饭菜和散步路线，让你重新充满了电。',effects:{mood:12,health:8,money:-100}},{text:'留下来做助研',result:'你第一次完整参与了一轮实验，拿到了小额补助。',effects:{research:5,money:180,health:-4}},{text:'给家里打个长电话',result:'话题从天气一直聊到童年。距离没有把你们推远。',effects:{mood:8,health:3}}]},
      {id:'rejection',title:'投稿系统：Rejected',body:'审稿意见有七条。第一遍读完，你觉得自己什么都不会；第二遍，你发现其中三条真的很有用。',min:3,icon:'file',choices:[{text:'和导师一起修改',result:'你把批评变成了待办清单，实验开始有了新方向。',effects:{research:7,paperProgress:15,mood:-3}},{text:'补做对照实验',result:'结果没有原来那么漂亮，却更扎实了。',effects:{research:6,theory:4,health:-4}},{text:'休息一下再读意见',result:'论文需要修改，但它不是对你整个人的判决。',effects:{mood:9,health:5}}]},
      {id:'team',title:'队友想换赛道',body:'竞赛队友坦白说，比起比赛，他更想试试产品开发。下次比赛报名还没有截止。',min:3,icon:'users',choices:[{text:'尊重选择，重新找队友',result:'你们仍然是朋友，只是接下来想走不同的路。',effects:{social:6,algorithm:3}},{text:'一起试做一个产品',result:'一个新点子在讨论里慢慢成形。',effects:{projectProgress:20,social:4}},{text:'把这段时间用来补课',result:'你终于把落下的那一章看懂了。',effects:{study:10,theory:3}}]},
      {id:'interview',title:'面试官让你反问一个问题',body:'技术问答结束了。面试官说：“你有什么想了解的吗？”你发现这也应该是一次双向选择。',min:5,icon:'briefcase',choices:[{text:'问团队的培养和代码审查',result:'你弄清了新人会如何被带着成长。',effects:{code:3,social:6}},{text:'问岗位内容和工作节奏',result:'你更清楚自己想要怎样的第一份工作。',effects:{social:5,mood:6}},{text:'请对方给一点学习建议',result:'建议很具体，你记下了三个可以继续改进的点。',effects:{algorithm:4,theory:4}}]},
      {id:'production',title:'测试通过，线上没通过',body:'实习项目出现了一个偶发问题。你发现本地环境和测试环境的配置并不相同。',min:5,icon:'terminal',choices:[{text:'及时说明，协助回滚排查',result:'导师肯定了你的及时沟通。修复前，先让系统恢复服务。',effects:{code:6,social:4,mood:-2}},{text:'补充日志与复现用例',result:'问题终于稳定复现了，修复也有了明确的验证方式。',effects:{code:7,theory:3,health:-4}}]},
      {id:'comparison',title:'朋友圈里，人均 offer',body:'有人保研，有人进了大厂。你往下滑了很久，开始怀疑自己的进度。',min:5,icon:'heart',choices:[{text:'整理自己已经做成的事',result:'原来这一年，你也从不会走到了会。',effects:{mood:10}},{text:'请朋友帮忙看看简历',result:'朋友指出了你习以为常、却值得写出来的亮点。',effects:{social:6,mood:5}},{text:'关掉手机，去跑步',result:'跑到第三圈，你不再数别人的里程。',effects:{health:9,mood:6}}]},
      {id:'mentor',title:'导师问：你真正好奇什么',body:'你准备了一堆热门方向，导师却问：“哪一个问题，会让你愿意多想十分钟？”',min:3,icon:'flask',choices:[{text:'说出那个一直困惑的问题',result:'你第一次有了属于自己的研究问题。',effects:{research:7,theory:4}},{text:'先把基础文献读扎实',result:'阅读清单变短了，理解却变深了。',effects:{theory:6,paperProgress:10}},{text:'坦白自己还在探索',result:'不知道答案，也可以是认真思考的起点。',effects:{mood:6,social:4}}]},
      {id:'startup',title:'“我们做个改变世界的 App 吧”',body:'朋友画了三页功能图。你仔细看完，问了一句：“第一个用户在哪里？”',min:4,icon:'box',choices:[{text:'先访谈十位同学',result:'你们删掉了一半功能，留下了最有用的那一个。',effects:{social:7,projectProgress:15}},{text:'做出最小可用版本',result:'两天后，第一个真实用户给出了反馈。',effects:{projectProgress:25,code:4,health:-4}},{text:'建议先参加一次创业分享',result:'听到失败经历，比只听成功故事更有帮助。',effects:{theory:4,social:3}}]},
      {id:'sunset',title:'今天的晚霞很好看',body:'回宿舍的路上，天边像开了一个温柔的滤镜。你停下脚步，发现很多人也在抬头。',icon:'heart',choices:[{text:'拍下来，发给在意的人',result:'“我这里也看到了。”你收到了一张另一座城市的晚霞。',effects:{mood:9,social:3}},{text:'什么也不做，看一会儿',result:'这一刻不需要产出任何东西。',effects:{mood:10,health:3}}]},
      {id:'keyboard',title:'购物车里的机械键盘',body:'你想买的新键盘终于降价了。它不会让代码自动变好，但看起来真的很喜欢。',icon:'wallet',choices:[{text:'预算允许，奖励自己',result:'清脆的键声让这次作业写得格外开心。',effects:{money:-250,mood:12}},{text:'等项目做完再决定',result:'你给自己设了一个小小的里程碑。',effects:{projectProgress:10,mood:4}},{text:'用现有键盘写出点东西',result:'旧键盘也敲得出漂亮的程序。',effects:{code:4,mood:3}}]},
      {id:'scholarship',title:'奖学金申请开始了',body:'辅导员提醒大家整理材料。你翻出过去的成绩和活动记录，才发现很多细节已经记不清。',icon:'file',choices:[{text:'认真整理，按要求申请',result:'清晰的材料帮你争取到了一笔学习补助。',effects:{money:220,study:4}},{text:'帮同学一起核对材料',result:'你们互相补全了遗漏的记录。',effects:{social:6,mood:4}}]},
      {id:'security',title:'仓库里不该出现的密钥',body:'你在提交前检查改动，发现测试用的访问密钥还留在配置文件里。',min:2,icon:'branch',choices:[{text:'撤销密钥，改用环境配置',result:'你补上了忽略规则，并学会了安全地管理配置。',effects:{code:5,theory:4}},{text:'请同学一起检查历史记录',result:'你们确认了暴露范围，并把检查步骤写进项目文档。',effects:{code:4,social:4}}]},
      {id:'defense',title:'第一次模拟答辩',body:'练习时，你在第二页就被问住了。原来“实现了什么”和“为什么这样实现”是两回事。',min:7,icon:'file',choices:[{text:'补充对比实验和设计依据',result:'答辩稿更短了，逻辑却更完整了。',effects:{thesis:15,theory:5}},{text:'请朋友扮演严格评委',result:'被提前问倒，胜过正式答辩时措手不及。',effects:{thesis:10,social:5,mood:3}},{text:'重新梳理最核心的贡献',result:'你终于能用三句话说清自己完成了什么。',effects:{thesis:12,mood:5}}]},
      {id:'farewell',title:'宿舍群里的毕业旅行',body:'大家发来了各自的预算和空闲时间。原来凑齐四个人，也需要认真做一次调度。',min:7,icon:'users',choices:[{text:'安排一次附近的短途旅行',result:'照片里没有人穿学士服，但那也是你们的毕业照。',effects:{money:-180,mood:14,social:6}},{text:'一起去最熟悉的那家餐馆',result:'聊到打烊时，老板又送了你们一盘小菜。',effects:{money:-60,mood:10,social:5}},{text:'把四年的照片整理成相册',result:'很多以为忘了的小事，一页页回到了眼前。',effects:{mood:9,social:4}}]}
    ],
    achievements:[
      {id:'hello',name:'Hello, World!',desc:'完成第一个学期',icon:'terminal'},
      {id:'project',name:'终于能用了',desc:'完成第一个个人项目',icon:'box'},
      {id:'award',name:'Accepted!',desc:'获得一次竞赛奖项',icon:'trophy'},
      {id:'paper',name:'从问题到论文',desc:'完成一项科研成果',icon:'flask'},
      {id:'intern',name:'第一次工牌',desc:'完成一段实习',icon:'briefcase'},
      {id:'friends',name:'有人一起走',desc:'人脉达到 70',icon:'users'},
      {id:'scholar',name:'绩点守护者',desc:'一个学期取得 3.8 以上绩点',icon:'book'},
      {id:'graduate',name:'未完待续',desc:'顺利完成大学学业',icon:'cap'},
      {id:'maker',name:'把想法做出来',desc:'完成 4 个个人项目',icon:'branch'},
      {id:'balance',name:'人生不止代码',desc:'毕业时健康、心态均达到 80',icon:'heart'}
    ]
  };
  root.CS_DATA = D;
  if (typeof module !== 'undefined') module.exports = D;
})(typeof globalThis !== 'undefined' ? globalThis : window);

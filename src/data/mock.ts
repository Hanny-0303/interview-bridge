import type {
  Candidate,
  Competency,
  InterviewCard,
  JobProfile,
  Question,
  QuestionType,
  ResumeClaim,
} from './types'
import { extractClaims } from '../lib/resume'

/* ------------------------------------------------------------------ *
 * 演示数据：10 个部门 / 20 位候选人（全部虚构）
 * 能力维度 = 4 条通用行为维度 + 1 条岗位专属
 * ------------------------------------------------------------------ */

const stamp = (days = 0, hour = 10) => {
  const d = new Date(Date.now() + days * 86400_000)
  d.setHours(hour, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* --------------------------- 通用行为维度 --------------------------- */

interface Template {
  text: string
  observationPoints: string[]
  rationale: string
}

const SHARED: { comp: Competency; core: Template; boundary: Template }[] = [
  {
    comp: {
      id: 'comp_1',
      name: '出事的时候，他在不在场',
      importance: 'core',
      taskIds: [],
      behaviors: ['说得出具体时间和影响范围', '讲的是「我做了什么」，不是「我们」', '失败也讲得清，不绕过去'],
      origin: 'both',
    },
    core: {
      text: '你上一份工作里，有没有遇到过事情突然出岔子、所有人都等着的情况？那次你具体做了什么？',
      observationPoints: [
        '说得出具体时间和影响范围 —— 说明他真的在场',
        '讲的是「我做了什么」，不是「我们团队」',
        '结果是失败的也讲得清，不绕过去',
      ],
      rationale: 'HR 面不看技术，只看事发当时他在不在场、扛没扛。',
    },
    boundary: {
      text: '如果一个问题查了一整天还没头绪，你会怎么跟上级说？',
      observationPoints: ['会不会主动说，而不是等被问', '说的是「我查到哪一步」，还是只说「还在查」', '有没有带着下一步计划去'],
      rationale: '假设题：没有结果的时候，怎么处理沟通和预期。',
    },
  },
  {
    comp: {
      id: 'comp_2',
      name: '出了错，他怎么收场',
      importance: 'core',
      taskIds: [],
      behaviors: ['敢承认，不先撇清', '先止损再解释', '事后有没有补动作'],
      origin: 'both',
    },
    core: {
      text: '你有没有做过一次改动，做完之后反而让情况变糟了？你是怎么发现的，后来怎么处理的？',
      observationPoints: ['敢承认，不先说「那是别人的问题」', '是先止损，还是先解释', '事后有没有补动作'],
      rationale: '敢讲失败的人，出事时通常也敢报。',
    },
    boundary: {
      text: '如果客户因为这件事直接投诉到你老板那里，你会怎么处理？',
      observationPoints: ['先解决问题还是先解释责任', '对客户的态度是否具体', '会不会主动同步进展'],
      rationale: '假设题：出事之后的第二反应，往往比第一反应更能看出人。',
    },
  },
  {
    comp: {
      id: 'comp_3',
      name: '跟别人怎么推进',
      importance: 'important',
      taskIds: [],
      behaviors: ['分得清责任，也不甩锅', '有具体推动动作，不是干等', '能说清对方为什么配合'],
      origin: 'both',
    },
    core: {
      text: '有没有遇到过「问题不在你这边，但最后要你来解决」的情况？那次你是怎么推动的？',
      observationPoints: ['分得清责任，但没有甩锅', '说得出具体动作：找了谁、说了什么、几天内推进的', '能说清对方为什么愿意配合'],
      rationale: '真实工作里一半的问题，靠的是跨团队推动。',
    },
    boundary: {
      text: '如果对方一直说「这不是我们的问题」，你怎么办？',
      observationPoints: ['有没有升级路径，而不是硬扛', '会不会先自己确认一遍责任边界', '措辞是否留了余地'],
      rationale: '假设题：跨部门协作里最常见的僵局。',
    },
  },
  {
    comp: {
      id: 'comp_4',
      name: '他对「做完了」的标准',
      importance: 'important',
      taskIds: [],
      behaviors: ['标准具体、可验证', '为了标准跟人起过冲突', '能说清最后谁让步'],
      origin: 'both',
    },
    core: {
      text: '你判断一件事「可以交付了」的标准是什么？举一个你坚持要再等等的例子。',
      observationPoints: ['标准具体、可验证，不是「感觉差不多了」', '有没有为了这个标准跟人起过冲突', '最后是谁让步，结果如何'],
      rationale: '只要判断他的标准是不是具体，就能判断他做事靠不靠得住。',
    },
    boundary: {
      text: '如果领导说「先上，出了问题我担着」，你会怎么办？',
      observationPoints: ['当面表达顾虑，还是事后抱怨', '会不会争取一个折中方案', '能不能说清「最坏会坏到什么程度」'],
      rationale: '假设题：压力之下还会不会坚持自己的标准。',
    },
  },
]

/* --------------------------- 岗位专属维度 --------------------------- */

interface JobExtra {
  compId: string
  comp: Omit<Competency, 'taskIds' | 'origin'> & { origin?: Competency['origin'] }
  core: Template
  boundary: Template
}

const EXTRAS: Record<string, JobExtra> = {
  job_agent: {
    compId: 'comp_j1',
    comp: {
      id: 'comp_j1',
      name: '对不确定的事会不会较真',
      importance: 'important',
      behaviors: ['会把「大概是」变成「确认过」', '能说出自己验证过的那一步'],
      origin: 'manager',
    },
    core: {
      text: '你上一次判断错了某件事，是过了多久才发现的？中间有没有过「有点不对劲」但没深究的时候？',
      observationPoints: ['敢不敢承认判断错过', '对「不对劲」的直觉是追下去还是放过'],
      rationale: 'AI 相关岗位一半的坑来自「大概是这个原因」，HR 看不到技术，但看得到他追不追。',
    },
    boundary: {
      text: '如果你非常确定一个结论，但同事说他想的是对的，你会怎么处理？',
      observationPoints: ['会不会当场坚持，还是先记录再验证', '有没有「去验证」的具体动作'],
      rationale: '假设题：较真和合作之间的分寸。',
    },
  },
  job_analyst: {
    compId: 'comp_j2',
    comp: {
      id: 'comp_j2',
      name: '拿到数字会不会先怀疑一遍',
      importance: 'important',
      behaviors: ['会先问口径和样本', '能说出哪个数字自己不信'],
      origin: 'manager',
    },
    core: {
      text: '你有没有拿到过一份别人给的、看起来很漂亮的数据，但你心里觉得不对？后来怎么处理的？',
      observationPoints: ['会不会先问口径', '有没有真的去核对过', '核对之后怎么跟对方说'],
      rationale: '数据分析岗最贵的错误不是算错，是没质疑。',
    },
    boundary: {
      text: '如果老板拿着一个有问题的数字在会上做决定，你会当场说吗？',
      observationPoints: ['会不会当场说，还是事后补', '说的时候指向问题还是指向人'],
      rationale: '假设题：当众纠错的勇气和方式。',
    },
  },
  job_frontend: {
    compId: 'comp_j3',
    comp: {
      id: 'comp_j3',
      name: '对「能用」和「好用」的分寸',
      importance: 'important',
      behaviors: ['能说出为了体验多花的时间', '知道什么时候该妥协'],
      origin: 'manager',
    },
    core: {
      text: '有没有一次，功能已经能用了，但你觉得还不够好，又花时间改？那次值不值？',
      observationPoints: ['说得出当时多花了多久', '能判断值不值，而不是「我觉得要更好」'],
      rationale: '前端的产出差距往往在「能用」之后那一段。',
    },
    boundary: {
      text: '如果上线时间只剩一天，但还有一个体验问题没解决，你会怎么选？',
      observationPoints: ['有没有明确取舍标准', '会不会主动提出替代方案'],
      rationale: '假设题：质量与 deadline 的真实取舍。',
    },
  },
  job_marketing: {
    compId: 'comp_j4',
    comp: {
      id: 'comp_j4',
      name: '对效果敢不敢认账',
      importance: 'important',
      behaviors: ['用数据说话，不归因于「市场环境」', '能说出自己判断错的那次'],
      origin: 'manager',
    },
    core: {
      text: '你做过的一次投放或活动，效果最差的是哪次？当时你的判断错在哪？',
      observationPoints: ['敢不敢直接说最差的那次', '归因是自己的判断还是外部环境'],
      rationale: '市场岗位最容易把失败归给平台和预算，HR 一听就知道。',
    },
    boundary: {
      text: '如果预算花了一半，数据明显不行，但这是老板拍板的方向，你会怎么办？',
      observationPoints: ['会不会主动上报', '有没有止损的具体建议', '对老板的态度是否得体'],
      rationale: '假设题：明知方向不对时的处理方式。',
    },
  },
  job_ops: {
    compId: 'comp_j5',
    comp: {
      id: 'comp_j5',
      name: '数据不好时先动哪个假设',
      importance: 'important',
      behaviors: ['能排出先试哪一个', '说得出为什么先试它'],
      origin: 'manager',
    },
    core: {
      text: '你负责的一个指标突然掉了，你第一件事是做什么？举个真实例子。',
      observationPoints: ['第一步是查数还是先改动作', '能不能排出优先级', '有没有验证过自己的假设'],
      rationale: '运营岗每天都在猜原因，区别在于先验证还是先动手。',
    },
    boundary: {
      text: '如果试了三周都没起色，团队开始怀疑方向，你会怎么处理？',
      observationPoints: ['会不会承认方向可能错', '有没有设定止损线'],
      rationale: '假设题：沉没成本下的判断。',
    },
  },
  job_sales: {
    compId: 'comp_j6',
    comp: {
      id: 'comp_j6',
      name: '敢不敢对客户说不',
      importance: 'core',
      behaviors: ['能说出拒绝过的一次', '拒绝之后关系没崩'],
      origin: 'manager',
    },
    core: {
      text: '有没有一次客户提的要求你做不到，但你还是答应了？后来怎么样了？',
      observationPoints: ['敢不敢讲答应了却没做到的事', '事后怎么补救', '有没有因此改变做法'],
      rationale: '销售最容易为了签单过度承诺，这一条比业绩数字更能看出长期性。',
    },
    boundary: {
      text: '如果一个大客户要求你承诺一个公司根本做不到的交付时间，你会怎么说？',
      observationPoints: ['有没有具体的拒绝话术', '会不会先内部确认再答复'],
      rationale: '假设题：签单压力下的底线。',
    },
  },
  job_cs: {
    compId: 'comp_j7',
    comp: {
      id: 'comp_j7',
      name: '被骂完还能不能按流程走',
      importance: 'important',
      behaviors: ['情绪上头时还能守流程', '能说出自己被投诉的一次'],
      origin: 'manager',
    },
    core: {
      text: '你被客户骂得最狠的一次是什么情况？当时你心里怎么想的，后来怎么处理的？',
      observationPoints: ['敢不敢讲真实的情绪', '情绪之后有没有回到流程', '事后有没有向上反馈'],
      rationale: '客服岗的专业度，体现在被骂之后那十分钟。',
    },
    boundary: {
      text: '如果客户的要求明显违反规定，但他威胁要投诉到总部，你会怎么办？',
      observationPoints: ['会不会为了平息而违规', '有没有升级和留痕意识'],
      rationale: '假设题：压力下的规则意识。',
    },
  },
  job_finance: {
    compId: 'comp_j8',
    comp: {
      id: 'comp_j8',
      name: '发现数字不对敢不敢拦',
      importance: 'core',
      behaviors: ['能说出拦下来的一次', '拦的时候给了依据'],
      origin: 'manager',
    },
    core: {
      text: '有没有一次，你发现一笔数字或一个流程不对，但提出来会让别人很难做？你当时怎么做的？',
      observationPoints: ['是真的提了还是忍了', '提的时候有没有带依据', '后续关系有没有受影响'],
      rationale: '财务岗位的价值在于「拦得住」，不在于算得快。',
    },
    boundary: {
      text: '如果业务负责人说这笔钱必须先付，流程后面补，你会怎么办？',
      observationPoints: ['有没有明确的红线', '会不会留下书面记录'],
      rationale: '假设题：业务压力与合规之间的处理。',
    },
  },
  job_pm: {
    compId: 'comp_j9',
    comp: {
      id: 'comp_j9',
      name: '说「不做」的时候怎么说服人',
      importance: 'core',
      behaviors: ['拒绝时有理由和数据', '拒绝之后给了替代方案'],
      origin: 'manager',
    },
    core: {
      text: '有没有一次你决定不做某个需求，但提需求的人很不高兴？你当时是怎么跟他说的？',
      observationPoints: ['拒绝的理由是不是具体', '有没有给替代方案', '事后有没有复盘这个决定'],
      rationale: '产品经理一半的工作是拒绝，HR 能听出他是讲道理还是讲职位。',
    },
    boundary: {
      text: '如果老板坚持要加一个你认为没价值的功能，你会怎么办？',
      observationPoints: ['会不会当面反对', '有没有试过用数据说服', '最后怎么落地'],
      rationale: '假设题：向上管理时的分寸。',
    },
  },
  job_hr: {
    compId: 'comp_j10',
    comp: {
      id: 'comp_j10',
      name: '候选人的话怎么核实',
      importance: 'important',
      behaviors: ['会追问细节而不是听结论', '能说出判断夸大的方法'],
      origin: 'manager',
    },
    core: {
      text: '你有没有遇到过候选人说得很漂亮、进来之后发现不是那么回事？当时哪句话骗过了你？',
      observationPoints: ['能具体说出被哪句话骗到', '事后总结出了什么识别方法'],
      rationale: '招人的人自己被夸大骗过，才真的会核实。',
    },
    boundary: {
      text: '如果用人部门急着要人，而你判断这个候选人不太合适，你会怎么办？',
      observationPoints: ['会不会坚持判断', '有没有用证据沟通'],
      rationale: '假设题：招聘压力下的专业坚持。',
    },
  },
}

/* --------------------------- 岗位 --------------------------- */

const BASE_JD = (title: string, dept: string, duties: string[], reqs: string[]) =>
  [`岗位：${title}（${dept}）`, '', '职责', ...duties.map((d, i) => `${i + 1}. ${d}`), '', '要求', ...reqs.map((r, i) => `${i + 1}. ${r}`)].join('\n')

interface JobSpec {
  id: string
  title: string
  dept: string
  favorite: boolean
  days: number
  duties: string[]
  reqs: string[]
  extraLines?: string[]
  issues?: JobProfile['issues']
}

const JOB_SPECS: JobSpec[] = [
  {
    id: 'job_agent',
    title: 'AI Agent 工程师',
    dept: '智能应用部',
    favorite: true,
    days: -21,
    duties: ['负责 Agent 编排与工具调用链路的开发与维护。', '参与 LLM 应用的需求分析与落地。'],
    reqs: ['本科及以上，3 年以上后端开发经验。', '精通 Python，熟悉 FastAPI / Flask。', '熟悉 LangChain、AutoGen 等 Agent 框架。', '熟悉 MySQL、Redis，了解向量数据库。'],
    extraLines: ['能看懂线上日志，独立定位故障。', '有过线上服务值班 / on-call 经验。', '写过故障复盘文档。'],
    issues: [
      {
        id: 'issue_1',
        kind: 'conflict',
        title: '「3 年以上 Python」可能筛掉合适的人',
        jdText: '要求：精通 Python，3 年以上后端开发经验。',
        managerText: '主管补充的三条要求里，没有一条跟语言或年限有关；他更在意有没有处理过线上故障。',
        status: 'open',
      },
      {
        id: 'issue_2',
        kind: 'gap',
        title: 'JD 强调框架经验，主管没提',
        jdText: '要求：熟悉 LangChain、AutoGen 等 Agent 框架。',
        managerText: '主管补充的内容全部围绕故障定位与稳定性，从未提到框架。这可能是加分项，而不是必需项。',
        status: 'open',
      },
    ],
  },
  {
    id: 'job_analyst',
    title: '数据分析师',
    dept: '增长部',
    favorite: true,
    days: -18,
    duties: ['负责增长实验的设计、数据回收与结论输出。', '搭建核心指标看板，支撑业务决策。'],
    reqs: ['2 年以上数据分析经验，熟练使用 SQL。', '有 A/B 实验设计经验。', '能把分析结论讲给非技术同事听。'],
  },
  {
    id: 'job_frontend',
    title: '前端工程师',
    dept: '交易平台部',
    favorite: false,
    days: -16,
    duties: ['负责交易链路的前端开发与性能优化。', '与设计、后端协作完成需求交付。'],
    reqs: ['3 年以上前端开发经验。', '熟悉 React 与 TypeScript。', '对交互细节和性能有要求。'],
  },
  {
    id: 'job_marketing',
    title: '市场专员',
    dept: '市场部',
    favorite: false,
    days: -14,
    duties: ['负责新品在小红书、抖音等平台的内容投放。', '对接代理商，控制获客成本。'],
    reqs: ['2 年以上内容投放经验。', '熟悉主流平台的投放逻辑。', '能独立做数据复盘。'],
    issues: [
      {
        id: 'issue_m1',
        kind: 'gap',
        title: '「熟悉主流平台投放逻辑」写得含糊',
        jdText: '要求：熟悉主流平台的投放逻辑。',
        managerText: '到底要投过哪几个平台、预算量级多大，JD 里没写，容易招到只投过小预算的人。',
        status: 'open',
      },
    ],
  },
  {
    id: 'job_ops',
    title: '运营专员',
    dept: '运营部',
    favorite: false,
    days: -12,
    duties: ['负责用户增长与活跃度的日常运营。', '设计并复盘运营活动。'],
    reqs: ['2 年以上运营经验。', '对数据敏感，能独立做归因。', '有活动策划与执行经验。'],
  },
  {
    id: 'job_sales',
    title: '销售经理',
    dept: '销售部',
    favorite: false,
    days: -11,
    duties: ['负责中大型客户的开拓与维护。', '完成季度销售目标。'],
    reqs: ['3 年以上 B 端销售经验。', '有独立跟单与大客户维护经验。', '能接受出差。'],
  },
  {
    id: 'job_cs',
    title: '客服主管',
    dept: '客服部',
    favorite: false,
    days: -9,
    duties: ['负责客服团队的日常管理与排班。', '处理升级投诉，优化服务流程。'],
    reqs: ['3 年以上客服经验，1 年以上带团队经验。', '抗压能力强。', '熟悉工单系统。'],
  },
  {
    id: 'job_finance',
    title: '财务分析',
    dept: '财务部',
    favorite: false,
    days: -7,
    duties: ['负责月度经营分析与预算跟踪。', '对接业务部门，提供财务支持。'],
    reqs: ['2 年以上财务分析经验。', '熟悉 Excel 与财务系统。', '有跨部门沟通经验。'],
  },
  {
    id: 'job_pm',
    title: '产品经理',
    dept: '产品部',
    favorite: false,
    days: -5,
    duties: ['负责一条业务线的需求分析与产品设计。', '协调研发、设计、运营推进项目。'],
    reqs: ['3 年以上产品经验。', '有从 0 到 1 的完整项目经验。', '逻辑清晰，能写清楚文档。'],
  },
  {
    id: 'job_hr',
    title: '招聘专员',
    dept: '人力资源部',
    favorite: false,
    days: -3,
    duties: ['负责技术与业务岗位的招聘交付。', '维护候选人体验与雇主品牌。'],
    reqs: ['2 年以上招聘经验。', '能独立完成面试安排与初筛。', '沟通表达清晰。'],
  },
]

const JOBS: JobProfile[] = JOB_SPECS.map((spec) => {
  const base = BASE_JD(spec.title, spec.dept, spec.duties, spec.reqs)
  const jdText = spec.extraLines ? `${base}\n${spec.extraLines.map((l, i) => `${spec.reqs.length + i + 1}. ${l}`).join('\n')}` : base
  const extra = EXTRAS[spec.id]
  return {
    id: spec.id,
    title: spec.title,
    department: spec.dept,
    jdText,
    baselineJd: base,
    version: spec.extraLines ? 2 : 1,
    status: 'confirmed' as const,
    approvedBy: undefined,
    createdAt: stamp(spec.days),
    updatedAt: stamp(spec.days + 1),
    favorite: spec.favorite,
    tasks: [],
    competencies: [
      ...SHARED.map((s) => ({ ...s.comp })),
      {
        id: extra.comp.id,
        name: extra.comp.name,
        importance: extra.comp.importance,
        taskIds: [],
        behaviors: extra.comp.behaviors,
        origin: extra.comp.origin ?? 'manager',
      },
    ],
    issues: spec.issues ?? [],
  }
})

/* --------------------------- 简历 --------------------------- */

interface ResumeSpec {
  id: string
  jobId: string
  name: string
  year: number
  headline: string
  company: string
  role: string
  duty: string
  bullets: { title: string; text: string }[]
  gap: string
  skills: string
  added: number
  level: Candidate['educationLevel']
  grad: number
}

const RESUME_SPECS: ResumeSpec[] = [
  {
    id: 'c_analyst', jobId: 'job_analyst', name: '刘思齐', year: 3, headline: '3 年数据分析 · 增长',
    company: '青禾消费', role: '数据分析师', duty: '负责增长侧的核心指标与实验分析。',
    bullets: [
      { title: '新客补贴实验（2024）', text: '主导补贴力度实验，把新客次月留存从 22% 提升到 31%，单个获客成本下降 18 元。' },
      { title: '看板口径统一（2023）', text: '发现两个团队对「活跃」的定义不一致，重新梳理口径后，日报误差从 7% 降到 1% 以内。' },
    ],
    gap: '有一次直接用了业务方给的现成数据，没核对口径，结论会上被当场质疑。',
    skills: 'SQL / Python / Tableau', added: -6, level: '硕士', grad: 2021,
  },
  {
    id: 'c_analyst2', jobId: 'job_analyst', name: '孙嘉禾', year: 2, headline: '2 年数据分析 · 电商',
    company: '南屏电商', role: '数据分析师', duty: '负责商品侧的数据支持与复盘。',
    bullets: [
      { title: '爆品预测模型（2024）', text: '用历史销量预测爆品，把备货准确率从 64% 提升到 82%，滞销库存减少 30%。' },
      { title: '异常订单排查（2023）', text: '定位到优惠券叠加导致的价格异常，挽回约 40 万损失。' },
    ],
    gap: '不太会给非技术同事讲结论，上一次汇报被说「听不懂」。',
    skills: 'SQL / Excel / 数据可视化', added: -4, level: '本科', grad: 2022,
  },
  {
    id: 'c_front', jobId: 'job_frontend', name: '王雨桐', year: 4, headline: '4 年前端 · 交易链路',
    company: '云杉科技', role: '高级前端工程师', duty: '负责交易页的前端开发与性能优化。',
    bullets: [
      { title: '交易页性能治理（2024）', text: '主导首屏性能优化，首屏时间从 3.2 秒降到 1.4 秒，转化率提升 6%。' },
      { title: '组件库重构（2023）', text: '牵头把三个重复组件库合并，包体积减少 40%，后续需求平均开发时间缩短 2 天。' },
    ],
    gap: '有一次为了赶上线，把一个兼容问题留到了线上，第二天才修。',
    skills: 'React / TypeScript / Webpack', added: -8, level: '本科', grad: 2020,
  },
  {
    id: 'c_front2', jobId: 'job_frontend', name: '陈子昂', year: 3, headline: '3 年前端 · 中后台',
    company: '恒瑞支付', role: '前端工程师', duty: '负责运营后台的前端开发。',
    bullets: [
      { title: '低代码表单（2024）', text: '设计并实现配置化表单，把运营提需求的排期从 5 天缩短到半天。' },
      { title: '线上白屏排查（2023）', text: '定位到是第三方脚本加载失败导致白屏，加了兜底后同类问题清零。' },
    ],
    gap: '没有独立负责过一个从 0 到 1 的项目。',
    skills: 'Vue / React / Node.js', added: -3, level: '本科', grad: 2021,
  },
  {
    id: 'c_mkt', jobId: 'job_marketing', name: '赵明轩', year: 3, headline: '3 年内容投放 · 消费品',
    company: '青禾消费', role: '市场专员', duty: '负责小红书与抖音的内容投放。',
    bullets: [
      { title: '新品冷启动（2024）', text: '主导新品在红书的冷启动，3 个月做到类目搜索前 3，获客成本从 180 元降到 96 元。' },
      { title: '达人池重建（2023）', text: '重新筛选达人合作池，把无效投放占比从 35% 压到 12%。' },
    ],
    gap: '有一次投放预算判断失误，两天花掉 4 万几乎没有转化。',
    skills: '内容策划 / 投放 / 数据复盘', added: -5, level: '本科', grad: 2021,
  },
  {
    id: 'c_mkt2', jobId: 'job_marketing', name: '李思远', year: 2, headline: '2 年品牌活动 · 快消',
    company: '南屏电商', role: '市场专员', duty: '负责品牌联名与线下活动。',
    bullets: [
      { title: '联名活动（2024）', text: '策划并执行一次品牌联名，带来 2.3 万新增用户，活动成本比预算低 15%。' },
      { title: '代理商更换（2023）', text: '发现原代理商数据造假，推动更换后投放真实性明显改善。' },
    ],
    gap: '线上投放经验比较少，主要在活动执行这一块。',
    skills: '活动策划 / 供应商管理', added: -2, level: '本科', grad: 2022,
  },
  {
    id: 'c_ops', jobId: 'job_ops', name: '郑亦然', year: 3, headline: '3 年用户运营 · 增长',
    company: '南屏电商', role: '运营专员', duty: '负责用户分层与活跃度运营。',
    bullets: [
      { title: '沉默用户召回（2024）', text: '设计分层召回策略，把 30 日沉默用户召回率从 4% 提升到 11%。' },
      { title: '活动复盘机制（2023）', text: '推动建立活动复盘机制，把重复踩坑的活动问题减少了 6 成。' },
    ],
    gap: '做活动偏执行，对整体策略参与得不多。',
    skills: '用户分层 / 活动运营 / SQL', added: -7, level: '本科', grad: 2021,
  },
  {
    id: 'c_ops2', jobId: 'job_ops', name: '周涵', year: 2, headline: '2 年内容运营',
    company: '云杉科技', role: '运营专员', duty: '负责社区内容与创作者运营。',
    bullets: [
      { title: '创作者激励（2024）', text: '重构创作者激励规则，月活创作者从 800 增加到 2100。' },
      { title: '内容质量治理（2023）', text: '主导低质内容清理，用户举报量下降 45%。' },
    ],
    gap: '数据能力一般，归因主要靠感觉。',
    skills: '内容运营 / 社群 / 基础 SQL', added: -3, level: '本科', grad: 2022,
  },
  {
    id: 'c_sales', jobId: 'job_sales', name: '吴清越', year: 5, headline: '5 年 B 端销售 · SaaS',
    company: '恒瑞支付', role: '销售经理', duty: '负责中大型客户的开拓与维护。',
    bullets: [
      { title: '大客户续约（2024）', text: '主导 3 个百万级客户的续约，续约率 100%，年化增购 40%。' },
      { title: '新行业开拓（2023）', text: '从 0 打开一个行业客户，一年做到 600 万营收。' },
    ],
    gap: '有一次为了签单承诺了交付时间，后来公司没做到，客户关系受损。',
    skills: '大客户销售 / 商务谈判', added: -8, level: '本科', grad: 2019,
  },
  {
    id: 'c_sales2', jobId: 'job_sales', name: '许承宇', year: 3, headline: '3 年销售 · 渠道',
    company: '南屏电商', role: '渠道销售', duty: '负责渠道商招募与管理。',
    bullets: [
      { title: '渠道体系搭建（2024）', text: '搭建区域渠道体系，一年签约 26 家，贡献营收占比从 8% 提升到 27%。' },
      { title: '渠道冲突处理（2023）', text: '处理过一次跨区域窜货，通过价格带区分解决，两个渠道商都留了下来。' },
    ],
    gap: '没有直接面对过终端大客户。',
    skills: '渠道管理 / 商务谈判', added: -4, level: '大专', grad: 2021,
  },
  {
    id: 'c_cs', jobId: 'job_cs', name: '冯岸', year: 4, headline: '4 年客服 · 2 年带团队',
    company: '云杉科技', role: '客服主管', duty: '负责 12 人客服团队的日常管理。',
    bullets: [
      { title: '响应时效治理（2024）', text: '重排班次与工单分配，把首响时间从 8 分钟压到 3 分钟，满意度提升 9 个点。' },
      { title: '投诉升级处理（2023）', text: '建立升级投诉的 24 小时闭环机制，重复投诉率下降 55%。' },
    ],
    gap: '有一次被客户当众辱骂后情绪失控，回怼了一句。',
    skills: '团队管理 / 工单系统 / 投诉处理', added: -9, level: '本科', grad: 2020,
  },
  {
    id: 'c_cs2', jobId: 'job_cs', name: '何知微', year: 3, headline: '3 年客服 · 高客单',
    company: '恒瑞支付', role: '资深客服', duty: '负责高客单客户的售后与投诉处理。',
    bullets: [
      { title: '退款流程优化（2024）', text: '梳理退款流程，把平均处理时间从 48 小时缩短到 12 小时。' },
      { title: '高危客户安抚（2023）', text: '处理过一起可能引发公开投诉的事件，最终客户撤回投诉并续约。' },
    ],
    gap: '没有带过人，管理经验是空白。',
    skills: '投诉处理 / 客户沟通', added: -2, level: '本科', grad: 2021,
  },
  {
    id: 'c_fin', jobId: 'job_finance', name: '曹雨声', year: 4, headline: '4 年财务分析 · 制造业',
    company: '恒瑞支付', role: '财务分析', duty: '负责月度经营分析与预算跟踪。',
    bullets: [
      { title: '预算偏差治理（2024）', text: '发现某条业务线预算偏差长期超 20%，推动重做成本模型，偏差收敛到 5% 以内。' },
      { title: '费用审核（2023）', text: '拦下一笔 80 万的重复付款，避免了实际损失。' },
    ],
    gap: '跟业务部门沟通时容易被说「只会说不」。',
    skills: '财务分析 / Excel / ERP', added: -6, level: '硕士', grad: 2020,
  },
  {
    id: 'c_fin2', jobId: 'job_finance', name: '邓嘉言', year: 2, headline: '2 年财务 · 互联网',
    company: '南屏电商', role: '财务专员', duty: '负责收入确认与费用核算。',
    bullets: [
      { title: '收入确认梳理（2024）', text: '重新梳理收入确认口径，把月结时间从 6 天压缩到 2 天。' },
      { title: '对账自动化（2023）', text: '推动对账自动化，人工核对工作量减少 70%。' },
    ],
    gap: '没有做过经营分析，主要在做核算。',
    skills: '核算 / Excel / 财务系统', added: -1, level: '本科', grad: 2022,
  },
  {
    id: 'c_pm', jobId: 'job_pm', name: '钱多多', year: 4, headline: '4 年产品 · B 端',
    company: '云杉科技', role: '产品经理', duty: '负责一条业务线的需求分析与产品设计。',
    bullets: [
      { title: '工单系统重构（2024）', text: '主导工单系统重构，客服人均处理量提升 60%，上线后需求变更率下降 30%。' },
      { title: '需求评审机制（2023）', text: '推动建立需求评审机制，把返工率从 25% 降到 8%。' },
    ],
    gap: '有一次为了赶版本，把一个明显有风险的需求放进了排期。',
    skills: '需求分析 / 原型 / 数据分析', added: -7, level: '本科', grad: 2020,
  },
  {
    id: 'c_pm2', jobId: 'job_pm', name: '沈知行', year: 3, headline: '3 年产品 · 增长',
    company: '南屏电商', role: '产品经理', duty: '负责增长方向的产品设计。',
    bullets: [
      { title: '注册转化优化（2024）', text: '把注册流程从 5 步减到 2 步，注册转化率从 31% 提升到 52%。' },
      { title: '会员体系（2023）', text: '设计会员体系，上线三个月付费会员达到 4.2 万。' },
    ],
    gap: '跟研发协作时容易急，被反馈过「不听完就下结论」。',
    skills: '增长产品 / A/B 实验', added: -3, level: '硕士', grad: 2021,
  },
  {
    id: 'c_hr', jobId: 'job_hr', name: '韩沐晴', year: 3, headline: '3 年招聘 · 技术岗',
    company: '拓扑智能', role: '招聘专员', duty: '负责技术岗位的全流程招聘。',
    bullets: [
      { title: '技术岗交付（2024）', text: '一年交付 48 个技术岗位，平均到岗周期从 45 天压缩到 28 天。' },
      { title: '面试官培训（2023）', text: '主导面试官培训，把面试评价的填写率从 40% 提升到 92%。' },
    ],
    gap: '有一次被候选人的项目描述说服，入职后发现实际参与度很低。',
    skills: '招聘全流程 / 面试评估', added: -6, level: '本科', grad: 2021,
  },
  {
    id: 'c_hr2', jobId: 'job_hr', name: '张一诺', year: 4, headline: '4 年招聘 · 校招与雇主品牌',
    company: '云杉科技', role: '招聘主管', duty: '负责校招与雇主品牌项目。',
    bullets: [
      { title: '校招体系重建（2024）', text: '主导校招流程重建，offer 转化率从 58% 提升到 79%，入职留存提升 12 个点。' },
      { title: '雇主品牌内容（2023）', text: '从 0 搭建雇主品牌内容矩阵，简历投递量增长 3 倍。' },
    ],
    gap: '没有做过技术岗的深度面试，主要做流程和项目管理。',
    skills: '校招 / 雇主品牌 / 流程设计', added: -2, level: '硕士', grad: 2020,
  },
]

/* --------------------------- 组装候选人 --------------------------- */

function buildResume(spec: ResumeSpec): string {
  return [
    `${spec.name} · ${spec.headline} · ${spec.year} 年经验`,
    '',
    '工作经历',
    `2021.07 - 至今   ${spec.company}   ${spec.role}`,
    spec.duty,
    '',
    '项目经历',
    ...spec.bullets.flatMap((b) => [`· ${b.title}`, b.text, '']),
    '教育背景',
    `2017 - ${spec.grad}   某大学   ${spec.level}   ${spec.grad > 2020 ? '相关专业' : '相关专业'}`,
    '',
    '技能',
    spec.skills,
    '',
    `不足：${spec.gap}`,
  ].join('\n')
}

const RESUME_A = [
  '林嘉睿 · 后端 / AI 应用工程师 · 4 年经验',
  '',
  '工作经历',
  '2022.03 - 至今   云杉科技   高级后端工程师',
  '负责企业知识库问答产品的检索与生成链路。',
  '',
  '项目经历',
  '· 知识库 RAG 检索优化（2024）',
  '负责检索链路重构，将召回准确率从 61% 提升到 84%。',
  '通过分析检索日志，定位到向量库分片不均导致的召回缺失，重写了分片路由与超时重试逻辑。',
  '设计索引重建的灰度方案，按租户分批切换，全量前观察 7 天。',
  '',
  '· 工单智能分类服务（2023）',
  '基于 LLM 的分类服务，日均 40 万次调用。',
  '上游超时时回退到规则分类，整体可用性从 99.2% 提升到 99.9%。',
  '',
  '教育背景',
  '2018 - 2022   某大学   计算机科学与技术   本科',
  '',
  '技能',
  'Python / TypeScript / PostgreSQL / Redis / Milvus / LangChain',
].join('\n')

const RESUME_B = [
  '周沐 · 测试开发 / Agent 稳定性 · 2.5 年经验',
  '',
  '工作经历',
  '2023.06 - 至今   拓扑智能   Agent 平台测试开发',
  '负责 Agent 工具调用链路的稳定性验证与问题定位。',
  '',
  '项目经历',
  '· Agent 工具调用回归测试集（2025）',
  '搭建工具调用自动化回归测试集，覆盖 42 个工具场景，把发布前回归时间从 2 天压缩到 3 小时。',
  '其中设计了超时、限流、返回脏数据三类故障注入用例。',
  '',
  '· 会话状态丢失问题定位（2024）',
  '定位并修复了工具调用超时导致的会话状态丢失问题，根因是重试时没有复用会话上下文。',
  '修复后线上同类工单下降 90%。',
  '',
  '· 幂等改造（2024）',
  '为下单类工具引入幂等键，重复提交导致的重复扣款问题清零。',
  '',
  '教育背景',
  '2019 - 2023   某大学   软件工程   本科',
  '',
  '技能',
  'Python / pytest / Docker / LangChain / 故障注入',
  '',
  '不足：没有大规模线上流量调优经验，未独立负责过服务 SLA。',
].join('\n')

function mkClaim(id: string, text: string, raw: string, comps: string[], unverified = false): ResumeClaim {
  const start = text.indexOf(raw)
  if (start < 0) console.warn('[mock] 未命中', id, raw.slice(0, 20))
  return { id, rawText: raw, start, competencyIds: comps, unverified }
}

const jobById = (id: string) => JOBS.find((j) => j.id === id)!

const CANDIDATE_A: Candidate = {
  id: 'cand_a',
  jobId: 'job_agent',
  name: '林嘉睿',
  headline: '4 年后端 · 知识库问答',
  years: 4,
  resumeText: RESUME_A,
  source: 'preset',
  addedAt: stamp(-9),
  updatedAt: stamp(-2),
  educationLevel: '本科',
  gradYear: 2022,
  claims: [
    mkClaim('claim_a1', RESUME_A, '将召回准确率从 61% 提升到 84%', ['comp_1', 'comp_4']),
    mkClaim('claim_a2', RESUME_A, '通过分析检索日志，定位到向量库分片不均导致的召回缺失，重写了分片路由与超时重试逻辑', ['comp_1', 'comp_j1']),
    mkClaim('claim_a3', RESUME_A, '设计索引重建的灰度方案，按租户分批切换，全量前观察 7 天', ['comp_4']),
    mkClaim('claim_a4', RESUME_A, '上游超时时回退到规则分类，整体可用性从 99.2% 提升到 99.9%', ['comp_3', 'comp_2']),
  ],
}

const CANDIDATE_B: Candidate = {
  id: 'cand_b',
  jobId: 'job_agent',
  name: '周沐',
  headline: '3 年测试开发 · Agent 稳定性',
  years: 2.5,
  resumeText: RESUME_B,
  source: 'preset',
  addedAt: stamp(-5),
  updatedAt: stamp(-5),
  educationLevel: '本科',
  gradYear: 2023,
  claims: [
    mkClaim('claim_b1', RESUME_B, '覆盖 42 个工具场景，把发布前回归时间从 2 天压缩到 3 小时', ['comp_4']),
    mkClaim('claim_b2', RESUME_B, '其中设计了超时、限流、返回脏数据三类故障注入用例', ['comp_4', 'comp_3']),
    mkClaim('claim_b3', RESUME_B, '定位并修复了工具调用超时导致的会话状态丢失问题，根因是重试时没有复用会话上下文', ['comp_1', 'comp_2']),
    mkClaim('claim_b4', RESUME_B, '为下单类工具引入幂等键，重复提交导致的重复扣款问题清零', ['comp_2']),
    mkClaim('claim_b5', RESUME_B, '没有大规模线上流量调优经验，未独立负责过服务 SLA', ['comp_3'], true),
  ],
}

/** 其余 16 位候选人的线索用规则抽取，追问走通用模板 */
const AUTO_CANDIDATES: Candidate[] = RESUME_SPECS.map((spec) => {
  const text = buildResume(spec)
  const job = jobById(spec.jobId)
  return {
    id: spec.id,
    jobId: spec.jobId,
    name: spec.name,
    headline: spec.headline,
    years: spec.year,
    resumeText: text,
    source: 'preset' as const,
    addedAt: stamp(spec.added),
    updatedAt: stamp(spec.added),
    educationLevel: spec.level,
    gradYear: spec.grad,
    claims: extractClaims(text, job.competencies),
  }
})

/* --------------------------- 题库模板 --------------------------- */

const CORE_QUESTIONS: Record<string, Template> = {}
const BOUNDARY_QUESTIONS: Record<string, Template> = {}

for (const s of SHARED) {
  CORE_QUESTIONS[s.comp.id] = s.core
  BOUNDARY_QUESTIONS[s.comp.id] = s.boundary
}
for (const id of Object.keys(EXTRAS)) {
  const e = EXTRAS[id]
  CORE_QUESTIONS[e.compId] = e.core
  BOUNDARY_QUESTIONS[e.compId] = e.boundary
}

/* 手写追问只给两位主演示候选人，其余走通用追问 */

interface FollowupTemplate extends Template {
  claimId: string
  competencyId: string
}

const FOLLOWUPS: Record<string, FollowupTemplate> = {
  fu_a1: {
    claimId: 'claim_a2',
    competencyId: 'comp_1',
    text: '你简历里写「定位到向量库分片不均」，是你先发现的，还是别人告诉你之后你去处理的？你怎么确认就是这个问题？',
    observationPoints: ['能不能说清「我是怎么确认的」', '是本人主导，还是接手了别人的结论'],
    rationale: '简历写了「定位到」，需要确认这是他的判断，还是转述别人的结论。',
  },
  fu_a2: {
    claimId: 'claim_a1',
    competencyId: 'comp_4',
    text: '「召回准确率从 61% 提升到 84%」这个数是谁统计的？上线前你们怎么确认这个数没算错？',
    observationPoints: ['数字的口径说清了吗', '是别人给的数，还是自己算的'],
    rationale: '给了具体数字，越具体越要确认口径是谁定的。',
  },
  fu_a3: {
    claimId: 'claim_a2',
    competencyId: 'comp_2',
    text: '你说重写了重试逻辑，上线后有没有出现过同一件事被执行了两遍？当时是怎么发现的？',
    observationPoints: ['有没有主动想过副作用', '是出事之后才补的，还是提前想到的'],
    rationale: '重试最容易造成的意外，就是同一件事做了两遍。',
  },
  fu_a4: {
    claimId: 'claim_a4',
    competencyId: 'comp_3',
    text: '你说超时会退回一套简单的规则，当时业务方接受吗？有没有人反对，你怎么说服的？',
    observationPoints: ['说不说得清反对意见是什么', '有没有具体的说服过程'],
    rationale: '降级方案总会影响别人，这里最容易看出他会不会沟通。',
  },
  fu_a5: {
    claimId: 'claim_a3',
    competencyId: 'comp_4',
    text: '你说先观察 7 天再全量，这 7 天你具体在看什么？最后是谁拍板可以全量？',
    observationPoints: ['观察的指标说得具体吗', '拍板的人是他，还是别人'],
    rationale: '需要确认这是走过场，还是他真的在判断。',
  },
  fu_a6: {
    claimId: 'claim_a2',
    competencyId: 'comp_j1',
    text: '你简历里写「分片不均」，能用不涉及技术的话讲一下这是什么情况吗？',
    observationPoints: ['能不能用日常语言讲清楚', '讲不清时，会不会承认「这部分是同事做的」'],
    rationale: '翻译题：HR 不需要懂答案，只需要判断他能不能把复杂的事讲明白。',
  },
  fu_b1: {
    claimId: 'claim_b3',
    competencyId: 'comp_1',
    text: '「重试时没有复用会话上下文」这个问题，是你先发现的，还是别人告诉你的？',
    observationPoints: ['定位的过程说得清吗', '是本人发现，还是接手处理'],
    rationale: '这是这份简历里最硬的一条，需要确认他的主导程度。',
  },
  fu_b2: {
    claimId: 'claim_b3',
    competencyId: 'comp_2',
    text: '修好之后，你是只修了这一次，还是顺手把同类问题都查了一遍？',
    observationPoints: ['有没有举一反三', '还是只做了被要求的那部分'],
    rationale: '修一个问题，和消灭一类问题，是两种不同的做事习惯。',
  },
  fu_b3: {
    claimId: 'claim_b4',
    competencyId: 'comp_2',
    text: '你写的「幂等键」，能用不涉及技术的话讲一下它解决的是什么问题吗？',
    observationPoints: ['能不能用日常语言讲明白', '讲不清，可能是因为不是他做的'],
    rationale: '翻译题：HR 只需要判断他能不能把这件事说明白。',
  },
  fu_b4: {
    claimId: 'claim_b1',
    competencyId: 'comp_4',
    text: '42 个场景是怎么挑出来的？哪些是你故意没覆盖的？',
    observationPoints: ['挑选有依据吗（踩过的坑、出过的事）', '敢不敢承认覆盖边界'],
    rationale: '数字很漂亮，但「怎么挑的」比数字本身更能说明问题。',
  },
  fu_b5: {
    claimId: 'claim_b2',
    competencyId: 'comp_3',
    text: '「返回脏数据」这一类，你们当时是怎么判断它确实坏了的？',
    observationPoints: ['判断依据具体吗', '有没有考虑过「不报错但结果错」的情况'],
    rationale: '三类用例里，脏数据最难判断，也最能看出深浅。',
  },
  fu_b6: {
    claimId: 'claim_b5',
    competencyId: 'comp_3',
    text: '你写自己没有独立负责过线上可用性，如果这个岗位要你负责，你打算怎么补？',
    observationPoints: ['是否诚实面对差距', '补法是否具体、有下一步'],
    rationale: '简历自述的短板，应当面确认，而不是替他假设。',
  },
}

const FOLLOWUPS_BY_CANDIDATE: Record<string, string[]> = {
  cand_a: ['fu_a1', 'fu_a2', 'fu_a3', 'fu_a4', 'fu_a5', 'fu_a6'],
  cand_b: ['fu_b1', 'fu_b2', 'fu_b3', 'fu_b4', 'fu_b5', 'fu_b6'],
}

/* --------------------------- 组卷 --------------------------- */

function derivedCore(comp: Competency, candidateId: string): Question {
  const behavior = comp.behaviors[0] ?? '说清当时具体发生了什么'
  return {
    id: `${candidateId}_core_${comp.id}`,
    competencyId: comp.id,
    type: 'core',
    text: `围绕「${comp.name}」：请举一个你亲自经历的例子，说明${behavior.replace(/^能/, '你是如何')}。`,
    sourceTaskIds: comp.taskIds,
    observationPoints: ['举的例子是本人主导，还是只是参与', '是否说清了具体事实，而不是只给结论', '能否说出当时的取舍'],
    rationale: `能力维度「${comp.name}」已被重新表述，该题同步更新。`,
    status: 'ai',
  }
}

function genericFollowups(job: JobProfile, candidate: Candidate): Question[] {
  return candidate.claims.slice(0, 4).map((claim, i) => {
    const compId = claim.competencyIds[0] ?? job.competencies[0].id
    const comp = job.competencies.find((c) => c.id === compId)
    const short = claim.rawText.length > 24 ? `${claim.rawText.slice(0, 24)}…` : claim.rawText
    const plain = short.replace(/^(不足|短板|劣势|说明|备注)\s*[:：]/, '')

    const isGap = Boolean(claim.unverified)
    const hasDesign = /(设计|搭建|重构|改造|方案|机制|梳理|建立)/.test(claim.rawText)
    const hasDebug = /(定位|排查|修复|根因|发现|拦下)/.test(claim.rawText)
    const hasMetric = /\d/.test(claim.rawText)

    const variant = isGap
      ? { text: `你写到自己「${plain}」，如果这个岗位需要你补上这块，你打算怎么补？`, points: ['是否诚实面对差距', '补法是否具体、有下一步'] }
      : hasDebug
        ? { text: `你写到「${short}」，这件事是你先发现的，还是别人告诉你的？`, points: ['能不能说清「我是怎么确认的」', '是本人主导，还是接手了别人的结论'] }
        : hasDesign
          ? { text: `你写到「${short}」，这件事里最关键的一个决定是什么？当时有人反对吗？`, points: ['能否说清取舍的代价', '有没有具体的推动过程'] }
          : hasMetric
            ? { text: `你写到「${short}」，这个数是谁统计的？你怎么确认它没算错？`, points: ['数字口径说清了吗', '是别人给的数，还是自己算的'] }
            : { text: `你写到「${short}」，这件事你本人负责哪一块？当时最难的一步是什么？`, points: ['能否分清自己做的和别人做的', '是否说得出具体的困难与取舍'] }

    return {
      id: `${candidate.id}_genfu_${i}`,
      competencyId: compId,
      type: 'followup' as const,
      text: variant.text,
      claimId: claim.id,
      sourceTaskIds: comp?.taskIds ?? [],
      observationPoints: variant.points,
      rationale: `来自简历原文的追问；配置模型后会替换成针对这段经历的定制问题。`,
      status: 'ai' as const,
    }
  })
}

export function buildCard(job: JobProfile, candidate: Candidate): InterviewCard {
  const questions: Question[] = []

  for (const comp of job.competencies) {
    if (comp.edited) {
      questions.push(derivedCore(comp, candidate.id))
      continue
    }
    const core = CORE_QUESTIONS[comp.id]
    if (!core) continue
    questions.push({
      id: `${candidate.id}_core_${comp.id}`,
      competencyId: comp.id,
      type: 'core',
      text: core.text,
      sourceTaskIds: comp.taskIds,
      observationPoints: core.observationPoints,
      rationale: core.rationale,
      status: 'ai',
    })
  }

  for (const key of FOLLOWUPS_BY_CANDIDATE[candidate.id] ?? []) {
    const tpl = FOLLOWUPS[key]
    if (!tpl) continue
    const claim = candidate.claims.find((c) => c.id === tpl.claimId)
    const comp = job.competencies.find((c) => c.id === tpl.competencyId)
    if (!claim || !comp) continue
    questions.push({
      id: `${candidate.id}_${key}`,
      competencyId: tpl.competencyId,
      type: 'followup',
      text: tpl.text,
      claimId: tpl.claimId,
      sourceTaskIds: comp.taskIds,
      observationPoints: tpl.observationPoints,
      rationale: tpl.rationale,
      status: 'ai',
    })
  }

  if (!FOLLOWUPS_BY_CANDIDATE[candidate.id]) {
    questions.push(...genericFollowups(job, candidate))
  }

  for (const comp of job.competencies) {
    const b = BOUNDARY_QUESTIONS[comp.id]
    if (!b) continue
    questions.push({
      id: `${candidate.id}_boundary_${comp.id}`,
      competencyId: comp.id,
      type: 'boundary',
      text: b.text,
      sourceTaskIds: comp.taskIds,
      observationPoints: b.observationPoints,
      rationale: b.rationale,
      status: 'ai',
    })
  }

  return {
    candidateId: candidate.id,
    jobVersion: job.version,
    generatedAt: stamp(),
    questions,
  }
}

export const INITIAL_JOBS: JobProfile[] = JOBS
export const INITIAL_CANDIDATES: Candidate[] = [CANDIDATE_A, CANDIDATE_B, ...AUTO_CANDIDATES]
export const DEFAULT_COMPETENCIES = (): Competency[] => SHARED.map((s) => ({ ...s.comp }))

export function initialCards(jobs: JobProfile[], candidates: Candidate[]): Record<string, InterviewCard> {
  const cards: Record<string, InterviewCard> = {}
  for (const c of candidates) {
    const job = jobs.find((j) => j.id === c.jobId)
    if (job) cards[c.id] = buildCard(job, c)
  }
  return cards
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  core: '必问题',
  followup: '简历追问',
  boundary: '假设题',
}

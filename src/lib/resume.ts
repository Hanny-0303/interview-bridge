import type { Competency, EducationLevel, ResumeClaim } from '../data/types'

// PDF / DOCX 解析库按需加载，首屏不为它们付代价

/* ------------------------------ 文件解析 ------------------------------ */

export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0|\u200b/g, ' ')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function readPdf(file: File): Promise<string> {
  const [pdfjsLib, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default

  const buf = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
  }).promise

  const lines: string[] = []
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    let line = ''
    for (const item of content.items as Array<{ str?: string; hasEOL?: boolean }>) {
      line += item.str ?? ''
      if (item.hasEOL) {
        lines.push(line)
        line = ''
      }
    }
    if (line) lines.push(line)
    lines.push('')
  }
  return normalizeText(lines.join('\n'))
}

async function readDocx(file: File): Promise<string> {
  const mammoth = (await import('mammoth')).default
  const buf = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  return normalizeText(result.value)
}

export async function parseResumeFile(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return readPdf(file)
  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) return readDocx(file)
  if (name.endsWith('.doc')) {
    throw new Error('旧版 .doc 无法直接解析，请另存为 .docx 或 PDF')
  }
  const text = await file.text()
  if (!text.trim()) throw new Error('这个文件里没有可识别的文字')
  return normalizeText(text)
}

/* ------------------------------ 轻量抽取 ------------------------------ */
/*
 * 规则抽取，不调用模型：把简历里"带结果/带动作"的句子识别为线索，
 * 并按能力关键词做粗匹配。有模型时会被模型抽取替换。
 */

const ACTION_WORDS = /(负责|主导|搭建|设计|优化|重构|定位|排查|修复|改造|实现|落地|上线|推动|引入|建立)/

/** 有结果、有量化，才值得追问 */
const RESULT_WORDS =
  /(提升|降低|下降|缩短|压缩|减少|降到|降至|提升到|从[^，。；]{1,14}到|零故障|清零|翻倍|节省)/

/** 简历里自述的短板 —— 恰恰要当面确认 */
const GAP_LINE = /^(不足|短板|劣势|说明|备注)\s*[:：]/

function bigrams(text: string): Set<string> {
  const clean = text.replace(/\s+/g, '')
  const out = new Set<string>()
  for (let i = 0; i < clean.length - 1; i += 1) out.add(clean.slice(i, i + 2))
  return out
}

function scoreAgainst(line: string, comp: Competency): number {
  const target = [...bigrams(comp.name), ...bigrams(comp.behaviors.join(' '))].filter((g) => !/[\d\s]/.test(g))
  const lineGrams = bigrams(line)
  let score = 0
  for (const g of target) if (lineGrams.has(g)) score += 1
  return score
}

export function extractClaims(resumeText: string, competencies: Competency[]): ResumeClaim[] {
  const lines = resumeText.split('\n').map((l) => l.trim())
  const claims: ResumeClaim[] = []
  let cursor = 0

  for (const line of lines) {
    const start = resumeText.indexOf(line, cursor)
    if (start < 0) continue
    cursor = start + line.length

    const plain = line.replace(/^[·•\-*\d.、)\s]+/, '')
    if (plain.length < 10 || plain.length > 150) continue
    if (/（20\d\d）\s*$/.test(plain)) continue // 项目标题
    const gap = GAP_LINE.test(plain)
    const hasResult = RESULT_WORDS.test(plain)
    const hasAction = ACTION_WORDS.test(plain)
    const hasNumber = /\d/.test(plain)
    // 有量化结果，或者（动作 + 数字），或者明确写了短板
    if (!gap && !hasResult && !(hasAction && hasNumber)) continue

    const scored = competencies
      .map((c) => ({ id: c.id, score: scoreAgainst(plain, c) }))
      .filter((x) => x.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)

    claims.push({
      id: `claim_h${claims.length + 1}`,
      rawText: line,
      start,
      competencyIds: scored.map((s) => s.id),
      unverified: gap || undefined,
    })
  }

  return claims.slice(0, 12)
}

export function guessName(resumeText: string, fileName?: string): string {
  const first = resumeText.split('\n').find((l) => l.trim().length > 0) ?? ''
  const head = first.split(/[·|｜,，\s]/)[0]?.trim() ?? ''
  if (head && head.length <= 6 && /^[\u4e00-\u9fa5]{2,4}$/.test(head)) return head
  const fromFile = fileName?.replace(/\.(pdf|docx?|txt|md)$/i, '').trim()
  if (fromFile && fromFile.length <= 20) return fromFile
  return '新候选人'
}

const LEVEL_RANK: Record<string, number> = { 博士: 4, 硕士: 3, 本科: 2, 大专: 1, 其他: 0 }

export function levelRank(level?: string): number {
  return level ? (LEVEL_RANK[level] ?? 0) : -1
}

/** 从简历里尽力抽学历与毕业年份；抽不到就返回 null，排序时排到最后 */
export function parseEducation(text: string): { level: EducationLevel; gradYear?: number } | null {
  const lines = text.split('\n')
  const eduLines = lines.filter((l) => /(大学|学院|学校|Univ|College|研究生院)/i.test(l))
  if (!eduLines.length) return null

  let level: EducationLevel = '其他'
  if (/博士|Ph\.?D/i.test(text)) level = '博士'
  else if (/硕士|研究生|MBA|Master/i.test(text)) level = '硕士'
  else if (/本科|学士|Bachelor/i.test(text)) level = '本科'
  else if (/大专|专科|高职/.test(eduLines.join(' '))) level = '大专'

  const years: number[] = []
  for (const l of eduLines) {
    for (const m of l.matchAll(/(19|20)\d{2}/g)) years.push(Number(m[0]))
  }
  const gradYear = years.length ? Math.max(...years) : undefined

  return { level, gradYear }
}

export function guessHeadline(resumeText: string): string {
  const lines = resumeText.split('\n').filter((l) => l.trim())
  const second = lines.find((l, i) => i > 0 && l.length < 40)
  return second?.replace(/^[·•\-*\s]+/, '') ?? '上传简历'
}

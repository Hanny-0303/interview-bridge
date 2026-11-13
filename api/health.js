import { readModelConfig } from './_core.js'

/** GET /api/health —— 前端用它判断要不要显示「AI 已连接」 */
export default function handler(_req, res) {
  const cfg = readModelConfig()
  res.status(200).json({ ok: true, model: cfg.model, configured: Boolean(cfg.apiKey) })
}

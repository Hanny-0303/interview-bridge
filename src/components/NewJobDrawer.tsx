import { useState } from 'react'
import { Drawer } from './ui'

export interface NewJobInput {
  title: string
  department: string
  jdText: string
}

export default function NewJobDrawer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (input: NewJobInput) => void
}) {
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [jdText, setJdText] = useState('')

  const reset = () => {
    setTitle('')
    setDepartment('')
    setJdText('')
  }

  const valid = title.trim().length > 0 && jdText.trim().length > 20

  return (
    <Drawer
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      width={560}
      title="新建岗位"
      subtitle="粘贴一份 JD，这个岗位就会存进岗位库，以后有新候选人直接切回来"
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">面试官用的是通用行为维度，建完可以再改</span>
          <div className="ml-auto flex gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => {
                reset()
                onClose()
              }}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              disabled={!valid}
              onClick={() => {
                onCreate({ title: title.trim(), department: department.trim() || '未填写部门', jdText: jdText.trim() })
                reset()
              }}
            >
              存进岗位库
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <div className="label mb-1">岗位名称</div>
          <input
            className="field"
            placeholder="例如：前端工程师"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <div className="label mb-1">部门</div>
          <input
            className="field"
            placeholder="例如：增长部"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>
        <div>
          <div className="label mb-1">JD 原文</div>
          <textarea
            className="field h-[38vh] resize-none text-[12px] leading-[1.8]"
            placeholder="把 JD 全文粘贴到这里…"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
          <p className="mt-1 text-[10.5px] text-muted/70">
            之后可以在左侧直接改 JD；改动过的行会被标成「新增」，方便你记住哪些是自己补的。
          </p>
        </div>
      </div>
    </Drawer>
  )
}

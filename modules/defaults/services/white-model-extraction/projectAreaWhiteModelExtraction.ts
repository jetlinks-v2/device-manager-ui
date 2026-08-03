import type {
  ProjectFloorPlan,
  ProjectFloorPlanSourceReference,
  ProjectFloorPlanWhiteModelCandidate,
  ProjectFloorPlanWhiteModelJob,
  ProjectFloorPlanWhiteModelRecognition,
} from '../../types'

interface WhiteModelExtractionRuntimeOptions {
  floorPlans: ProjectFloorPlan[]
  seedPublishedFloorPlanIds: string[]
}

interface StartWhiteModelJobInput {
  projectId: string
  floorPlanId: string
}

interface SelectWhiteModelResult {
  candidate: ProjectFloorPlanWhiteModelCandidate
  job: ProjectFloorPlanWhiteModelJob
}

export const PROJECT_AREA_WHITE_MODEL_IMAGE_URL = '/images/spatial/mall-atrium-white-model-image2-premium-v2.png'
export const PROJECT_AREA_REFERENCE_WHITE_MODEL_IMAGE_URL = '/images/spatial/mall-atrium-white-model-v7.png'
export const PROJECT_AREA_WHITE_MODEL_GENERATED_AT = '2026-05-04T10:32:18+08:00'
export const PROJECT_AREA_WHITE_MODEL_QUALITY_THRESHOLD = 85
const PROJECT_AREA_WHITE_MODEL_SCORE = 96

export function createProjectAreaWhiteModelExtractionRuntime(options: WhiteModelExtractionRuntimeOptions) {
  const floorPlans = options.floorPlans
  const seedFloorPlanIds = new Set(options.seedPublishedFloorPlanIds)
  const seedCandidates = floorPlans
    .filter((floorPlan) => seedFloorPlanIds.has(floorPlan.id))
    .map(createSeedWhiteModelCandidate)
  const seedJobs = seedCandidates
    .map((candidate) => {
      const floorPlan = floorPlans.find((item) => item.id === candidate.floorPlanId)
      return floorPlan ? createSeedWhiteModelJob(floorPlan, candidate) : null
    })
    .filter((job): job is ProjectFloorPlanWhiteModelJob => Boolean(job))

  let candidateState = seedCandidates.map(cloneWhiteModelCandidate)
  let jobState = seedJobs.map(cloneWhiteModelJob)
  const runState = new Map(seedCandidates.map((candidate) => [candidate.floorPlanId, 1]))

  function resetProject(projectId: string) {
    const projectFloorPlanIds = new Set(floorPlans.filter((plan) => plan.projectId === projectId).map((plan) => plan.id))
    candidateState = [
      ...candidateState.filter((candidate) => !projectFloorPlanIds.has(candidate.floorPlanId)),
      ...seedCandidates.filter((candidate) => projectFloorPlanIds.has(candidate.floorPlanId)).map(cloneWhiteModelCandidate),
    ]
    jobState = [
      ...jobState.filter((job) => job.projectId !== projectId),
      ...seedJobs.filter((job) => job.projectId === projectId).map(cloneWhiteModelJob),
    ]
    for (const floorPlanId of projectFloorPlanIds) {
      runState.set(
        floorPlanId,
        seedJobs.some((job) => job.projectId === projectId && job.floorPlanId === floorPlanId) ? 1 : 0,
      )
    }
  }

  function listJobs(projectId: string) {
    return jobState.filter((job) => job.projectId === projectId).map(cloneWhiteModelJob)
  }

  function listCandidates(projectId: string) {
    return candidateState
      .filter((candidate) =>
        floorPlans.some((plan) => plan.projectId === projectId && plan.id === candidate.floorPlanId),
      )
      .map(cloneWhiteModelCandidate)
  }

  function startWhiteModelJob(input: StartWhiteModelJobInput) {
    const floorPlan = findProjectFloorPlan(input.projectId, input.floorPlanId)
    if (!floorPlan) return null

    const existingJob = jobState.find((job) =>
      job.projectId === input.projectId && job.floorPlanId === input.floorPlanId,
    )
    const candidate = createNextInternalWhiteModelCandidate(floorPlan)
    const publishedCandidateId = existingJob?.publishedCandidateId
      ?? (candidate.status === 'published' ? candidate.id : undefined)

    const job = upsertWhiteModelJob({
      id: existingJob?.id ?? `wm-job-${input.floorPlanId}`,
      projectId: input.projectId,
      floorPlanId: input.floorPlanId,
      status: publishedCandidateId ? 'published' : 'ready',
      mode: 'internal',
      progress: 100,
      stageLabel: createWhiteModelStageLabel(Boolean(publishedCandidateId), candidate.score),
      startedAt: PROJECT_AREA_WHITE_MODEL_GENERATED_AT,
      completedAt: PROJECT_AREA_WHITE_MODEL_GENERATED_AT,
      selectedCandidateId: candidate.id,
      publishedCandidateId,
      qualityScore: candidate.score,
      qualityThreshold: PROJECT_AREA_WHITE_MODEL_QUALITY_THRESHOLD,
      reviewReason: createWhiteModelReviewReason(candidate.score),
      recognition: createRecognitionForFloorPlan(input.floorPlanId),
    })

    return { candidate: cloneWhiteModelCandidate(candidate), job: cloneWhiteModelJob(job) }
  }

  function selectWhiteModelCandidate(projectId: string, floorPlanId: string, candidateId: string): SelectWhiteModelResult | null {
    const floorPlan = findProjectFloorPlan(projectId, floorPlanId)
    if (!floorPlan) return null
    const candidate = candidateState.find((item) => item.floorPlanId === floorPlanId && item.id === candidateId)
    if (!candidate) return null

    const existingJob = jobState.find((item) => item.projectId === projectId && item.floorPlanId === floorPlanId)
    const job = upsertWhiteModelJob({
      id: existingJob?.id ?? `wm-job-${floorPlanId}`,
      projectId,
      floorPlanId,
      status: existingJob?.status ?? 'ready',
      mode: candidate.generationMode,
      progress: existingJob?.progress ?? 100,
      stageLabel: createWhiteModelStageLabel(Boolean(existingJob?.publishedCandidateId), candidate.score),
      startedAt: existingJob?.startedAt ?? PROJECT_AREA_WHITE_MODEL_GENERATED_AT,
      completedAt: existingJob?.completedAt ?? PROJECT_AREA_WHITE_MODEL_GENERATED_AT,
      selectedCandidateId: candidateId,
      publishedCandidateId: existingJob?.publishedCandidateId,
      qualityScore: candidate.score,
      qualityThreshold: existingJob?.qualityThreshold ?? PROJECT_AREA_WHITE_MODEL_QUALITY_THRESHOLD,
      reviewReason: candidate.qualityReason,
      recognition: existingJob?.recognition ?? createRecognitionForFloorPlan(floorPlanId),
    })

    return { candidate: cloneWhiteModelCandidate(candidate), job: cloneWhiteModelJob(job) }
  }

  function publishWhiteModelCandidate(projectId: string, floorPlanId: string, candidateId: string): SelectWhiteModelResult | null {
    const floorPlan = findProjectFloorPlan(projectId, floorPlanId)
    if (!floorPlan) return null
    const candidate = candidateState.find((item) => item.floorPlanId === floorPlanId && item.id === candidateId)
    if (!candidate) return null

    candidateState = candidateState.map((item) => {
      if (item.floorPlanId !== floorPlanId) return item
      return {
        ...item,
        status: item.id === candidateId ? 'published' : item.status === 'archived' ? 'archived' : 'generated',
      }
    })

    const existingJob = jobState.find((item) => item.projectId === projectId && item.floorPlanId === floorPlanId)
    const job = upsertWhiteModelJob({
      id: existingJob?.id ?? `wm-job-${floorPlanId}`,
      projectId,
      floorPlanId,
      status: 'published',
      mode: candidate.generationMode,
      progress: 100,
      stageLabel: createWhiteModelPublishLabel(),
      startedAt: existingJob?.startedAt ?? PROJECT_AREA_WHITE_MODEL_GENERATED_AT,
      completedAt: PROJECT_AREA_WHITE_MODEL_GENERATED_AT,
      selectedCandidateId: candidateId,
      publishedCandidateId: candidateId,
      qualityScore: candidate.score,
      qualityThreshold: existingJob?.qualityThreshold ?? PROJECT_AREA_WHITE_MODEL_QUALITY_THRESHOLD,
      reviewReason: candidate.qualityReason,
      recognition: existingJob?.recognition ?? createRecognitionForFloorPlan(floorPlanId),
    })

    return { candidate: cloneWhiteModelCandidate(candidate), job: cloneWhiteModelJob(job) }
  }

  function findProjectFloorPlan(projectId: string, floorPlanId: string) {
    return floorPlans.find((plan) => plan.projectId === projectId && plan.id === floorPlanId)
  }

  function createNextInternalWhiteModelCandidate(floorPlan: ProjectFloorPlan) {
    archiveWhiteModelDraftCandidates(floorPlan.id)
    const runIndex = nextWhiteModelRunIndex(floorPlan.id)
    const candidate = createGeneratedWhiteModelCandidate(floorPlan, runIndex)
    candidateState = [...candidateState, cloneWhiteModelCandidate(candidate)]
    return candidate
  }

  function archiveWhiteModelDraftCandidates(floorPlanId: string) {
    candidateState = candidateState.map((candidate) => {
      if (candidate.floorPlanId !== floorPlanId || candidate.status === 'published') return candidate
      return { ...candidate, status: 'archived' }
    })
  }

  function nextWhiteModelRunIndex(floorPlanId: string) {
    const nextIndex = (runState.get(floorPlanId) ?? 0) + 1
    runState.set(floorPlanId, nextIndex)
    return nextIndex
  }

  function upsertWhiteModelJob(nextJob: ProjectFloorPlanWhiteModelJob) {
    const index = jobState.findIndex((job) =>
      job.projectId === nextJob.projectId && job.floorPlanId === nextJob.floorPlanId,
    )
    if (index < 0) {
      jobState = [...jobState, cloneWhiteModelJob(nextJob)]
      return nextJob
    }
    jobState = jobState.map((job, currentIndex) =>
      currentIndex === index ? cloneWhiteModelJob(nextJob) : job,
    )
    return nextJob
  }

  return {
    listCandidates,
    listJobs,
    publishWhiteModelCandidate,
    resetProject,
    selectWhiteModelCandidate,
    startWhiteModelJob,
  }
}

function createSeedWhiteModelCandidate(floorPlan: ProjectFloorPlan): ProjectFloorPlanWhiteModelCandidate {
  return {
    id: `wm-${floorPlan.id}-source-derived`,
    floorPlanId: floorPlan.id,
    generationMode: 'internal',
    styleKey: 'image2-premium',
    styleName: '精修白模',
    imageUrl: PROJECT_AREA_WHITE_MODEL_IMAGE_URL,
    status: 'published',
    generatedAt: PROJECT_AREA_WHITE_MODEL_GENERATED_AT,
    promptSummary: `${floorPlan.name} 精修白模：基于源平面图结构生成高质量 2.5D 白模，保留主通道、中庭、店铺体块和服务空间。`,
    qualityLabel: '精修白模已达标',
    qualityReason: '当前白模已替换为高质量精修版本，可作为空间态势的默认发布底图。',
    sourceReference: cloneSourceReference(floorPlan.sourceReference),
    reviewItems: ['主通道与中庭轮廓清晰', '店铺体块与外墙层次完整', '适合叠加设备和告警点位'],
    score: PROJECT_AREA_WHITE_MODEL_SCORE,
  }
}

function createGeneratedWhiteModelCandidate(
  floorPlan: ProjectFloorPlan,
  runIndex: number,
): ProjectFloorPlanWhiteModelCandidate {
  const runLabel = `第 ${runIndex} 轮`
  return {
    id: `wm-${floorPlan.id}-source-derived-${runIndex}`,
    floorPlanId: floorPlan.id,
    generationMode: 'internal',
    styleKey: 'image2-premium',
    styleName: `${runLabel} · 精修白模`,
    imageUrl: PROJECT_AREA_WHITE_MODEL_IMAGE_URL,
    status: 'generated',
    generatedAt: PROJECT_AREA_WHITE_MODEL_GENERATED_AT,
    promptSummary: `${floorPlan.name} ${runLabel}精修白模：基于源平面图结构生成高质量 2.5D 白模，保留主通道、中庭、店铺体块和服务空间。`,
    qualityLabel: '精修白模已达标',
    qualityReason: '本轮白模已替换为高质量精修版本；发布前可复核主要动线与区域边界。',
    sourceReference: cloneSourceReference(floorPlan.sourceReference),
    reviewItems: ['主通道与中庭轮廓清晰', '店铺体块与外墙层次完整', '适合叠加设备和告警点位'],
    score: PROJECT_AREA_WHITE_MODEL_SCORE,
  }
}

function createSeedWhiteModelJob(
  floorPlan: ProjectFloorPlan,
  candidate: ProjectFloorPlanWhiteModelCandidate,
): ProjectFloorPlanWhiteModelJob {
  return {
    id: `wm-job-${floorPlan.id}`,
    projectId: floorPlan.projectId,
    floorPlanId: floorPlan.id,
    status: 'published',
    mode: 'internal',
    progress: 100,
    stageLabel: '系统白模已发布到空间态势',
    startedAt: PROJECT_AREA_WHITE_MODEL_GENERATED_AT,
    completedAt: PROJECT_AREA_WHITE_MODEL_GENERATED_AT,
    selectedCandidateId: candidate.id,
    publishedCandidateId: candidate.id,
    qualityScore: candidate.score,
    qualityThreshold: PROJECT_AREA_WHITE_MODEL_QUALITY_THRESHOLD,
    reviewReason: '当前发布版本为高质量精修白模；重新点击系统生成会读取源图纸并生成新的单张白模结果。',
    recognition: createRecognitionForFloorPlan(floorPlan.id),
  }
}

function createWhiteModelStageLabel(hasPublishedCandidate: boolean, qualityScore: number) {
  if (hasPublishedCandidate) return '已有发布版本，已生成新一轮系统结果'
  return qualityScore >= PROJECT_AREA_WHITE_MODEL_QUALITY_THRESHOLD ? '系统内部白模已达标' : '系统内部白模已生成，等待复核'
}

function createWhiteModelPublishLabel() {
  return '系统白模已发布到空间态势'
}

function createWhiteModelReviewReason(qualityScore: number) {
  return qualityScore >= PROJECT_AREA_WHITE_MODEL_QUALITY_THRESHOLD
    ? '系统已生成单张高质量精修白模结果；确认主要动线和区域边界后即可发布到空间态势。'
    : '系统已生成白模结果，但仍需复核主通道、外墙和区域边界后再发布。'
}

function createRecognitionForFloorPlan(floorPlanId: string): ProjectFloorPlanWhiteModelRecognition {
  if (floorPlanId === 'plan-mall-1f') {
    return {
      walls: 118,
      rooms: 108,
      doors: 16,
      labels: 6,
      confidence: 0.86,
      reviewItems: ['中庭栏杆已自动闭合', '消防通道门洞已人工确认', '主力店西侧边界已校准'],
    }
  }
  return {
    walls: 42,
    rooms: 24,
    doors: 8,
    labels: 5,
    confidence: 0.72,
    reviewItems: ['外轮廓已识别', '房间切分需要人工校准', '图纸文字标签需要复核'],
  }
}

function cloneWhiteModelCandidate(
  candidate: ProjectFloorPlanWhiteModelCandidate,
): ProjectFloorPlanWhiteModelCandidate {
  return {
    ...candidate,
    sourceReference: cloneSourceReference(candidate.sourceReference),
    reviewItems: [...candidate.reviewItems],
  }
}

function cloneWhiteModelJob(job: ProjectFloorPlanWhiteModelJob): ProjectFloorPlanWhiteModelJob {
  return {
    ...job,
    recognition: {
      ...job.recognition,
      reviewItems: [...job.recognition.reviewItems],
    },
  }
}

function cloneSourceReference(
  reference: ProjectFloorPlanSourceReference | undefined,
): ProjectFloorPlanSourceReference | undefined {
  return reference ? { ...reference } : undefined
}


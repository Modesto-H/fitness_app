const MAX_EXERCISES_PER_MUSCLE = 4

const MUSCLE_SYNERGIES = {
  chest: ['triceps', 'shoulders'],
  shoulders: ['triceps'],
  back: ['biceps'],
  legs: ['glutes'],
  glutes: ['legs'],
  biceps: [],
  triceps: [],
  core: [],
}

const ISOLATION_ONLY = new Set(['biceps', 'triceps', 'core'])

const MUSCLE_PRIORITY = {
  legs: 5,
  back: 4,
  chest: 4,
  shoulders: 3,
  glutes: 3,
  biceps: 2,
  triceps: 2,
  core: 1,
}

const MOVEMENT_FAMILIES = {
  push_horizontal_flat: 'horizontal_press',
  push_horizontal_incline: 'horizontal_press',
  push_horizontal_decline: 'horizontal_press',

  push_vertical: 'vertical_press',

  pull_horizontal: 'horizontal_pull',
  pull_vertical: 'vertical_pull',

  chest_isolation: 'chest_isolation',

  lateral_raise: 'shoulder_abduction',
  rear_delt: 'rear_delt',

  triceps_isolation: 'triceps_extension',
  triceps_pushdown: 'triceps_extension',
  triceps_overhead: 'triceps_extension',

  biceps_short_head: 'biceps_curl',
  biceps_long_head: 'biceps_curl',
  biceps_brachialis: 'biceps_curl',

  core_flexion: 'core_flexion',
  core_rotation: 'core_rotation',
  core_anti_extension: 'core_anti_extension',

  knee_dominant: 'knee_dominant',
  hip_dominant: 'hip_dominant',
  hip_extension: 'hip_extension',
  legs_general: 'legs_general',

  glute_abduction: 'glute_abduction',

  calves: 'calves',

  back_isolation: 'back_isolation',
}

function getMovementFamily(movementPattern) {
  return MOVEMENT_FAMILIES[movementPattern] || movementPattern || 'unknown'
}

function shuffle(array) {
  const result = [...array]

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

function randomChoice(array) {
  if (!array.length) return null

  return array[Math.floor(Math.random() * array.length)]
}

function getAvailablePool(dataset, muscles, equipment) {
  return dataset.filter((exercise) => muscles.includes(exercise.mainMuscle) && equipment.includes(exercise.equipment))
}

function calculateMinimumCoverage(muscles, totalExercises) {
  const muscleCount = muscles.length

  if (muscleCount === 0) {
    return {}
  }

  if (muscleCount === 1) {
    return {
      [muscles[0]]: Math.min(totalExercises, MAX_EXERCISES_PER_MUSCLE),
    }
  }

  if (totalExercises >= muscleCount * 2) {
    return Object.fromEntries(muscles.map((muscle) => [muscle, 2]))
  }

  return Object.fromEntries(muscles.map((muscle) => [muscle, 1]))
}

function getExerciseProfile(exercise) {
  const isCompound = exercise.target === 'compound'
  const isIsolation = exercise.target === 'isolation'

  const movementPattern = exercise.movementPattern || 'unknown'

  const family = getMovementFamily(movementPattern)

  return {
    ...exercise,
    isCompound,
    isIsolation,
    priority: MUSCLE_PRIORITY[exercise.mainMuscle] || 0,
    pattern: movementPattern,
    family,
    redundancyGroup: family,
    axial: Boolean(exercise.hasAxialLoad),
  }
}

function createContext(muscles, totalExercises) {
  return {
    muscles,
    totalExercises,
    selected: [],
    directCounts: Object.fromEntries(muscles.map((m) => [m, 0])),
    patternCounts: {},
    familyCounts: {},
    redundancyGroupCounts: {},
    axialLoadCount: 0,
    exposure: Object.fromEntries(muscles.map((m) => [m, 0])),
  }
}

function getSynergyExposure(exercise, muscle) {
  const synergies = MUSCLE_SYNERGIES[exercise.mainMuscle] || []
  return synergies.includes(muscle) ? 0.35 : 0
}

function getRedundancyPenalty(exercise, context) {
  let penalty = 0
  const samePattern = context.patternCounts[exercise.pattern] || 0
  const sameFamily = context.familyCounts[exercise.family] || 0
  const sameGroup = context.redundancyGroupCounts[exercise.redundancyGroup] || 0

  penalty += samePattern * 18

  penalty += sameFamily * 7

  if (exercise.redundancyGroup !== exercise.family) {
    penalty += sameGroup * 8
  }

  const sameMuscle = context.directCounts[exercise.mainMuscle] || 0

  penalty += sameMuscle * 5

  return penalty
}

function getAxialPenalty(exercise, context) {
  if (!exercise.axial) {
    return 0
  }

  return context.axialLoadCount * 15
}

function getPatternCoverageScore(exercise, context) {
  const samePattern = context.patternCounts[exercise.pattern] || 0

  if (samePattern === 0) {
    return 18
  }

  if (samePattern === 1) {
    return 4
  }

  return -10
}

function getMusclePriorityScore(exercise, context) {
  const currentCount = context.directCounts[exercise.mainMuscle] || 0

  let score = (MUSCLE_PRIORITY[exercise.mainMuscle] || 0) * 2

  score -= currentCount * 4

  return score
}

function getRoleScore(exercise, context) {
  let score = 0

  if (exercise.isCompound) {
    score += 12
  }

  if (exercise.isIsolation && context.selected.length < 2) {
    score -= 6
  }

  if (exercise.isIsolation && context.selected.length >= 2) {
    score += 5
  }

  return score
}

function getSynergyPenalty(exercise, context) {
  let penalty = 0

  for (const muscle of context.muscles) {
    if (muscle === exercise.mainMuscle) {
      continue
    }

    const indirect = getSynergyExposure(exercise, muscle)

    if (indirect > 0) {
      penalty += indirect * 4
    }
  }

  return penalty
}

function getNoveltyScore() {
  return Math.random() * 12
}

function getFamilyCoverageScore(exercise, context) {
  const sameFamily = context.familyCounts[exercise.family] || 0

  if (sameFamily === 0) {
    return 10
  }

  if (sameFamily === 1) {
    return 2
  }

  return -4
}

function getMuscleLimitPenalty(exercise, context) {
  const currentCount = context.directCounts[exercise.mainMuscle] || 0

  if (currentCount >= MAX_EXERCISES_PER_MUSCLE) {
    return 100
  }

  return 0
}

function scoreExercise(exercise, context) {
  let score = 0

  score += getMusclePriorityScore(exercise, context)

  score += getPatternCoverageScore(exercise, context)

  score += getFamilyCoverageScore(exercise, context)

  score += getRoleScore(exercise, context)

  score += getNoveltyScore()

  score -= getRedundancyPenalty(exercise, context)

  score -= getAxialPenalty(exercise, context)

  score -= getSynergyPenalty(exercise, context)

  score -= getMuscleLimitPenalty(exercise, context)

  return score
}

function registerExercise(exercise, context) {
  context.selected.push(exercise)

  const muscle = exercise.mainMuscle

  context.directCounts[muscle] = (context.directCounts[muscle] || 0) + 1

  const pattern = exercise.pattern || 'unknown'

  context.patternCounts[pattern] = (context.patternCounts[pattern] || 0) + 1

  const family = exercise.family || 'unknown'

  context.familyCounts[family] = (context.familyCounts[family] || 0) + 1

  const redundancyGroup = exercise.redundancyGroup || family

  context.redundancyGroupCounts[redundancyGroup] = (context.redundancyGroupCounts[redundancyGroup] || 0) + 1

  if (exercise.axial) {
    context.axialLoadCount++
  }
}

function selectBestCandidate(candidates, context) {
  if (!candidates.length) {
    return null
  }

  const ranked = candidates
    .map((exercise) => ({
      exercise,

      score: scoreExercise(exercise, context),
    }))
    .sort((a, b) => b.score - a.score)

  const topCount = Math.min(4, ranked.length)

  const topCandidates = ranked.slice(0, topCount)

  return randomChoice(topCandidates)?.exercise || null
}

function satisfyMinimumCoverage(candidates, minimumCoverage, context) {
  const muscles = Object.keys(minimumCoverage)

  const shuffled = shuffle(muscles)

  for (const muscle of shuffled) {
    const target = minimumCoverage[muscle]

    while (context.directCounts[muscle] < target) {
      const available = candidates.filter(
        (exercise) =>
          exercise.mainMuscle === muscle && !context.selected.some((selected) => selected.id === exercise.id)
      )

      if (!available.length) {
        break
      }

      const best = selectBestCandidate(available, context)

      if (!best) {
        break
      }

      registerExercise(best, context)
    }
  }
}

function fillRemainingSlots(candidates, context) {
  while (context.selected.length < context.totalExercises) {
    const available = candidates.filter((exercise) => !context.selected.some((selected) => selected.id === exercise.id))

    if (!available.length) {
      break
    }

    const best = selectBestCandidate(available, context)

    if (!best) {
      break
    }

    registerExercise(best, context)
  }
}

function orderRoutine(exercises) {
  return [...exercises].sort((a, b) => {
    const aIsolation = ISOLATION_ONLY.has(a.mainMuscle)

    const bIsolation = ISOLATION_ONLY.has(b.mainMuscle)

    if (aIsolation !== bIsolation) {
      return aIsolation ? 1 : -1
    }

    const aCompound = a.target === 'compound'

    const bCompound = b.target === 'compound'

    if (aCompound !== bCompound) {
      return bCompound - aCompound
    }

    const aPriority = MUSCLE_PRIORITY[a.mainMuscle] || 0

    const bPriority = MUSCLE_PRIORITY[b.mainMuscle] || 0

    return bPriority - aPriority
  })
}

export function generateSmartRoutine(optimizedDataset, userPreferences) {
  const { muscles, equipment, totalExercises } = userPreferences

  if (
    !Array.isArray(muscles) ||
    !muscles.length ||
    !Array.isArray(equipment) ||
    !equipment.length ||
    !totalExercises ||
    totalExercises <= 0
  ) {
    return []
  }

  const availablePool = getAvailablePool(optimizedDataset, muscles, equipment)

  if (!availablePool.length) {
    return []
  }

  const candidates = availablePool.map(getExerciseProfile)
  const context = createContext(muscles, totalExercises)
  const minimumCoverage = calculateMinimumCoverage(muscles, totalExercises)

  satisfyMinimumCoverage(candidates, minimumCoverage, context)
  fillRemainingSlots(candidates, context)
  return orderRoutine(context.selected)
}

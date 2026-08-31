const MAX_EXERCISES_PER_MUSCLE = 4;

export function generateSmartRoutine(optimizedDataset, userPreferences) {
  const { muscles, equipment, totalExercises } = userPreferences;

  let availablePool = optimizedDataset.filter(exercise =>
    muscles.includes(exercise.mainMuscle) &&
    equipment.includes(exercise.equipment)
  );

  if (availablePool.length === 0) return [];

  let finalSetlist = [];
  let usedPatterns = new Set();
  let axialLoadCount = 0;

  const MAX_AXIAL_LOAD = totalExercises <= 6 ? 1 : 2;

  const isPushDay = muscles.includes('chest') || muscles.includes('shoulders');
  const isPullDay = muscles.includes('back');

  const getMuscleLimit = (muscle) => {
    if (muscles.length === 1) return totalExercises;
    if (muscle === 'triceps' && isPushDay) return 2;
    if (muscle === 'biceps' && isPullDay) return 2;
    return MAX_EXERCISES_PER_MUSCLE;
  };

  let exercisesPerMuscle = {};
  muscles.forEach(m => exercisesPerMuscle[m] = 0);

  let remainingSlots = totalExercises;
  let madeProgress = true;

  let shuffledMuscles = [...muscles].sort(() => Math.random() - 0.5);

  while (remainingSlots > 0 && madeProgress) {
    madeProgress = false;
    for (let m of shuffledMuscles) {
      if (remainingSlots === 0) break;

      let countInPool = availablePool.filter(e => e.mainMuscle === m).length;
      let muscleLimit = getMuscleLimit(m);

      if (exercisesPerMuscle[m] < countInPool && exercisesPerMuscle[m] < muscleLimit) {
        exercisesPerMuscle[m]++;
        remainingSlots--;
        madeProgress = true;
      }
    }
  }

  shuffledMuscles.forEach(muscle => {
    let targetCount = exercisesPerMuscle[muscle];
    let muscleCandidates = availablePool.filter(e => e.mainMuscle === muscle);

    muscleCandidates.sort(() => Math.random() - 0.5);
    muscleCandidates.sort((a, b) => (b.target === "compound" ? 1 : 0) - (a.target === "compound" ? 1 : 0));

    let selectedForMuscle = 0;

    for (let candidate of muscleCandidates) {
      if (selectedForMuscle >= targetCount) break;

      if (candidate.hasAxialLoad && axialLoadCount >= MAX_AXIAL_LOAD) continue;

      let hasPatternConflict = usedPatterns.has(candidate.movementPattern);
      let alternativesExist = muscleCandidates.some(c =>
        !usedPatterns.has(c.movementPattern) &&
        !finalSetlist.some(f => f.id === c.id) &&
        (!c.hasAxialLoad || axialLoadCount < MAX_AXIAL_LOAD)
      );

      if (hasPatternConflict && alternativesExist) continue;

      finalSetlist.push(candidate);
      usedPatterns.add(candidate.movementPattern);
      if (candidate.hasAxialLoad) axialLoadCount++;
      selectedForMuscle++;
    }
  });

  if (finalSetlist.length < totalExercises) {
    let fillerPool = availablePool.filter(e => !finalSetlist.some(f => f.id === e.id));
    fillerPool.sort(() => Math.random() - 0.5);

    for (let candidate of fillerPool) {
      if (finalSetlist.length >= totalExercises) break;

      if (candidate.hasAxialLoad && axialLoadCount >= MAX_AXIAL_LOAD) continue;

      finalSetlist.push(candidate);
      if (candidate.hasAxialLoad) axialLoadCount++;
    }
  }

  const ISOLATION_ONLY = ["biceps", "triceps", "core"];
  const MUSCLE_HIERARCHY = {
    "legs": 5, "back": 4, "chest": 4, "shoulders": 3, "glutes": 3, "biceps": 2, "triceps": 2, "core": 1
  };

  finalSetlist.sort((a, b) => {
    let isA_Iso = ISOLATION_ONLY.includes(a.mainMuscle);
    let isB_Iso = ISOLATION_ONLY.includes(b.mainMuscle);

    if (isA_Iso !== isB_Iso) return isA_Iso ? 1 : -1;

    let mechanicA = a.target === "compound" ? 2 : 1;
    let mechanicB = b.target === "compound" ? 2 : 1;
    if (mechanicA !== mechanicB) return mechanicB - mechanicA;

    let weightA = MUSCLE_HIERARCHY[a.mainMuscle] || 0;
    let weightB = MUSCLE_HIERARCHY[b.mainMuscle] || 0;
    return weightB - weightA;
  });

  return finalSetlist;
}
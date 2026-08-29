const muscleHierarchy = {
  "legs": 5,
  "back": 4,
  "chest": 4,
  "shoulders": 3,
  "glutes": 3,
  "biceps": 2,
  "triceps": 2,
  "core": 1
};

const maxExercisesPerMuscle = {
  "core": 3,
  "biceps": 3,
  "triceps": 3,
  "shoulders": 4,
  "glutes": 4,
  "chest": 5,
  "back": 5,
  "legs": 6
};

export function generateSmartRoutine(optimizedDataset, userPreferences) {
  const { muscles, equipment, totalExercises } = userPreferences;

  let availablePool = optimizedDataset.filter(exercise =>
    muscles.includes(exercise.mainMuscle) &&
    equipment.includes(exercise.equipment)
  );

  if (availablePool.length === 0) return [];

  let finalSetlist = [];
  let exerciseCount = {};

  muscles.forEach(m => exerciseCount[m] = 0);

  muscles.forEach(muscle => {
    let muscleExercises = availablePool.filter(e => e.mainMuscle === muscle);
    muscleExercises.sort(() => Math.random() - 0.5);

    if (muscleExercises.length > 0 && finalSetlist.length < totalExercises) {
      let chosen = muscleExercises.shift();
      exerciseCount[muscle]++;
      finalSetlist.push(chosen);
    }
  });

  let remainingSlots = totalExercises - finalSetlist.length;

  if (remainingSlots > 0) {
    let weightedPool = [];
    muscles.forEach(muscle => {
      let weight = muscleHierarchy[muscle] || 1;
      for (let i = 0; i < weight; i++) {
        weightedPool.push(muscle);
      }
    });

    while (remainingSlots > 0 && availablePool.length > finalSetlist.length) {
      let validWeightedPool = weightedPool.filter(muscle => {
        let currentCount = exerciseCount[muscle] || 0;
        let limit = maxExercisesPerMuscle[muscle] || totalExercises;
        let hasMoreExercises = availablePool.some(e => e.mainMuscle === muscle && !finalSetlist.some(f => f.id === e.id));

        return currentCount < limit && hasMoreExercises;
      });

      if (validWeightedPool.length === 0) break;

      let targetMuscle = validWeightedPool[Math.floor(Math.random() * validWeightedPool.length)];

      let candidates = availablePool.filter(e =>
        e.mainMuscle === targetMuscle &&
        !finalSetlist.some(f => f.id === e.id)
      );

      if (candidates.length > 0) {
        candidates.sort((a, b) => (b.target === "compound" ? 1 : 0) - (a.target === "compound" ? 1 : 0));

        let chosen = candidates[0];
        finalSetlist.push(chosen);
        exerciseCount[targetMuscle]++;
        remainingSlots--;
      }
    }
  }

  if (finalSetlist.length < totalExercises) {
    let absoluteRemaining = availablePool.filter(e => !finalSetlist.some(f => f.id === e.id));
    absoluteRemaining.sort(() => Math.random() - 0.5);

    let filler = absoluteRemaining.slice(0, totalExercises - finalSetlist.length);
    finalSetlist = [...finalSetlist, ...filler];
  }

  finalSetlist.sort((a, b) => {
    let weightA = muscleHierarchy[a.mainMuscle] || 0;
    let weightB = muscleHierarchy[b.mainMuscle] || 0;

    if (weightA !== weightB) {
      return weightB - weightA;
    }

    let isCompoundA = a.target === "compound" ? 1 : 0;
    let isCompoundB = b.target === "compound" ? 1 : 0;

    return isCompoundB - isCompoundA;
  });

  return finalSetlist;
}
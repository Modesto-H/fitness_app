import { generateSmartRoutine } from './routineEngine.js';

const ROUTINE_KEY = 'currentRoutine';
const PREFS_KEY = 'userPreferences';
const ALL_EQUIPMENT = ['dumbbell', 'barbell', 'cable'];

let globalDataset = [];
let userPreferences = {
  muscles: [],
  equipment: [...ALL_EQUIPMENT],
  totalExercises: 6
};

let muscleEquipmentMap = {};
let currentRoutine = [];
let currentIndexToSwap = null;
let selectedAlternative = null;
let currentAlternativesList = [];
let toastTimeout = null;

async function initApp() {
  try {
    const response = await fetch('exercises.json');
    globalDataset = await response.json();

    buildEquipmentMap();

    const savedPrefs = localStorage.getItem(PREFS_KEY);
    if (savedPrefs) {
      try {
        userPreferences = JSON.parse(savedPrefs);
      } catch (e) {
        console.warn("Error leyendo preferencias guardadas", e);
      }
    }

    const savedRoutineIds = localStorage.getItem(ROUTINE_KEY);

    if (savedRoutineIds) {
      try {
        const routineIds = JSON.parse(savedRoutineIds);

        if (!Array.isArray(routineIds) || routineIds.length === 0) {
          throw new Error("IDs inválidos");
        }

        currentRoutine = routineIds.map(id => globalDataset.find(ex => ex.id === id)).filter(Boolean);

        if (currentRoutine.length !== routineIds.length) {
          throw new Error("Algunos IDs ya no existen en el dataset");
        }

        if (!savedPrefs) {
          userPreferences = {
            muscles: [...new Set(currentRoutine.map(ex => ex.mainMuscle))],
            equipment: [...new Set(currentRoutine.map(ex => ex.equipment))],
            totalExercises: currentRoutine.length
          };
        }

        renderSetlist(currentRoutine);

      } catch (error) {
        console.warn("IDs almacenados corruptos o desactualizados, reiniciando...", error);
        localStorage.removeItem(ROUTINE_KEY);
      }
    }

    restorePreferencesUI();

  } catch (error) {
    console.error("Error loading dataset:", error);
  }
}

function buildEquipmentMap() {
  globalDataset.forEach(ex => {
    const muscle = ex.mainMuscle;
    const eq = ex.equipment;

    if (!muscleEquipmentMap[muscle]) {
      muscleEquipmentMap[muscle] = new Set();
    }
    muscleEquipmentMap[muscle].add(eq);
  });
}

function savePreferences() {
  localStorage.setItem(PREFS_KEY, JSON.stringify(userPreferences));
}

function restorePreferencesUI() {
  document.querySelectorAll('#grid-muscles .btn-option, #grid-equipment .btn-option').forEach(btn => {
    btn.classList.remove('active');
  });

  userPreferences.muscles.forEach(m => {
    const btn = document.querySelector(`#grid-muscles [data-muscle="${m}"]`);
    if (btn) btn.classList.add('active');
  });

  updateEquipmentAvailability();

  userPreferences.equipment.forEach(e => {
    const btn = document.querySelector(`#grid-equipment [data-equipment="${e}"]`);
    if (btn) btn.classList.add('active');
  });

  document.querySelectorAll('.btn-num').forEach(btn => btn.classList.remove('active'));
  const numBtn = document.querySelector(`.btn-num[data-num="${userPreferences.totalExercises}"]`);
  if (numBtn) {
    numBtn.classList.add('active');
    document.getElementById('txt-total').innerText = String(userPreferences.totalExercises).padStart(2, '0');
  }
}

function resetPreferencesUI() {
  localStorage.removeItem(ROUTINE_KEY);
  localStorage.removeItem(PREFS_KEY);

  userPreferences = {
    muscles: [],
    equipment: [...ALL_EQUIPMENT],
    totalExercises: 6
  };
  currentRoutine = [];

  restorePreferencesUI();
}

function updateEquipmentAvailability() {
  if (userPreferences.muscles.length === 0) {
    document.querySelectorAll('#grid-equipment .btn-option').forEach(btn => {
      btn.disabled = false;
    });
    return;
  }

  const equiposDisponibles = new Set();
  userPreferences.muscles.forEach(muscle => {
    if (muscleEquipmentMap[muscle]) {
      muscleEquipmentMap[muscle].forEach(eq => equiposDisponibles.add(eq));
    }
  });

  document.querySelectorAll('#grid-equipment .btn-option').forEach(btn => {
    const eq = btn.dataset.equipment;

    if (equiposDisponibles.has(eq)) {
      btn.disabled = false;
    } else {
      btn.disabled = true;

      if (userPreferences.equipment.includes(eq)) {
        btn.classList.remove('active');
        userPreferences.equipment = userPreferences.equipment.filter(e => e !== eq);
      }
    }
  });
}

function showToast(message, duration = 3500) {
  const toast = document.getElementById('toast-container');
  toast.innerText = message;
  toast.classList.remove('hidden');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

document.querySelectorAll('#grid-muscles .btn-option').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    const muscle = btn.dataset.muscle;
    if (userPreferences.muscles.includes(muscle)) {
      userPreferences.muscles = userPreferences.muscles.filter(m => m !== muscle);
    } else {
      userPreferences.muscles.push(muscle);
    }

    updateEquipmentAvailability();
    savePreferences();
  });
});

document.querySelectorAll('#grid-equipment .btn-option').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;

    btn.classList.toggle('active');
    const eq = btn.dataset.equipment;
    if (userPreferences.equipment.includes(eq)) {
      userPreferences.equipment = userPreferences.equipment.filter(e => e !== eq);
    } else {
      userPreferences.equipment.push(eq);
    }

    savePreferences();
  });
});

document.querySelectorAll('.btn-num').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.btn-num.active')?.classList.remove('active');
    btn.classList.add('active');
    userPreferences.totalExercises = parseInt(btn.dataset.num);
    document.getElementById('txt-total').innerText = btn.dataset.num.padStart(2, '0');

    savePreferences();
  });
});

document.getElementById('btn-build').addEventListener('click', () => {
  if (userPreferences.muscles.length === 0 || userPreferences.equipment.length === 0) {
    showToast("SELECCIONA AL MENOS UN MÚSCULO Y UN EQUIPAMIENTO");
    return;
  }

  const generatedRoutine = generateSmartRoutine(globalDataset, userPreferences);

  if (generatedRoutine.length === 0) {
    showToast("NO HAY EJERCICIOS DISPONIBLES CON ESOS FILTROS");
    return;
  }

  const routineIds = generatedRoutine.map(ex => ex.id);
  localStorage.setItem(ROUTINE_KEY, JSON.stringify(routineIds));
  savePreferences();

  renderSetlist(generatedRoutine);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const includedMuscles = new Set(generatedRoutine.map(ex => ex.mainMuscle));
  const missingMuscles = userPreferences.muscles.filter(m => !includedMuscles.has(m));

  const muscleCounts = {};
  generatedRoutine.forEach(ex => {
    muscleCounts[ex.mainMuscle] = (muscleCounts[ex.mainMuscle] || 0) + 1;
  });

  let warningMessage = null;

  if (missingMuscles.length > 0) {
    const translatedMissing = missingMuscles.map(translateMuscle).join(', ');
    warningMessage = `⚠️ AVISO: NO HAY EJERCICIOS DE (${translatedMissing}) CON EL EQUIPO SELECCIONADO.`;
  }

  const heavyGripCount = generatedRoutine.filter(ex =>
    (ex.mainMuscle === 'back' || ex.movementPattern === 'hip_dominant') &&
    (ex.equipment === 'barbell' || ex.equipment === 'dumbbell')
  ).length;

  if (warningMessage) {
    showToast(warningMessage, 4000);
    if (heavyGripCount >= 3) {
      setTimeout(() => {
        showToast("💡 CONSEJO: ALTA FATIGA DE AGARRE. USA STRAPS SI FALLAN TUS ANTEBRAZOS.", 4500);
      }, 4200);
    }
  } else if (heavyGripCount >= 3) {
    showToast("💡 CONSEJO: ALTA FATIGA DE AGARRE. USA STRAPS SI FALLAN TUS ANTEBRAZOS.", 4500);
  }
});

function renderSetlist(exercises) {
  currentRoutine = exercises;
  const gridContainer = document.getElementById('grid-cards');
  gridContainer.innerHTML = '';

  if (exercises.length === 0) {
    gridContainer.innerHTML = `<p style="font-weight: 800; font-size: 0.9rem; grid-column: 1/-1; text-align: center; padding: 2rem;">No se encontraron ejercicios que coincidan con esta combinación.</p>`;
  } else {
    exercises.forEach((ex, index) => {
      const card = document.createElement('div');
      card.className = 'exercise-card';
      card.innerHTML = `
            <div class="card-header-row">
                <span class="order-num">${String(index + 1).padStart(2, '0')}</span>
                <button class="btn-top-swap" data-index="${index}" title="Cambiar ejercicio">&#8644;</button>
            </div>
            <img src="${ex.image}" alt="${ex.name}" loading="lazy">
            <h3>${ex.name}</h3>
            <div class="tags">
                <span class="tag-muscle">${translateMuscle(ex.mainMuscle)}</span>
                <span class="tag-equipment">${translateEquipment(ex.equipment)}</span>
            </div>
            <button class="btn-details" data-id="${ex.id}">VER GUÍA</button>
        `;

      card.querySelector('.btn-details').addEventListener('click', () => openModal(ex.id));
      card.querySelector('.btn-top-swap').addEventListener('click', () => openSwapModal(index));
      gridContainer.appendChild(card);
    });
  }

  document.querySelector('main').classList.add('hidden');
  document.getElementById('setlist-container').classList.remove('hidden');
}

document.getElementById('btn-rebuild').addEventListener('click', () => {
  resetPreferencesUI();

  document.getElementById('setlist-container').classList.add('hidden');
  document.querySelector('main').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function openModal(id) {
  const ex = globalDataset.find(e => e.id === id);
  if (!ex) return;

  document.body.classList.add('modal-open');
  document.getElementById('modal-title').innerText = ex.name;
  document.getElementById('modal-video').src = ex.video;

  const stepsList = document.getElementById('modal-steps');
  stepsList.innerHTML = '';
  ex.steps.forEach(step => {
    let li = document.createElement('li');
    li.innerText = step;
    stepsList.appendChild(li);
  });

  document.getElementById('modal-detail').classList.remove('hidden');
}

document.getElementById('btn-close-modal').addEventListener('click', () => {
  document.body.classList.remove('modal-open');
  document.getElementById('modal-detail').classList.add('hidden');
  document.getElementById('modal-video').src = '';
});

function renderAlternativesList(list) {
  const alternativesContainer = document.getElementById('grid-alternatives');
  alternativesContainer.innerHTML = '';

  if (list.length === 0) {
    alternativesContainer.innerHTML = `<p style="font-size: 0.8rem; font-weight: 700; text-align: center; padding: 1rem;">No hay alternativas disponibles con esta búsqueda o filtros.</p>`;
    return;
  }

  list.forEach(alt => {
    const item = document.createElement('div');
    item.className = 'alternative-item';
    item.innerHTML = `
      <img src="${alt.image}" alt="${alt.name}" loading="lazy">
      <span>${alt.name}</span>
    `;

    item.addEventListener('click', () => {
      document.querySelectorAll('.alternative-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      selectAlternativeForPreview(alt);
    });

    alternativesContainer.appendChild(item);
  });
}

function openSwapModal(index) {
  currentIndexToSwap = index;
  selectedAlternative = null;

  document.body.classList.add('modal-open');
  document.getElementById('btn-confirm-swap').disabled = true;

  const searchInput = document.getElementById('input-search-swap');
  if (searchInput) searchInput.value = '';

  const exerciseToReplace = currentRoutine[index];

  const remainingRoutine = currentRoutine.filter((_, i) => i !== index);
  const currentAxialCount = remainingRoutine.filter(ex => ex.hasAxialLoad).length;
  const maxAxialAllowed = userPreferences.totalExercises <= 6 ? 1 : 2;

  const activePatterns = new Set(remainingRoutine.map(ex => ex.movementPattern));

  currentAlternativesList = globalDataset.filter(ex => {
    const isSameMuscle = ex.mainMuscle === exerciseToReplace.mainMuscle;
    const isAllowedEquipment = userPreferences.equipment.includes(ex.equipment);
    const isNotInCurrentRoutine = !currentRoutine.some(rutinaEx => rutinaEx.id === ex.id);

    if (!isSameMuscle || !isAllowedEquipment || !isNotInCurrentRoutine) return false;

    return !(ex.hasAxialLoad && currentAxialCount >= maxAxialAllowed);
  });

  currentAlternativesList.sort((a, b) => {
    const aUsed = activePatterns.has(a.movementPattern) ? 1 : 0;
    const bUsed = activePatterns.has(b.movementPattern) ? 1 : 0;
    return aUsed - bUsed;
  });

  const previewContainer = document.getElementById('swap-preview');
  previewContainer.innerHTML = `<p class="preview-placeholder">Selecciona un ejercicio para ver la vista previa</p>`;

  renderAlternativesList(currentAlternativesList);

  document.getElementById('modal-swap').classList.remove('hidden');
}

document.getElementById('input-search-swap').addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();

  const filteredList = currentAlternativesList.filter(alt =>
    alt.name.toLowerCase().includes(searchTerm)
  );

  renderAlternativesList(filteredList);
});

function selectAlternativeForPreview(alt) {
  selectedAlternative = alt;
  const previewContainer = document.getElementById('swap-preview');
  previewContainer.innerHTML = `
    <img src="${alt.video}" alt="${alt.name}" loading="lazy">
    <h4>${alt.name.toUpperCase()}</h4>
  `;
  document.getElementById('btn-confirm-swap').disabled = false;
}

document.getElementById('btn-confirm-swap').addEventListener('click', () => {
  if (selectedAlternative) {
    executeSwap(selectedAlternative);
  }
});

document.getElementById('btn-random-swap').addEventListener('click', () => {
  if (currentAlternativesList.length > 0) {
    const activePatterns = new Set(
      currentRoutine.filter((_, i) => i !== currentIndexToSwap).map(ex => ex.movementPattern)
    );

    const optimalAlternatives = currentAlternativesList.filter(alt => !activePatterns.has(alt.movementPattern));

    const poolToPick = optimalAlternatives.length > 0 ? optimalAlternatives : currentAlternativesList;
    const randomIndex = Math.floor(Math.random() * poolToPick.length);

    executeSwap(poolToPick[randomIndex]);
  } else {
    showToast("NO HAY ALTERNATIVAS DISPONIBLES");
  }
});

function executeSwap(newExercise) {
  if (currentIndexToSwap !== null) {
    currentRoutine[currentIndexToSwap] = newExercise;

    const routineIds = currentRoutine.map(ex => ex.id);
    localStorage.setItem(ROUTINE_KEY, JSON.stringify(routineIds));

    renderSetlist(currentRoutine);
    closeSwapModal();
  }
}

function closeSwapModal() {
  document.body.classList.remove('modal-open');
  document.getElementById('modal-swap').classList.add('hidden');
  currentIndexToSwap = null;
  selectedAlternative = null;
}

document.getElementById('btn-close-swap').addEventListener('click', closeSwapModal);

const modalInfo = document.getElementById('modal-info');
const btnOpenInfo = document.getElementById('btn-open-info');
const btnCloseInfo = document.getElementById('btn-close-info');

btnOpenInfo.addEventListener('click', () => {
  modalInfo.classList.remove('hidden');
});

btnCloseInfo.addEventListener('click', () => {
  modalInfo.classList.add('hidden');
});

modalInfo.addEventListener('click', (e) => {
  if (e.target === modalInfo) {
    modalInfo.classList.add('hidden');
  }
});

function translateMuscle(muscle) {
  const translations = {
    'chest': 'PECHO',
    'back': 'ESPALDA',
    'shoulders': 'HOMBROS',
    'biceps': 'BÍCEPS',
    'triceps': 'TRÍCEPS',
    'legs': 'PIERNAS',
    'core': 'ABDOMEN',
    'glutes': 'GLÚTEOS',
    'other': 'OTROS'
  };
  return translations[muscle.toLowerCase()] || muscle.toUpperCase();
}

function translateEquipment(equipment) {
  const translations = {
    'body weight': 'PESO CORPORAL',
    'bodyweight': 'PESO CORPORAL',
    'dumbbell': 'MANCUERNAS',
    'barbell': 'BARRA',
    'cable': 'POLEA',
  };
  return translations[equipment.toLowerCase()] || equipment.toUpperCase();
}

initApp().finally();
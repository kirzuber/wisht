import type { Locale } from './locale.js';
import type { Artifact } from './firstDeed.js';

/** Safe and useful fallback content, never an executed action. English schema keys are stable. */
const worksheets: Record<Locale,Omit<Artifact,'sourceNote'>> = {
  en:{
    title:'First-step worksheet',
    sections:[
      {type:'document',title:'Record a starting point',body:'What I already know: [write only what you know]\nOne option: [write an option, or leave blank]\nWhat to find out first: [write one question]'},
      {type:'questions',title:'Before taking that step',items:['If you listed an option, what would need to be available for it?','Would you need permission? Leave this open if you are unsure.']},
    ],
    unknowns:['What conditions would a first step require?'],
    nextDeed:{title:'Write one question to resolve',why:'The answer can help you decide which step is feasible.',prompt:'Fill in “What to find out first.” Keep anything uncertain as a question.'},
    boundary:'Private worksheet. No external action or verification took place.',
  },
  ru:{
    title:'Рабочий лист для первого шага',
    sections:[
      {type:'document',title:'Запишите отправную точку',body:'Что уже известно: [укажите только то, что знаете]\nВариант: [запишите один вариант или оставьте поле пустым]\nЧто нужно уточнить: [запишите один вопрос]'},
      {type:'questions',title:'Перед первым шагом',items:['Если Вы записали вариант, что для него должно быть доступно?','Нужно ли кому-то дать разрешение? Если не знаете, оставьте вопрос открытым.']},
    ],
    unknowns:['Какие условия нужны для первого шага?'],
    nextDeed:{title:'Запишите один вопрос',why:'Ответ поможет понять, какой шаг возможен.',prompt:'Заполните поле «Что нужно уточнить». Сохраняйте неизвестное как вопрос.'},
    boundary:'Личный рабочий лист. Никаких внешних действий или проверок не было.',
  },
  fr:{
    title:'Fiche pour un premier pas',
    sections:[
      {type:'document',title:'Définir le point de départ',body:'Ce que je sais déjà : [notez seulement les faits connus]\nUne possibilité : [notez une option ou laissez vide]\nCe que je dois vérifier : [notez une question]'},
      {type:'questions',title:'Avant de commencer',items:['Si vous avez choisi une option, quelles ressources seraient nécessaires ?','Faut-il une autorisation ? Laissez cette question ouverte si vous ne savez pas.']},
    ],
    unknowns:['Quelles conditions seraient nécessaires pour commencer ?'],
    nextDeed:{title:'Noter une question à résoudre',why:'La réponse aidera à choisir une première étape réaliste.',prompt:'Remplissez le champ « Ce que je dois vérifier » sans inventer de détails.'},
    boundary:'Fiche privée uniquement. Aucune action externe ni vérification n’a été effectuée.',
  },
  es:{
    title:'Hoja de trabajo para empezar',
    sections:[
      {type:'document',title:'Anota el punto de partida',body:'Lo que ya sé: [escribe solo lo que sabes]\nUna posibilidad: [anota una opción o déjalo en blanco]\nQué debo averiguar: [escribe una pregunta]'},
      {type:'questions',title:'Antes de dar el primer paso',items:['Si has anotado una opción, ¿qué tendría que estar disponible?','¿Necesitas algún permiso? Si no lo sabes, deja la pregunta abierta.']},
    ],
    unknowns:['¿Qué condiciones hacen falta para el primer paso?'],
    nextDeed:{title:'Anota una pregunta pendiente',why:'La respuesta te ayudará a decidir qué paso es viable.',prompt:'Rellena «Qué debo averiguar» y mantén las dudas como preguntas.'},
    boundary:'Hoja de trabajo privada. No se ha realizado ninguna acción externa ni verificación.',
  },
};
export function starterWorksheet(sourceNote:string,locale:Locale):Artifact {
  // Clone immutable text before allowing client edits.
  const source=worksheets[locale];
  return {...structuredClone(source),sourceNote};
}

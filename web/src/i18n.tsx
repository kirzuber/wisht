import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { intlLocales, localeLabels, normalizeLocale, supportedLocales, type Locale } from '../../api/src/locale';

export { intlLocales, localeLabels, supportedLocales };
export type { Locale };

const KEY = 'wisht:ui-language:v1';
const translations: Record<string,readonly [string,string,string]> = {
  // Navigation and guest / adaptive home
  'Jinn home':['Главная Jinn','Accueil Jinn','Inicio de Jinn'],
  'Language':['Язык','Langue','Idioma'],
  'My Jinns':['Мои джинны','Mes Jinns','Mis Jinns'],
  'Manage Jinns':['Управлять джиннами','Gérer les Jinns','Gestionar Jinns'],
  'Manage':['Управлять','Gérer','Gestionar'],
  'Sign in':['Войти','Se connecter','Iniciar sesión'],
  'Sign out':['Выйти','Se déconnecter','Cerrar sesión'],
  'YOUR WISH STARTS HERE':['ВАШЕ ЖЕЛАНИЕ НАЧИНАЕТСЯ ЗДЕСЬ','VOTRE SOUHAIT COMMENCE ICI','TU DESEO EMPIEZA AQUÍ'],
  'What would you':['Что бы вы','Que souhaitez-vous','¿Qué te gustaría'],
  'like to do?':['хотели сделать?','faire ?','hacer?'],
  'Tell {name} what matters to you. We’ll find one useful first step together.':['Расскажите {name}, что для вас важно. Вместе найдём первый полезный шаг.','Dites à {name} ce qui compte pour vous. Nous trouverons ensemble une première étape utile.','Cuenta a {name} lo que te importa. Encontraremos juntos un primer paso útil.'],
  'Opening your companions…':['Открываем ваших джиннов…','Chargement de vos Jinns…','Cargando tus Jinns…'],
  'Could not load your companions.':['Не удалось загрузить джиннов.','Impossible de charger vos Jinns.','No se han podido cargar tus Jinns.'],
  'Your Wish has not been assigned.':['Желание ещё не назначено.','Votre souhait n’a pas été attribué.','Tu deseo aún no se ha asignado.'],
  'Retry loading Jinns':['Повторить загрузку','Réessayer le chargement','Volver a cargar los Jinns'],
  'Current Wish companion':['Джинн этого желания','Jinn de ce souhait','Jinn de este deseo'],
  'MAKE THIS WISH WITH':['ПОМОЖЕТ С ЭТИМ ЖЕЛАНИЕМ','CRÉER CE SOUHAIT AVEC','CREAR ESTE DESEO CON'],
  'Choose your Jinn':['Выберите джинна','Choisissez votre Jinn','Elige tu Jinn'],
  'Default':['По умолчанию','Par défaut','Predeterminado'],
  'The selected Jinn helps with this Wish. Your work stays in your account and this Wish keeps its own context.':['Выбранный джинн помогает с этим желанием. Работа остаётся в вашем аккаунте, а контекст — у самого желания.','Le Jinn choisi vous aide avec ce souhait. Votre travail reste dans votre compte et ce souhait garde son propre contexte.','El Jinn elegido te ayuda con este deseo. Tu trabajo permanece en tu cuenta y el deseo conserva su propio contexto.'],
  'Wish with {name}':['Желание с {name}','Souhait avec {name}','Deseo con {name}'],
  '{name} is helping with this Wish.':['С этим желанием помогает {name}.','{name} vous accompagne pour ce souhait.','{name} te ayuda con este deseo.'],
  'Your previously selected Jinn is no longer available for this account. No Wish has been reassigned.':['Ранее выбранный джинн больше недоступен в этом аккаунте. Желание не переназначено.','Le Jinn précédemment choisi n’est plus disponible pour ce compte. Aucun souhait n’a été réattribué.','El Jinn que elegiste ya no está disponible en esta cuenta. No se ha reasignado ningún deseo.'],
  'Choose my default Jinn':['Выбрать джинна по умолчанию','Choisir mon Jinn par défaut','Elegir mi Jinn predeterminado'],
  'Open My Jinns':['Открыть моих джиннов','Ouvrir Mes Jinns','Abrir Mis Jinns'],
  'YOUR WISH':['ВАШЕ ЖЕЛАНИЕ','VOTRE SOUHAIT','TU DESEO'],
  'I want to…':['Я хочу…','Je voudrais…','Quiero…'],
  'Continue with {name}':['Продолжить с {name}','Continuer avec {name}','Continuar con {name}'],
  'A few places to begin':['С чего можно начать','Quelques idées pour commencer','Algunas ideas para empezar'],
  'I want to make a family story book':['Я хочу написать книгу семейных историй','Je voudrais créer un livre d’histoires familiales','Quiero escribir un libro de historias familiares'],
  'I want to start a garden':['Я хочу разбить сад','Je voudrais créer un jardin','Quiero empezar un jardín'],
  'I want to learn a new skill':['Я хочу освоить новый навык','Je voudrais apprendre une nouvelle compétence','Quiero aprender una habilidad nueva'],
  'You control this Wish. Saving keeps it in your account; AI only prepares a draft.':['Это ваше желание. При сохранении оно останется в вашем аккаунте; ИИ лишь подготовит черновик.','Vous gardez le contrôle de ce souhait. Il sera enregistré dans votre compte ; l’IA prépare seulement un brouillon.','Este deseo está bajo tu control. Al guardarlo, permanece en tu cuenta; la IA solo prepara un borrador.'],
  'Start without signing in. Your wish is sent to AI to prepare a private draft.':['Начните без входа. Ваше желание будет отправлено ИИ для подготовки личного черновика.','Commencez sans vous connecter. Votre souhait est envoyé à l’IA pour préparer un brouillon privé.','Empieza sin iniciar sesión. Tu deseo se envía a la IA para preparar un borrador privado.'],
  'One wish.':['Одно желание.','Un souhait.','Un deseo.'],
  'One meaningful start.':['Один важный первый шаг.','Un premier pas qui compte.','Un primer paso con sentido.'],
  '{name} helps you shape a first Deed you can inspect, edit, and keep.':['{name} поможет подготовить первый шаг, который можно проверить, изменить и сохранить.','{name} vous aide à préparer un premier acte à consulter, modifier et conserver.','{name} te ayuda a preparar una primera acción que puedes revisar, editar y guardar.'],
  'Your wish':['Желание','Votre souhait','Tu deseo'],
  'One question':['Один вопрос','Une question','Una pregunta'],
  'First Deed':['Первый шаг','Premier acte','Primera acción'],
  'Your wishes. Real work.':['Ваши желания. Реальная работа.','Vos souhaits. Du concret.','Tus deseos. Trabajo real.'],
  'This shared page has been retired.':['Эта общая страница больше недоступна.','Cette page partagée n’est plus disponible.','Esta página compartida ya no está disponible.'],
  'Jinn now works with private Wishes and editable Deeds.':['Теперь Jinn работает с личными желаниями и редактируемыми шагами.','Jinn fonctionne désormais avec des souhaits privés et des actes modifiables.','Jinn ahora trabaja con deseos privados y acciones editables.'],
  'Start a wish':['Начать желание','Commencer un souhait','Empezar un deseo'],

  // Auth
  'Your draft is ready to keep.':['Ваш черновик готов к сохранению.','Votre brouillon est prêt à être conservé.','Tu borrador está listo para guardarlo.'],
  'Your Jinns and saved wishes are here.':['Здесь ваши джинны и сохранённые желания.','Vos Jinns et souhaits enregistrés sont ici.','Aquí están tus Jinns y deseos guardados.'],
  'ONE QUICK THING':['ЕЩЁ ОДИН МОМЕНТ','UNE PETITE CHOSE','UNA COSA MÁS'],
  "Let's make this":['Давайте сделаем это','À présent, c’est','Vamos a hacerlo'],
  'yours.':['вашим.','à vous.','tuyo.'],
  'Verify your email so you can return to the work later.':['Подтвердите почту, чтобы позже вернуться к работе.','Confirmez votre adresse e-mail pour reprendre plus tard.','Verifica tu correo para poder volver más adelante.'],
  'YOUR EMAIL':['ВАША ПОЧТА','VOTRE ADRESSE E-MAIL','TU CORREO'],
  'Sending…':['Отправляем…','Envoi en cours…','Enviando…'],
  'Send a sign-in code':['Отправить код для входа','Envoyer un code de connexion','Enviar código de acceso'],
  'Open the':['Откройте','Ouvrez','Abre'],
  'local inbox (Mailpit)':['локальную почту (Mailpit)','la boîte locale (Mailpit)','la bandeja local (Mailpit)'],
  'for the code addressed to {email}.':['для получения кода на адрес {email}.','pour le code envoyé à {email}.','para ver el código enviado a {email}.'],
  'Check {email} for your sign-in code.':['Проверьте код для входа в почте {email}.','Consultez le code de connexion envoyé à {email}.','Consulta el código de acceso enviado a {email}.'],
  'VERIFICATION CODE':['КОД ПОДТВЕРЖДЕНИЯ','CODE DE VÉRIFICATION','CÓDIGO DE VERIFICACIÓN'],
  'Enter the code from Mailpit':['Введите код из Mailpit','Saisissez le code de Mailpit','Introduce el código de Mailpit'],
  'Enter the code from your email':['Введите код из письма','Saisissez le code reçu par e-mail','Introduce el código de tu correo'],
  'Verifying…':['Проверяем…','Vérification…','Verificando…'],
  'Verify and continue':['Подтвердить и продолжить','Vérifier et continuer','Verificar y continuar'],
  'Requesting…':['Запрашиваем…','Demande en cours…','Solicitando…'],
  'Request a new code':['Запросить новый код','Demander un nouveau code','Solicitar otro código'],
  'Use another email':['Указать другой адрес','Utiliser une autre adresse e-mail','Usar otro correo'],
  'No password needed. Your work is saved only after verification.':['Пароль не нужен. Работа сохранится только после подтверждения.','Aucun mot de passe requis. Votre travail est enregistré après vérification.','No necesitas contraseña. Tu trabajo se guarda después de verificar el correo.'],
  'Not now — keep exploring':['Не сейчас — продолжить','Pas maintenant — continuer à explorer','Ahora no, seguir explorando'],

  // My Jinns
  'YOUR COMPANIONS':['ВАШИ ДЖИННЫ','VOS COMPAGNONS','TUS COMPAÑEROS'],
  'My':['Мои','Mes','Mis'],
  'Jinns.':['джинны.','Jinns.','Jinns.'],
  'Each Jinn helps with assigned Wishes. Your Wishes stay in your account and keep separate context.':['Каждый джинн помогает с назначенными ему желаниями. Желания остаются в вашем аккаунте, а их контексты не смешиваются.','Chaque Jinn aide avec les souhaits qui lui sont attribués. Vos souhaits restent dans votre compte, avec des contextes distincts.','Cada Jinn ayuda con los deseos que tiene asignados. Tus deseos permanecen en tu cuenta, con contextos separados.'],
  'Signed in as {email}':['Вы вошли как {email}','Connecté avec {email}','Sesión iniciada como {email}'],
  'Retry':['Повторить','Réessayer','Reintentar'],
  'Opening your Jinns and Wishes…':['Загружаем джиннов и желания…','Chargement de vos Jinns et souhaits…','Cargando tus Jinns y deseos…'],
  'Create Jinn':['Создать джинна','Créer un Jinn','Crear Jinn'],
  'Choose a Jinn':['Выберите джинна','Choisir un Jinn','Elegir un Jinn'],
  'Default Jinn ·':['Джинн по умолчанию ·','Jinn par défaut ·','Jinn predeterminado ·'],
  'Wish':['желание','souhait','deseo'],
  'Wishes':['желаний','souhaits','deseos'],
  'Rename your Jinn':['Переименовать джинна','Renommer votre Jinn','Cambiar el nombre del Jinn'],
  'Jinn name':['Имя джинна','Nom du Jinn','Nombre del Jinn'],
  'A name you recognize':['Узнаваемое имя','Un nom qui vous parle','Un nombre fácil de reconocer'],
  'Purpose note (optional)':['Назначение (необязательно)','Note d’intention (facultative)','Nota de propósito (opcional)'],
  "What you'd like to use this Jinn for":['Для чего вам нужен этот джинн','À quoi servira ce Jinn ?','Para qué quieres usar este Jinn'],
  'This note is descriptive only. It does not change how Jinn drafts or share memories between Wishes.':['Это только описание. Оно не меняет поведение джинна и не объединяет память разных желаний.','Cette note est seulement descriptive : elle ne modifie pas les brouillons ni ne partage la mémoire entre souhaits.','Esta nota solo describe el propósito; no cambia los borradores ni comparte memoria entre deseos.'],
  'Saving…':['Сохраняем…','Enregistrement…','Guardando…'],
  'Save Jinn':['Сохранить джинна','Enregistrer le Jinn','Guardar Jinn'],
  'Cancel':['Отмена','Annuler','Cancelar'],
  'YOUR DEFAULT COMPANION':['ВАШ ДЖИНН ПО УМОЛЧАНИЮ','VOTRE JINN PAR DÉFAUT','TU JINN PREDETERMINADO'],
  'YOUR COMPANION':['ВАШ ДЖИНН','VOTRE JINN','TU JINN'],
  'Ready to help with any Wish.':['Готов помочь с любым желанием.','Prêt à vous aider avec un souhait.','Listo para ayudarte con cualquier deseo.'],
  'Edit Jinn':['Изменить джинна','Modifier le Jinn','Editar Jinn'],
  'Delete empty Jinn':['Удалить пустого джинна','Supprimer ce Jinn vide','Eliminar Jinn vacío'],
  "{name}'s Wishes":['Желания джинна {name}','Souhaits de {name}','Deseos de {name}'],
  'No Wishes with {name} yet. Start one here, or move a saved Wish from another Jinn.':['У {name} пока нет желаний. Начните новое или перенесите сохранённое от другого джинна.','Aucun souhait avec {name} pour le moment. Commencez ici ou déplacez un souhait enregistré.','Todavía no hay deseos con {name}. Empieza uno aquí o mueve uno guardado desde otro Jinn.'],
  'PRIVATE WISH':['ЛИЧНОЕ ЖЕЛАНИЕ','SOUHAIT PRIVÉ','DESEO PRIVADO'],
  'ACTIVE':['АКТИВНО','ACTIF','ACTIVO'],
  'Updated {date}':['Обновлено {date}','Mis à jour le {date}','Actualizado el {date}'],
  'Switch the Jinn helping with this Wish':['Выбрать другого джинна для желания','Changer le Jinn qui accompagne ce souhait','Cambiar el Jinn que ayuda con este deseo'],
  'Keep with {name}':['Оставить с {name}','Garder avec {name}','Mantener con {name}'],
  'Confirm move Wish':['Подтвердить перенос желания','Confirmer le déplacement du souhait','Confirmar traslado del deseo'],
  'This Jinn will help with this Wish from now on. Your saved work stays with the Wish. Previous Deeds are not reassigned to a different author.':['Теперь этим желанием будет заниматься выбранный джинн. Сохранённая работа останется с желанием. Авторство прошлых шагов не меняется.','Ce Jinn accompagnera désormais ce souhait. Le travail enregistré reste lié au souhait. Les actes antérieurs ne changent pas d’auteur.','Este Jinn ayudará con el deseo a partir de ahora. El trabajo guardado permanece con el deseo. No cambia la autoría de las acciones anteriores.'],
  'Confirm move':['Подтвердить перенос','Confirmer le déplacement','Confirmar traslado'],
  'Deleting…':['Удаляем…','Suppression…','Eliminando…'],
  'Delete Wish':['Удалить желание','Supprimer le souhait','Eliminar deseo'],
  'Start a Wish with {name}':['Начать желание с {name}','Commencer un souhait avec {name}','Empezar un deseo con {name}'],
  '{count} saved Wish(es) reference an unavailable Jinn. No association was changed. Contact support before moving these Wishes.':['{count} сохранённых желаний ссылаются на недоступного джинна. Связи не изменены. Обратитесь в поддержку перед переносом.','{count} souhait(s) enregistrés font référence à un Jinn indisponible. Aucun lien n’a changé. Contactez l’assistance avant de les déplacer.','{count} deseos guardados hacen referencia a un Jinn no disponible. No se han cambiado las asignaciones. Contacta con soporte antes de moverlos.'],
  'Delete {name}? Only an empty Jinn can be deleted. Your other Wishes will stay.':['Удалить {name}? Можно удалить только пустого джинна. Остальные желания сохранятся.','Supprimer {name} ? Seul un Jinn vide peut être supprimé. Vos autres souhaits resteront.','¿Eliminar {name}? Solo se puede eliminar un Jinn vacío. Tus demás deseos permanecerán.'],
  'Delete this wish, its Deeds and artifacts? This cannot be undone.':['Удалить желание, его шаги и документы? Это нельзя отменить.','Supprimer ce souhait, ses actes et ses documents ? Cette action est irréversible.','¿Eliminar este deseo, sus acciones y documentos? No se puede deshacer.'],
  'Could not open My Jinns.':['Не удалось открыть список джиннов.','Impossible d’ouvrir Mes Jinns.','No se han podido abrir Mis Jinns.'],
  'Could not save Jinn.':['Не удалось сохранить джинна.','Impossible d’enregistrer le Jinn.','No se ha podido guardar el Jinn.'],
  'Could not delete Jinn.':['Не удалось удалить джинна.','Impossible de supprimer le Jinn.','No se ha podido eliminar el Jinn.'],
  'Could not move Wish.':['Не удалось перенести желание.','Impossible de déplacer le souhait.','No se ha podido mover el deseo.'],
  'Could not delete Wish.':['Не удалось удалить желание.','Impossible de supprimer le souhait.','No se ha podido eliminar el deseo.'],

  // Wish / Deed workspace
  'Back to wish':['Назад к желанию','Retour au souhait','Volver al deseo'],
  'WISH · FIRST DEED · WORKSPACE':['ЖЕЛАНИЕ · ПЕРВЫЙ ШАГ · РАБОТА','SOUHAIT · PREMIER ACTE · ESPACE DE TRAVAIL','DESEO · PRIMERA ACCIÓN · ESPACIO DE TRABAJO'],
  'Currently assigned to this Wish · Wish-local context':['Сейчас помогает с этим желанием · отдельный контекст','Associé à ce souhait · contexte propre au souhait','Asignado a este deseo · contexto independiente'],
  'Making this Wish with you · Wish-local context':['Помогает с этим желанием · отдельный контекст','Vous accompagne pour ce souhait · contexte privé','Te acompaña con este deseo · contexto privado'],
  'Switch Jinn / My Jinns':['Сменить джинна / Мои джинны','Changer de Jinn / Mes Jinns','Cambiar Jinn / Mis Jinns'],
  'Wish workspace':['Работа с желанием','Espace de travail du souhait','Espacio de trabajo del deseo'],
  'Current wish':['Текущее желание','Souhait actuel','Deseo actual'],
  'Artifacts':['Документы','Documents','Documentos'],
  'Next step':['Следующий шаг','Étape suivante','Siguiente paso'],
  'History':['История','Historique','Historial'],
  'Retry starting wish':['Попробовать снова','Réessayer ce souhait','Reintentar el deseo'],
  'Your Wish is unchanged. You can retry, or go back and add one concrete detail that helps Jinn prepare a grounded first result.':['Ваше желание не изменилось. Попробуйте ещё раз или вернитесь и добавьте одну конкретную деталь, чтобы Jinn смог подготовить обоснованный первый результат.','Votre souhait est inchangé. Réessayez ou revenez ajouter un détail concret pour aider Jinn à préparer un premier résultat fiable.','Tu deseo no ha cambiado. Vuelve a intentarlo o regresa y añade un detalle concreto para que Jinn prepare un primer resultado fundamentado.'],
  '{name}’s starting point':['Первый шаг с {name}','Le point de départ de {name}','El punto de partida de {name}'],
  'We can start with what you shared. I’ll prepare one useful first step.':['Можно начать с того, что вы рассказали. Я подготовлю один полезный первый шаг.','Nous pouvons commencer avec ce que vous avez partagé. Je vais préparer une première étape utile.','Podemos empezar con lo que me has contado. Prepararé un primer paso útil.'],
  'Prepare my first deed':['Подготовить первый шаг','Préparer mon premier acte','Preparar mi primera acción'],
  'A question from {name}':['Вопрос от {name}','Une question de {name}','Una pregunta de {name}'],
  'A few words are enough':['Достаточно нескольких слов','Quelques mots suffisent','Bastan unas palabras'],
  'I’m not sure':['Я не знаю','Je ne sais pas','No estoy seguro'],
  '{name} is with you':['{name} рядом','{name} est avec vous','{name} está contigo'],
  'Welcome back. Opening your saved work…':['С возвращением. Открываем сохранённую работу…','Bon retour. Ouverture de votre travail…','Te damos la bienvenida. Abriendo tu trabajo guardado…'],
  'Preparing your first Deed…':['Готовим первый шаг…','Préparation de votre premier acte…','Preparando tu primera acción…'],
  'Finding one good place to start…':['Ищем хороший первый шаг…','Nous cherchons par où commencer…','Buscando un buen punto de partida…'],
  'WELCOME BACK':['С ВОЗВРАЩЕНИЕМ','HEUREUX DE VOUS REVOIR','TE DAMOS LA BIENVENIDA'],
  'YOUR FIRST DEED':['ВАШ ПЕРВЫЙ ШАГ','VOTRE PREMIER ACTE','TU PRIMERA ACCIÓN'],
  'Continue your wish.':['Продолжим ваше желание.','Poursuivons votre souhait.','Sigamos con tu deseo.'],
  'Your first Deed.':['Ваш первый шаг.','Votre premier acte.','Tu primera acción.'],
  'SAVED WISH':['ЖЕЛАНИЕ СОХРАНЕНО','SOUHAIT ENREGISTRÉ','DESEO GUARDADO'],
  'UNSAVED DRAFT':['НЕСОХРАНЁННЫЙ ЧЕРНОВИК','BROUILLON NON ENREGISTRÉ','BORRADOR SIN GUARDAR'],
  'DEED PREPARED':['ШАГ ПОДГОТОВЛЕН','ACTE PRÉPARÉ','ACCIÓN PREPARADA'],
  'Welcome back. Your saved Wish and latest corrections are ready for the next Deed.':['С возвращением. Ваше сохранённое желание и последние исправления готовы для следующего шага.','Bon retour. Votre souhait enregistré et vos dernières corrections sont prêts pour le prochain acte.','Bienvenido de nuevo. Tu deseo guardado y las últimas correcciones están listos para la siguiente acción.'],
  'Your first Deed is ready to inspect and edit.':['Первый шаг готов: его можно проверить и изменить.','Votre premier acte est prêt à être consulté et modifié.','Tu primera acción está lista para revisar y editar.'],
  'DRAFT · EDITABLE':['ЧЕРНОВИК · МОЖНО ИЗМЕНИТЬ','BROUILLON · MODIFIABLE','BORRADOR · EDITABLE'],
  'From you · source note':['ВАШИ СЛОВА · ИСХОДНАЯ ЗАМЕТКА','VOS MOTS · NOTE SOURCE','TUS PALABRAS · NOTA ORIGINAL'],
  'No detail supplied yet. Add or correct your own facts here.':['Пока нет подробностей. Добавьте или исправьте свои сведения.','Aucun détail pour le moment. Ajoutez ou corrigez vos propres informations ici.','Todavía no hay detalles. Añade o corrige tus datos aquí.'],
  'Only this wish uses this note. Your correction takes priority in the next Deed.':['Эта заметка относится только к этому желанию. Следующий шаг учтёт ваши исправления.','Seul ce souhait utilise cette note. Votre correction sera prioritaire pour l’acte suivant.','Solo este deseo usa esta nota. Tu corrección tendrá prioridad en la siguiente acción.'],
  'step':['шаг','étape','paso'],
  'After step {number}':['После шага {number}','Après l’étape {number}','Después del paso {number}'],
  'question':['вопрос','question','pregunta'],
  'Still unknown':['Пока неизвестно','Encore inconnu','Aún no se sabe'],
  'CURRENT WISH':['ТЕКУЩЕЕ ЖЕЛАНИЕ','SOUHAIT ACTUEL','DESEO ACTUAL'],
  'With':['Помогает','Avec','Con'],
  'ONE NEXT DEED':['СЛЕДУЮЩИЙ ШАГ','UN PROCHAIN ACTE','SIGUIENTE ACCIÓN'],
  'HISTORY · WORK RECEIPT':['ИСТОРИЯ · ЗАПИСЬ О РАБОТЕ','HISTORIQUE · TRACE DU TRAVAIL','HISTORIAL · JUSTIFICANTE DEL TRABAJO'],
  'PREPARED':['ПОДГОТОВЛЕНО','PRÉPARÉ','PREPARADO'],
  'Private draft only. Nothing sent, published, or independently fact-checked.':['Личный черновик. Ничего не отправлено, не опубликовано и не проверено во внешних источниках.','Brouillon privé uniquement. Rien n’a été envoyé, publié ni vérifié de manière indépendante.','Solo borrador privado. No se ha enviado, publicado ni verificado nada de forma independiente.'],
  'Earlier Deeds':['Предыдущие шаги','Actes précédents','Acciones anteriores'],
  'Saved privately under your account.':['Сохранено только в вашем аккаунте.','Enregistré en privé dans votre compte.','Guardado de forma privada en tu cuenta.'],
  'This draft is only in this open session until you keep it.':['Черновик останется только в этой сессии, пока вы его не сохраните.','Ce brouillon reste dans cette session jusqu’à son enregistrement.','Este borrador solo permanece en esta sesión hasta que lo guardes.'],
  'No cross-wish memory or external action.':['Нет общей памяти между желаниями и внешних действий.','Aucune mémoire entre souhaits ni action externe.','Sin memoria entre deseos ni acciones externas.'],
  'Jinn will help you continue this Wish. You can name it later.':['Джинн поможет продолжить это желание. Вы сможете дать ему имя позже.','Jinn vous aidera à poursuivre ce souhait. Vous pourrez le nommer plus tard.','Jinn te ayudará a continuar este deseo. Puedes ponerle nombre después.'],
  'Keep this Wish with':['Сохранить желание с','Garder ce souhait avec','Guardar este deseo con'],
  'My default Jinn':['Мой джинн по умолчанию','Mon Jinn par défaut','Mi Jinn predeterminado'],
  'The previously selected Jinn is unavailable for this account. Your draft is safe.':['Ранее выбранный джинн недоступен в этом аккаунте. Черновик не потерян.','Le Jinn précédemment choisi est indisponible pour ce compte. Votre brouillon est préservé.','El Jinn elegido anteriormente no está disponible en esta cuenta. Tu borrador está a salvo.'],
  'Use my default Jinn':['Использовать джинна по умолчанию','Utiliser mon Jinn par défaut','Usar mi Jinn predeterminado'],
  'Working…':['Подождите…','Traitement…','Procesando…'],
  'Save corrections':['Сохранить исправления','Enregistrer les corrections','Guardar correcciones'],
  'Corrections saved':['Исправления сохранены','Corrections enregistrées','Correcciones guardadas'],
  'Keep this wish':['Сохранить желание','Conserver ce souhait','Guardar este deseo'],
  'Prepare next Deed':['Подготовить следующий шаг','Préparer le prochain acte','Preparar la siguiente acción'],
  'Save your corrections before preparing the next Deed.':['Сохраните исправления перед следующим шагом.','Enregistrez vos corrections avant le prochain acte.','Guarda tus correcciones antes de preparar la siguiente acción.'],
  'Delete wish and artifact':['Удалить желание и документ','Supprimer le souhait et le document','Eliminar deseo y documento'],
  'Retry opening wish':['Попробовать открыть снова','Réessayer d’ouvrir le souhait','Reintentar abrir el deseo'],
  'Delete this wish and its first-deed artifact? This cannot be undone.':['Удалить желание и документ первого шага? Это нельзя отменить.','Supprimer ce souhait et son premier document ? Cette action est irréversible.','¿Eliminar este deseo y su primer documento? No se puede deshacer.'],
  'Jinn prepared a starter worksheet. Fill in what you know and leave the rest open.':['Джинн подготовил рабочий лист. Запишите известное, остальное оставьте открытым.','Jinn a préparé une fiche de départ. Indiquez ce que vous savez et laissez le reste ouvert.','Jinn ha preparado una hoja inicial. Anota lo que sabes y deja el resto abierto.'],
  'AI revised the draft and checked it against your supplied facts.':['ИИ исправил черновик и проверил его по предоставленным вами сведениям.','L’IA a révisé le brouillon et vérifié les faits fournis.','La IA ha revisado el borrador y lo ha comprobado con los datos que aportaste.'],
  'AI generated and checked an editable draft against supplied facts':['ИИ подготовил и проверил редактируемый черновик.','L’IA a créé et vérifié un brouillon modifiable selon les faits fournis.','La IA ha generado y comprobado un borrador editable con los datos aportados.'],
  'AI prepared a follow-up draft from the saved, corrected artifact':['ИИ подготовил следующий черновик на основе сохранённых исправлений.','L’IA a préparé une suite à partir du document enregistré et corrigé.','La IA ha preparado un borrador de continuación a partir del documento guardado y corregido.'],

  // F03-004 generative First-Value interface
  'First Deed proposal':['Предложенный первый шаг','Premier acte proposé','Primera acción propuesta'],
  'Prepared First Deed':['ПОДГОТОВЛЕННЫЙ ПЕРВЫЙ ШАГ','PREMIER ACTE PRÉPARÉ','PRIMERA ACCIÓN PREPARADA'],
  'Private preparation only. No external action was performed.':['Только личная подготовка. Никаких внешних действий не было.','Préparation privée uniquement. Aucune action externe n’a été effectuée.','Solo preparación privada. No se ha realizado ninguna acción externa.'],
  'YOUR FIRST ARTIFACT':['ВАШ ПЕРВЫЙ РЕЗУЛЬТАТ','VOTRE PREMIER RÉSULTAT','TU PRIMER RESULTADO'],
  'Edit artifact':['Редактировать результат','Modifier le résultat','Editar resultado'],
  'Finish editing':['Завершить редактирование','Terminer la modification','Terminar de editar'],
  'A working draft you can read and use now. Suggestions are not verified personal facts.':['Готовый черновик, который можно использовать сейчас. Предложения не являются проверенными фактами о вас.','Un brouillon utilisable dès maintenant. Les suggestions ne sont pas des faits personnels vérifiés.','Un borrador que ya puedes utilizar. Las sugerencias no son datos personales verificados.'],
  'Supporting material':['Дополнительные материалы','Compléments','Material de apoyo'],
  'Sources and unknowns':['Источники и неизвестное','Sources et inconnues','Fuentes y datos pendientes'],
  'No personal details supplied.':['Личные сведения не предоставлены.','Aucun détail personnel fourni.','No se han facilitado datos personales.'],
  'No unknowns listed.':['Неизвестные детали не указаны.','Aucune inconnue indiquée.','No se indican datos pendientes.'],
  'Work receipt':['Запись о работе','Compte rendu du travail','Justificante del trabajo'],
  'Other':['Другое','Autre','Otra opción'],
  'Your own answer':['Ваш ответ','Votre réponse','Tu respuesta'],
  'Skip':['Пропустить','Passer','Saltar'],
  'Continue':['Продолжить','Continuer','Continuar'],
  'Suggested next step — not performed yet.':['Предложенный следующий шаг — пока не выполнен.','Prochaine étape suggérée — pas encore effectuée.','Siguiente paso sugerido; aún no se ha realizado.'],
  'PROPOSED FIRST DEED':['ПРЕДЛОЖЕННЫЙ ПЕРВЫЙ ШАГ','PREMIER ACTE PROPOSÉ','PRIMERA ACCIÓN PROPUESTA'],
  'Let Jinn prepare it':['Пусть Jinn подготовит','Laisser Jinn le préparer','Dejar que Jinn lo prepare'],
  'Change the plan':['Изменить план','Modifier le plan','Cambiar el plan'],
  'Choose what fits':['Выберите подходящий вариант','Choisissez une option','Elige una opción'],
  'Based on your Wish':['На основе вашего желания','Basé sur votre souhait','Basado en tu deseo'],
  'AI suggestion · Not verified':['Предложение ИИ · Не проверено','Suggestion de l’IA · Non vérifiée','Sugerencia de IA · Sin verificar'],

  'Preparing something useful for your Wish…':['Готовим полезный результат для вашего желания…','Préparation d’un résultat utile pour votre souhait…','Preparando algo útil para tu deseo…'],
  'The Experience Plan was invalid. Try again.':['План не удалось проверить. Повторите попытку.','Le plan n’a pas pu être validé. Réessayez.','No se ha podido validar el plan. Inténtalo de nuevo.'],
  // Recoverable errors: do not show untranslated provider internals to the user
  'Could not complete that action. Please try again.':['Не удалось выполнить действие. Повторите попытку.','Impossible de terminer cette action. Veuillez réessayer.','No se ha podido completar la acción. Inténtalo de nuevo.'],
  'Could not reach the drafting service. Please try again.':['Не удалось связаться с сервисом подготовки. Повторите попытку.','Le service de rédaction est inaccessible. Veuillez réessayer.','No se puede acceder al servicio de redacción. Inténtalo de nuevo.'],
  'Could not begin.':['Не удалось начать.','Impossible de commencer.','No se ha podido empezar.'],
  'Could not load wish.':['Не удалось загрузить желание.','Impossible de charger le souhait.','No se ha podido cargar el deseo.'],
  'Could not prepare this deed.':['Не удалось подготовить шаг.','Impossible de préparer cet acte.','No se ha podido preparar esta acción.'],
  'Could not save your wish.':['Не удалось сохранить желание.','Impossible d’enregistrer votre souhait.','No se ha podido guardar tu deseo.'],
  'Could not continue this wish.':['Не удалось продолжить желание.','Impossible de poursuivre ce souhait.','No se ha podido continuar el deseo.'],
  'Could not delete this wish.':['Не удалось удалить желание.','Impossible de supprimer ce souhait.','No se ha podido eliminar el deseo.'],
  'Sign in to continue this wish.':['Войдите, чтобы продолжить желание.','Connectez-vous pour poursuivre ce souhait.','Inicia sesión para continuar este deseo.'],
  'Your selected Jinn is unavailable. Choose a Jinn from this account before saving.':['Выбранный джинн недоступен. Выберите джинна из этого аккаунта.','Le Jinn sélectionné est indisponible. Choisissez un Jinn de ce compte avant d’enregistrer.','El Jinn elegido no está disponible. Selecciona uno de esta cuenta antes de guardar.'],
  'This Jinn belongs to a different account. Choose your default Jinn or return to My Jinns.':['Этот джинн принадлежит другому аккаунту. Выберите джинна по умолчанию или вернитесь к списку.','Ce Jinn appartient à un autre compte. Choisissez votre Jinn par défaut ou revenez à Mes Jinns.','Este Jinn pertenece a otra cuenta. Elige tu Jinn predeterminado o vuelve a Mis Jinns.'],
  'Could not send verification email.':['Не удалось отправить письмо с кодом.','Impossible d’envoyer le courriel de vérification.','No se ha podido enviar el correo de verificación.'],
  'Could not verify your code.':['Не удалось проверить код.','Impossible de vérifier votre code.','No se ha podido verificar el código.'],
  'Verify your email to save or open your wishes.':['Подтвердите почту, чтобы сохранять и открывать желания.','Confirmez votre adresse e-mail pour enregistrer et ouvrir vos souhaits.','Verifica tu correo para guardar y abrir tus deseos.'],
};
const index: Record<Locale,number>={en:-1,ru:0,fr:1,es:2};
export function translate(locale: Locale,key: string, params: Record<string,string|number>={}):string {
  const row=translations[key];
  const phrase=(locale==='en'||!row?key:row[index[locale]]);
  return phrase.replace(/\{([a-z]+)\}/gi, (match,name)=>name in params?String(params[name]):match);
}
export function localizeError(error:unknown,locale:Locale,fallback='Could not complete that action. Please try again.'):string{
  const message=error instanceof Error?error.message:'';
  return Object.hasOwn(translations,message)?translate(locale,message):translate(locale,fallback);
}
type LocaleContextValue={locale:Locale;setLocale:(locale:Locale)=>void;t:(key:string,params?:Record<string,string|number>)=>string};
const LocaleContext=createContext<LocaleContextValue|null>(null);
function initialLocale():Locale {
  try {
    const saved=window.localStorage.getItem(KEY);
    if (saved) return normalizeLocale(saved);
    return normalizeLocale(window.navigator.language);
  }catch{return 'en';}
}
export function LocaleProvider({children}:{children:ReactNode}) {
  const [locale,setLocale]=useState<Locale>(initialLocale);
  useEffect(()=>{
    document.documentElement.lang=locale;
    try{window.localStorage.setItem(KEY,locale)}catch{/* Private mode still supports session choices. */}
  },[locale]);
  const value=useMemo<LocaleContextValue>(()=>({locale,setLocale,t:(key,params)=>translate(locale,key,params)}),[locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale():LocaleContextValue {
  const value=useContext(LocaleContext);
  if(!value)throw new Error('LocaleProvider is required for the product UI.');
  return value;
}
/** Count-sensitive nouns; Russian has three plural forms. */
export function wishCountNoun(count:number,locale:Locale):string{
  if(locale!=='ru') return translate(locale,count===1?'Wish':'Wishes');
  const tens=count%100,unit=count%10;
  if(unit===1&&tens!==11)return 'желание';
  if(unit>=2&&unit<=4&&(tens<12||tens>14))return 'желания';
  return 'желаний';
}
export function formatLocalDate(value:string,locale:Locale):string{
  return new Date(value).toLocaleDateString(intlLocales[locale]);
}
export function formatLocalDateTime(value:string,locale:Locale):string{
  return new Date(value).toLocaleString(intlLocales[locale]);
}

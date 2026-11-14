/** JINN-001 capability catalog: descriptions of PLANNED actions, not executed capabilities. */
export type WishKind = 'photography' | 'career' | 'soccer' | 'independence' | 'finance' | 'creative' | 'personal' | 'unsupported';
export type Mission = {
  id: string;
  title: string;
  promise: string;
  question: string;
  choices: { id: string; label: string }[];
  deliverables: string[];
  nextInput: string;
  permission: string;
};
export type Interpretation = {
  kind: WishKind;
  tone: 'warm' | 'playful' | 'discreet';
  reflection: string;
  message: string;
  missions: Mission[];
  supported: boolean;
};

const mission = (id:string, title:string, promise:string, question:string, choices:[string,string][], deliverables:string[], nextInput:string, permission:string='Private preparation only'):Mission => ({
  id,title,promise,question,choices:choices.map(([id,label])=>({id,label})),deliverables,nextInput,permission
});

const catalog:Record<Exclude<WishKind,'unsupported'>, Interpretation> = {
  photography: {
    kind:'photography',tone:'warm',supported:true,
    reflection:'So, you want to make photography part of your life.',
    message:'I can help you show your work, discover real opportunities, or get your first offer ready. Pick the first thing you want me to tackle.',
    missions:[
      mission('build-portfolio','Build my portfolio','Turn your chosen photos into a polished private portfolio preview.', 'Where are your photos now?', [['local','On my device'],['link','In a public online gallery'],['later','I am just getting started']], ['A curated photo selection','An editable private gallery preview'], 'Photo upload or a user-supplied gallery link will be requested when this skill is implemented.'),
      mission('find-photo-opportunities','Find places to show my work','Find relevant public photography opportunities with sources and requirements.', 'What are you most interested in?', [['contest','Competitions and exhibitions'],['community','Local photography communities'],['clients','Paid photography opportunities']], ['Source-verified shortlist','Requirements and next-action checklist'], 'Location and photographic interests may be needed later.'),
      mission('photography-offer','Prepare my first photo offer','Create a simple, usable service offer and public-page draft.', 'What would you like to photograph?', [['portraits','People and portraits'],['events','Events'],['other','Nature, products or other subjects']], ['Editable offer page','Shareable-page preview'], 'Specific offer details or sample photographs will be needed later.')
    ]
  },
  career: {
    kind:'career',tone:'warm',supported:true,
    reflection:'A different career chapter. Let’s make it concrete.',
    message:'I can investigate real opportunities, prepare an application, or keep watch on the jobs you actually want.',
    missions:[
      mission('career-scout','Find my next opportunity','Research verified openings and shortlist relevant matches.', 'Which direction are you going?', [['advance','Grow in my current field'],['change','Switch to a new field'],['explore','I am still exploring']], ['Verified job shortlist','Fit reasoning and next steps'], 'Resume or brief experience summary, location and role interests will be requested during execution.'),
      mission('career-application','Prepare an application','Prepare a tailored resume and letter for a selected verified job.', 'Do you have a resume already?', [['yes','Yes'],['no','Not yet']], ['Editable resume draft','Tailored application draft'], 'A resume or short experience summary and a job description will be needed.'),
      mission('career-watch','Watch for my next role','Set up a bounded public-opening watch and notify on meaningful matches.', 'How would you like to search?', [['remote','Remote opportunities'],['local','Opportunities near me'],['either','Either']], ['10-day job monitoring brief','New-match notifications (opt-in)'], 'Location, career context and notification opt-in will be needed.', 'User consent required for scheduled notifications')
    ]
  },
  soccer: {
    kind:'soccer',tone:'warm',supported:true,
    reflection:'Every football story needs a first pitch. ⚽',
    message:'I can look for legitimate clubs and trials, prepare a practical plan, or watch for relevant sign-up opportunities.',
    missions:[
      mission('find-team','Find my team','Search official clubs and leagues, with registration links where available.', 'Where do you want to start?', [['competitive','Competitive club'],['recreational','Recreational league'],['new','I am a beginner']], ['Verified club shortlist','Official contact or registration links'], 'City or region will be needed; age category only when necessary.'),
      mission('training-plan','Prepare my first practice plan','Create a realistic practice schedule and calendar file.', 'How often can you practice?', [['two','Twice a week'],['three','Three times a week'],['flexible','My schedule varies']], ['Personalized practice calendar file','Progress checklist'], 'Experience and constraints may be needed to personalize.'),
      mission('watch-tryouts','Watch for trials','Monitor selected official tryout/registration sources for a defined period.', 'What are you most interested in?', [['tryouts','Competitive tryouts'],['registration','League registration'],['events','Local soccer events']], ['Verified update alerts','Source links and deadline details'], 'Location and opt-in notification preference will be required.', 'User consent required for scheduled notifications')
    ]
  },
  independence: {
    kind:'independence',tone:'warm',supported:true,
    reflection:'More freedom. That’s a powerful ambition.',
    message:'I can help you prepare a first public offer or investigate realistic opportunities that fit your circumstances.',
    missions:[
      mission('first-offer','Make my first independent offer','Prepare an editable offer and a private landing-page preview.', 'Where would you start?', [['skills','Sell a skill or service'],['product','Create a small product'],['explore','I am still exploring']], ['Editable first offer','Private landing-page preview'], 'A skill, interest or project idea will be needed.'),
      mission('income-scout','Find realistic income opportunities','Research relevant public income opportunities and prepare a comparison.', 'What freedom do you want first?', [['side','Extra income alongside work'],['own','Work for myself'],['flex','More everyday autonomy']], ['Source-verified opportunity list','Actionable comparison'], 'Location, available hours, experience and realistic budget may be requested.'),
      mission('first-presence','Build my first public presence','Create a private personal or business page preview.', 'What should the page represent?', [['me','My skills'],['service','A service I could offer'],['idea','A project idea']], ['Editable private page preview','Publish-ready package, subject to approval'], 'Exact facts and publishing consent are required later.', 'Explicit approval required before publishing')
    ]
  },
  finance: {
    kind:'finance',tone:'warm',supported:true,
    reflection:'You want more financial freedom.',
    message:'I cannot promise wealth or invest on your behalf. I can prepare useful research and practical comparisons instead.',
    missions:[
      mission('financial-options','Explore income paths','Find and compare publicly documented income opportunities that fit your situation.', 'What would help you most?', [['additional','An extra income stream'],['business','Owning a small business'],['planning','Getting a clearer financial picture']], ['Sourced opportunity overview','Assumptions and next steps'], 'Basic goals, location and constraints may be requested; no bank connection is needed.'),
      mission('financial-plan','Map a practical milestone','Create an illustrative income target and progress worksheet.', 'Which milestone matters first?', [['small','My first $500/month'],['medium','$2,000/month'],['unclear','I am not sure yet']], ['Editable milestone worksheet','Clear assumptions'], 'High-level income/spending estimates are optional; no accounts or transactions.')
    ]
  },
  creative: {
    kind:'creative',tone:'playful',supported:true,
    reflection:'An ambitious title. I respect the confidence. 👑',
    message:'Which throne are we talking about? I can make something delightful, or help you pursue real leadership opportunities.',
    missions:[
      mission('royal-creative','Create my royal identity','Make an original fictional proclamation and emblem concept.', 'What kind of kingdom?', [['fantasy','A fantasy kingdom'],['family','Just ruling the family group chat']], ['Creative proclamation','Editable identity brief'], 'A title or style preference may be requested.'),
      mission('leadership-path','Explore real leadership','Find accessible leadership communities or skill-building resources.', 'What kind of leadership?', [['work','Professional'],['community','Community']], ['Resource shortlist','First-action brief'], 'Relevant interests and location may be requested.')
    ]
  },
  personal: {
    kind:'personal',tone:'discreet',supported:true,
    reflection:'I hear you.',
    message:'This can be personal. We can take it at your pace, with nothing shared publicly. What would be most helpful?',
    missions:[
      mission('private-exploration','Create a private space to explore','Prepare a private editable reflection or presentation concept.', 'What feels useful right now?', [['reflect','A private reflection space'],['style','Experimenting with personal style']], ['Private editable document or concept'], 'No identity disclosure or social lookup; only chosen preferences will be used.'),
      mission('private-resources','Find practical resources','Find reputable resources you can review privately.', 'What kind of information?', [['community','Community and support resources'],['practical','Practical information']], ['Source-checked private resource list'], 'Location is optional and requested only if needed; sensitive data is never shared.')
    ]
  }
};

const fallback: Interpretation={
  kind:'unsupported',tone:'warm',supported:false,
  reflection:'That’s an interesting future to imagine.',
  message:'I don’t have a reliable action for that wish yet, and I won’t pretend otherwise. Try one of these supported paths, or come back when I have more magic.',
  missions:[]
};

export function interpretWish(raw: string): Interpretation {
  const s=raw.trim().toLocaleLowerCase('en');
  if(/\b(woman|female|transgender|trans woman|gender identity)\b/.test(s)) return catalog.personal;
  if(/\b(frog|toad)\b/.test(s)) return {
    ...catalog.creative,
    reflection:'A frog? Excellent choice of office location. 🐸',
    message:'I cannot turn anyone into an amphibian, but I can create a playful frog persona or help explore the natural world.',
    missions:[
      mission('frog-persona','Make my frog persona','Create a fun, original amphibian character profile.', 'What sort of frog?', [['hero','A heroic frog'],['chill','A relaxed pond dweller']], ['Original character card','Creative backstory'], 'A name can be added later.'),
      mission('frog-world','Explore the frog world','Collect reliable public sources about frogs, habitats and conservation.', 'What sounds interesting?', [['nature','Wildlife near me'],['learn','Fascinating frog facts']], ['Curated source list','Learning or nature checklist'], 'Optional location if searching nearby.')
    ]
  };
  if(/\b(king|queen|royal|ruler|monarch)\b/.test(s))return catalog.creative;
  if(/photograph|photographer|camera|photos?\b/.test(s)) return catalog.photography;
  if(/\b(soccer|footballer|football player|footy)\b/.test(s))return catalog.soccer;
  if(/\b(career|job|employment|new role|new profession|changing fields|change jobs)\b/.test(s))return catalog.career;
  if(/\b(millionaire|financial|rich|wealth|money)\b/.test(s))return catalog.finance;
  if(/\b(independent|own boss|own business|freelanc|entrepreneu|start a business|self.employ)\b/.test(s))return catalog.independence;
  return fallback;
}
export function supportedExamples() {return ['I want to be a photographer','I want a new career','I want to play soccer','I want to be independent'];}

/** A model may classify an aspiration but may only select server-owned skills. */
export function getInterpretationForKind(kind: WishKind): Interpretation {
  return kind === 'unsupported' ? fallback : catalog[kind];
}

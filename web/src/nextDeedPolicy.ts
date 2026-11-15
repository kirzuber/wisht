/** JINN-UX-03: deterministic continuation from a verified deed, never an invented agent capability. */
export type CompletedDeed='PHOTO_SHORTLIST_SAVED'|'CAREER_SHORTLIST_SAVED'|'SOCCER_SHORTLIST_SAVED'|'PORTFOLIO_PUBLISHED';
export type NextDeedPolicy={mode:'in_app'|'external';title:string;label:string;note:string};
const POLICIES:Record<CompletedDeed,NextDeedPolicy>={
 PHOTO_SHORTLIST_SAVED:{
  mode:'in_app',title:'Want to prepare an entry?',label:'Prepare a submission draft',
  note:'Preparation only. No external submission or eligibility verification.'
 },
 CAREER_SHORTLIST_SAVED:{
  mode:'external',title:'Ready to explore this application?',label:'Open application page',
  note:"You're leaving Jinn. Check the employer's requirements and availability."
 },
 SOCCER_SHORTLIST_SAVED:{
  mode:'external',title:'Want to see how to join?',label:'Open club program',
  note:'Club information only. Current registration status has not been verified.'
 },
 PORTFOLIO_PUBLISHED:{
  mode:'in_app',title:'Want to show your work somewhere new?',label:'Find photography opportunities',
  note:'Public-source search only. Organizer eligibility and rules still need your review.'
 }
};
export function nextDeedFor(deed:CompletedDeed):Readonly<NextDeedPolicy>{
 return POLICIES[deed];
}

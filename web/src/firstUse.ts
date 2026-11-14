/** JINN-UX-01: keep the executable first-use capability boundary explicit.
 * A classified aspiration is not proof that the catalog's planned missions work.
 */
export type FirstUseRoute='portfolio'|'scout'|'career-scout'|'soccer-scout';
const ROUTES:Record<string,FirstUseRoute>={
 'build-portfolio':'portfolio',
 'find-photo-opportunities':'scout',
 'career-scout':'career-scout',
 'find-team':'soccer-scout'
};
export function firstUseRoute(missionId:string):FirstUseRoute|null {
 return ROUTES[missionId]??null;
}
export function executableMissions<T extends {id:string}>(missions:readonly T[]):T[]{
 return missions.filter(m=>firstUseRoute(m.id)!==null);
}
/** Only auto-enter an executable mission when there is an unambiguous single choice.
 * Gallery creation still requires user-initiated authentication, so don't auto-open it.
 */
export function autoStartMission<T extends {id:string}>(missions:readonly T[]):T|null{
 const available=executableMissions(missions);
 return available.length===1&&available[0].id!=='build-portfolio'?available[0]:null;
}

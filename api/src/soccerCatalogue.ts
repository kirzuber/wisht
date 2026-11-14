/** JINN-004.2: bounded Ontario pilot. Curated, first-party club evidence, NOT a live directory.
 * Verified on 2026-11-14; check external sources before registration.
 */
export type SoccerLevel='beginner'|'recreational'|'competitive';
export type SoccerAge='adult'|'youth';
export type SoccerInput={city:string;level:SoccerLevel;ageGroup:SoccerAge};
export type SoccerClub={
 id:string;name:string;city:string;region:string;level:SoccerLevel[];
 ageGroups:SoccerAge[];sourceUrl:string;programUrl:string;programNote:string;
 evidence:'program_documented';verifiedAt:string;
};
export type SoccerResult={
 source:'curated_ontario_clubs_v1';checkedAt:string;city:string;level:SoccerLevel;
 ageGroup:SoccerAge;clubs:SoccerClub[];coverage:string;evidenceScope:string;
};
const VERIFIED='2026-11-14';
export const DIRECTORY_URL='https://canadasoccer.com/clubs/club-directory/';
const entry=(id:string,name:string,city:string,region:string,level:SoccerLevel[],ageGroups:SoccerAge[],programUrl:string,programNote:string,sourceUrl=programUrl):SoccerClub=>({
 id,name,city,region,level,ageGroups,sourceUrl,programUrl,programNote,
 evidence:'program_documented',verifiedAt:VERIFIED
});
/** This list is intentionally tiny; unsupported cities must NOT appear to be exhaustive. */
export const VERIFIED_CLUBS:readonly SoccerClub[]=[
 entry('burlington-soccer','Burlington Soccer Club','Burlington','Halton',['beginner','recreational','competitive'],['adult','youth'],
  'https://burlingtonsoccer.com/youth/','Official youth house-league programs and development routes.','https://burlingtonsoccer.com/'),
 entry('oakville-soccer','Oakville Soccer Club','Oakville','Halton',['beginner','recreational','competitive'],['youth'],
  'https://www.oakvillesoccer.ca/home/','Official club describes youth house league and competitive youth pathways.'),
 entry('oakville-adult','Oakville Soccer Club — Adult Leagues','Oakville','Halton',['beginner','recreational'],['adult'],
  'https://www.oakvillesoccer.ca/recreational/','Official club recreational page describes adult league options for ages U19+.','https://www.oakvillesoccer.ca/home/'),
 entry('guelph-soccer','Guelph Soccer','Guelph','Wellington',['beginner','recreational','competitive'],['adult','youth'],
  'https://www.guelphsoccer.ca/recreational-2026','Official club page describes youth house league and adult recreational leagues.','https://www.guelphsoccer.ca/'),
 entry('erin-mills','Erin Mills Soccer Club','Mississauga','Peel',['beginner','recreational','competitive'],['youth'],
  'https://www.erinmillssoccer.com/','Official club lists youth house league and competitive development programs.'),
 entry('erin-mills-adult','Erin Mills Soccer Club — Adult Recreation','Mississauga','Peel',['beginner','recreational'],['adult'],
  'https://www.erinmillssoccer.com/adult-soccer','Official adult recreational league page.','https://www.erinmillssoccer.com/'),
 entry('toronto-high-park','Toronto High Park FC','Toronto','Toronto',['beginner','recreational','competitive'],['adult','youth'],
  'https://thpfc.ca/structure/','Official club describes recreational, competitive and adult programming.','https://thpfc.ca/'),
 entry('ottawa-south','Ottawa South United','Ottawa','Ottawa',['beginner','recreational','competitive'],['adult','youth'],
  'https://www.osu.ca/new-community-recreational/men-s-adult-soccer','Official club describes recreational and competitive adult pathways.','https://www.osu.ca/')
] as const;
const normalize=(city:string)=>city.toLocaleLowerCase('en-CA').replace(/\s+/g,' ').trim();
export function validateSoccerInput(value:unknown):SoccerInput{
 if(!value||typeof value!=='object')throw new Error('Tell me where you would like to play.');
 const input=value as Record<string,unknown>;
 const city=typeof input.city==='string'?input.city.trim():'';
 if(city.length<2||city.length>65||!/^[a-zA-ZÀ-ÿ .'-]+$/.test(city))throw new Error('Enter an Ontario city (letters only, 2–65 characters).');
 if(!['beginner','recreational','competitive'].includes(String(input.level)))throw new Error('Choose your preferred level.');
 if(!['adult','youth'].includes(String(input.ageGroup)))throw new Error('Choose adult or youth programs.');
 return {city,level:input.level as SoccerLevel,ageGroup:input.ageGroup as SoccerAge};
}
export function findSoccerClubs(input:SoccerInput,now=new Date()):SoccerResult{
 const found=VERIFIED_CLUBS.filter(c=>normalize(c.city)===normalize(input.city)
    &&c.ageGroups.includes(input.ageGroup)&&c.level.includes(input.level));
 // One club per city/mode, but keep an adult-v-youth program entry when relevant.
 const unique=[...new Map(found.map(c=>[c.name,c])).values()].slice(0,5);
 return {
  source:'curated_ontario_clubs_v1',checkedAt:now.toISOString(),
  city:input.city,level:input.level,ageGroup:input.ageGroup,clubs:unique,
  coverage:'Small maintained pilot catalogue: Burlington, Oakville, Mississauga, Guelph, Toronto and Ottawa only. Other Ontario towns and nearby clubs are not searched.',
  evidenceScope:'First-party program pages checked on 2026-11-14. This is not a live club or registration search. Club programs can change; available spots, trial dates, registration status, eligibility and prices have NOT been verified. Confirm with the club.'
 };
}

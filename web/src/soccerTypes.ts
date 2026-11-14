export type SoccerLevel='beginner'|'recreational'|'competitive';
export type SoccerAge='adult'|'youth';
export type SoccerClub={
 id:string;name:string;city:string;region:string;
 level:SoccerLevel[];ageGroups:SoccerAge[];sourceUrl:string;programUrl:string;
 programNote:string;evidence:'program_documented';verifiedAt:string;
};
export type SoccerResult={
 source:'curated_ontario_clubs_v1';checkedAt:string;city:string;
 level:SoccerLevel;ageGroup:SoccerAge;clubs:SoccerClub[];coverage:string;evidenceScope:string;
};
export type SoccerSaved={
 id:string;wish_id:string;city:string;level:SoccerLevel;age_group:SoccerAge;
 fetched_at:string;matches:SoccerClub[];created_at:string;
};

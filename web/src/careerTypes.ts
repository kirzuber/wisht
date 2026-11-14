export type CareerCountry='CA'|'US'|'worldwide';
export type CareerJob={
 id:string;title:string;company:string;excerpt:string;description:string;
 sourceUrl:string;applicationLink:string;publishedAt:string;expiresAt:string|null;
 employmentType:string;seniority:string;locations:string[];
 salary:string;fit:'not_assessed'|'promising'|'possible'|'unclear';reason:string;gap:string;
};
export type CareerResult={
 source:'himalayas_jobs';checkedAt:string;query:string;country:CareerCountry;
 jobs:CareerJob[];candidateCount:number;aiUsed:boolean;
 aiStatus:'not_requested'|'completed'|'unavailable';evidenceScope:string;
};
export type CareerSaved={
 id:string;wish_id:string;query:string;country:CareerCountry;fetched_at:string;
 ai_used:boolean;matches:CareerJob[];created_at:string;
};
